const EventEmitter = require("events");
const DockerLogs = require("./docker-logs");
const ErrorDetector = require("./error-detector");
const WorkflowCreator = require("./workflow-creator");

const CONTEXT_BUFFER_SIZE = 10;
const CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // 30 min

class LogWatcher extends EventEmitter {
  constructor(projectsDir) {
    super();
    this.projectsDir = projectsDir;
    this.dockerLogs = new DockerLogs();
    this.errorDetector = new ErrorDetector();
    this.workflowCreator = new WorkflowCreator(projectsDir);

    // Active streams: containerName → stream
    this.streams = new Map();

    // Context buffers: containerName → circular buffer of last N lines
    this.contextBuffers = new Map();

    // Error counts per project
    this.errorCounts = new Map();

    // Dismissed hashes
    this.dismissed = new Set();
  }

  async start() {
    if (!this.dockerLogs.available) {
      console.log("[LogWatcher] Docker not available, watcher disabled");
      return;
    }

    console.log("[LogWatcher] Starting...");
    await this._watchAllContainers();

    // Periodically check for new/removed containers
    this._refreshInterval = setInterval(() => this._watchAllContainers(), 30000);

    // Periodically clean up old dedup entries
    this._cleanupInterval = setInterval(() => this.errorDetector.cleanup(), CLEANUP_INTERVAL_MS);
  }

  stop() {
    if (this._refreshInterval) clearInterval(this._refreshInterval);
    if (this._cleanupInterval) clearInterval(this._cleanupInterval);

    for (const [name, stream] of this.streams) {
      try { stream.destroy(); } catch (e) {}
    }
    this.streams.clear();
    console.log("[LogWatcher] Stopped");
  }

  async _watchAllContainers() {
    try {
      const containers = await this.dockerLogs.listContainers();
      const currentNames = new Set(containers.map((c) => c.name));

      // Stop streams for removed containers
      for (const [name, stream] of this.streams) {
        if (!currentNames.has(name)) {
          try { stream.destroy(); } catch (e) {}
          this.streams.delete(name);
          this.contextBuffers.delete(name);
          console.log(`[LogWatcher] Stopped watching removed container: ${name}`);
        }
      }

      // Start streams for new containers (skip self to avoid log loops)
      for (const container of containers) {
        if (container.name === "projects-dashboard") continue;
        if (!this.streams.has(container.name)) {
          await this._watchContainer(container);
        }
      }
    } catch (e) {
      console.error("[LogWatcher] Error refreshing containers:", e.message);
    }
  }

  async _watchContainer(container) {
    const name = container.name;
    const projectId = this._getProjectId(name);

    this.contextBuffers.set(name, []);

    const stream = await this.dockerLogs.streamLogs(name, (line, isStderr) => {
      // Update context buffer
      const buf = this.contextBuffers.get(name) || [];
      buf.push(line);
      if (buf.length > CONTEXT_BUFFER_SIZE) buf.shift();
      this.contextBuffers.set(name, buf);

      // Emit log event for SSE clients
      this.emit("log", {
        container: name,
        project: projectId,
        line,
        isStderr,
        timestamp: Date.now(),
      });

      // Check for errors
      const error = this.errorDetector.detect(line);
      if (error && !this.dismissed.has(error.hash)) {
        error.container = name;

        if (!this.errorDetector.isDuplicate(error.hash)) {
          // New unique error: create workflow
          if (projectId) {
            const contextLines = [...(this.contextBuffers.get(name) || [])];
            this.workflowCreator.createErrorWorkflow(projectId, error, contextLines);
          }

          // Track error count
          const count = (this.errorCounts.get(projectId) || 0) + 1;
          this.errorCounts.set(projectId, count);

          // Emit error event
          this.emit("error_detected", {
            container: name,
            project: projectId,
            error,
            timestamp: Date.now(),
          });
        }
      }
    }, { tail: 50 });

    if (stream) {
      this.streams.set(name, stream);

      stream.on("end", () => {
        this.streams.delete(name);
        this.contextBuffers.delete(name);
        console.log(`[LogWatcher] Stream ended for ${name}, will reconnect on next refresh`);
      });

      console.log(`[LogWatcher] Watching container: ${name} (project: ${projectId || "unknown"})`);
    }
  }

  /**
   * Extract project ID from container name.
   * Convention: {project}-{type} e.g. ticket-api → ticket
   * Also handles: projects-dashboard → projects-dashboard (single name)
   */
  _getProjectId(containerName) {
    const parts = containerName.split("-");
    if (parts.length >= 2) {
      const suffix = parts[parts.length - 1];
      const knownSuffixes = ["api", "front", "landing", "db", "redis", "worker", "nginx"];
      if (knownSuffixes.includes(suffix)) {
        return parts.slice(0, -1).join("-");
      }
    }
    return containerName;
  }

  /**
   * Get error count for a project.
   */
  getErrorCount(projectId) {
    return this.errorCounts.get(projectId) || 0;
  }

  /**
   * Get recent errors from the detector.
   */
  getRecentErrors() {
    return this.errorDetector.getRecentErrors();
  }

  /**
   * Dismiss an error hash (won't create workflows for it anymore).
   */
  dismissError(hash) {
    this.dismissed.add(hash);
  }

  /**
   * Check if Docker is available.
   */
  isAvailable() {
    return this.dockerLogs.available;
  }
}

module.exports = LogWatcher;
