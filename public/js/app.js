const API_BASE = '/api';

class Dashboard {
    constructor() {
        this.projects = [];
        this.init();
    }

    async init() {
        document.getElementById('refresh-btn').addEventListener('click', () => this.loadProjects());
        await this.loadProjects();
    }

    async loadProjects() {
        const container = document.getElementById('projects-list');
        container.innerHTML = '<div class="loading">Chargement...</div>';

        try {
            const response = await fetch(API_BASE + '/projects');
            this.projects = await response.json();
            this.render();
            this.updateStats();
            await this.checkHealth();
        } catch (error) {
            container.innerHTML = '<div class="no-projects">Erreur de chargement</div>';
            console.error(error);
        }
    }

    updateStats() {
        document.getElementById('total-projects').textContent = this.projects.length;
        
        let activeWorkflows = 0;
        this.projects.forEach(p => {
            if (p.workflows && p.workflows.active) {
                activeWorkflows += p.workflows.active.length;
            }
        });
        document.getElementById('active-workflows').textContent = activeWorkflows;
    }

    async checkHealth() {
        let healthy = 0;
        let errors = 0;

        for (const project of this.projects) {
            if (!project.repos) continue;
            
            for (const repo of project.repos) {
                if (!repo.url) continue;
                
                try {
                    const healthUrl = repo.type === 'landing' 
                        ? repo.url + '/health.json'
                        : repo.url + '/health';
                    
                    const response = await fetch(healthUrl, { 
                        mode: 'cors',
                        cache: 'no-store'
                    });
                    
                    if (response.ok) {
                        healthy++;
                        this.updateRepoHealth(project.id, repo.name, 'ok');
                    } else {
                        errors++;
                        this.updateRepoHealth(project.id, repo.name, 'error');
                    }
                } catch (e) {
                    errors++;
                    this.updateRepoHealth(project.id, repo.name, 'error');
                }
            }
        }

        document.getElementById('healthy-services').textContent = healthy;
        document.getElementById('error-services').textContent = errors;
    }

    updateRepoHealth(projectId, repoName, status) {
        const el = document.querySelector(`[data-project="${projectId}"][data-repo="${repoName}"]`);
        if (el) {
            el.className = 'repo-health ' + status;
        }
    }

    render() {
        const container = document.getElementById('projects-list');
        
        if (this.projects.length === 0) {
            container.innerHTML = '<div class="no-projects">Aucun projet</div>';
            return;
        }

        container.innerHTML = this.projects.map(project => this.renderProject(project)).join('');
    }

    renderProject(project) {
        const repos = project.repos || [];
        const workflows = project.workflows?.active || [];

        return `
            <div class="project-card">
                <div class="project-header">
                    <span class="project-name">${project.name}</span>
                    <span class="project-status ok">Actif</span>
                </div>
                <div class="project-body">
                    <p class="project-description">${project.pitch || 'Pas de description'}</p>
                    
                    <ul class="repos-list">
                        ${repos.map(repo => `
                            <li class="repo-item">
                                <span class="repo-name">${repo.name} (${repo.stack || repo.type})</span>
                                <span class="repo-health unknown" 
                                      data-project="${project.id}" 
                                      data-repo="${repo.name}"></span>
                            </li>
                        `).join('')}
                    </ul>

                    ${workflows.length > 0 ? `
                        <div class="workflows-section">
                            <h4>Workflows actifs</h4>
                            ${workflows.map(wf => `
                                <div class="workflow-item">
                                    <span>${wf.title}</span>
                                    <span class="workflow-phase">${wf.current_phase}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
}

new Dashboard();
