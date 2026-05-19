# Contexte projet pour Claude Code

Ce fichier est lu automatiquement par Claude Code à chaque session. Il
contient le contexte métier et les conventions techniques du projet
**Chantiers Essaouira** (Ludimmo Travaux).

---

## État au 2026-05-19 (après PHASE 2 refonte)

**La modélisation à trois niveaux CLIENT → LIEU → POSTE est en place.**
Toute référence ci-dessous au modèle Lieu/Poste/Paiement reflète l'état
actuel du code. Voir `docs/JOURNAL.md` entrée du 2026-05-19 pour le
détail de la refonte (5 commits successifs) et le plan associé.

L'ancien modèle (`Chantier`, `Devis`, `LigneDevis`, `Avenant`, ancien
`Paiement` avec échéancier, `Avance`, `Fournisseur`, `Materiau`,
`PrixHistorique`, `Intervention`, `BudgetChantier`) **n'existe plus**.
Toute documentation qui s'y référerait est à archiver ou supprimer.

---

## Le contexte métier (à lire avant tout)

**Qui ?**
- **Dominique Bruneau** : retraité français à Essaouira, gérant Ludimmo
  Travaux. Il prend les chantiers issus de son agence immo Ludimmo,
  s'associe avec **Rachid Aqoudi** (chef de chantier marocain) qui
  exécute via des ouvriers sous-traitants. Dominique gère la partie
  commerciale, les devis, les paiements clients, et avance souvent
  l'argent.
- **Yassine Bruneau** (son fils) : développe et maintient cette app,
  a un rôle admin pour configurer le système.
- **Rachid Aqoudi** : chef de chantier, voit ses Lieux, déclare
  l'avancement des Postes (statut), envoie des photos (module à venir),
  saisit les dépenses.
- **Clients** : propriétaires de villas/riads à Essaouira (souvent
  expatriés français). Ludimmo intervient en continu sur leurs biens,
  Poste après Poste, au fil des mois.

**Le problème qu'on résout :**

Dominique gérait ses chantiers sur tableur. Le passage à un app web
adresse trois douleurs identifiées et confirmées par l'observation
terrain :

1. **Suivi des paiements client floues** : un même bien immobilier
   reçoit plusieurs Postes (interventions) au fil du temps. Chaque
   Poste se règle en plusieurs versements CASH ou VIREMENT, à des
   dates imprévisibles. L'app tient le compteur « payé / reste à
   recevoir » par Poste et fait remonter les créances en retard
   (Postes TERMINE non intégralement payés) sur le dashboard admin.
2. **Marges floues** : l'app trace `montantBrutCentimes` (coût réel
   pour Ludimmo) et `montantClientCentimes` (prix facturé) sur chaque
   Poste, et calcule la marge auto. Le chef ne voit jamais ces
   montants (strip côté API).
3. **Compta floue** : Dominique avance souvent l'argent. L'app sépare
   le cash qu'il donne à Rachid en début de Lieu (`BudgetLieu` type
   `VERSEMENT`) des avances personnelles de Rachid (`Depense` avec
   `estAvancePersonnelle = true`) et calcule ce qui reste dû.

---

## Modélisation (résumé — détail dans `backend/prisma/schema.prisma`)

```
CLIENT (Utilisateur, role='client')
  └─ LIEU (1..N par client)
       ├─ POSTE (intervention chiffrée = devis 1 ligne)
       │    ├─ PAIEMENT[] (CASH | VIREMENT, libres au fil de l'eau)
       │    ├─ DEPENSE.posteId[] (optionnel, SetNull)
       │    ├─ BUDGETLIEU.posteId[] (optionnel, SetNull)
       │    └─ PHOTO[] (modèle prêt, aucune API V1)
       ├─ DEPENSE.lieuId[] (obligatoire)
       └─ BUDGETLIEU.lieuId[] (obligatoire)
```

**Référence Lieu** : `L-2026-NNN` (compteur annuel, géré côté backend).
Pas de référence de Poste — un Poste se cite par son titre dans son
Lieu.

**Statuts Lieu** : `PROSPECT | EN_COURS | TERMINE`. Calculé
applicativement par `lib/postesHelpers.recalculerStatutLieu(lieuId)`
dans la même transaction que toute mutation de Poste. PROSPECT si
aucun Poste ou que des A_FAIRE, TERMINE si tous TERMINE, EN_COURS
sinon.

**Statuts Poste** : `A_FAIRE | EN_COURS | TERMINE`. Machine à états
pour le chef : `A_FAIRE → EN_COURS`, `EN_COURS → TERMINE`,
`TERMINE → EN_COURS` autorisés ; `EN_COURS → A_FAIRE` et
`TERMINE → A_FAIRE` interdits (422). L'admin a toutes les transitions
libres. Champ `Poste.termineLe DateTime?` mis à jour automatiquement
quand le statut passe à TERMINE.

---

## Logique métier critique (à respecter dans tout le code)

### 1. Montants Poste (brut vs client)

Chaque Poste a :
- `montantBrutCentimes` : ce que Dominique paie en réel (fournisseurs +
  main d'œuvre cumulés sur l'intervention)
- `montantClientCentimes` : ce qui est facturé au client
- `margeCentimes` = `montantClientCentimes - montantBrutCentimes`
  (recalculé automatiquement par `routes/postes.js`)
- `margePourcent` = `(marge / brut) * 100` arrondi 2 décimales

**Le chef ne voit jamais ces 4 champs** (strippés côté API via
`selectPosteSelonRole(user)` dans `lib/postesHelpers.js`, doublé d'un
`{#if estAdmin}` côté frontend).

### 2. Paiements libres au fil de l'eau

**Pas d'échéancier 30/40/30** (supprimé en refonte 2026-05-19). Un
Poste reçoit N paiements (`CASH` ou `VIREMENT`) à des dates
imprévisibles. Le « reste à recevoir » est calculé en temps réel :
`montantClientCentimes - Σ(paiements.montantCentimes)`.

Côté UI, sur la fiche Poste admin : bloc résumé `Total payé / Reste
à recevoir` + formulaire « + Paiement reçu ». Côté dashboard admin,
section « Créances à recouvrer » : Postes TERMINE dont le reste à
recevoir > 0, triés par `termineLe asc` (plus vieille créance d'abord).

### 3. Frais kilométriques (Touareg V6 TDI 2015-2016)

Formule dans `backend/src/lib/fraisKm.js` (inchangé par la refonte) :

```
coutKm = (consommation_l_par_100km × prix_gasoil_dh_par_l) / 100
       + usure_dh_par_km

frais_essence = distance_aller_simple_km × 2 × (nb_aller_retour_prevus + securite_ar)
              × coutKm
```

Paramètres par défaut (modèle `Reglages`) :
- consommation : 9.5 L/100km
- prix gasoil : 11.5 DH/L (mise à jour manuelle)
- usure : 0.8 DH/km
- securité_ar : +1 (toujours ajouter 1 A/R de sécurité)

Calculés au niveau **Lieu** (la distance dépend du bien, pas de
l'intervention).

### 4. Cash Dominique → Rachid (BudgetLieu)

Modèle `BudgetLieu` :
- `type = 'VERSEMENT'` : Dominique donne du cash à Rachid pour démarrer
  un Lieu ou un Poste précis. `posteId` optionnel (null = global Lieu).
- `type = 'REMBOURSEMENT'` : Dominique rembourse une avance
  personnelle de Rachid.

Synthèse compta par Lieu (`GET /api/lieux/:id/compta`) :
- `budgetRecu` = Σ VERSEMENT
- `totalDepense` = Σ Depense (hors avances perso)
- `soldeRestant` = budgetRecu - totalDepense
- `totalAvancesPerso` = Σ Depense avec `estAvancePersonnelle = true`
- `totalRembourse` = Σ REMBOURSEMENT
- `dominiqueMeDoit` = totalAvancesPerso - totalRembourse

### 5. Dépenses Rachid

Modèle `Depense` :
- `lieuId` obligatoire
- `posteId` optionnel (affectation fine à un Poste précis pour calcul
  de marge réelle ; SetNull si le Poste est supprimé)
- `fournisseur` String? texte libre (« Hassan menuisier », distributeur
  ciment, etc.) — **pas de modèle Fournisseur persistant en V1**
- `categorie` : `ACOMPTE | MATERIEL | REPAS`
- `estAvancePersonnelle` : booléen (cf. point 4)
- `statut` : `A_VALIDER | VALIDEE` — saisie chef = A_VALIDER, saisie
  admin = VALIDEE auto, modif admin sur A_VALIDER = validation auto

**Badge admin** : `/api/depenses/a-valider/count` (compteur dépenses
A_VALIDER) alimente le pastille sur l'onglet Compta du NavBas. Décrément
local immédiat à la validation/suppression, polling 60 s en filet de
sécurité.

---

## Permissions par rôle (résumé exhaustif)

| Action | Admin | Chef |
|---|---|---|
| Voir tous les Lieux | ✅ | ❌ (uniquement `lieu.chefId = user.id`) |
| Créer / modifier un Lieu | ✅ | ❌ |
| Voir les montants d'un Poste | ✅ | ❌ (strippé côté API) |
| Créer / supprimer un Poste | ✅ | ❌ |
| Modifier titre / description / montants d'un Poste | ✅ | ❌ (zod strict refuse) |
| Modifier le statut d'un Poste | ✅ libre | ✅ selon machine à états Q8 |
| Créer / modifier / supprimer un Paiement | ✅ | ❌ |
| Voir la compta d'un Lieu | ✅ | ✅ si chef du Lieu |
| Saisir une dépense | ✅ direct VALIDEE | ✅ A_VALIDER |
| Affecter une dépense à un Poste | ✅ | ✅ |
| Valider une dépense | ✅ | ❌ |
| Créer / modifier / supprimer un Budget | ✅ | ❌ |
| Dashboard admin (`/compta`) | ✅ | ❌ (voit ses Lieux à la place) |
| `POST /api/admin/recalculer-statuts` | ✅ | ❌ |

---

## Conventions techniques

### Code style

- **Backend** : ESM (`import`/`export`), pas de CommonJS. Pas de
  TypeScript pour la V1 (on garde simple), JSDoc pour le typage.
- **Frontend** : SvelteKit en JavaScript (pas TS V1), runes Svelte 5
  (`$state`, `$derived`, `$props`, `$effect`).
- **Nommage** : camelCase pour JS, snake_case pour colonnes DB
  (via `@map(...)` Prisma), PascalCase pour composants Svelte.
- **Commentaires** : en français, c'est un projet francophone.

### Devises et formats

- Toutes les valeurs monétaires sont en **DH (dirhams marocains)**
  stockées en **centimes** dans la DB (entiers, pas de flottant) pour
  éviter les erreurs d'arrondi.
- Format affichage : `129 915 DH` (espace milliers, pas de décimales
  sauf besoin spécifique). Helper inline `formaterDh(centimes)` dans
  chaque page (pas de lib partagée pour rester pragmatique).
- Dates : ISO 8601 en DB, format `JJ/MM/AAAA` à l'affichage.

### Sécurité

- Mots de passe : bcrypt cost 12.
- JWT : access token 15 min, refresh token 7 jours.
- Toutes les requêtes DB via Prisma (pas de SQL brut sauf cas justifié).
- Validation entrées avec `zod` côté backend, jamais faire confiance
  au frontend. `.strict()` pour les schémas restreints par rôle
  (refuse les champs inconnus avec 400 VALIDATION).
- Strip défensif des champs interdits selon rôle dans les `select:`
  Prisma (cf. `selectPosteSelonRole`).

### Photos chantier (préparé mais non implémenté)

Le modèle `Photo` existe dans le schéma avec FK `posteId`, mais aucune
route Fastify ni UI n'est livrée en V1. À implémenter dans une
session future :
- Endpoint `POST /api/postes/:id/photos` (multipart, Sharp 1920px qualité 80 WebP)
- Stockage `/uploads/postes/{posteId}/`
- Servi en static par Caddy avec cache 30j

---

## Architecture API (préfixes Fastify)

| Préfixe | Source | Rôles |
|---|---|---|
| `/api/auth` | `routes/auth.js` | tous |
| `/api/users` | `routes/users.js` | admin (dropdowns) |
| `/api/clients` | `routes/clients.js` | admin (création inline) |
| `/api/lieux` | `routes/lieux.js` + `routes/compta.js#routesComptaLieu` | admin + chef (sur ses Lieux) |
| `/api/postes` | `routes/postes.js` | admin + chef (lecture + statut) |
| `/api/paiements` | `routes/paiements.js` | admin |
| `/api/depenses` | `routes/depenses.js` | admin + chef |
| `/api/budgets` | `routes/budgets.js` | admin |
| `/api/compta` | `routes/compta.js` (dashboard) | admin |
| `/api/admin` | `routes/admin.js` | admin (recalc statuts) |

Helper partagé : `lib/postesHelpers.js` exporte
`selectPosteSelonRole`, `transitionAutorisee`, `recalculerStatutLieu`,
constante `STATUTS_POSTE`.

---

## Modules à implémenter (post-PHASE 2)

| Module | Statut |
|---|---|
| Module Photos (upload + galerie sur fiche Poste) | À implémenter |
| PDF devis / récap client | À implémenter |
| Compta générale analytique (page `/compta/general`) | Placeholder seul |
| Migration PostgreSQL pour prod | Préparé dans le schéma (datasource sqlite à basculer) |
| Espace client par URL secrète | V1.5 / V2 |

Hors V1 et non planifié : `LigneDevis` séparé, échéancier automatique
30/40/30, modèle `Fournisseur` persistant, statut ANNULE Poste, statut
ARCHIVE Lieu, multi-chefs par Lieu, suppression Lieu/Client.

---

## Données de référence (seed)

Le seed (`backend/prisma/seed.js`) crée :
- 4 utilisateurs : Yassine (admin), Dominique (admin), Rachid Aqoudi
  (chef, `rachid_aqoudi@hotmail.fr`), Pierre-Yves Laurent (client sans
  connexion).
- 1 Lieu `L-2026-001` « Villa Pierre-Yves Laurent », statut EN_COURS,
  Essaouira, 8 km × 12 A/R.
- 3 Postes couvrant les 3 statuts (TERMINE intégralement payé,
  EN_COURS partiellement payé, A_FAIRE).
- 2 paiements (VIREMENT solde Poste A + CASH partiel Poste B).
- 3 dépenses (2 VALIDEE affectées Poste, 1 A_VALIDER globale au Lieu).
- 2 budgets (1 VERSEMENT global, 1 VERSEMENT affecté au Poste A).

**Mots de passe** : `admin123` (Yassine), `chef123` (Dominique et Rachid
pour le moment — Dominique changera plus tard).

---

## Comportements attendus de Claude Code

Quand tu travailles sur ce projet :

1. **Lire `docs/JOURNAL.md` en tout premier** — il contient le dernier
   état d'avancement et les décisions récentes. L'entrée du 2026-05-19
   résume la refonte Lieu/Poste/Paiement et ses 8 décisions techniques
   (Q1-Q8).
2. **À la fin de chaque session importante** (module terminé, décision
   prise, anomalie identifiée), proposer d'ajouter une entrée au
   `JOURNAL.md`. Préférer **Edit** avec un ancrage chirurgical à un
   Write complet sur ce fichier (1300+ lignes).
3. **Lire aussi le `CLAUDE.md`** du sous-dossier sur lequel tu travailles
   (`backend/CLAUDE.md` ou `frontend/CLAUDE.md` si présent).
4. **Respecter la logique métier** ci-dessus, surtout :
   - Le strip côté API des montants Poste pour le rôle chef
   - La machine à états Q8 (chef ne peut pas reculer vers A_FAIRE)
   - Le `recalculerStatutLieu` dans la même transaction que toute
     mutation de Poste
   - Le filtrage `lieu.chefId = user.id` pour le rôle chef sur toutes
     les routes Lieu/Poste/Dépense/Budget
5. **Tester avec le seed** quand tu touches au module Poste/Paiement
   (Villa Pierre-Yves + 3 Postes couvrent les 3 statuts et les chemins
   typiques).
6. **Pas de surcouche inutile** : pas de Redux, pas de TypeScript V1,
   pas de tests E2E pour démarrer. Pragmatique.
7. **Demander avant d'ajouter une dépendance npm** — chaque package
   compte sur 4 GB RAM.
8. **Communiquer en français** dans le code (commentaires, messages
   d'erreur utilisateur, libellés UI).
9. **Fichiers déjà corrompus par bash append** dans des sessions
   passées : `seed.js`, `routes/depenses.js`. Pour ces fichiers,
   **réécriture complète via Write**, jamais d'append. Le `JOURNAL.md`
   se gère via **Edit** chirurgical, jamais d'append non plus.
10. **Règle EPERM Prisma** : avant `prisma migrate dev` ou
    `prisma generate`, arrêter le serveur Node (sinon le DLL est
    verrouillé). Règle apprise dans la douleur en session 2026-05-16.
