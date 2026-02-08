const express = require("express");
const fs = require("fs");
const path = require("path");
const LogWatcher = require("./lib/log-watcher");

const app = express();
const PORT = 3000;

// Le dossier où project-loader sync les projets
// Monté depuis ~/projects-sync sur le VPS vers /data/projects dans le container
const PROJECTS_DIR = "/data/projects";

app.use(express.static("public"));
app.use(express.json());

// Start log watcher
const logWatcher = new LogWatcher(PROJECTS_DIR);
logWatcher.start();

app.get("/api/projects", async (req, res) => {
  try {
    const projects = [];

    if (!fs.existsSync(PROJECTS_DIR)) {
      return res.json([]);
    }

    const dirs = fs.readdirSync(PROJECTS_DIR);

    for (const dir of dirs) {
      const projectPath = path.join(PROJECTS_DIR, dir, ".project");
      const metadataPath = path.join(projectPath, "metadata.json");

      if (fs.existsSync(metadataPath)) {
        try {
          const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
          const workflows = loadWorkflows(PROJECTS_DIR, dir);

          // Nouveau format (avec repos array)
          if (metadata.repos && Array.isArray(metadata.repos)) {
            projects.push({
              id: dir,
              name: metadata.name || dir,
              pitch: metadata.pitch || metadata.description || "",
              type: metadata.type || "fullstack",
              created: metadata.created_at || null,
              updated: metadata.updated_at || metadata.created_at || null,
              version: metadata.version || "1.0.0",
              stack: metadata.stack || [],
              repos: metadata.repos,
              workflows: workflows,
              env: metadata.env || [],
              errorCount: logWatcher.getErrorCount(dir),
            });
          }
          // Ancien format (avec domains object) - conversion automatique
          else {
            projects.push({
              id: dir,
              name: metadata.name || dir,
              pitch: metadata.description || "",
              type: "fullstack",
              created: metadata.created_at || null,
              updated: metadata.created_at || null,
              version: "1.0.0",
              stack: [],
              repos: buildReposFromDomains(metadata, dir),
              workflows: workflows,
              env: [],
              errorCount: logWatcher.getErrorCount(dir),
            });
          }
        } catch (e) {
          console.error("Error reading metadata.json for", dir, e);
        }
      }
    }

    res.json(projects);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal error" });
  }
});

// --- Docker Logs Endpoints ---

// List containers for a project
app.get("/api/projects/:id/containers", async (req, res) => {
  try {
    const containers = await logWatcher.dockerLogs.getContainersByProject(req.params.id);
    res.json(containers);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// SSE stream logs for a specific container
app.get("/api/projects/:id/containers/:name/logs", (req, res) => {
  const containerName = req.params.name;
  const projectId = req.params.id;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  res.write("data: {\"type\":\"connected\"}\n\n");

  const onLog = (data) => {
    if (data.container === containerName) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  const onError = (data) => {
    if (data.project === projectId) {
      res.write(`data: ${JSON.stringify({ ...data, type: "error_detected" })}\n\n`);
    }
  };

  logWatcher.on("log", onLog);
  logWatcher.on("error", onError);

  // If not already watching this container, start streaming
  if (!logWatcher.streams.has(containerName)) {
    logWatcher.dockerLogs.streamLogs(containerName, (line, isStderr) => {
      logWatcher.emit("log", {
        container: containerName,
        project: projectId,
        line,
        isStderr,
        timestamp: Date.now(),
      });
    }, { tail: 100 });
  }

  req.on("close", () => {
    logWatcher.removeListener("log", onLog);
    logWatcher.removeListener("error", onError);
  });
});

// Get recent errors for a project
app.get("/api/projects/:id/errors", (req, res) => {
  const errors = logWatcher.getRecentErrors();
  const count = logWatcher.getErrorCount(req.params.id);
  res.json({ count, errors });
});

// Dismiss an error
app.post("/api/projects/:id/errors/:hash/dismiss", (req, res) => {
  logWatcher.dismissError(req.params.hash);
  logWatcher.workflowCreator.dismissError(req.params.id, req.params.hash);
  res.json({ ok: true });
});

// Docker status
app.get("/api/docker/status", (req, res) => {
  res.json({ available: logWatcher.isAvailable() });
});

// Charger les workflows actifs et complétés
function loadWorkflows(projectsDir, projectName) {
  const result = { active: [], completed: [] };

  // Workflows actifs
  const activePath = path.join(
    projectsDir,
    projectName,
    ".workflows",
    "active",
  );
  if (fs.existsSync(activePath)) {
    try {
      const wfDirs = fs.readdirSync(activePath);
      for (const wfDir of wfDirs) {
        const wfMetaPath = path.join(activePath, wfDir, "metadata.json");
        if (fs.existsSync(wfMetaPath)) {
          try {
            const wfMeta = JSON.parse(fs.readFileSync(wfMetaPath, "utf8"));
            result.active.push({
              title: wfMeta.title || wfDir,
              current_phase: wfMeta.current_phase || "unknown",
              status: wfMeta.status || "in_progress",
              source: wfMeta.source || null,
            });
          } catch (e) {}
        }
      }
    } catch (e) {}
  }

  // Workflows complétés
  const completedPath = path.join(
    projectsDir,
    projectName,
    ".workflows",
    "completed",
  );
  if (fs.existsSync(completedPath)) {
    try {
      const wfDirs = fs.readdirSync(completedPath);
      for (const wfDir of wfDirs) {
        const wfMetaPath = path.join(completedPath, wfDir, "metadata.json");
        if (fs.existsSync(wfMetaPath)) {
          try {
            const wfMeta = JSON.parse(fs.readFileSync(wfMetaPath, "utf8"));
            result.completed.push({
              title: wfMeta.title || wfDir,
              completed_at: wfMeta.completed_at || null,
            });
          } catch (e) {}
        }
      }
    } catch (e) {}
  }

  return result;
}

// Construire la liste des repos depuis l'ancien format (domains object)
function buildReposFromDomains(metadata, projectName) {
  const repos = [];
  const domains = metadata.domains || {};
  const githubOrg = metadata.github_org || "buse974";

  if (domains.api) {
    repos.push({
      name: "API",
      type: "api",
      stack: "Express",
      url: `https://${domains.api}`,
      healthUrl: `https://${domains.api}/health`,
      github: `https://github.com/${githubOrg}/${projectName}-api`,
    });
  }

  if (domains.front) {
    repos.push({
      name: "Frontend",
      type: "web",
      stack: "React",
      url: `https://${domains.front}`,
      healthUrl: `https://${domains.front}/health.json`,
      github: `https://github.com/${githubOrg}/${projectName}-front`,
    });
  }

  if (domains.landing) {
    repos.push({
      name: "Landing",
      type: "landing",
      stack: "HTML/CSS/JS",
      url: `https://${domains.landing}`,
      healthUrl: `https://${domains.landing}/health.json`,
      github: `https://github.com/${githubOrg}/${projectName}-landing`,
    });
  }

  return repos;
}

app.listen(PORT, () => {
  console.log("Dashboard running on port " + PORT);
});
