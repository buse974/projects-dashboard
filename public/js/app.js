/**
 * Modern Projects Dashboard
 * Interactive project list with detailed view
 */

const API_BASE = "/api";

// Project type icons
const TYPE_ICONS = {
  web: "🌐",
  api: "⚡",
  mobile: "📱",
  landing: "🚀",
  backend: "🔧",
  fullstack: "💻",
  default: "📦",
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
    this.init();
  }

  async init() {
    this.bindEvents();
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

    // GitHub button
    document.getElementById("btn-github").addEventListener("click", () => {
      if (this.selectedProject?.github) {
        window.open(this.selectedProject.github, "_blank");
      }
    });

    // URL button
    document.getElementById("btn-url").addEventListener("click", () => {
      if (this.selectedProject?.repos?.[0]?.url) {
        window.open(this.selectedProject.repos[0].url, "_blank");
      }
    });
  }

  async loadProjects() {
    const refreshBtn = document.getElementById("refresh-btn");
    refreshBtn.classList.add("loading");

    try {
      const response = await fetch(`${API_BASE}/projects`);
      this.projects = await response.json();

      // If no projects from API, use mock data for demo
      if (this.projects.length === 0) {
        this.projects = this.getMockProjects();
      }

      this.renderProjectsList();
      this.updateStats();
      this.checkAllHealth();
    } catch (error) {
      console.error("Error loading projects:", error);
      // Use mock data on error
      this.projects = this.getMockProjects();
      this.renderProjectsList();
      this.updateStats();
    } finally {
      refreshBtn.classList.remove("loading");
    }
  }

  getMockProjects() {
    return [
      {
        id: "portfolio-v2",
        name: "Portfolio V2",
        pitch:
          "Mon portfolio personnel nouvelle génération avec des animations fluides et un design moderne. Présente mes projets, compétences et expériences de manière interactive.",
        type: "landing",
        created: "2024-01-15",
        updated: "2024-02-01",
        version: "2.1.0",
        github: "https://github.com/user/portfolio-v2",
        stack: ["Next.js", "TypeScript", "Tailwind", "Framer Motion"],
        repos: [
          {
            name: "Frontend",
            type: "landing",
            stack: "Next.js",
            url: "https://portfolio.example.com",
          },
        ],
        workflows: { active: [] },
        env: ["NEXT_PUBLIC_API_URL", "ANALYTICS_ID"],
      },
      {
        id: "saas-starter",
        name: "SaaS Starter Kit",
        pitch:
          "Template complet pour démarrer rapidement un projet SaaS. Inclut authentification, paiements Stripe, dashboard admin et API REST.",
        type: "fullstack",
        created: "2024-02-10",
        updated: "2024-02-28",
        version: "1.0.0-beta",
        github: "https://github.com/user/saas-starter",
        stack: ["React", "Node.js", "PostgreSQL", "Stripe", "Docker"],
        repos: [
          {
            name: "Frontend",
            type: "web",
            stack: "React",
            url: "https://app.saas-demo.com",
          },
          {
            name: "API",
            type: "api",
            stack: "Node.js",
            url: "https://api.saas-demo.com",
          },
          {
            name: "Admin",
            type: "web",
            stack: "React",
            url: "https://admin.saas-demo.com",
          },
        ],
        workflows: {
          active: [
            {
              title: "Intégration Stripe Connect",
              current_phase: "development",
            },
            { title: "Multi-tenancy", current_phase: "planning" },
          ],
        },
        env: ["DATABASE_URL", "STRIPE_SECRET_KEY", "JWT_SECRET", "REDIS_URL"],
      },
      {
        id: "ai-chatbot",
        name: "AI Chatbot Platform",
        pitch:
          "Plateforme de création de chatbots personnalisés alimentés par GPT-4. Interface drag-and-drop pour créer des flows conversationnels.",
        type: "fullstack",
        created: "2024-01-20",
        updated: "2024-02-25",
        version: "0.9.0",
        github: "https://github.com/user/ai-chatbot",
        stack: ["Vue.js", "Python", "FastAPI", "OpenAI", "Redis"],
        repos: [
          {
            name: "Dashboard",
            type: "web",
            stack: "Vue.js",
            url: "https://chatbot.example.com",
          },
          {
            name: "API",
            type: "api",
            stack: "FastAPI",
            url: "https://api.chatbot.example.com",
          },
        ],
        workflows: {
          active: [
            { title: "Support multi-langues", current_phase: "testing" },
          ],
        },
        env: ["OPENAI_API_KEY", "REDIS_URL", "DATABASE_URL"],
      },
      {
        id: "devops-monitor",
        name: "DevOps Monitor",
        pitch:
          "Solution de monitoring pour infrastructure DevOps. Agrège les métriques de plusieurs sources et alerte en temps réel.",
        type: "backend",
        created: "2023-11-01",
        updated: "2024-02-20",
        version: "3.2.1",
        github: "https://github.com/user/devops-monitor",
        stack: ["Go", "Prometheus", "Grafana", "InfluxDB"],
        repos: [
          {
            name: "Collector",
            type: "api",
            stack: "Go",
            url: "https://monitor.example.com",
          },
          {
            name: "Dashboard",
            type: "web",
            stack: "Grafana",
            url: "https://grafana.example.com",
          },
        ],
        workflows: { active: [] },
        env: ["INFLUXDB_URL", "PROMETHEUS_URL", "SLACK_WEBHOOK"],
      },
      {
        id: "mobile-fitness",
        name: "FitTrack Mobile",
        pitch:
          "Application mobile de suivi fitness avec plans d'entraînement personnalisés, tracking GPS et synchronisation avec les wearables.",
        type: "mobile",
        created: "2024-01-05",
        updated: "2024-02-18",
        version: "1.5.0",
        github: "https://github.com/user/fittrack",
        stack: ["React Native", "TypeScript", "Node.js", "MongoDB"],
        repos: [
          {
            name: "Mobile App",
            type: "mobile",
            stack: "React Native",
            url: null,
          },
          {
            name: "Backend",
            type: "api",
            stack: "Node.js",
            url: "https://api.fittrack.example.com",
          },
        ],
        workflows: { active: [] },
        env: ["MONGODB_URI", "APPLE_HEALTH_KEY", "GOOGLE_FIT_KEY"],
      },
      {
        id: "ecommerce-headless",
        name: "Headless E-commerce",
        pitch:
          "Solution e-commerce headless avec Shopify comme backend. Storefront ultra-rapide avec SSR et optimisations SEO avancées.",
        type: "fullstack",
        created: "2023-12-10",
        updated: "2024-02-28",
        version: "2.0.0",
        github: "https://github.com/user/headless-shop",
        stack: ["Next.js", "Shopify", "GraphQL", "Vercel"],
        repos: [
          {
            name: "Storefront",
            type: "web",
            stack: "Next.js",
            url: "https://shop.example.com",
          },
        ],
        workflows: {
          active: [
            { title: "Migration vers Shopify 2.0", current_phase: "review" },
          ],
        },
        env: [
          "SHOPIFY_STORE_DOMAIN",
          "SHOPIFY_ACCESS_TOKEN",
          "NEXT_PUBLIC_DOMAIN",
        ],
      },
    ];
  }

  renderProjectsList() {
    const container = document.getElementById("projects-list");

    if (this.projects.length === 0) {
      container.innerHTML = `
                <li class="no-projects">
                    <p>Aucun projet trouvé</p>
                </li>
            `;
      return;
    }

    container.innerHTML = this.projects
      .map((project, index) => {
        const icon = TYPE_ICONS[project.type] || TYPE_ICONS.default;
        const stackPreview =
          project.stack?.slice(0, 2).join(" • ") || project.type;
        const isActive = this.selectedProject?.id === project.id;

        return `
                <li class="project-item ${isActive ? "active" : ""}" data-id="${project.id}">
                    <a onclick="dashboard.selectProject('${project.id}')">
                        <div class="project-icon">${icon}</div>
                        <div class="project-info">
                            <div class="project-info-name">${project.name}</div>
                            <div class="project-info-stack">${stackPreview}</div>
                        </div>
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
                    <div class="repo-status-badge ${repoHealth}" data-repo-health="${p.id}-${repo.name}">
                        <span class="dot"></span>
                        <span>${repoHealth === "online" ? "Online" : repoHealth === "offline" ? "Offline" : "Checking"}</span>
                    </div>
                </div>
            `;
        })
        .join("") || '<p style="color: var(--text-muted)">Aucun repository</p>';

    // Workflows
    const workflows = p.workflows?.active || [];
    const workflowsSection = document.getElementById("workflows-section");
    const workflowsContainer = document.getElementById("detail-workflows");

    if (workflows.length > 0) {
      workflowsSection.style.display = "block";
      workflowsContainer.innerHTML = workflows
        .map(
          (wf) => `
                <div class="workflow-item-detail">
                    <div class="workflow-info">
                        <h4>${wf.title}</h4>
                        <span>Workflow actif</span>
                    </div>
                    <span class="workflow-phase-badge">${wf.current_phase}</span>
                </div>
            `,
        )
        .join("");
    } else {
      workflowsSection.style.display = "none";
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
                    <span class="env-value">••••••••</span>
                </div>
            `,
        )
        .join("");
    } else {
      envSection.style.display = "none";
    }

    // Update button states
    document.getElementById("btn-github").style.opacity = p.github
      ? "1"
      : "0.3";
    document.getElementById("btn-github").style.pointerEvents = p.github
      ? "auto"
      : "none";

    const hasUrl = p.repos?.[0]?.url;
    document.getElementById("btn-url").style.opacity = hasUrl ? "1" : "0.3";
    document.getElementById("btn-url").style.pointerEvents = hasUrl
      ? "auto"
      : "none";
  }

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
            repo.type === "landing"
              ? `${repo.url}/health.json`
              : `${repo.url}/health`;

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

        // Update UI for this repo
        this.updateRepoHealthUI(key);
      }

      // Update project indicator in list
      this.updateProjectStatusIndicator(project.id);
    }

    // Update stats
    document.getElementById("stat-healthy").textContent = healthyCount;
    document.getElementById("stat-errors").textContent = errorCount;

    // Re-render detail if a project is selected
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

    let activeWorkflows = 0;
    this.projects.forEach((p) => {
      if (p.workflows?.active) {
        activeWorkflows += p.workflows.active.length;
      }
    });
    // Note: We could add a workflows stat if needed
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
