# Patch SQLite — Mode d'emploi

Cette patch transforme le projet Chantiers Essaouira pour qu'il fonctionne
en local avec SQLite (au lieu de PostgreSQL via Docker).

## Application en 3 étapes

### Étape 1 : Décompresser le zip de la patch

Décompresse `patch-sqlite.zip` directement dans le dossier racine du projet.
Tu dois obtenir cette structure :

```
C:\Users\USUARIO\Projets\chantiers-essaouira\chantiers-essaouira\
├── backend/
├── frontend/
├── deploy/
├── docs/
├── patch/                    <- nouveau dossier créé par la patch
│   ├── schema.prisma
│   └── .env
├── install-windows.ps1       <- nouveau script
├── README.md
├── QUICKSTART.md
├── CLAUDE.md
└── ...
```

### Étape 2 : Exécuter le script d'installation

Dans PowerShell, depuis la racine du projet :

```powershell
cd C:\Users\USUARIO\Projets\chantiers-essaouira\chantiers-essaouira
.\install-windows.ps1
```

Si tu as une erreur de politique d'exécution :

```powershell
# Autorise l'exécution de ce script juste pour cette session
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\install-windows.ps1
```

Le script fait tout : remplace le schéma, installe les dépendances,
crée la base SQLite, et lance le seed avec le devis Villa PY.

### Étape 3 : Lancer le backend

```powershell
cd backend
npm run dev
```

Tu dois voir :
```
API Chantiers Essaouira en écoute sur http://0.0.0.0:3000
```

Tu peux tester en ouvrant http://localhost:3000/api/health dans ton navigateur.
Tu devrais voir : `{"status":"ok",...}`

## Ce qui a changé vs version PostgreSQL

- `provider = "sqlite"` au lieu de `postgresql`
- Tous les `enum` Prisma convertis en `String` (SQLite ne les supporte pas)
- La validation des valeurs autorisées se fera côté code avec zod
- Le fichier base de données est `backend/prisma/dev.db`

## Pour réinitialiser la base si besoin

```powershell
cd backend
Remove-Item prisma\dev.db
npx prisma migrate dev --name init
npx prisma db seed
```

## Pour explorer la base visuellement

```powershell
cd backend
npx prisma studio
```

Interface graphique sur http://localhost:5555 — pratique pour vérifier
les données.
