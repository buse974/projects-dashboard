const Docker = require("dockerode");
const fs = require("fs");

const DOCKER_SOCKET = "/var/run/docker.sock";

class DockerLogs {
  constructor() {
    this.docker = null;
    this.available = false;
    this._init();
  }

  _init() {
    if (fs.existsSync(DOCKER_SOCKET)) {
      try {
        this.docker = new Docker({ socketPath: DOCKER_SOCKET });
        this.available = true;
      } catch (e) {
        console.warn("Docker socket found but cannot connect:", e.message);
      }
    } else {
      console.warn("Docker socket not found at", DOCKER_SOCKET, "- running in mock mode");
    }
  }

  async listContainers() {
    if (!this.available) return [];

    try {
      const containers = await this.docker.listContainers({ all: false });
      return containers.map((c) => ({
        id: c.Id.substring(0, 12),
        name: c.Names[0].replace(/^\//, ""),
        image: c.Image,
        state: c.State,
        status: c.Status,
        created: c.Created,
      }));
    } catch (e) {
      console.error("Error listing containers:", e.message);
      return [];
    }
  }

  /**
   * Map containers to projects based on naming convention:
   * {project}-{type} → e.g. ticket-api, ticket-front, byewait-landing
   */
  async getContainersByProject(projectId) {
    const all = await this.listContainers();
    return all.filter((c) => {
      const name = c.name.toLowerCase();
      return name.startsWith(projectId.toLowerCase() + "-") || name === projectId.toLowerCase();
    });
  }

  /**
   * Stream logs from a container.
   * Returns a stream object. Call stream.destroy() to stop.
   * onData(line, isStderr) is called for each log line.
   */
  async streamLogs(containerName, onData, opts = {}) {
    if (!this.available) return null;

    try {
      const containers = await this.docker.listContainers({
        all: false,
        filters: { name: [containerName] },
      });

      if (containers.length === 0) {
        throw new Error(`Container "${containerName}" not found`);
      }

      const container = this.docker.getContainer(containers[0].Id);

      const stream = await container.logs({
        follow: true,
        stdout: true,
        stderr: true,
        tail: opts.tail || 100,
        timestamps: true,
      });

      // Docker multiplexed stream: 8-byte header per frame
      // Byte 0: stream type (1=stdout, 2=stderr)
      // Bytes 4-7: frame size (big-endian uint32)
      let buffer = Buffer.alloc(0);

      stream.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);

        while (buffer.length >= 8) {
          const streamType = buffer[0]; // 1=stdout, 2=stderr
          const frameSize = buffer.readUInt32BE(4);

          if (buffer.length < 8 + frameSize) break;

          const payload = buffer.slice(8, 8 + frameSize).toString("utf8").trimEnd();
          buffer = buffer.slice(8 + frameSize);

          if (payload) {
            const isStderr = streamType === 2;
            payload.split("\n").forEach((line) => {
              if (line.trim()) onData(line, isStderr);
            });
          }
        }
      });

      stream.on("error", (err) => {
        console.error(`Log stream error for ${containerName}:`, err.message);
      });

      return stream;
    } catch (e) {
      console.error(`Error streaming logs for ${containerName}:`, e.message);
      return null;
    }
  }
}

module.exports = DockerLogs;
