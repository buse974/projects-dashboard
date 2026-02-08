/**
 * Modern Projects Dashboard
 * Interactive project list with detailed view + Docker Logs
 */

const API_BASE = "/api";
const MAX_LOG_LINES = 1000;

// Project type icons
const TYPE_ICONS = {
  web: "\u{1F310}",
  api: "\u26A1",
  mobile: "\u{1F4F1}",
  landing: "\u{1F680}",
  backend: "\u{1F527}",
  fullstack: "\u{1F4BB}",
  default: "\u{1F4E6}",
};

// Stack colors for tags
const STACK_COLORS = {
  react: "primary",
  vue: "primary",
  next: "primary",
  node: "primary",
  express: "",
  python: "primary",
  django: "",
  fastapi: "",
  go: "primary",
  rust: "primary",
};

class Dashboard {
  constructor() {
    this.projects = [];
    this.selectedProject = null;
    this.healthStatus = new Map();
    this.dockerAvailable = false;
    this.logEventSource = null;
    this.logStreaming = false;
    this.logLineCount = 0;
    this.init();
  }

  async init() {
    this.bindEvents();
    await this.checkDockerStatus();
    await this.loadProjects();
  }

  bindEvents() {
    // Refresh button
    document.getElementById("refresh-btn").addEventListener("click", () => {
      this.loadProjects();
    });

    // Search input
    document.getElementById("search-input").addEventListener("input", (e) => {
      this.filterProjects(e.target.value);
    });

    // Workflow tabs
    document.querySelectorAll(".workflow-tab").forEach((tab) => {
      tab.addEventListener("click", (e) => {
        const tabName = e.currentTarget.dataset.tab;
        this.switchWorkflowTab(tabName);
      });
    });

    // Docker logs controls
    document
      .getElementById("container-select")
      .addEventListener("change", (e) => {
        this.stopLogStream();
        if (e.target.value) {
          document.getElementById("logs-toggle-btn").disabled = false;
        } else {
          document.getElementById("logs-toggle-btn").disabled = true;
        }
      });

    document.getElementById("logs-toggle-btn").addEventListener("click", () => {
      if (this.logStreaming) {
        this.stopLogStream();
      } else {
        this.startLogStream();
      }
    });

    document.getElementById("logs-clear-btn").addEventListener("click", () => {
      this.clearLogs();
    });
  }

  async checkDockerStatus() {
    try {
      const res = await fetch(`${API_BASE}/docker/status`);
      const data = await res.json();
      this.dockerAvailable = data.available;
    } catch (e) {
      this.dockerAvailable = false;
    }
  }

  switchWorkflowTab(tabName) {
    // Update tab buttons
    document.querySelectorAll(".workflow-tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.tab === tabName);
    });

    // Show/hide lists
    document.getElementById("detail-workflows-active").style.display =
      tabName === "active" ? "flex" : "none";
    document.getElementById("detail-workflows-completed").style.display =
      tabName === "completed" ? "flex" : "none";
  }

  async loadProjects() {
    const refreshBtn = document.getElementById("refresh-btn");
    refreshBtn.classList.add("loading");

    try {
      const response = await fetch(`${API_BASE}/projects`);
      this.projects = await response.json();

      this.renderProjectsList();
      this.updateStats();
      this.checkAllHealth();
    } catch (error) {
      console.error("Error loading projects:", error);
      this.projects = [];
      this.renderProjectsList();
    } finally {
      refreshBtn.classList.remove("loading");
    }
  }

  renderProjectsList() {
    const container = document.getElementById("projects-list");

    if (this.projects.length === 0) {
      container.innerHTML = `
                <li class="no-projects">
                    <p>Aucun projet trouv\u00E9</p>
                </li>
            `;
      return;
    }

    container.innerHTML = this.projects
      .map((project) => {
        const icon = TYPE_ICONS[project.type] || TYPE_ICONS.default;
        const stackPreview =
          project.stack?.slice(0, 2).join(" \u2022 ") || project.type;
        const isActive = this.selectedProject?.id === project.id;
        const errorBadge =
          project.errorCount > 0
            ? `<span class="project-error-count">${project.errorCount}</span>`
            : "";

        return `
                <li class="project-item ${isActive ? "active" : ""}" data-id="${project.id}">
                    <a onclick="dashboard.selectProject('${project.id}')">
                        <div class="project-icon">${icon}</div>
                        <div class="project-info">
                            <div class="project-info-name">${project.name}</div>
                            <div class="project-info-stack">${stackPreview}</div>
                        </div>
                        ${errorBadge}
                        <div class="project-status-indicator checking" data-project-status="${project.id}"></div>
                    </a>
                </li>
            `;
      })
      .join("");

    // Auto-select first project if none selected
    if (!this.selectedProject && this.projects.length > 0) {
      this.selectProject(this.projects[0].id);
    }
  }

  selectProject(projectId) {
    // Stop any active log stream when switching projects
    this.stopLogStream();

    this.selectedProject = this.projects.find((p) => p.id === projectId);

    if (!this.selectedProject) return;

    // Update active state in list
    document.querySelectorAll(".project-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.id === projectId);
    });

    // Show detail view
    document.getElementById("empty-state").style.display = "none";
    document.getElementById("project-detail").style.display = "block";

    this.renderProjectDetail();
    this.loadContainers(projectId);
  }

  renderProjectDetail() {
    const p = this.selectedProject;
    if (!p) return;

    // Header
    document.getElementById("detail-name").textContent = p.name;

    // Status
    const statusEl = document.getElementById("detail-status");
    const projectHealth = this.getProjectOverallHealth(p.id);
    statusEl.className = `detail-status ${projectHealth}`;
    statusEl.querySelector(".status-text").textContent =
      projectHealth === "online"
        ? "Online"
        : projectHealth === "offline"
          ? "Offline"
          : "Checking...";

    // Info
    document.getElementById("detail-pitch").textContent =
      p.pitch || "Pas de description";
    document.getElementById("detail-created").textContent = this.formatDate(
      p.created,
    );
    document.getElementById("detail-updated").textContent = this.formatDate(
      p.updated,
    );
    document.getElementById("detail-version").textContent = p.version || "-";
    document.getElementById("detail-type").textContent = this.capitalize(
      p.type || "Projet",
    );

    // Stack tags
    const stackContainer = document.getElementById("detail-stack");
    stackContainer.innerHTML = (p.stack || [])
      .map((tech) => {
        const colorClass = STACK_COLORS[tech.toLowerCase()] || "";
        return `<span class="tech-tag ${colorClass}">${tech}</span>`;
      })
      .join("");

    // Repos
    const reposContainer = document.getElementById("detail-repos");
    reposContainer.innerHTML =
      (p.repos || [])
        .map((repo) => {
          const repoHealth =
            this.healthStatus.get(`${p.id}-${repo.name}`) || "checking";
          return `
                <div class="repo-item-detail">
                    <div class="repo-info">
                        <div class="repo-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                            </svg>
                        </div>
                        <div class="repo-details">
                            <h4>${repo.name}</h4>
                            <span>${repo.stack || repo.type}</span>
                        </div>
                    </div>
                    <div class="repo-actions">
                        ${
                          repo.github
                            ? `
                            <a href="${repo.github}" target="_blank" class="repo-action-btn" title="GitHub">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                                </svg>
                            </a>
                        `
                            : ""
                        }
                        ${
                          repo.url
                            ? `
                            <a href="${repo.url}" target="_blank" class="repo-action-btn" title="Ouvrir le site">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                    <polyline points="15 3 21 3 21 9"/>
                                    <line x1="10" y1="14" x2="21" y2="3"/>
                                </svg>
                            </a>
                        `
                            : ""
                        }
                        <div class="repo-status-badge ${repoHealth}" data-repo-health="${p.id}-${repo.name}">
                            <span class="dot"></span>
                            <span>${repoHealth === "online" ? "Online" : repoHealth === "offline" ? "Offline" : "Checking"}</span>
                        </div>
                    </div>
                </div>
            `;
        })
        .join("") ||
      '<p style="color: var(--text-muted)">Aucun repository</p>';

    // Workflows
    const activeWorkflows = p.workflows?.active || [];
    const completedWorkflows = p.workflows?.completed || [];
    const workflowsSection = document.getElementById("workflows-section");
    const activeContainer = document.getElementById("detail-workflows-active");
    const completedContainer = document.getElementById(
      "detail-workflows-completed",
    );

    // Update tab counts
    document.getElementById("active-count").textContent =
      activeWorkflows.length;
    document.getElementById("completed-count").textContent =
      completedWorkflows.length;

    if (activeWorkflows.length > 0 || completedWorkflows.length > 0) {
      workflowsSection.style.display = "block";

      // Render active workflows
      if (activeWorkflows.length > 0) {
        activeContainer.innerHTML = activeWorkflows
          .map((wf) => {
            const isDetected = wf.source === "log-watcher";
            const statusClass =
              wf.status === "detected" ? "detected" : "";
            return `
                <div class="workflow-item-detail ${statusClass}">
                    <div class="workflow-info">
                        <h4>${isDetected ? "\u{1F6A8} " : ""}${wf.title}</h4>
                        <span>${wf.status === "detected" ? "D\u00E9tect\u00E9 automatiquement" : "En cours"}</span>
                    </div>
                    <div class="workflow-meta">
                        <span class="workflow-phase-badge ${statusClass}">${wf.status === "detected" ? "detected" : wf.current_phase}</span>
                    </div>
                </div>
            `;
          })
          .join("");
      } else {
        activeContainer.innerHTML =
          '<p class="workflows-list empty">Aucun workflow actif</p>';
      }

      // Render completed workflows
      if (completedWorkflows.length > 0) {
        completedContainer.innerHTML = completedWorkflows
          .map(
            (wf) => `
                <div class="workflow-item-detail completed">
                    <div class="workflow-info">
                        <h4>${wf.title}</h4>
                        <span>Termin\u00E9${wf.completed_at ? ` le ${this.formatDate(wf.completed_at)}` : ""}</span>
                    </div>
                    <div class="workflow-meta">
                        <span class="workflow-phase-badge completed">Termin\u00E9</span>
                    </div>
                </div>
            `,
          )
          .join("");
      } else {
        completedContainer.innerHTML =
          '<p class="workflows-list empty">Aucun workflow termin\u00E9</p>';
      }

      // Reset to active tab
      this.switchWorkflowTab("active");
    } else {
      workflowsSection.style.display = "none";
    }

    // Docker Logs section - always visible
    const logsSection = document.getElementById("logs-section");
    logsSection.style.display = "block";

    // Show notice if Docker not available
    const terminal = document.getElementById("logs-terminal");
    if (!this.dockerAvailable && !this.logStreaming) {
      document.getElementById("container-select").disabled = true;
      document.getElementById("logs-toggle-btn").disabled = true;
      terminal.innerHTML = '<div class="logs-placeholder">Docker non disponible sur ce serveur.<br>V\u00E9rifiez que docker.sock est mont\u00E9 dans le container.</div>';
    }

    // Error badge in logs header
    const errorBadge = document.getElementById("logs-error-badge");
    if (p.errorCount > 0) {
      errorBadge.textContent = p.errorCount;
      errorBadge.style.display = "inline-flex";
    } else {
      errorBadge.style.display = "none";
    }

    // Environment variables
    const envVars = p.env || [];
    const envSection = document.getElementById("env-section");
    const envContainer = document.getElementById("detail-env");

    if (envVars.length > 0) {
      envSection.style.display = "block";
      envContainer.innerHTML = envVars
        .map(
          (key) => `
                <div class="env-item">
                    <span class="env-key">${key}</span>
                    <span class="env-value">\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022</span>
                </div>
            `,
        )
        .join("");
    } else {
      envSection.style.display = "none";
    }
  }

  // --- Docker Logs Methods ---

  async loadContainers(projectId) {
    const select = document.getElementById("container-select");
    select.innerHTML = '<option value="">Chargement...</option>';

    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/containers`);
      const containers = await res.json();

      if (containers.length === 0) {
        select.innerHTML =
          '<option value="">Aucun container trouv\u00E9</option>';
        return;
      }

      select.innerHTML =
        '<option value="">S\u00E9lectionner un container...</option>' +
        containers
          .map(
            (c) =>
              `<option value="${c.name}">${c.name} (${c.state})</option>`,
          )
          .join("");
    } catch (e) {
      select.innerHTML =
        '<option value="">Erreur de chargement</option>';
    }
  }

  startLogStream() {
    const containerName = document.getElementById("container-select").value;
    const projectId = this.selectedProject?.id;
    if (!containerName || !projectId) return;

    this.stopLogStream();
    this.clearLogs();

    const toggleBtn = document.getElementById("logs-toggle-btn");
    toggleBtn.classList.add("streaming");
    toggleBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12"/></svg>`;
    this.logStreaming = true;

    const url = `${API_BASE}/projects/${projectId}/containers/${containerName}/logs`;
    this.logEventSource = new EventSource(url);

    this.logEventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "connected") return;
        if (data.type === "error_detected") {
          this.onErrorDetected(data);
          return;
        }
        this.appendLogLine(data.line, data.isStderr);
      } catch (e) {
        // ignore parse errors
      }
    };

    this.logEventSource.onerror = () => {
      // SSE will auto-reconnect, but update UI
      console.warn("SSE connection error, will retry...");
    };
  }

  stopLogStream() {
    if (this.logEventSource) {
      this.logEventSource.close();
      this.logEventSource = null;
    }

    const toggleBtn = document.getElementById("logs-toggle-btn");
    toggleBtn.classList.remove("streaming");
    toggleBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
    this.logStreaming = false;
  }

  clearLogs() {
    const terminal = document.getElementById("logs-terminal");
    terminal.innerHTML =
      '<div class="logs-placeholder">En attente de logs...</div>';
    this.logLineCount = 0;
  }

  appendLogLine(line, isStderr) {
    const terminal = document.getElementById("logs-terminal");

    // Remove placeholder if present
    const placeholder = terminal.querySelector(".logs-placeholder");
    if (placeholder) placeholder.remove();

    // Detect error lines
    const isError =
      /\bError:\b|\bFATAL\b|\b5\d{2}\b|UnhandledPromiseRejection|ECONNREFUSED/i.test(
        line,
      );

    const lineEl = document.createElement("div");
    lineEl.className = `log-line${isStderr ? " stderr" : ""}${isError ? " error" : ""}`;

    // Extract timestamp if present
    const tsMatch = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.Z+-]+)\s+(.*)/);
    if (tsMatch) {
      const ts = new Date(tsMatch[1]);
      const timeStr = ts.toLocaleTimeString("fr-FR");
      lineEl.innerHTML = `<span class="log-timestamp">${timeStr}</span><span class="log-content">${this.escapeHtml(tsMatch[2])}</span>`;
    } else {
      lineEl.innerHTML = `<span class="log-content">${this.escapeHtml(line)}</span>`;
    }

    terminal.appendChild(lineEl);
    this.logLineCount++;

    // Trim old lines if over max
    while (this.logLineCount > MAX_LOG_LINES) {
      const first = terminal.querySelector(".log-line");
      if (first) {
        first.remove();
        this.logLineCount--;
      } else {
        break;
      }
    }

    // Auto-scroll to bottom
    terminal.scrollTop = terminal.scrollHeight;
  }

  onErrorDetected(data) {
    // Update error badge
    const badge = document.getElementById("logs-error-badge");
    const current = parseInt(badge.textContent || "0", 10);
    badge.textContent = current + 1;
    badge.style.display = "inline-flex";

    // Refresh projects to update sidebar badges
    this.loadProjects();
  }

  escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Health Check Methods ---

  async checkAllHealth() {
    let healthyCount = 0;
    let errorCount = 0;

    for (const project of this.projects) {
      if (!project.repos) continue;

      for (const repo of project.repos) {
        const key = `${project.id}-${repo.name}`;

        if (!repo.url) {
          this.healthStatus.set(key, "offline");
          errorCount++;
          continue;
        }

        try {
          const healthUrl =
            repo.healthUrl ||
            (repo.type === "landing"
              ? `${repo.url}/health.json`
              : `${repo.url}/health`);

          const response = await fetch(healthUrl, {
            mode: "cors",
            cache: "no-store",
            signal: AbortSignal.timeout(5000),
          });

          if (response.ok) {
            this.healthStatus.set(key, "online");
            healthyCount++;
          } else {
            this.healthStatus.set(key, "offline");
            errorCount++;
          }
        } catch (e) {
          this.healthStatus.set(key, "offline");
          errorCount++;
        }

        this.updateRepoHealthUI(key);
      }

      this.updateProjectStatusIndicator(project.id);
    }

    document.getElementById("stat-healthy").textContent = healthyCount;
    document.getElementById("stat-errors").textContent = errorCount;

    if (this.selectedProject) {
      this.renderProjectDetail();
    }
  }

  updateRepoHealthUI(key) {
    const badge = document.querySelector(`[data-repo-health="${key}"]`);
    if (badge) {
      const status = this.healthStatus.get(key) || "checking";
      badge.className = `repo-status-badge ${status}`;
      badge.querySelector("span:last-child").textContent =
        status === "online"
          ? "Online"
          : status === "offline"
            ? "Offline"
            : "Checking";
    }
  }

  updateProjectStatusIndicator(projectId) {
    const indicator = document.querySelector(
      `[data-project-status="${projectId}"]`,
    );
    if (indicator) {
      const health = this.getProjectOverallHealth(projectId);
      indicator.className = `project-status-indicator ${health}`;
    }
  }

  getProjectOverallHealth(projectId) {
    const project = this.projects.find((p) => p.id === projectId);
    if (!project?.repos?.length) return "offline";

    let hasOnline = false;
    let hasOffline = false;
    let allChecking = true;

    for (const repo of project.repos) {
      const status = this.healthStatus.get(`${projectId}-${repo.name}`);
      if (status === "online") {
        hasOnline = true;
        allChecking = false;
      } else if (status === "offline") {
        hasOffline = true;
        allChecking = false;
      }
    }

    if (allChecking) return "checking";
    if (hasOnline && !hasOffline) return "online";
    if (hasOffline && !hasOnline) return "offline";
    return "online"; // Partial = still online
  }

  updateStats() {
    document.getElementById("stat-total").textContent = this.projects.length;
  }

  filterProjects(query) {
    const normalizedQuery = query.toLowerCase().trim();

    document.querySelectorAll(".project-item").forEach((item) => {
      const project = this.projects.find((p) => p.id === item.dataset.id);
      if (!project) return;

      const searchText = [
        project.name,
        project.pitch,
        project.type,
        ...(project.stack || []),
      ]
        .join(" ")
        .toLowerCase();

      const matches = !normalizedQuery || searchText.includes(normalizedQuery);
      item.style.display = matches ? "" : "none";
    });
  }

  formatDate(dateStr) {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  }

  capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// Initialize dashboard
const dashboard = new Dashboard();
