-- CreateTable
CREATE TABLE "utilisateurs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT,
    "mot_de_passe_hash" TEXT,
    "prenom" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "telephone" TEXT,
    "adresse" TEXT,
    "notes" TEXT,
    "role" TEXT NOT NULL,
    "part_defaut_pct" INTEGER NOT NULL DEFAULT 50,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "cree_le" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token" TEXT NOT NULL,
    "utilisateur_id" INTEGER NOT NULL,
    "expire_le" DATETIME NOT NULL,
    "cree_le" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_tokens_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reglages" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "vehicule_modele" TEXT NOT NULL DEFAULT 'VW Touareg V6 TDI 2015-2016',
    "consommation_l_100km" REAL NOT NULL DEFAULT 9.5,
    "prix_gasoil_centimes" INTEGER NOT NULL DEFAULT 1150,
    "usure_centimes_par_km" INTEGER NOT NULL DEFAULT 80,
    "securite_aller_retour" INTEGER NOT NULL DEFAULT 1,
    "entreprise_nom" TEXT NOT NULL DEFAULT 'Ludimmo Travaux',
    "entreprise_adresse" TEXT NOT NULL DEFAULT '480 Borj 1, 44010 Essaouira',
    "entreprise_tel" TEXT NOT NULL DEFAULT '+212 6 87 19 86 36',
    "entreprise_email" TEXT NOT NULL DEFAULT 'ludimmo.essaouira@gmail.com',
    "modifie_le" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "lieux" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reference" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "client_id" INTEGER NOT NULL,
    "chef_id" INTEGER,
    "adresse" TEXT NOT NULL,
    "budget_estimatif_centimes" INTEGER,
    "statut" TEXT NOT NULL DEFAULT 'PROSPECT',
    "distance_aller_km" INTEGER,
    "nombre_aller_retour_prevu" INTEGER,
    "frais_essence_centimes" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "cree_le" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" DATETIME NOT NULL,
    CONSTRAINT "lieux_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "utilisateurs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "lieux_chef_id_fkey" FOREIGN KEY ("chef_id") REFERENCES "utilisateurs" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "postes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lieu_id" INTEGER NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "statut" TEXT NOT NULL DEFAULT 'A_FAIRE',
    "termine_le" DATETIME,
    "montant_brut_centimes" INTEGER NOT NULL DEFAULT 0,
    "montant_client_centimes" INTEGER NOT NULL DEFAULT 0,
    "marge_centimes" INTEGER NOT NULL DEFAULT 0,
    "marge_pourcent" REAL NOT NULL DEFAULT 0,
    "cree_le" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" DATETIME NOT NULL,
    CONSTRAINT "postes_lieu_id_fkey" FOREIGN KEY ("lieu_id") REFERENCES "lieux" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "paiements" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "poste_id" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "montant_centimes" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "description" TEXT,
    "cree_le" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "paiements_poste_id_fkey" FOREIGN KEY ("poste_id") REFERENCES "postes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "photos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "poste_id" INTEGER NOT NULL,
    "chemin_fichier" TEXT NOT NULL,
    "titre" TEXT,
    "description" TEXT,
    "pris_le" DATETIME,
    "uploade_le" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "photos_poste_id_fkey" FOREIGN KEY ("poste_id") REFERENCES "postes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "depenses" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lieu_id" INTEGER NOT NULL,
    "poste_id" INTEGER,
    "saisie_par_id" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "categorie" TEXT NOT NULL,
    "montant_centimes" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "fournisseur" TEXT,
    "est_avance_personnelle" BOOLEAN NOT NULL DEFAULT false,
    "statut" TEXT NOT NULL DEFAULT 'A_VALIDER',
    "validee_par_id" INTEGER,
    "validee_le" DATETIME,
    "corrigee_par_id" INTEGER,
    "corrigee_le" DATETIME,
    "cree_le" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_le" DATETIME NOT NULL,
    CONSTRAINT "depenses_lieu_id_fkey" FOREIGN KEY ("lieu_id") REFERENCES "lieux" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "depenses_poste_id_fkey" FOREIGN KEY ("poste_id") REFERENCES "postes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "depenses_saisie_par_id_fkey" FOREIGN KEY ("saisie_par_id") REFERENCES "utilisateurs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "depenses_validee_par_id_fkey" FOREIGN KEY ("validee_par_id") REFERENCES "utilisateurs" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "depenses_corrigee_par_id_fkey" FOREIGN KEY ("corrigee_par_id") REFERENCES "utilisateurs" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "budgets_lieu" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lieu_id" INTEGER NOT NULL,
    "poste_id" INTEGER,
    "user_id" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "montant_centimes" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "cree_par_id" INTEGER NOT NULL,
    "cree_le" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "budgets_lieu_lieu_id_fkey" FOREIGN KEY ("lieu_id") REFERENCES "lieux" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "budgets_lieu_poste_id_fkey" FOREIGN KEY ("poste_id") REFERENCES "postes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "budgets_lieu_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "utilisateurs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "budgets_lieu_cree_par_id_fkey" FOREIGN KEY ("cree_par_id") REFERENCES "utilisateurs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_email_key" ON "utilisateurs"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "lieux_reference_key" ON "lieux"("reference");

-- CreateIndex
CREATE INDEX "lieux_client_id_idx" ON "lieux"("client_id");

-- CreateIndex
CREATE INDEX "lieux_chef_id_idx" ON "lieux"("chef_id");

-- CreateIndex
CREATE INDEX "lieux_statut_idx" ON "lieux"("statut");

-- CreateIndex
CREATE INDEX "postes_lieu_id_idx" ON "postes"("lieu_id");

-- CreateIndex
CREATE INDEX "postes_statut_idx" ON "postes"("statut");

-- CreateIndex
CREATE INDEX "postes_termine_le_idx" ON "postes"("termine_le");

-- CreateIndex
CREATE INDEX "paiements_poste_id_idx" ON "paiements"("poste_id");

-- CreateIndex
CREATE INDEX "photos_poste_id_idx" ON "photos"("poste_id");

-- CreateIndex
CREATE INDEX "depenses_lieu_id_idx" ON "depenses"("lieu_id");

-- CreateIndex
CREATE INDEX "depenses_poste_id_idx" ON "depenses"("poste_id");

-- CreateIndex
CREATE INDEX "depenses_statut_idx" ON "depenses"("statut");

-- CreateIndex
CREATE INDEX "budgets_lieu_lieu_id_idx" ON "budgets_lieu"("lieu_id");

-- CreateIndex
CREATE INDEX "budgets_lieu_poste_id_idx" ON "budgets_lieu"("poste_id");

-- CreateIndex
CREATE INDEX "budgets_lieu_user_id_idx" ON "budgets_lieu"("user_id");
