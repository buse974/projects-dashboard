const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

// Le dossier où project-loader sync les projets
// Monté depuis ~/projects-sync sur le VPS vers /data/projects dans le container
const PROJECTS_DIR = "/data/projects";

app.use(express.static("public"));

app.get("/api/projects", async (req, res) => {
  try {
    const projects = [];

    if (!fs.existsSync(PROJECTS_DIR)) {
      return res.json([]);
    }

    const dirs = fs.readdirSync(PROJECTS_DIR);

    for (const dir of dirs) {
      const projectPath = path.join(PROJECTS_DIR, dir, ".project");
      const dashboardPath = path.join(projectPath, "dashboard.json");
      const metadataPath = path.join(projectPath, "metadata.json");

      // Priorité à dashboard.json (nouveau format)
      if (fs.existsSync(dashboardPath)) {
        try {
          const dashboard = JSON.parse(fs.readFileSync(dashboardPath, "utf8"));

          // Charger les workflows depuis .workflows/
          const workflows = loadWorkflows(PROJECTS_DIR, dir);
          dashboard.workflows = workflows;

          projects.push(dashboard);
        } catch (e) {
          console.error("Error reading dashboard.json for", dir, e);
        }
      }
      // Fallback sur metadata.json (ancien format)
      else if (fs.existsSync(metadataPath)) {
        try {
          const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
          const workflows = loadWorkflows(PROJECTS_DIR, dir);

          // Convertir ancien format vers nouveau
          projects.push({
            id: dir,
            name: metadata.name || dir,
            pitch: metadata.description || "",
            type: "fullstack",
            created: metadata.created_at || null,
            updated: metadata.created_at || null,
            version: "1.0.0",
            stack: [],
            repos: buildReposFromMetadata(metadata, dir),
            workflows: workflows,
            env: [],
          });
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

// Construire la liste des repos depuis l'ancien format metadata
function buildReposFromMetadata(metadata, projectName) {
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
