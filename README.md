# Chantiers Essaouira

Application de gestion de chantiers pour Ludimmo Travaux (Essaouira, Maroc).
Multi-utilisateurs, mobile-first, déployable sur VPS Hostinger KVM 1.

## Aperçu

Cette app remplace le tableur Google Sheets actuel par une vraie application
web installable (PWA) que Dominique peut utiliser depuis son téléphone sur le
terrain, et que Yassine pilote depuis ordinateur/tablette.

**Fonctionnalités V1 (MVP) :**

- Saisie chantiers avec photos et avenants
- Devis double colonne (brut interne / prix client) avec marge par ligne
- Génération PDF imprimable (colonne brute masquée)
- Échéancier paiements 30/40/30 avec alertes relances automatiques
- Frais kilométriques auto (Touareg V6 TDI, prix gasoil ajustable)
- Comptabilité Yassine/Rachid avec parts personnalisables par chantier
- Catalogue matériaux + fournisseurs avec historique des prix
- Avances séparées sous-traitants / distributeurs
- Planning interventions (calendrier)

**Rôles utilisateurs :**

- **admin** (Yassine) : tout y compris paramètres et marges brutes
- **chef** (Dominique) : chantiers, devis, paiements, avances
- **sous_traitant** (Rachid) : ses chantiers, sa part, avancement, photos
- **client** : ses devis (vue client), avancement, échéancier

## Stack technique

| Couche | Techno | Pourquoi |
|---|---|---|
| Backend | Node.js 20 + Fastify | Rapide, léger pour 4 GB RAM |
| ORM | Prisma | Schéma typé, migrations propres |
| DB | PostgreSQL 16 | Requêtes compta complexes |
| Auth | JWT + refresh tokens | Stateless, mobile-friendly |
| Frontend | SvelteKit | Léger, SSR, PWA native |
| PDF | Puppeteer | Devis imprimables fidèles HTML |
| Reverse proxy | Caddy | HTTPS auto Let's Encrypt |
| Process | PM2 | Restart auto, logs centralisés |
| Stockage photos | Local + Sharp | Compression auto, 50 GB suffit |

## Démarrage rapide (développement local)

### Prérequis

- Node.js 20+ ([nvm](https://github.com/nvm-sh/nvm) recommandé)
- Docker + Docker Compose (pour PostgreSQL local)
- Git
- Claude Code installé (`npm install -g @anthropic-ai/claude-code`)

### Setup

```bash
# 1. Cloner et entrer dans le projet
git clone <repo>
cd chantiers-essaouira

# 2. Démarrer PostgreSQL en local
docker compose up -d

# 3. Backend
cd backend
npm install
cp .env.example .env       # Adapter si besoin
npx prisma migrate dev     # Créer les tables
npx prisma db seed         # Données de démo
npm run dev                # http://localhost:3000

# 4. Frontend (nouvel onglet terminal)
cd frontend
npm install
cp .env.example .env
npm run dev                # http://localhost:5173

# 5. Lancer Claude Code à la racine du projet
cd ..
claude
```

### Comptes de démonstration

Après `prisma db seed` :

- **admin@ludimmo.ma** / `admin123` (Yassine)
- **dominique@ludimmo.ma** / `chef123` (Dominique)
- **rachid@ludimmo.ma** / `chef123` (Rachid)

## Structure du projet

```
chantiers-essaouira/
├── backend/                # API Fastify + Prisma
│   ├── prisma/             # Schéma DB et migrations
│   ├── src/
│   │   ├── routes/         # Endpoints REST par module
│   │   ├── services/       # Logique métier
│   │   ├── middleware/     # Auth, rôles, validation
│   │   └── lib/            # Utilitaires (PDF, calculs km)
│   └── CLAUDE.md           # Contexte pour Claude Code
├── frontend/               # SvelteKit PWA
│   ├── src/
│   │   ├── routes/         # Pages de l'app
│   │   └── lib/            # Composants, stores, utils
│   ├── static/             # Manifest PWA, icônes
│   └── CLAUDE.md
├── deploy/                 # Scripts et config VPS
│   ├── Caddyfile           # Reverse proxy + HTTPS
│   ├── ecosystem.config.js # PM2
│   └── deploy.sh           # Script déploiement
├── docs/                   # Documentation utilisateur
└── CLAUDE.md               # Contexte global pour Claude Code
```

## Déploiement sur Hostinger VPS KVM 1

Voir `deploy/DEPLOY.md` pour la procédure complète.

Résumé : push sur Git → SSH au VPS → `git pull` → `pm2 restart`.

## Licence

Privée — Ludimmo SARL, Essaouira.
