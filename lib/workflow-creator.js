const fs = require("fs");
const path = require("path");

class WorkflowCreator {
  constructor(projectsDir) {
    this.projectsDir = projectsDir;
  }

  /**
   * Create a "detected" workflow for an error.
   * Returns the workflow path if created, null if already exists.
   */
  createErrorWorkflow(projectId, error, contextLines) {
    const date = new Date().toISOString().split("T")[0];
    const workflowId = `docker-error-${error.hash}-${date}`;
    const workflowDir = path.join(
      this.projectsDir,
      projectId,
      ".workflows",
      "active",
      workflowId,
    );

    // Filesystem dedup: skip if already exists
    if (fs.existsSync(workflowDir)) {
      return null;
    }

    // Ensure parent dirs exist
    fs.mkdirSync(workflowDir, { recursive: true });

    // Write metadata.json
    const metadata = {
      id: workflowId,
      type: "bug",
      title: `[Auto] ${error.type}: ${this._truncate(error.line, 80)}`,
      description: `Erreur détectée automatiquement dans les logs Docker.\nType: ${error.type}\nHash: ${error.hash}`,
      status: "detected",
      source: "log-watcher",
      current_phase: "analysis",
      phases: {
        analysis: { status: "pending" },
        plan: { status: "pending" },
        validation: { status: "pending" },
        dev: { status: "pending" },
        tests: { status: "pending" },
        review: { status: "pending" },
        commit: { status: "pending" },
      },
      error_hash: error.hash,
      error_type: error.type,
      container: error.container || "unknown",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    fs.writeFileSync(
      path.join(workflowDir, "metadata.json"),
      JSON.stringify(metadata, null, 2),
    );

    // Write error-log.txt with context
    const logContent = [
      `Error detected at ${new Date().toISOString()}`,
      `Type: ${error.type}`,
      `Hash: ${error.hash}`,
      `Container: ${error.container || "unknown"}`,
      "",
      "--- Error Line ---",
      error.line,
      "",
      "--- Context (surrounding lines) ---",
      ...(contextLines || []),
      "",
    ].join("\n");

    fs.writeFileSync(path.join(workflowDir, "error-log.txt"), logContent);

    console.log(`[WorkflowCreator] Created workflow ${workflowId} for project ${projectId}`);
    return workflowDir;
  }

  /**
   * Mark an error workflow as dismissed.
   */
  dismissError(projectId, hash) {
    const date = new Date().toISOString().split("T")[0];
    const workflowId = `docker-error-${hash}-${date}`;
    const metaPath = path.join(
      this.projectsDir,
      projectId,
      ".workflows",
      "active",
      workflowId,
      "metadata.json",
    );

    if (!fs.existsSync(metaPath)) return false;

    try {
      const metadata = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      metadata.status = "dismissed";
      metadata.updated_at = new Date().toISOString();
      fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
      return true;
    } catch (e) {
      console.error("Error dismissing workflow:", e.message);
      return false;
    }
  }

  _truncate(str, len) {
    if (!str) return "";
    // Remove timestamp prefix if present
    const clean = str.replace(/^\d{4}-\d{2}-\d{2}T[\d:.Z+-]+\s*/, "");
    return clean.length > len ? clean.substring(0, len) + "..." : clean;
  }
}

module.exports = WorkflowCreator;
