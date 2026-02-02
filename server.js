const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const PROJECTS_DIR = '/data/projects';

app.use(express.static('public'));

app.get('/api/projects', async (req, res) => {
    try {
        const projects = [];
        
        if (!fs.existsSync(PROJECTS_DIR)) {
            return res.json([]);
        }

        const dirs = fs.readdirSync(PROJECTS_DIR);
        
        for (const dir of dirs) {
            const projectPath = path.join(PROJECTS_DIR, dir, '.project');
            const metadataPath = path.join(projectPath, 'metadata.json');
            
            if (fs.existsSync(metadataPath)) {
                try {
                    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
                    
                    // Check for active workflows
                    const workflowsPath = path.join(PROJECTS_DIR, dir, '.workflows', 'active');
                    let activeWorkflows = [];
                    
                    if (fs.existsSync(workflowsPath)) {
                        const wfDirs = fs.readdirSync(workflowsPath);
                        for (const wfDir of wfDirs) {
                            const wfMetaPath = path.join(workflowsPath, wfDir, 'metadata.json');
                            if (fs.existsSync(wfMetaPath)) {
                                try {
                                    const wfMeta = JSON.parse(fs.readFileSync(wfMetaPath, 'utf8'));
                                    activeWorkflows.push(wfMeta);
                                } catch (e) {}
                            }
                        }
                    }

                    projects.push({
                        id: dir,
                        ...metadata,
                        workflows: {
                            active: activeWorkflows
                        }
                    });
                } catch (e) {
                    console.error('Error reading project', dir, e);
                }
            }
        }

        res.json(projects);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal error' });
    }
});

app.listen(PORT, () => {
    console.log('Dashboard running on port ' + PORT);
});
