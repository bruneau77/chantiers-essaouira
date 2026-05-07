# Démarrage rapide — Chantiers Essaouira

Guide condensé pour relancer le projet chez toi avec Claude Code.

## 1. Pré-requis sur ta machine

- **Node.js 20+** (vérifier : `node --version`)
- **Docker Desktop** (pour PostgreSQL local)
- **Git**
- **Claude Code** : `npm install -g @anthropic-ai/claude-code`

## 2. Premier lancement

```bash
# Décompresser le .zip dans le dossier de ton choix
cd ~/Projets
unzip chantiers-essaouira.zip
cd chantiers-essaouira

# Initialiser Git (recommandé)
git init
git add .
git commit -m "Initial commit — squelette projet"

# Démarrer PostgreSQL en local
docker compose up -d

# Backend
cd backend
npm install
cp .env.example .env
# (Optionnel) Éditer .env si tu veux changer le mot de passe DB
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed

# Lancer le backend (laisser ce terminal ouvert)
npm run dev
# → API disponible sur http://localhost:3000
```

Dans un **nouveau terminal** :

```bash
cd chantiers-essaouira/frontend
npm install
cp .env.example .env
npm run dev
# → Frontend sur http://localhost:5173
```

Tu dois voir la page placeholder.

## 3. Lancer Claude Code

Dans un **3e terminal**, à la racine du projet :

```bash
cd chantiers-essaouira
claude
```

Claude Code lit automatiquement :
- `CLAUDE.md` (contexte global)
- `backend/CLAUDE.md` (si tu travailles backend)
- `frontend/CLAUDE.md` (si tu travailles frontend)

Premier message à essayer :

> "Lis le CLAUDE.md et propose un plan pour implémenter le module Auth
> avec login JWT, en suivant les conventions du projet."

## 4. Workflow recommandé

```
Tu codes avec Claude Code en local
        ↓
Tu testes avec http://localhost:5173
        ↓
git add / git commit / git push (sur GitHub privé)
        ↓
SSH sur ton VPS Hostinger
        ↓
git pull + pm2 restart
        ↓
L'app est en prod
```

## 5. Ordre suggéré des chantiers (ordre = priorité)

1. **Module Auth** — login, refresh token, middleware rôles
2. **Page connexion + layout global** avec nav bottom mobile
3. **Tableau de bord** (KPIs encaissé / à recevoir / parts)
4. **CRUD Chantiers** (liste + détail + création + photos)
5. **Module Devis** ⭐ le plus critique — double colonne brut/client
6. **Génération PDF Puppeteer** (vue interne + vue client)
7. **Module Paiements** (échéancier 30/40/30 + alertes)
8. **Module Avances** (sous-traitants + distributeurs)
9. **Catalogue matériaux** (utilisable depuis création de devis)
10. **Module Comptabilité** (parts Yassine/Rachid, agrégats par mois)
11. **Module Planning** (calendrier interventions)
12. **PWA finale** (manifest, service worker, mode offline)

## 6. Validation continue

Le devis Villa PY (cas test) doit toujours produire :
- Total brut ~129 915 DH
- Total client (marge 15%) ~149 402 DH
- Acompte 30% ~44 821 DH

Si tu casses ça, tu as cassé `lib/calculsDevis.js`.

## 7. Pour déployer sur le VPS

Voir `deploy/DEPLOY.md` — guide pas-à-pas complet.

Résumé express :
1. SSH sur le VPS, installe Node 20 + PostgreSQL + Caddy + PM2
2. Clone le repo dans `/var/app/chantiers-essaouira`
3. `npm ci`, `prisma migrate deploy`, `prisma db seed`, `npm run build`
4. `pm2 start deploy/ecosystem.config.js`
5. Copie `deploy/Caddyfile` dans `/etc/caddy/` et reload
6. C'est en ligne sur `http://TON_IP_VPS`

## 8. Si tu veux que je continue le développement ici

Tu peux me copier des fichiers dans une nouvelle conversation avec un message
du type :

> "Voici le projet Chantiers Essaouira. Implémente le module Auth (routes
> login, refresh, middleware) en suivant les conventions du CLAUDE.md."

Je le ferai en respectant exactement les conventions posées ici.
