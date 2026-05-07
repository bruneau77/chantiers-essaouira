# Script d'installation pour Windows
# À exécuter depuis C:\Users\USUARIO\Projets\chantiers-essaouira\chantiers-essaouira
#
# Usage : .\install-windows.ps1
#
# Ce script :
#   1. Remplace le schéma Prisma par la version SQLite
#   2. Crée le fichier .env (à partir du .env.example adapté)
#   3. Installe les dépendances backend
#   4. Génère le client Prisma
#   5. Crée la base SQLite et applique le schéma
#   6. Insère les données de démo (seed Villa PY)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Installation de Chantiers Essaouira (mode SQLite dev)..." -ForegroundColor Cyan
Write-Host ""

# Verifier qu'on est dans le bon dossier
if (-not (Test-Path "backend")) {
  Write-Host "Erreur : ce script doit etre lance depuis la racine du projet" -ForegroundColor Red
  Write-Host "       (le dossier qui contient backend/, frontend/, deploy/...)" -ForegroundColor Red
  exit 1
}

# Etape 1 : remplacer le schema Prisma
Write-Host "[1/6] Remplacement du schema Prisma (PostgreSQL -> SQLite)..." -ForegroundColor Yellow
Copy-Item -Path "patch\schema.prisma" -Destination "backend\prisma\schema.prisma" -Force
Write-Host "      OK schema SQLite installe" -ForegroundColor Green

# Etape 2 : creer le .env
Write-Host "[2/6] Creation du fichier .env..." -ForegroundColor Yellow
Copy-Item -Path "patch\.env" -Destination "backend\.env" -Force
Write-Host "      OK .env cree" -ForegroundColor Green

# Etape 3 : installer les dependances backend
Write-Host "[3/6] Installation des dependances backend (peut prendre 1-2 min)..." -ForegroundColor Yellow
Set-Location backend
npm install
if ($LASTEXITCODE -ne 0) {
  Write-Host "      Echec npm install" -ForegroundColor Red
  Set-Location ..
  exit 1
}
Write-Host "      OK dependances installees" -ForegroundColor Green

# Etape 4 : generer le client Prisma
Write-Host "[4/6] Generation du client Prisma..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -ne 0) {
  Write-Host "      Echec prisma generate" -ForegroundColor Red
  Set-Location ..
  exit 1
}
Write-Host "      OK client Prisma genere" -ForegroundColor Green

# Etape 5 : creer la base et appliquer le schema
Write-Host "[5/6] Creation de la base SQLite et migration..." -ForegroundColor Yellow
npx prisma migrate dev --name init --skip-seed
if ($LASTEXITCODE -ne 0) {
  Write-Host "      Echec prisma migrate" -ForegroundColor Red
  Set-Location ..
  exit 1
}
Write-Host "      OK base SQLite creee (backend\prisma\dev.db)" -ForegroundColor Green

# Etape 6 : seed
Write-Host "[6/6] Insertion des donnees de demo (Villa PY)..." -ForegroundColor Yellow
npx prisma db seed
if ($LASTEXITCODE -ne 0) {
  Write-Host "      Echec seed" -ForegroundColor Red
  Set-Location ..
  exit 1
}

Set-Location ..

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  Installation terminee avec succes !" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Comptes de connexion (une fois le module Auth implemente) :" -ForegroundColor Cyan
Write-Host "  admin@ludimmo.ma     / admin123  (Yassine)"
Write-Host "  dominique@ludimmo.ma / chef123   (Dominique)"
Write-Host "  rachid@ludimmo.ma    / chef123   (Rachid)"
Write-Host ""
Write-Host "Prochaines etapes :" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Lancer le backend :" -ForegroundColor White
Write-Host "     cd backend"
Write-Host "     npm run dev"
Write-Host "     -> API sur http://localhost:3000"
Write-Host ""
Write-Host "  2. Dans un autre terminal, installer et lancer le frontend :"
Write-Host "     cd frontend"
Write-Host "     npm install"
Write-Host "     Copy-Item .env.example .env"
Write-Host "     npm run dev"
Write-Host "     -> Web sur http://localhost:5173"
Write-Host ""
Write-Host "  3. Pour explorer la base SQLite visuellement :"
Write-Host "     cd backend"
Write-Host "     npx prisma studio"
Write-Host "     -> Interface sur http://localhost:5555"
Write-Host ""
