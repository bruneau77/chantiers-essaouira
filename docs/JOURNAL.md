# Journal de bord — Chantiers Essaouira

Ce fichier sert de mémoire entre les sessions de développement. Claude
n'a pas d'historique entre les conversations : à chaque nouvelle session,
**lire ce journal en premier** (après `CLAUDE.md`) pour reprendre où on
en était sans tout refaire.

**Convention** : on ajoute une nouvelle section en haut à chaque session
importante. Les anciennes sessions restent en dessous, par ordre
chronologique inverse (la plus récente en haut).

---

## Session du 2026-05-19 — PHASE 2 refonte Lieu/Poste/Paiement exécutée

> **Refonte livrée.** La PHASE 2 — l'exécution du plan validé en
> PHASE 1 — est terminée. La modélisation à trois niveaux
> **CLIENT → LIEU → POSTE** est en place de bout en bout (schéma,
> backend, seed, frontend) et a passé les tests visuels en local.
> 5 commits Git successifs, chacun verrouillé sur GitHub avant
> l'enchaînement suivant.

### Statut

L'app tourne sur le nouveau modèle. La DB locale contient la Villa
Pierre-Yves Laurent (`L-2026-001`) avec 3 Postes couvrant les 3 statuts,
2 paiements, 3 dépenses, 2 budgets — tout est cohérent et le statut du
Lieu est bien recalculé à `EN_COURS` par la fonction applicative
`recalculerStatutLieu`. Aucune trace de l'ancien modèle (Chantier,
Devis, LigneDevis, Avenant, Avance, Fournisseur, Materiau,
PrixHistorique, Intervention, BudgetChantier) ne subsiste, ni au schéma
ni dans le code.

### Découpage en commits (verrouillés sur GitHub dans l'ordre)

| # | Commit | Contenu |
|---|---|---|
| 1 | `e1f436a` — `refonte(schema)` | Nouveau `schema.prisma` (9 modèles), une seule migration `init_lieu_poste_paiement`, reset complet de `dev.db`. Anciennes migrations purgées. |
| 2 | `2d07216` — `refonte(backend)` | 11 fichiers : helper `lib/postesHelpers.js` (3 utilitaires partagés), routes neuves `routes/{lieux,postes,paiements,admin}.js`, réécriture `routes/{depenses,budgets,compta}.js` et `server.js`. Suppression `routes/chantiers.js` et `lib/calculsDevis.js`. |
| 3 | (seed inclus dans le rebuild après commit 2) | Réécriture complète `prisma/seed.js` avec les corrections de données (Rachid AQOUDI / `rachid_aqoudi@hotmail.fr`). |
| 4 | `61676b3` — `refonte(frontend)` | 11 fichiers Svelte : `NouveauPosteModale.svelte` neuve, refonte d'`AjoutDepenseForm`, `DepenseRow`, `NavBas`, 6 pages réécrites/créées sous `lieux/` (liste, nouveau, fiche, compta, fiche poste) + adaptation du dashboard `/compta`. Ancien dossier `chantiers/` supprimé. |
| 5 | (cette entrée) | Mise à jour `JOURNAL.md` + `CLAUDE.md`, vérification absence de debug oublié. |

### Décisions techniques majeures (8 questions Q1-Q8 validées et implémentées)

- **Q1 — Statut Lieu calculé.** Colonne stockée `statut`, recalculée
  applicativement après chaque mutation de Poste dans la même
  transaction Prisma (`prisma.$transaction` + `recalculerStatutLieu`).
  Pas de hook middleware. Endpoint admin caché
  `POST /api/admin/recalculer-statuts` pour recalcul en bloc (non
  exposé dans l'UI).
- **Q2 — Politique `onDelete`.** Lieu→Poste/Depense/BudgetLieu :
  `Restrict`. Poste→Paiement : `Restrict` (protection traçabilité
  financière, divergence vs proposition initiale). Poste→Photo :
  `Cascade`. Poste→Depense/BudgetLieu : `SetNull`. Pas de
  `DELETE /api/lieux/:id` ni `DELETE /api/clients/:id` en V1.
  `DELETE /api/postes/:id` ne passe que si 0 paiement ET 0 dépense,
  sinon `409 POSTE_NON_SUPPRIMABLE`.
- **Q3 — Champs orphelins Reglages purgés.** Suppression de
  `pctAcompte`, `pctMiChantier`, `pctSolde`, `joursAvantRelanceAcompte`,
  `margeDefautPct`, `baseCommission` (logique 30/40/30 et partage
  Yassine/Rachid hors V1). Reste véhicule + entreprise.
- **Q4 — Dashboard admin « créances à recouvrer ».** Remplace l'ancienne
  section « paiements clients en attente ». Liste les Postes TERMINE
  dont la somme des paiements est strictement inférieure à
  `montantClientCentimes`, triés par `termineLe asc` (créance la plus
  ancienne d'abord). Champ `Poste.termineLe DateTime?` ajouté au schéma,
  mis à jour automatiquement par le backend quand le statut passe à
  `TERMINE` (et remis à `null` si on revient en arrière).
- **Q5 — Création Poste = modale.** `NouveauPosteModale.svelte`, pattern
  identique à `NouveauClientModale`. Bouton « + Nouveau poste » uniquement
  affiché pour le rôle admin sur la fiche Lieu.
- **Q6 — Strip montants côté API pour rôle chef.** Helper
  `selectPosteSelonRole(user)` dans `lib/postesHelpers.js`. Les 4 champs
  `montantBrutCentimes`, `montantClientCentimes`, `margeCentimes`,
  `margePourcent` sont strippés de toutes les réponses API quand
  `req.user.role === 'chef'`. Defense in depth, doublé d'une condition
  d'affichage `{#if estAdmin}` côté frontend.
- **Q7 — Module Photos.** Modèle `Photo` créé dans le schéma (FK
  `posteId`, `onDelete: Cascade`), aucune route Fastify ni UI en V1.
  Ouverture pour une session future.
- **Q8 — Machine à états du chef.** Transitions autorisées pour le chef :
  `A_FAIRE → EN_COURS`, `EN_COURS → TERMINE`, `TERMINE → EN_COURS`
  (correction d'erreur). Interdites : `EN_COURS → A_FAIRE`,
  `TERMINE → A_FAIRE`. L'admin a toutes les transitions libres.
  Validation backend dans `PATCH /api/postes/:id` → `422
  TRANSITION_INTERDITE` si KO. Côté UI, les boutons des transitions
  interdites apparaissent **désactivés** (grisés + tooltip), pas masqués.

### Permissions chef strictes (au-delà de Q6)

- Schémas zod différenciés sur `PATCH /api/postes/:id` :
  - admin : `schemaModifAdmin` (titre, description, statut, montants,
    ordre)
  - chef : `schemaModifChef.strict()` qui accepte **uniquement** `statut`
    et renvoie `400 VALIDATION` sur tout autre champ (pas de strip
    silencieux : un bug frontend qui enverrait un titre se voit
    immédiatement).
- `POST /api/postes` et `DELETE /api/postes/:id` : admin uniquement.
- Liste des Postes pour le chef filtrée WHERE `lieu.chefId = user.id`,
  quel que soit le `?lieuId=` passé en query (le chef ne peut pas
  scanner les lieux d'un autre chef).
- `AjoutDepenseForm` côté chef : dropdown Postes du Lieu sans montants
  (déjà strippés par l'API).

### Corrections de données (importantes pour mémoire)

- **Rachid AQOUDI** (et non « El Mansouri » qui était une erreur dev
  persistante depuis le premier seed). Email réel
  `rachid_aqoudi@hotmail.fr` (et non le placeholder
  `rachid@ludimmo.ma`).
- **Pierre-Yves Laurent** reste sans email ni mot de passe — c'est le
  cas client typique créé via la modale du formulaire Lieu, illustré
  dans le seed pour vérifier la branche « client sans connexion ».
- **L'ancien `console.log [DEBUG prenom client]`** dans
  `routes/chantiers.js` est parti avec la suppression du fichier au
  commit 2. Le bug typo « Pierre -Jean » est donc résolu de fait (les
  routes Lieu/Poste n'ont jamais embarqué ce log). Si une typo
  réapparaît un jour côté création client (`POST /api/clients`),
  prévoir une normalisation `/\s*-\s*/g → -` sur `prenom`/`nom` à la
  saisie — non urgent.

### Tests validés en live (côté Yassine, mobile + desktop)

1. Login admin (`yassine.bruneau@gmail.com` / `admin123`) → home admin
   affiche les Postes EN_COURS (Poste B « 3 tables marbre + bibliothèque »).
2. Login chef (`rachid_aqoudi@hotmail.fr` / `chef123`) → home chef
   affiche ses Lieux (Villa Pierre-Yves uniquement).
3. Navigation `/lieux` → Villa Pierre-Yves visible avec compteur
   « 3 postes » et statut EN_COURS.
4. Fiche Lieu → 3 Postes listés avec leur statut, lien vers chaque
   fiche Poste. Bouton « + Nouveau poste » visible admin, absent chef.
5. Fiche Poste B (EN_COURS) → boutons de transition statut, section
   Montants (admin uniquement), paiement CASH 200 DH, dépense
   « Bois pour bibliothèque » de Hassan menuisier, versement budget
   5 000 DH affecté.
6. **Machine à états Q8** confirmée : bouton « À faire » grisé après
   passage en TERMINE côté chef. Tooltip « Transition réservée à
   l'administrateur » affiché.
7. **Strip côté API** confirmé en chef : section Montants absente sur
   fiche Poste, pas de colonne montant sur les cards Lieu.
8. Dashboard `/compta` admin : section « Créances à recouvrer » présente
   et fonctionnelle. (Vide aujourd'hui car le seul Poste TERMINE est
   intégralement payé — comportement attendu.)
9. Création d'un nouveau Poste via modale → ajout en base, statut Lieu
   inchangé si initial `A_FAIRE`, le Lieu repasse en `EN_COURS` si
   `EN_COURS`.

### Prochaines étapes (post-PHASE 2)

1. **Module Photos** : créer les routes `/api/postes/:id/photos`
   (multipart upload via Sharp, stockage `/uploads/postes/{posteId}/`)
   et l'UI sur la fiche Poste (galerie avant/après).
2. **PDF devis client** : générer un PDF à partir d'un ou plusieurs
   Postes d'un Lieu pour envoi WhatsApp / email.
3. **Compta générale analytique** : la page `/compta/general` est
   toujours un placeholder. À implémenter quand Dominique aura
   exprimé son besoin précis.
4. **Migration PostgreSQL** : prévue pour la mise en prod sur le VPS
   (cf. `docs/migration-postgres.md` à créer).
5. **Espace client** par URL secrète (V1.5/V2) : permettre au client
   de voir l'état de ses Postes sans compte.

### Notes pour la prochaine session

- Le bug typo « Pierre -Jean » n'est plus pertinent. Si on rencontre
  un espace parasite dans un prénom composé, c'est nouveau et à
  diagnostiquer (probablement saisie).
- Le helper `nomComplet(u)` (`lib/utils/nom.js`) avec tirets insécables
  U+2011 reste en place dans tout le frontend, c'est de toute façon
  utile contre les sauts de ligne sur mobile.
- L'endpoint admin `POST /api/admin/recalculer-statuts` est documenté
  dans `routes/admin.js` mais non exposé dans l'UI. À garder en tête
  pour cas de désynchro.

---

## Session du 2026-05-17 — Cadrage refonte Lieu/Poste/Paiement

> **Décision structurante.** Cette session est une session de réflexion
> métier, pas de code. Elle remet en question la modélisation actuelle
> (Chantier monolithique avec Devis et échéancier 30/40/30) et acte le
> passage à un modèle à trois niveaux **CLIENT → LIEU → POSTE**, plus
> conforme à la réalité d'exploitation de Ludimmo à Essaouira.
>
> **La PROCHAINE session sera la PHASE 1 de la refonte : analyse
> détaillée + plan d'exécution, toujours sans coder.** Le brief technique
> complet sera collé en début de session prochaine. Cette entrée-ci ne
> sert qu'à consolider la mémoire pour ne pas re-discuter de ces choix.

### Statut

Rien n'a été codé. Le code en place (Chantier, Devis avec lignes,
EcheancierPaiement, Paiement lié au devis) reste fonctionnel mais ne
reflète plus le métier réel observé. Les seules données en base sont
des tests dev (Villa PY, Villa Ounara, CH-2026-001 « Réfection villa
Ounara »), jamais utilisées en production : on pourra **reset complet
la DB** lors de la refonte sans coût métier.

### Contexte métier qui force la refonte

Le modèle actuel suppose un **chantier monolithique** : un client, un
chantier, un devis signé avec lignes prédéfinies, un échéancier rigide
30/40/30. La réalité Ludimmo Essaouira est différente :

- Les clients (expats principalement) ont des **biens immobiliers où
  Ludimmo intervient en continu**, sur des « postes » qui s'ajoutent
  au fil des mois : modification d'un lit, 3 tables marbre, dépannage
  électrique, nettoyage arbres, bibliothèque, contrôle piscine, etc.
- Chaque **poste** a son propre devis (souvent une ligne unique
  négociée) et ses propres **paiements libres au fil de l'eau** (cash
  ou virement, plusieurs versements possibles, pas d'échéancier
  contractuel).
- **Culture marocaine relationnelle** : pas de signature de devis
  formelle, l'accord se fait à l'oral / WhatsApp.

Conclusion : la maille de gestion n'est pas le chantier, c'est
**l'intervention chiffrée sur un lieu**. D'où la bascule.

### Modélisation cible

#### CLIENT — réutilise `Utilisateur` (étendu hier), pas de modèle séparé

- `prenom`, `nom` obligatoires
- `telephone`, `email`, `adresse`, `notes` optionnels
- `role = 'client'`, pas de `motDePasseHash`
- Pas de suppression de client en V1

#### LIEU — nouveau modèle (remplace `Chantier` dans son rôle « contenant »)

- `reference` auto **L-2026-NNN** (remplace `CH-2026-NNN`)
- `nom` libre obligatoire
- `clientId` obligatoire, relation **1 client → N lieux** (un client
  peut posséder plusieurs biens ; un lieu n'a qu'un seul propriétaire,
  pas de copropriété en V1)
- `adresse` précise du lieu
- `chefId` optionnel (un seul chef par lieu en V1)
- `budgetEstimatifCentimes` optionnel — purement informatif
- Frais kilométriques au niveau Lieu (logique géographique) :
  `distanceKm`, `allerRetour`, `coutEssenceCentimes` — repris tels
  quels de `Chantier`
- `statut` : **PROSPECT | EN_COURS | TERMINE** (pas d'ANNULE ni
  d'ARCHIVE pour V1). Transitions automatiques selon l'état des Postes
  rattachés — choix d'implémentation à trancher en phase 1 entre hook
  Prisma et getter calculé.

#### POSTE — nouveau modèle (remplace `Devis` dans son rôle « intervention chiffrée »)

> **Le Poste EST le devis.** Pas de modèle Devis séparé avec lignes
> filles. 1 poste = 1 ligne unique. C'est le changement structurel le
> plus fort de la refonte.

- `lieuId` obligatoire
- `titre` libre obligatoire (le client demande des choses
  imprévisibles : « 3 tables marbre », « contrôle piscine »… **pas de
  catégorie prédéfinie**, le titre libre suffit)
- `description` libre optionnelle
- `statut` : **A_FAIRE | EN_COURS | TERMINE** (pas d'ANNULE en V1)
- `montantBrutCentimes` (coût réel pour Ludimmo)
- `montantClientCentimes` (prix facturé)
- `margeCentimes` et `margePourcent` calculés
- Pas de numérotation type `P-NNN` : un poste se référence par son
  titre (et son lieu)

#### PAIEMENT — refonte

- `posteId` obligatoire (remplace l'ancien lien `chantierId` /
  `devisId`)
- `date`, `montantCentimes`, `mode` (**CASH | VIREMENT** seulement
  pour V1 — on retire CHEQUE et autres)
- `description` optionnelle
- **Plusieurs paiements par poste, pas d'échéancier.** Le modèle
  `EcheancierPaiement` disparaît.

#### BUDGET_LIEU — adaptation de `BudgetChantier`

- Renommage `BudgetChantier` → `BudgetLieu`
- `lieuId` obligatoire (ex-`chantierId`)
- **`posteId` optionnel — nouveau** : un versement de Dominique peut
  être affecté à un poste précis ou rester global au lieu
- `montant`, `type` (VERSEMENT | REMBOURSEMENT), `date`,
  `description`, `createurId` : inchangés

#### DEPENSE — adaptation

- `lieuId` obligatoire (ex-`chantierId`)
- **`posteId` optionnel — nouveau** : permet le calcul de marge précis
  par poste quand l'affectation est connue
- **`fournisseur` nouveau champ texte libre** (« Hassan menuisier »,
  etc.) — pas de modèle Fournisseur persistant en V1
- `categorie` (ACOMPTE | MATERIEL | REPAS) inchangée
- `saisieParId`, validation, audit `corrigeePar` : inchangés

#### À supprimer

- `LigneDevis` (le Poste est une ligne unique)
- `EcheancierPaiement` (paiements libres au fil de l'eau)

#### Photos — modèle prévu mais module non codé en refonte

Prévoir dans le schéma un modèle `Photo` rattaché au **Poste** (logique
avant/après par intervention), mais ne PAS coder l'UI photo dans la
refonte. Module à part dans une session ultérieure.

### UX cible

- **Page d'accueil ADMIN** : liste des **Postes EN_COURS** sur tous les
  lieux. Vision « qu'est-ce qui bouge ». Remplace la liste des
  chantiers en page d'accueil.
- **Page d'accueil CHEF (Rachid)** : ses **Lieux uniquement**, sans
  devis ni marges.
- **Onglet Lieux** (renommé depuis Chantiers) avec filtres par statut,
  bouton + (admin uniquement) pour créer un Lieu.
- **Fiche Lieu** : informations du lieu + **liste des Postes** + budget
  Dominique global, dépenses, frais km.
- **Fiche Poste** : devis (montants admin uniquement), paiements
  reçus, budget Dominique affecté à ce poste, photos (modèle prêt,
  module non codé), dépenses affectées.
- **Création Lieu** réutilise la modale `+ Nouveau client…` existante
  (acquis de la session 2026-05-16 suite 5).
- **Création Poste** depuis la fiche Lieu.
- **Paiement reçu** saisi depuis la fiche Poste.

#### Permissions

- **Admin** : tout.
- **Chef (Rachid)** : lecture/écriture sur les Lieux dont il est chef,
  Postes (titre, statut, description **sans les montants ni les
  marges**), saisie de dépenses.

### Décisions techniques (pour ne pas re-discuter)

- **Numérotation** : `L-2026-NNN` pour les Lieux. Pas de numérotation
  séparée pour les Postes — un Poste se référence par son titre dans
  son Lieu.
- **1 lieu = 1 client toujours**. Pas de copropriété en V1.
- **Frais km restent au niveau Lieu**, pas Poste (logique
  géographique : la distance dépend du lieu, pas de l'intervention).
- **Photos au niveau Poste** (avant/après par intervention).
- **Paiement client : 2 modes seulement** — CASH ou VIREMENT. CHEQUE
  et autres retirés.
- **Budget Dominique** : peut être affecté à un Poste précis (nouveau)
  ou rester global au Lieu (comme avant).
- **Dépense Rachid** : `lieuId` obligatoire, `posteId` optionnel.
- **Lieu sans Poste** : statut PROSPECT (compatible avec l'existant).
- **Fournisseur** : texte libre sur la Dépense, **pas de modèle
  persistant** en V1.
- **Transitions de statut du Lieu** d'après ses Postes : choix entre
  hook Prisma et getter calculé à arbitrer en phase 1.

### Migration

**Reset complet de la base.** Les données actuelles (Villa PY, Villa
Ounara, CH-2026-001) sont des tests dev, jamais utilisées en
production, aucune valeur métier. On part de zéro proprement avec une
nouvelle migration Prisma et un nouveau seed.

Le **nouveau seed** doit contenir :
- Pierre-Yves Laurent + sa villa (un Lieu, statut EN_COURS)
- 2 à 3 Postes de démo couvrant les trois états : un Poste TERMINE et
  intégralement payé, un Poste EN_COURS partiellement payé, un Poste
  A_FAIRE
- Quelques dépenses Rachid (au moins une validée et une à valider) sur
  le Lieu, dont au moins une affectée à un Poste précis
- Au moins un versement budget Dominique global au Lieu + un versement
  affecté à un Poste précis (pour exercer le nouveau lien
  `BudgetLieu.posteId`)

### Hors scope de la refonte (sessions séparées)

À NE PAS coder dans la refonte Lieu/Poste/Paiement :

- **Module Photos** : juste prévoir le modèle `Photo` lié au Poste
  dans le schéma, pas d'UI.
- **Compta générale analytique** : placeholder existant conservé.
- **Module Fournisseurs persistant** : texte libre suffit, pas de
  modèle.
- **Statut ANNULE sur Poste** et **ARCHIVE sur Lieu** : pas en V1.
- **Espace client par URL secrète** : déjà documenté plus bas dans ce
  journal en brief permanent — reste pour V1.5/V2.
- **Multiple chefs par Lieu** : un seul chef en V1.
- **Suppression de client** : pas en V1.

### Prochaines étapes

1. **Prochaine session = PHASE 1 de la refonte.** Yassine collera le
   brief technique complet en début de session. Le but de la phase 1
   est une **analyse détaillée et un plan d'exécution chiffré**,
   toujours **sans coder**, pour valider :
   - le schéma Prisma cible précis (types, relations, contraintes,
     index, valeurs par défaut)
   - la liste exhaustive des routes API à créer, modifier, supprimer
   - le découpage front (pages à créer, à renommer, à supprimer)
   - l'ordre des opérations et les éventuels points de risque
   - le choix hook Prisma vs getter calculé pour la transition de
     statut du Lieu
2. Phases ultérieures (à découper en phase 1) : migration Prisma +
   seed, backend, frontend admin, frontend chef, recette par Yassine.
3. **En attente** de cette session, le bug cosmétique « Pierre -Jean »
   reste à diagnostiquer (cf. session 2026-05-16 suite 7). Ce n'est
   plus prioritaire si la refonte démarre, mais le `console.log [DEBUG
   prenom client]` est toujours dans `backend/src/routes/chantiers.js`
   et **devra être retiré** quoi qu'il advienne — soit lors du
   diagnostic, soit lors de la refonte qui supprimera de toute façon
   ces routes.

---

## Session du 2026-05-16 (suite 7) — Bilan du soir avant pause

Session arrêtée le soir, fatigue. Récap de ce qui a été fait et de ce
qui reste pour la prochaine session.

### Validé en live ce soir

- **Création client inline** : modale + sentinel value `__nouveau__` dans
  le dropdown — fonctionne bout-en-bout. **Pierre-Jean Gonzales** créé
  en base avec téléphone, email, adresse Ounara et notes "TOUS TRAVAUX
  DE BATIMENT".
- **Chantier CH-2026-001 « Réfection villa Ounara »** créé pour
  Pierre-Jean Gonzales avec Rachid comme chef. Statut PROSPECT.
- **Bug Prisma `motDePasseHash`** résolu : retrait du champ du `data:{}`
  du `prisma.utilisateur.create` (au lieu de le passer à `null` explicite),
  puis `npx prisma generate` lancé serveur arrêté (le warning EPERM
  bloquait le remplacement du binaire DLL tant que Node tournait).
  Règle qui sort de cette mini-galère : **après une migration qui change
  la nullabilité d'un champ, toujours `prisma generate` serveur arrêté.**
- **Bonus UX** repéré et apprécié : le téléphone du client est cliquable
  (`<a href="tel:…">`) sur la fiche chantier, hérité du code existant.

### Toujours bloqué — à reprendre la prochaine fois

**Typo cosmétique "Pierre -Jean"** : la chaîne s'affiche avec un espace
parasite avant le tiret sur la fiche chantier détail. Tentatives :

- Hypothèse #1 : retour à la ligne CSS au niveau du tiret. **Réfutée** —
  fix appliqué via helper `nomComplet(u)` + tirets insécables U+2011 sur
  11 callsites, l'espace persiste donc ce n'était pas du wrap.
- Hypothèse #2 : un caractère espace (regular, NBSP, narrow NBSP, ZWS,
  …) est réellement stocké en base ou ajouté dans le pipeline. **À
  confirmer** au prochain démarrage.

État du diagnostic :
- Un `console.log [DEBUG prenom client]` a été ajouté à
  `GET /api/chantiers/:id` (dans `backend/src/routes/chantiers.js`) qui
  imprime les codes Unicode caractère par caractère du `prenom` du
  client. **N'a pas été déclenché ce soir** (pause avant test).
- **À faire prochaine session** :
  1. Démarrer le backend, ouvrir la fiche `CH-2026-001`
  2. Relever la ligne `[DEBUG prenom client]` dans le terminal backend
  3. Selon le diagnostic : soit normaliser à la sauvegarde
     (regex `/\s*-\s*/g → -` dans `routes/clients.js` + UPDATE SQL
     ponctuel pour corriger Pierre-Jean), soit creuser dans le helper
     ou le rendu
  4. **Retirer le `console.log [DEBUG prenom client]`** de
     `routes/chantiers.js` une fois le bug trouvé

### Helper `nomComplet(u)` créé (utile en soi)

Même si l'espace parasite n'est pas dû au wrap, le helper est une bonne
chose : centralisation de l'affichage des noms, tirets insécables qui
préviendront un vrai bug de wrap quand on aura des noms composés plus
longs. À conserver.

Localisation : `frontend/src/lib/utils/nom.js`. Appelé depuis 7 fichiers
frontend (`(app)/+page.svelte`, `(app)/chantiers/[id]/+page.svelte`,
`(app)/chantiers/nouveau/+page.svelte`, `(app)/compta/+page.svelte`,
`(app)/profil/+page.svelte`, `lib/components/DepenseRow.svelte`).

---

## Session du 2026-05-16 (suite 6) — Validation création client + fix affichage noms composés

### Ce qui a été validé en live

- **Création client inline validée 100 %** : Pierre-Jean Gonzales créé
  via la modale, sélection auto dans le dropdown, chantier
  **CH-2026-001 « Réfection villa Ounara »** (TOUT CORPS D'ÉTAT, chef
  Rachid, statut PROSPECT) créé pour ce client.
- Téléphone client cliquable (`<a href="tel:…">`) sur la fiche chantier
  bien remarqué par Yassine — c'était déjà dans le code existant de la
  fiche détail.

### Bug Prisma corrigé en cours de test

`POST /api/clients` plantait avec
`Argument motDePasseHash must not be null`. Deux causes combinées :

1. Le **client Prisma TypeScript n'était pas régénéré** après la
   migration `client_fields_optional` — il croyait toujours que
   `motDePasseHash` était `String NOT NULL`. Le warning EPERM à
   `migrate dev` indiquait que Node tournait et bloquait le remplacement
   du binaire DLL.
2. Le code passait **`motDePasseHash: null` explicite** dans
   `data:{}` — formellement valide pour un champ optionnel, mais le
   client TS strict refuse tant qu'il croit le champ requis.

Fix : retrait de `motDePasseHash` du `data:{}` du `prisma.utilisateur.create`
(la colonne SQL recevra NULL par défaut). Yassine a arrêté Node, lancé
`npx prisma generate` (sans EPERM cette fois), redémarré le backend.
Création client OK ensuite.

**Règle pour la suite** : après une migration qui change la nullabilité
d'un champ, toujours `prisma generate` avec le serveur ARRÊTÉ.

### Typo affichage : « Pierre -Jean » sur écran mobile

Yassine a signalé un espace parasite avant le tiret du prénom composé
sur la fiche chantier. Diagnostic : aucun caractère espace n'est ajouté
dans le pipeline (modal → backend → DB → render). C'est le **navigateur
qui casse la ligne au tiret** sur écran étroit (le `.info-ligne` flex
rétrécit le span valeur, le `-` est un point de break par défaut).

**Fix** : nouveau helper `frontend/src/lib/utils/nom.js` exportant
`nomComplet(u)` qui remplace les tirets ordinaires `-` par des **tirets
insécables U+2011** (rendu visuel strictement identique, mais empêche
toute coupure de ligne à cet endroit). Centralisation des 12 endroits
où `{u.prenom} {u.nom}` était écrit inline (sauf un sort interne dans
le formulaire chantier — non visible).

Fichiers touchés :
- Nouveau : `frontend/src/lib/utils/nom.js`
- `routes/(app)/+page.svelte` (liste chantiers)
- `routes/(app)/chantiers/[id]/+page.svelte` (client + chef + sousTraitant)
- `routes/(app)/chantiers/nouveau/+page.svelte` (dropdowns chef + client)
- `routes/(app)/compta/+page.svelte` (carte chantier + paiement client)
- `routes/(app)/profil/+page.svelte`
- `lib/components/DepenseRow.svelte` (saisiePar + corrigeePar)

À tester pour Yassine : recharger la fiche chantier CH-2026-001 sur
mobile. « Pierre-Jean GONZALES » doit s'afficher sans coupure visible
au tiret, quel que soit la largeur d'écran.

### Bonus repéré

Le téléphone client est cliquable (lien `tel:`) sur la fiche chantier
depuis le début (héritage du code chantier détail). Si on veut le même
comportement sur la fiche client elle-même (page `/clients/[id]` future),
penser à l'appliquer aussi.

---

## Session du 2026-05-16 (suite 5) — Création client inline

### Contexte

Yassine voulait pouvoir créer un nouveau client directement depuis le
formulaire de création de chantier (cas d'usage : nouveau chantier à
Ounara pour un client qui n'existe pas en base). L'ancien formulaire
forçait à choisir un client déjà saisi — impasse en pratique.

### Décisions techniques validées

**Schéma : extension de `Utilisateur`, pas de modèle `Client` séparé.**
Les clients étaient déjà des `Utilisateur` avec `role='client'`, et
`Chantier.clientId` pointe vers `Utilisateur`. Créer un modèle distinct
aurait imposé une migration risquée du seed Villa PY. 4 modifs de
schéma à la place :

- `email String?  @unique` (était requis)
- `motDePasseHash String?` (était requis)
- ajout `adresse String?`
- ajout `notes String?`

En SQLite, plusieurs `NULL` ne sont pas considérés égaux pour `UNIQUE`,
donc l'unicité de l'email reste assurée pour les non-null.

**UX dropdown : sentinel value plutôt que dropdown custom.**
Le `<select>` natif garde un look propre sur mobile et son accessibilité.
On ajoute une première option `<option value="__nouveau__">+ Nouveau client…</option>`
qu'un handler `onchange` (pas `bind:value`, pour éviter une boucle
réactive) intercepte pour ouvrir une modale.

**Sécurité login : garde explicite "compte sans mot de passe".**
Dans `POST /api/auth/login`, on rejette `if (!utilisateur.motDePasseHash)`
avec **le même message générique** que pour un mauvais mot de passe.
Pas de fuite d'information : un attaquant ne peut pas savoir si un compte
existe sans password (énumération d'emails empêchée).

### Ce qui a été fait

**Backend**

- `prisma/schema.prisma` : `Utilisateur` étendu (4 modifs ci-dessus).
- Nouveau `src/routes/clients.js` : `POST /api/clients` (admin only,
  validation zod, force `role='client'`, gère email/téléphone/adresse/notes
  optionnels, normalise les chaînes vides en `null`, vérifie unicité
  email si fourni → 409 `EMAIL_DEJA_UTILISE`).
- `src/server.js` : route branchée sous `/api/clients`.
- `src/routes/auth.js` : ajout de la garde "compte sans password" dans
  `POST /login` (cf. décision sécurité ci-dessus).

**Frontend**

- Nouveau composant `lib/components/NouveauClientModale.svelte` :
  réutilisable, voile + modale centrée, 6 champs (prenom\*, nom\*, telephone,
  email, adresse, notes), validation email basique côté client, fermeture
  par voile + bouton + touche Escape, callbacks `onCree(client)` et
  `onFermer()`. Suit le pattern Svelte 5 "primitives + reset" (cf.
  bug `state_referenced_locally` du 16 mai suite 3).
- `routes/(app)/chantiers/nouveau/+page.svelte` :
  - **résolution du TODO du journal** : la liste hardcodée des
    4 utilisateurs est remplacée par un fetch `GET /api/users` au montage
  - Clients triés alphabétiquement (`localeCompare` français)
  - Option sentinelle `+ Nouveau client…` insérée **avant** la liste,
    visible uniquement aux admins (`$auth.utilisateur.role === 'admin'`)
  - Handler `onChangeClient` qui intercepte la sentinelle, remet
    `clientId = ''`, ouvre la modale
  - Callback `onClientCree` qui pousse le client dans la liste locale
    sans re-fetch et le sélectionne (`clientId = String(nouveauClient.id)`)

### Limite connue de la session

Sandbox/host divergence à nouveau active : impossible de générer la
migration Prisma `--create-only` depuis le shell sandbox (la version
schéma vue par `npx prisma validate` était tronquée). **Yassine doit
lancer côté Windows** :

```powershell
cd C:\Users\USUARIO\Projets\chantiers-essaouira\chantiers-essaouira\backend
npx prisma migrate dev --name client_fields_optional
```

(Pas `--create-only` puisque Yassine pilote directement sur sa machine.)
La migration touche uniquement `utilisateurs` : passage de `email` et
`mot_de_passe_hash` en NULLABLE, ajout des colonnes `adresse` et `notes`.
Pas de perte de données.

### Plan de test pour Yassine

- **Cas A** : connecté admin Yassine, ouvrir `/chantiers/nouveau`, cliquer
  sur le dropdown Client → première option "+ Nouveau client…" → modale
  s'ouvre → saisir prenom "Mohammed", nom "Bennis", éventuellement
  téléphone/adresse → Créer → modale se ferme, le client apparaît
  sélectionné dans le dropdown.
- **Cas B** : sur le même formulaire, compléter titre, adresse, chef →
  créer le chantier → redirection vers `/chantiers/:id` qui doit afficher
  "Client : Mohammed Bennis".
- **Cas C** : se connecter en chef (Rachid). Le formulaire
  `/chantiers/nouveau` n'est en théorie pas accessible aux chefs (création
  réservée admin via le bouton FAB), mais si Rachid y arrive par URL
  directe : l'option "+ Nouveau client…" ne s'affiche pas (filtre
  `estAdmin`), et si jamais il atteignait l'API `POST /api/clients`
  directement, le middleware `role(['admin'])` renvoie 403.

### Décision métier structurante notée pour plus tard

Voir la section **"Espace client (V1.5/V2) — accès par URL secrète"**
ajoutée plus bas dans ce journal. Le champ email optionnel sur
`Utilisateur` est volontairement cohérent avec ce futur usage : un
client sans email reste créable, l'accès se fera par URL plutôt que par
login.

---

## Espace client (V1.5 / V2) — accès par URL secrète

> Section dédiée pour ne pas perdre cette décision métier au fil des
> sessions. **Ne pas coder cette V1.5 maintenant**, mais avoir tout en
> tête pour la session "PDF + espace client" qui viendra plus tard.

### Pourquoi

WhatsApp reste le canal du quotidien entre Ludimmo et ses clients, mais
les données s'y diluent dans le temps (messages qui défilent, photos
mélangées, vocaux non recherchables). Un espace client structuré permet :
- au **client** : d'avoir un historique propre de SON chantier
- à **Ludimmo** : de mieux structurer ses archives et de paraître plus pro

### Périmètre fonctionnel (consultation seule, lecture seule, pas d'écriture)

- Devis acceptés
- Suivi d'avancement (statut + % avancement)
- Galerie photos du chantier
- Échéancier des paiements (acompte/mi-chantier/solde + versements
  effectués)
- Factures
- **PAS** de messagerie (WhatsApp reste le canal)
- **PAS** de documents annexes pour V1.5

### Mode d'accès : URL secrète par chantier

- Un **token aléatoire** (~32 caractères) stocké sur le modèle `Chantier`,
  généré à la création du chantier
- URL publique non listée : ex `/client/{token}`
- **Aucun login, aucun mot de passe** (cohérent avec le `motDePasseHash`
  optionnel décidé en session "Création client inline")
- Envoyé sur WhatsApp par Dominique/Yassine au client à la signature du
  devis
- Lecture seule. Validation du token côté backend. 404 si invalide ou
  révoqué.
- Possibilité côté admin de **régénérer** ou **révoquer** un token (UI à
  prévoir)
- **Token par chantier**, pas par client : un client avec 2 chantiers =
  2 URLs distinctes

### À faire quand on attaque ce module

1. Ajout d'un champ `tokenAccesClient String? @unique` sur `Chantier`,
   généré à la création (lib crypto, hex 32 chars).
2. Routes publiques (préfixe `/api/public/chantier/:token`) sans
   middleware d'auth, mais avec validation du token.
3. Routes admin pour régénérer/révoquer un token.
4. Pages frontend `/client/[token]/+page.svelte` (route group différent
   de `(app)` pour ne pas hériter du layout connecté).
5. Lien partageable copiable depuis la fiche chantier admin.

---

## Session du 2026-05-16 (suite 4) — Cosmétique technique

Mini-session de nettoyage après validation du module Compta. Trois changements :

- `backend/uploads/.gitkeep` créé → warning Fastify `@fastify/static`
  `WARN: "root" path must exist` éliminé au démarrage (confirmé dans
  les logs du terminal backend après redémarrage).
- Nouveau store `frontend/src/lib/stores/badgeAValider.js` (4 méthodes :
  `definir`, `decrementer`, `incrementer`, `reset`).
- `NavBas.svelte` + `DepenseRow.svelte` câblés au store → badge "à valider"
  réactif **dans la seconde** au lieu de jusqu'à 60 s. Polling 60 s
  conservé comme filet de sécurité (cas multi-utilisateurs : chef qui
  crée une dépense pendant qu'un admin est connecté en parallèle).

Validé en live par Yassine : le badge tombe instantanément après un
clic Valider côté admin.

---

## Session du 2026-05-16 (suite 3) — Module Compta V1 validé à 100 % en live

### Statut

Module Compta V1 niveau 1 **complet et validé bout-en-bout** par Yassine
sur le téléphone et le poste de dev. Toutes les briques (admin saisie,
chef saisie, validation, verrouillage, calculs, navigation) fonctionnent
comme prévu par le cahier des charges.

### Ce qui a été fait cette session

- Module Compta complet implémenté : tables `Depense` + `BudgetChantier`,
  8 endpoints backend, pages `/compta` (admin/chef) + `/chantiers/[id]/compta`,
  composants `AjoutDepenseForm` + `DepenseRow`, `NavBas` avec badge admin.
- Seed corrigé : `chefId` de Villa PY pointe vers Rachid, nom
  **"El Mansouri"** ajouté à Rachid (à la fois en `create` et en `update`
  de l'upsert pour que le re-seed sans reset corrige les enregistrements
  existants).

### 5 bugs trouvés et corrigés pendant les tests live

1. **Validation auto manquante à la création par admin**
   (`POST /api/depenses`). Le cahier des charges disait "Saisie par
   Rachid ou un admin → A_VALIDER" mais l'usage attendu était que l'admin
   valide directement à la création. Fix : si `req.user.role === 'admin'`,
   création directe avec `statut: 'VALIDEE'`, `valideeParId`, `valideeLe`.

2. **Pattern Svelte 5 `$state(prop?.field)` cassé** pour
   `estAvancePersonnelle`. Le `bind:checked` ne mettait pas à jour la
   variable parce que Svelte 5 émet un warning `state_referenced_locally`
   sur les `$state(...)` dont l'initialiseur lit une prop, et la
   réactivité du binding tombe avec. **3 itérations** pour identifier la
   vraie cause (d'abord soupçon JSON, puis backend, puis warning Svelte
   capturé par Yassine dans le terminal Vite). Fix final : initialiser
   tous les `$state` avec des **primitives**, puis charger les valeurs
   de la prop dans un bloc `if (depenseExistante) { ... }` exécuté une
   seule fois au montage du composant.

3. **Suffix "(à compléter)" parasite** sur le nom de Rachid affiché
   partout. Corrigé via seed (nom "El Mansouri").

4. **`seed.js` et `depenses.js` corrompus** par des `bash cat >> append`
   qui dupliquaient du contenu sur le disque hôte Windows alors que
   Claude voyait une version propre dans le mount Linux. **Cause**: les
   chemins `/sessions/.../mnt/chantiers-essaouira/...` (sandbox) et
   `C:\Users\...\chantiers-essaouira\...` (host) peuvent diverger
   transitoirement. Fix : nettoyage manuel via `Edit` (qui passe par
   l'API host, pas par bash). **Règle pour Claude à l'avenir** :
   utiliser **uniquement** Edit/Write pour modifier les fichiers ; bash
   en lecture seule pour le diagnostic.

5. **`PATCH /:id/valider` et `DELETE /:id` sans body** alors que
   `apiAuth` force toujours `Content-Type: application/json`. Fastify
   refuse avec "Body cannot be empty when content-type is set to
   'application/json'". Fix : ajout de `body: JSON.stringify({})` aux
   2 appels dans `DepenseRow.svelte`. Tous les autres endpoints
   appelants ont déjà un body (vérifié par grep).

### Tests live validés

- Versement budget 5 000 DH par admin sur Villa PY → "Budget reçu" et
  "Solde restant" passent à 5 000 DH.
- Création dépense Matériel 1 200 DH par admin → statut **Validée
  d'emblée**, total dépensé +1 200 DH, solde restant 3 800 DH.
- Création dépense Acompte 350 DH par Rachid avec "Avance personnelle"
  cochée → statut **À valider**, comptée dans **Avancé** (pas dans Total
  dépensé), section "Dominique me doit" affiche 350 DH.
- **Badge admin "1"** affiché sur l'onglet Compta du NavBas tant qu'une
  dépense est à valider.
- Tableau de bord admin avec alerte "⚠️ Avances Rachid non
  remboursées : 350 DH" sur la carte du chantier concerné (ajout
  proactif fait pendant le codage de la page).
- Bouton **Valider** fonctionne : dépense passe en Validée, badge tombe
  à 0, disparaît de la section "À valider".
- Bouton **Supprimer** (admin) fonctionne.
- Nom **"Rachid El Mansouri"** affiché partout, plus aucun "(à compléter)".

### Prochaines sessions prioritaires

1. **Tester les scénarios annexes** pour finir de couvrir le cahier des
   charges : modification d'une dépense par le chef (toujours
   `A_VALIDER` après modif), modification par admin (validation auto
   attendue + traçabilité `corrigeeParId`/`corrigeeLe`), création d'un
   **remboursement** (BudgetChantier type `REMBOURSEMENT` → la section
   "Dominique me doit" doit décroître).
2. **Module Compta niveau 2 — Compta générale analytique** : CA encaissé
   mois/année, ventilation dépenses par catégorie, marge brute,
   graphiques d'évolution. Route placeholder déjà posée à
   `/compta/general`.
3. **Module Photos** : capture caméra mobile + galerie par chantier.
4. **Déploiement sur le VPS Hostinger KVM 1** (pas Vercel/Netlify).
   Voir l'entrée précédente du journal pour les vérifications infra à
   faire au démarrage de la session (reverse proxy, process manager,
   choix SQLite vs PostgreSQL).

### Détails techniques à régler à un moment ou à un autre

- Mot de passe `chef123` de **Dominique** (rôle admin) à changer — c'est
  un seed.
- Email placeholder de **Rachid** (`rachid@ludimmo.ma`) à remplacer
  quand il aura communiqué son vraie adresse.
- ~~Dossier `backend/uploads/` à créer~~ → fait en session du 16 mai (cosmétique).
- ~~Badge "à valider" du NavBas à 60 s de latence~~ → fait en session du 16 mai
  (cosmétique) : store partagé + décrément local immédiat.

---

## Session du 2026-05-16 (suite 2) — Module Compta V1 niveau 1 codé

### Ce qui a été fait

Implémentation complète du module Compta V1 (niveau 1) + permissions Rachid,
en suivant à la lettre le cahier des charges figé en amont avec Yassine.

**Backend**

- **Schéma Prisma** : ajout des modèles `Depense` et `BudgetChantier` avec
  relations inverses sur `Utilisateur` et `Chantier`. Adapté à SQLite :
  enums Prisma remplacés par String (validés en zod), `Decimal` remplacé
  par `Int montantCentimes` (convention projet).
- **Champs d'audit** nommés `corrigeeParId` / `corrigeePar` / `corrigeeLe`
  (et non `modifieeParId` / `modifieeLe`) pour éviter la collision avec
  le `modifieLe @updatedAt` Prisma existant. Choix technique signalé
  pour ne pas piéger les futures sessions.
- **Migration** générée en `--create-only` :
  `backend/prisma/migrations/20260516152247_add_compta/migration.sql`.
  Pas encore appliquée à la DB — Yassine doit lancer `npx prisma migrate dev`
  côté Windows.
- **Seed corrigé** : `chefId` de Villa PY pointe désormais vers Rachid,
  `sousTraitantId` mis à null (Rachid n'est plus à la fois chef ET ST).
  Le champ `sousTraitantId` reste dans le schéma pour les futurs chantiers
  avec un vrai sous-traitant distinct.
- **Routes créées** :
  - `routes/users.js` → `GET /api/users` (admin only, filtres ?role et ?actif)
  - `routes/depenses.js` → `GET /a-valider/count`, `POST /`, `PATCH /:id`,
    `PATCH /:id/valider`, `DELETE /:id`
  - `routes/budgets.js` → `POST /`, `PATCH /:id`, `DELETE /:id`
  - `routes/compta.js` → `GET /api/compta/dashboard` + extensions
    `GET /api/chantiers/:id/compta` et `GET /api/chantiers/:id/budgets`
- **server.js** : 4 nouvelles registrations (users, depenses, budgets,
  compta + extension chantiers).
- **Vérif** : `node --check` OK sur les 8 fichiers JS, `npx prisma validate` ✓.

**Règles d'accès appliquées (cohérentes avec le cahier des charges)**

- Chef : crée des dépenses sur SES chantiers uniquement, modifie/supprime
  SA propre dépense tant qu'elle est `A_VALIDER`.
- Admin : crée/modifie/valide partout. Modification d'une dépense
  `A_VALIDER` par admin → passage auto à `VALIDEE` + audit `corrigeeParId`
  et `corrigeeLe`.
- `GET /chantiers/:id/compta` → 403 si chef ≠ chefId du chantier.
- Tous les calculs en centimes DH côté API.

**Frontend**

- **`NavBas.svelte`** : onglet Compta ouvert au rôle `chef`. Badge rouge
  avec compteur des dépenses à valider (admin uniquement). Refresh au
  montage, toutes les 60 s, et à chaque navigation.
- **`DepenseRow.svelte`** (nouveau composant réutilisable) : carte
  dépense, boutons Valider/Modifier conditionnés au rôle et au statut,
  ligne d'audit "Modifié par X le DD/MM" si dépense corrigée par admin.
- **`AjoutDepenseForm.svelte`** (nouveau) : 3 boutons rapides catégorie
  avec pré-remplissage description, date auto, montant DH avec suffixe,
  checkbox avance perso. Réutilisable en création ET en édition.
- **`/compta/+page.svelte`** :
  - Admin : section "À valider" en tête (rouge), KPI "ce que Dominique
    doit à Rachid", chantiers actifs avec solde (cartes cliquables vers
    `/chantiers/:id/compta`), paiements clients en attente, lien vers
    `/compta/general`.
  - Chef : message "Sélectionne un chantier" + liste de ses chantiers
    cliquables.
- **`/compta/general/+page.svelte`** : placeholder "À venir prochainement"
  (Niveau 2 — Compta générale analytique).
- **`/chantiers/[id]/compta/+page.svelte`** : 3 sections (Budget reçu de
  Dominique / Mes avances personnelles / Mes dépenses). Formulaire admin
  pour saisir versement ou remboursement. Liste des dépenses via
  `DepenseRow`. Le bouton "+ Ajouter une dépense" ouvre l'`AjoutDepenseForm`
  inline.
- **Raccourci compta** : bouton "📊 Compta du chantier" ajouté en haut
  de la fiche détail chantier (au-dessus de la section Devis), bordure
  gauche dorée pour accrocher l'œil.

### Décisions techniques signalées

1. **Centimes Int vs Decimal(10,2)** : on garde la convention projet
   (centimes en `Int`). Le cahier des charges proposait `Decimal(10,2)`,
   mais c'est incompatible avec SQLite et casserait la cohérence avec
   les modules existants (Devis, Paiement, Chantier).
2. **Enums → String** : SQLite ne supporte pas les enums Prisma. Validation
   des valeurs autorisées (`ACOMPTE` / `MATERIEL` / `REPAS`, `A_VALIDER` /
   `VALIDEE`, `VERSEMENT` / `REMBOURSEMENT`) déléguée à zod côté backend.
3. **`corrigeeLe` vs `modifieeLe`** : choix d'éviter la collision avec
   le `modifieLe @updatedAt` Prisma. Si on revient un jour à `modifieeLe`,
   bien vérifier qu'aucune query ne confond les deux.

### Question résolue (du cahier des charges)

**Dominique (admin) doit-il pouvoir saisir des dépenses ?** Oui — implémenté.
Un admin peut créer une dépense sur n'importe quel chantier, et sa dépense
est créée directement en `A_VALIDER` (cohérent avec les autres). À noter :
si un admin veut une dépense déjà validée à la création, il faut soit
la valider juste après, soit ajouter ce comportement plus tard (pas
demandé dans le cahier des charges V1).

### Question pour la prochaine session

Sur le **tableau de bord admin**, on a aujourd'hui :
- Section "À valider"
- KPI cumul Dominique → Rachid
- Cartes chantiers actifs (avec solde + alerte avances)
- Paiements clients en attente
- Lien Compta générale (placeholder)

Est-ce qu'il manque quelque chose pour que ça soit utilisable au quotidien ?
Notamment : faut-il un récap des **soldes des budgets donnés à Rachid par
chantier** sous forme de section dédiée (ou bien le solde affiché sur
chaque carte chantier suffit) ?

### À faire côté Windows pour activer

```powershell
cd C:\Users\USUARIO\Projets\chantiers-essaouira\chantiers-essaouira\backend
npx prisma migrate dev      # applique 20260516152247_add_compta + génère le client
npm run db:seed             # re-seed pour avoir Villa PY avec chefId = Rachid
```

Puis relancer backend + frontend et suivre le plan de test détaillé fourni
en fin de session précédente (voir la conversation Cowork — 16 étapes
couvrant admin saisie, chef saisie, validation, verrouillage).

### Prochaines étapes (priorité inchangée)

1. **Tester en live le module Compta** (16 étapes du plan de test).
2. **Compta générale analytique** (Niveau 2) — CA mois/année, dépenses
   par catégorie, marge brute. Session dédiée.
3. **Module Photos** — capture caméra + galerie par chantier.
4. **Déploiement VPS Hostinger** (cf. session précédente pour les
   vérifications infra à faire au démarrage).

---

## Session du 2026-05-16 (suite) — Tests live + icônes PWA + test mobile

### Ce qui a été fait

- **Test live module Chantiers validé** : création + filtres + détail OK
- **Test mobile réel** sur téléphone via WiFi (`192.168.1.3:5173`) :
  navigation au pouce fluide, texte lisible, boutons bien dimensionnés,
  scroll fluide
- **6 icônes PWA générées** (32, 144, 192, 384, 512 + favicon) avec
  palette LD doré (`#c8924a`) sur fond bleu Atlantique (`#1e4d6b`),
  via Pillow. Fichiers dans `frontend/static/icons/`
- **Manifest mis à jour** (`manifest.json`) avec les 5 tailles référencées
  (`purpose: "any maskable"`)

### Points bloquants découverts

- Pages `/photos` et `/compta` retournent 404 (normal, pas encore codées)
- **Install PWA impossible en HTTP** sur IP locale (`192.168.1.3`) sur
  Brave et Chrome mobile. Sera testable une fois l'app déployée en HTTPS.
  Pour le moment, accès via favori dans le navigateur mobile.

### Hébergement disponible (info infra)

- **VPS Hostinger KVM 1** : 1 vCPU / 4 GB RAM / 50 GB SSD
- Déjà utilisé pour n8n, Lume, un bot Telegram d'analyse russo-ukrainienne
  et Suno via Telegram
- HTTPS / Let's Encrypt déjà en place
- Node.js déjà installé
- Accès SSH root

### Prochaines sessions (priorité)

1. **Module Compta + permissions Rachid** — cahier des charges déjà
   détaillé dans l'entrée précédente du journal
2. **Module Photos** — capture caméra + galerie par chantier
3. **Déploiement sur le VPS Yassine** (pas Vercel/Netlify) :
   - Choisir un sous-domaine (ex : `chantiers.ludimmo.com`)
   - Vérifier en début de session quel reverse proxy est utilisé
     (nginx ? Caddy ?)
   - Vérifier quel process manager est utilisé (PM2 ? systemd ?)
   - SQLite peut suffire (`dev.db`) ou migrer vers PostgreSQL si déjà
     installé sur le VPS

---

## Session du 2026-05-16 — Cahier des charges : Permissions Rachid + Module Compta

### Contexte

Session de clarification métier avec Yassine. Pas de code produit. L'objectif
était de résoudre la confusion sur le mot "chef" (rôle applicatif vs rôle
métier sur un chantier) et de définir précisément ce que Rachid doit voir
et faire dans l'app.

### Cahier des charges validé

#### 1. Réalité métier

Rachid finance le terrain de 2 façons selon les chantiers :

- Soit cash reçu de Dominique en début de chantier
- Soit avance de sa poche, remboursée ensuite

L'app doit gérer les 2 cas en parallèle sur un même chantier.

#### 2. Catégories de dépenses gérées par Rachid

- Acompte ouvrier / artisan
- Petit matériel (outils, consommables)
- Repas / restauration équipes

(Pas de matériaux ni d'essence : géré par Dominique directement)

#### 3. Justificatifs

Pas de photo de ticket pour le démarrage. À ajouter plus tard si besoin.

#### 4. Vue Compta de Rachid (par chantier)

Sections affichées :

- **"Budget reçu de Dominique"** : total reçu / total dépensé / solde restant
- **"Mes avances personnelles"** : total avancé / remboursé / ce que Dominique me doit
- Liste de mes dépenses + bouton "Ajouter"

**PAS** de section "Ma part" pour le moment (sujet trop sensible, à voir plus tard).

#### 5. Formulaire "Ajouter une dépense" (optimisé mobile)

- Date (auto = aujourd'hui, modifiable)
- Catégorie (dropdown : Acompte / Matériel / Repas)
- Montant en DH
- Description (texte court libre)
- Checkbox "Avance personnelle" (décochée par défaut = budget Dominique)
- Bouton Enregistrer

#### 6. Modification des permissions

- Rôle applicatif `chef` (Rachid) : **OUVRIR** l'accès à l'onglet Compta
  (modifier `NavBas.svelte` qui filtrait actuellement)
- Côté Rachid : vue Compta filtrée selon ce qui est défini en section 4
- Côté admin (Yassine + Dominique) : vue Compta complète comme aujourd'hui

#### 7. Corrections backend nécessaires

- Corriger le seed : `chefId` de Villa PY doit pointer vers **Rachid** (pas Dominique)
- Ajouter table `Depense` : id, chantierId, userId, date, categorie (enum),
  montant, description, estAvancePersonnelle (boolean)
- Ajouter table `BudgetChantier` : id, chantierId, userId, montant, date,
  type (enum : "versement" ou "remboursement")
- Endpoint `GET /api/users` (pour les dropdowns côté frontend)
- Endpoint `GET /api/chantiers/:id/compta` retournant la vue filtrée selon
  le rôle de l'utilisateur connecté
- Endpoints CRUD pour `Depense` et `BudgetChantier`
- Mise à jour fiche chantier : section "Sous-traitant" sur Villa PY mentionne
  "Rachid (à compléter)" — à clarifier : que faire de ce champ maintenant
  que Rachid devient `chefId` ?

#### 8. Question à clarifier avant de coder la prochaine session

Dominique (admin) doit-il aussi pouvoir saisir des dépenses sur un chantier ?
A priori oui, en tant qu'admin il a accès à tout. Mais à confirmer avec
Yassine au début de la prochaine session.

---

## Session du 2026-05-15 — Auth 100 % + test rôle Rachid + début module Chantiers

### État

Module Auth **complet et fonctionnel** (backend + frontend). Validé à 100 % en navigation privée.

### Bug résolu (rappel consolidé)

La route `/refresh` ne renvoie que `{ accessToken }` (pas de `refreshToken` ni `user`). Le frontend appelle désormais `/api/auth/me` pour récupérer l'utilisateur après un refresh. Le store `auth.js` nettoie aussi les valeurs corrompues `"undefined"` du localStorage au démarrage.

### Tests passés

- Connexion avec `yassine.bruneau@gmail.com` / `admin123` : OK
- Persistance après F5 : OK
- Déconnexion propre : OK
- **Test compte Rachid** (`rachid@ludimmo.ma` / `chef123`, rôle `chef`) : OK — la nav du bas affiche bien 3 onglets seulement (Chantiers, Photos, Profil), pas de Compta. Filtrage par rôle validé.

### Fichiers créés (module Chantiers — pas encore testés en live)

- `backend/src/routes/chantiers.js` — CRUD complet (GET liste paginée + filtres statut/chef, GET détail, POST création admin, PUT modification admin, DELETE admin). Validation zod, recalcul auto frais km, numéro auto CH-AAAA-NNN. Un chef ne voit que ses propres chantiers.
- `backend/src/server.js` — modifié pour brancher `/api/chantiers`
- `frontend/src/routes/(app)/+page.svelte` — réécrit avec liste, cartes, badges statut, filtres horizontaux, bouton FAB "+" (admin seulement)
- `frontend/src/routes/(app)/chantiers/nouveau/+page.svelte` — formulaire création (titre, adresse, client, chef, distance, A/R, notes)
- `frontend/src/routes/(app)/chantiers/[id]/+page.svelte` — page détail (intervenants, dates, frais km, aperçu devis/paiements, boutons changement statut rapide)

**Attention** : le formulaire de création utilise une liste d'utilisateurs codée en dur (les 4 du seed). À remplacer par un endpoint `/api/utilisateurs` plus tard.

### Prochaine étape

**Tester en live le module Chantiers** : relancer frontend, vérifier la liste, créer un chantier, ouvrir le détail. Puis corriger les éventuels bugs.

### Décision prise : rôles et visibilité Rachid

**Problème identifié** : le mot "chef" désigne deux choses différentes :
- rôle applicatif `chef` (permissions dans l'app)
- champ `chefId` sur un chantier (chef de chantier terrain)

**Décision** : on garde "Chef de chantier" pour le rôle métier terrain. Le `chefId` de Villa PY doit pointer vers **Rachid** (pas Dominique). Dominique reste admin/gérant commercial.

**Visibilité Rachid (rôle `chef`)** :
- Voit : ses avances, les paiements clients, sa part sur chaque chantier
- Ne voit PAS : les marges par ligne de devis, le bénéfice net global
- Conséquence : Rachid doit avoir accès à l'onglet Compta avec une **vue filtrée** (pas la même que l'admin)

**À faire en prochaine session** :
1. Corriger le seed : `chefId` = Rachid, et Dominique n'est plus "chef" mais reste créateur/gérant du chantier
2. Ajouter Rachid à la liste des rôles autorisés pour l'onglet Compta dans NavBas, mais avec vue filtrée
3. Créer un endpoint `GET /api/utilisateurs` pour alimenter les sélecteurs client/chef dans le formulaire

### Tâches différées

- Endpoint `GET /api/utilisateurs` pour le formulaire de création
- Vue Compta filtrée pour le rôle `chef`
- Correction seed Villa PY (`chefId` → Rachid)

---

## Session du 2026-05-12 (suite) — Module Auth ✅ validé bout-en-bout

### Statut

Le module Auth est **terminé et validé à 100% en navigation privée** par
Yassine. Tests passés avec succès :

- Login admin (Yassine) → page Chantiers + nav bas 4 onglets (Chantiers,
  Photos, Compta, Profil).
- Login chef (Rachid) → nav bas 3 onglets seulement (pas de Compta) —
  filtrage par rôle confirmé.
- F5 (rafraîchissement) → l'utilisateur reste connecté grâce au refresh
  token persistant.
- Déconnexion via le bouton Profil → retour login propre.

### Bug résolu en cours de session : refresh token corrompu

**Symptôme** : après le premier login, un F5 cassait la session. La clé
`ludimmo_refresh_token` dans localStorage contenait la chaîne `"undefined"`.

**Cause** : le backend `/api/auth/refresh` ne renvoie volontairement que
`{ accessToken }` (pas de rotation du refresh token pour la V1). Or
l'ancien store frontend faisait systématiquement
`localStorage.setItem('ludimmo_refresh_token', data.refreshToken)`,
écrasant le vrai refresh par `undefined`.

**Correction** : remplacement complet de `frontend/src/lib/stores/auth.js`
par une version qui :

- Ne touche PLUS au `localStorage` lors d'un `/refresh` sauf si le
  backend renvoie un *nouveau* refresh token (rotation optionnelle, pas
  encore implémentée côté backend).
- Récupère l'utilisateur via `GET /api/auth/me` après un refresh, puisque
  `/refresh` ne renvoie pas l'objet `user`.
- Détecte et purge les valeurs corrompues (`"undefined"`, `"null"` en
  string) au démarrage, pour rattraper les anciens utilisateurs qui
  auraient déjà la valeur cassée en localStorage.
- Valide que la réponse `/login` contient bien les deux tokens avant de
  rien stocker.

### Conséquence côté backend

Aucune modification nécessaire : le backend `/refresh` reste tel quel
(renvoie uniquement `{ accessToken }`). Si on veut activer la rotation
du refresh token plus tard pour durcir la sécurité, c'est une simple
modification dans `backend/src/routes/auth.js` — le frontend la gérera
déjà grâce au `if (data.refreshToken)` dans le store.

### Module Auth — état final

**Backend** : lib/password.js, lib/tokens.js, middleware/authentifie.js,
middleware/role.js, routes/auth.js, server.js branché. Endpoints
`/api/auth/login`, `/refresh`, `/logout`, `/me`.

**Frontend** : app.css (palette), stores/auth.js (v2 corrigée),
+layout.svelte (auth global), login/+page.svelte, NavBas.svelte,
(app)/+layout.svelte, (app)/+page.svelte, (app)/profil/+page.svelte.

### Prochaine étape (inchangée)

Module Chantiers — CRUD côté backend + pages frontend. C'est le module
le plus simple en termes de logique, et il prépare le terrain pour le
module Devis qui s'y attache. Voir la section "Prochaine étape" de
l'entrée précédente pour la liste complète priorisée.

---

## Session du 2026-05-12 — Module Auth (backend + frontend)

### Ce qu'on a fait

**Backend — Auth complet**

Module Auth implémenté en suivant les conventions de `backend/CLAUDE.md` :

- `backend/src/lib/password.js` — helpers bcrypt (`hasherMotDePasse`,
  `verifierMotDePasse`), cost 12.
- `backend/src/lib/tokens.js` — gestion des tokens. Access token = JWT
  signé par `@fastify/jwt` (15 min). Refresh token = chaîne opaque
  random (96 chars hex) stockée en DB dans `RefreshToken`, durée 7 jours,
  révocable côté serveur.
- `backend/src/middleware/authentifie.js` — décore `fastify.authentifie`
  qui lit le header Authorization, vérifie le JWT, charge l'utilisateur
  depuis la DB et l'attache à `req.user`.
- `backend/src/middleware/role.js` — factory `fastify.role(['admin','chef'])`
  pour restreindre une route à certains rôles.
- `backend/src/routes/auth.js` — 4 endpoints :
  - `POST /api/auth/login` → `{ accessToken, refreshToken, refreshExpireLe, user }`
  - `POST /api/auth/refresh` → `{ accessToken }`
  - `POST /api/auth/logout` → 204
  - `GET  /api/auth/me` → utilisateur courant (protégé)
- `backend/src/server.js` — branche les plugins middleware et les routes auth.

**Validation faite** : `node --check` OK sur les 6 fichiers, JWT
round-trip testé en isolation, validation zod testée. Le serveur n'a pas
pu être démarré depuis la sandbox Linux du dev (bcrypt avec binding natif
Windows), mais tourne correctement chez l'utilisateur sous Windows.

**Frontend — page de connexion + nav mobile**

8 fichiers créés en SvelteKit + Svelte 5 (runes) :

- `frontend/src/app.css` — styles globaux, palette sable + bleu Atlantique.
- `frontend/src/lib/stores/auth.js` — store auth + wrapper `apiAuth`
  avec refresh automatique en cas de 401.
- `frontend/src/routes/+layout.svelte` — layout global, initialise
  l'auth au montage, redirige vers `/login` si non-connecté et vers `/`
  si déjà connecté sur une page publique.
- `frontend/src/routes/login/+page.svelte` — page de connexion mobile,
  toggle afficher mot de passe, messages d'erreur en français.
- `frontend/src/lib/components/NavBas.svelte` — nav bottom mobile avec
  filtrage des onglets selon le rôle (Compta visible pour admin
  uniquement).
- `frontend/src/routes/(app)/+layout.svelte` — layout du groupe protégé,
  contient `<NavBas />`.
- `frontend/src/routes/(app)/+page.svelte` — page Chantiers (placeholder
  pour l'instant, à remplir quand le module Chantiers sera fait).
- `frontend/src/routes/(app)/profil/+page.svelte` — page Profil avec
  avatar, badge rôle et bouton déconnexion.

**Décisions importantes prises**

- **Rôles des utilisateurs** : Yassine et Dominique sont tous les deux
  `admin` ; Rachid est `chef`. Pas de double rôle dans le schéma DB
  (un utilisateur = un rôle).
- **Emails réels** : `yassine.bruneau@gmail.com` (Yassine) et
  `dbruneau77@gmail.com` (Dominique). Rachid garde un placeholder
  `rachid@ludimmo.ma` en attendant qu'il communique son vrai email.
- **Suppression du placeholder** : l'ancien `frontend/src/routes/+page.svelte`
  ("Application en construction") a été supprimé car il créait un conflit
  de routing avec le nouveau `(app)/+page.svelte` (les parenthèses étant
  un *route group* SvelteKit qui n'affecte pas l'URL).
- **Refresh token opaque** : choix volontaire de ne PAS utiliser un JWT
  pour le refresh. Une chaîne random + stockage DB est plus simple et
  tout aussi sûre, puisque le seul intérêt du refresh est d'être
  révocable côté serveur.

### Comptes de test (rappel)

| Personne  | Email                            | Rôle  |
|-----------|----------------------------------|-------|
| Yassine   | yassine.bruneau@gmail.com        | admin |
| Dominique | dbruneau77@gmail.com             | admin |
| Rachid    | rachid@ludimmo.ma *(placeholder)* | chef  |
| Pierre-Yves *(client demo)* | pierre-yves@example.com | client |

> **Mot de passe initial** : `admin123` pour Yassine, `chef123` pour
> Dominique et Rachid, `demo123` pour Pierre-Yves. **À changer avant
> tout déploiement** (les mdp actuels sont dans le seed, donc dans Git).

### Démarrage du projet

**Première installation (à faire une seule fois)** :

```powershell
# Backend
cd C:\Users\USUARIO\Projets\chantiers-essaouira\chantiers-essaouira\backend
npm install
npx prisma migrate dev --name init
# (le seed s'exécute automatiquement avec prisma migrate dev)

# Frontend
cd ..\frontend
npm install
```

**Démarrage quotidien** (2 terminaux) :

```powershell
# Terminal 1 — backend
cd C:\Users\USUARIO\Projets\chantiers-essaouira\chantiers-essaouira\backend
npm run dev
# → API sur http://localhost:3000

# Terminal 2 — frontend
cd C:\Users\USUARIO\Projets\chantiers-essaouira\chantiers-essaouira\frontend
npm run dev
# → App sur http://localhost:5173
```

**Réinitialiser la DB** (en cas de modif du seed) :

```powershell
cd C:\Users\USUARIO\Projets\chantiers-essaouira\chantiers-essaouira\backend
Remove-Item prisma\dev.db
npx prisma migrate dev --name init
```

**Explorer la DB visuellement** : `npx prisma studio` → http://localhost:5555

### Anomalie à résoudre plus tard (TODO différé)

Le seed produit pour le devis Villa PY :

```
Total brut    : 104 860 DH
Total client  : 120 589 DH
```

Or `docs/devis_reference.md` annonce :

```
Total brut    : ~129 915 DH
Total client  : ~149 402 DH
```

**Écart de ~25 000 DH sur le brut**. La logique de calcul
(`lib/calculsDevis.js`) est validée — c'est juste que les 11 lignes du
seed produisent ce total et que la doc annonce un total différent. Soit
il manque des lignes dans le seed (provenant du fichier Excel d'origine
`VILLA_PY_ET_LAURENT.ods`), soit les chiffres annoncés dans la doc sont
erronés.

À résoudre quand Yassine aura le fichier Excel sous les yeux. Un TODO
est posé dans `backend/prisma/seed.js` au-dessus du tableau `lignesBrutes`.

### Prochaine étape

Une fois la connexion testée et validée (voir section "Plan de test"
ci-dessous), l'ordre suggéré par le `QUICKSTART.md` est :

1. **Tableau de bord** (KPIs encaissé / à recevoir / parts, alertes
   acomptes en retard) — page d'accueil pour Yassine et Dominique.
2. **Module Chantiers** côté backend + frontend (CRUD + photos) :
   - `backend/src/routes/chantiers.js`
   - Pages `frontend/src/routes/(app)/chantiers/{,nouveau,[id]}/`
3. **Module Devis** ⭐ le plus critique de l'app :
   - Double colonne brut/client avec marge par ligne
   - Page de création/édition de devis (focus à 100%)
   - Génération PDF Puppeteer (vue interne admin/chef vs vue client)
4. **Module Paiements** avec échéancier 30/40/30 + alertes relances.
5. Avances, Catalogue matériaux, Compta (parts Yassine/Rachid), Planning.
6. PWA finale (manifest, service worker, mode offline).

Mon avis : démarrer par **le module Chantiers** une fois la connexion
validée — c'est le module le plus simple côté CRUD et il prépare le
terrain pour le module Devis qui s'y attache.

### Plan de test (à valider en ouvrant Chrome)

1. `http://localhost:5173` → page de login Ludimmo s'affiche (logo
   doré, fond clair, layout mobile).
2. Login avec `yassine.bruneau@gmail.com` / `admin123` →
   redirection vers `/` → page "Chantiers" + nav bas avec **4 onglets**
   (Chantiers, Photos, Compta, Profil).
3. Onglet Profil → bouton "Se déconnecter" → confirmation → retour
   login.
4. Login avec `rachid@ludimmo.ma` / `chef123` → nav bas avec **3
   onglets** seulement (pas de Compta — c'est un test du filtrage par
   rôle).
5. F5 (refresh) : doit rester connecté grâce au refresh token persistant
   dans localStorage.

---

## Historique avant ce journal

Sessions précédentes (squelette du projet, structure backend/frontend,
schéma Prisma, calculs devis et frais km, seed initial) : non
journalisées. Voir les commits Git ou le `CLAUDE.md` pour le contexte
métier.
