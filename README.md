# Projects Dashboard

## Deploiement

1. Copier le projet sur le serveur:
```bash
rsync -avz ~/workspace/projects-dashboard/ alt:~/projects-dashboard/
```

2. Generer le hash basicauth:
```bash
htpasswd -nb admin motdepasse
# Resultat: admin:$$apr1$$...
```

3. Creer le .env sur le serveur:
```bash
cd ~/projects-dashboard/deploy
echo "DASHBOARD_AUTH=admin:\$$apr1\$$..." > .env
```

4. Lancer:
```bash
docker-compose up -d --build
```

## Acces

https://dashboard.51.77.223.61.nip.io

## Structure des donnees

Le dashboard lit les projets depuis `/data/projects` (monte depuis `~/projects-sync`).

Chaque projet doit avoir:
- `.project/metadata.json` - infos du projet
- `.workflows/active/*/metadata.json` - workflows en cours
