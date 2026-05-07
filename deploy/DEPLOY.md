# Déploiement sur Hostinger VPS KVM 1

Procédure complète pour déployer Chantiers Essaouira sur ton VPS Ubuntu.

## Pré-requis VPS

- Ubuntu 22.04 LTS ou 24.04 LTS
- Accès SSH root (fourni par Hostinger dans hPanel)
- IP publique du VPS

## 1. Première connexion et durcissement

```bash
ssh root@TON_IP_VPS

# Mise à jour
apt update && apt upgrade -y

# Créer un utilisateur non-root
adduser ludimmo
usermod -aG sudo ludimmo

# Copier ta clé SSH (depuis ta machine locale)
# ssh-copy-id ludimmo@TON_IP_VPS

# Désactiver login root par mot de passe
nano /etc/ssh/sshd_config
# Mettre : PermitRootLogin prohibit-password
# Mettre : PasswordAuthentication no
systemctl restart ssh

# Pare-feu
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable
```

## 2. Installer les dépendances

```bash
# Node.js 20 (via nvm ou nodesource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Vérifier
node --version  # doit afficher v20.x

# PM2 globalement
sudo npm install -g pm2

# PostgreSQL 16
sudo apt install -y postgresql postgresql-contrib

# Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy

# Git
sudo apt install -y git

# Outils Puppeteer (pour génération PDF)
sudo apt install -y \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  libgbm1 libpango-1.0-0 libcairo2 libasound2t64
```

## 3. Configurer PostgreSQL

```bash
sudo -u postgres psql

# Dans psql :
CREATE USER ludimmo WITH PASSWORD 'CHOISIS_UN_VRAI_MOT_DE_PASSE';
CREATE DATABASE chantiers_essaouira OWNER ludimmo;
GRANT ALL PRIVILEGES ON DATABASE chantiers_essaouira TO ludimmo;
\q
```

## 4. Cloner et configurer le projet

```bash
sudo mkdir -p /var/app
sudo chown ludimmo:ludimmo /var/app
cd /var/app

# Cloner depuis ton repo Git (à créer sur GitHub d'abord)
git clone https://github.com/ton-user/chantiers-essaouira.git
cd chantiers-essaouira

# Backend
cd backend
npm ci --production=false
cp .env.example .env
nano .env
# → DATABASE_URL=postgresql://ludimmo:MOT_DE_PASSE@localhost:5432/chantiers_essaouira?schema=public
# → JWT_SECRET=$(openssl rand -base64 64)
# → JWT_REFRESH_SECRET=$(openssl rand -base64 64)
# → CORS_ORIGINS=http://TON_IP_VPS
# → UPLOAD_DIR=/var/app/uploads

mkdir -p /var/app/uploads
sudo chown -R ludimmo:ludimmo /var/app/uploads

npx prisma migrate deploy
npx prisma db seed

# Frontend
cd ../frontend
npm ci
echo "VITE_API_URL=/api" > .env
npm run build
```

## 5. Démarrer avec PM2

```bash
cd /var/app/chantiers-essaouira
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup
# Suivre l'instruction affichée par PM2 (sudo env...)
```

## 6. Configurer Caddy

```bash
sudo cp /var/app/chantiers-essaouira/deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy
```

## 7. Vérifier

Depuis ton navigateur : `http://TON_IP_VPS`
Depuis le VPS : `curl http://localhost/api/health`

Tu devrais voir le placeholder de l'app et `{"status":"ok",...}` sur l'API.

## 8. Mises à jour ultérieures

À chaque changement poussé sur Git :

```bash
ssh ludimmo@TON_IP_VPS
cd /var/app/chantiers-essaouira
git pull

# Backend (si schéma DB modifié)
cd backend
npm ci --production=false
npx prisma migrate deploy
pm2 restart chantiers-api

# Frontend (si modifs)
cd ../frontend
npm ci
npm run build
pm2 restart chantiers-web
```

## 9. Sauvegardes PostgreSQL automatiques

```bash
sudo nano /etc/cron.daily/backup-chantiers
```

Contenu :

```bash
#!/bin/bash
BACKUP_DIR=/var/backups/chantiers
mkdir -p $BACKUP_DIR
DATE=$(date +%Y-%m-%d)
sudo -u postgres pg_dump chantiers_essaouira | gzip > $BACKUP_DIR/db-$DATE.sql.gz
# Garder 30 jours
find $BACKUP_DIR -name "db-*.sql.gz" -mtime +30 -delete
```

```bash
sudo chmod +x /etc/cron.daily/backup-chantiers
```

## Domaine plus tard

Quand tu auras acheté un domaine :

1. Créer un enregistrement DNS A `chantiers.tondomaine.com` → `TON_IP_VPS`
2. Modifier `/etc/caddy/Caddyfile` (décommenter le bloc avec le domaine)
3. `sudo systemctl reload caddy` → Caddy obtient automatiquement un certif HTTPS
4. Modifier `frontend/.env` → `VITE_API_URL=https://chantiers.tondomaine.com/api`
5. Rebuild frontend et `pm2 restart`
