# Contexte projet pour Claude Code

Ce fichier est lu automatiquement par Claude Code à chaque session. Il
contient le contexte métier et les conventions techniques du projet
**Chantiers Essaouira** (Ludimmo Travaux).

---

## Le contexte métier (à lire avant tout)

**Qui ?**
- **Dominique Bruneau** : retraité français à Essaouira, gérant Ludimmo
  Travaux. Il prend les chantiers issus de son agence immo Ludimmo,
  s'associe avec **Rachid** (chef de chantier marocain) qui exécute via
  des ouvriers sous-traitants. Dominique gère la partie commerciale,
  les devis, les paiements clients, et avance souvent l'argent.
- **Yassine Bruneau** (son fils) : développe et maintient cette app, a
  un rôle admin pour configurer le système.
- **Rachid** : chef de chantier, voit ses chantiers, déclare l'avancement,
  envoie des photos.
- **Clients** : propriétaires de villas/riads à Essaouira (souvent
  expatriés français), reçoivent des devis et règlent en 3 fois.

**Le problème qu'on résout :**

Aujourd'hui Dominique gère ses chantiers sur tableur. Trois douleurs
identifiées :

1. **Avances confuses** : il avance souvent l'argent au lieu de réclamer
   l'acompte 30% à la signature. L'app doit imposer le rythme 30/40/30
   et alerter quand un acompte tarde.
2. **Devis lents** : il doit ressaisir les mêmes lignes (céramique,
   ciment, main d'œuvre maçon) à chaque chantier. L'app a un catalogue
   matériaux/fournisseurs réutilisable.
3. **Compta floue** : il sait pas exactement combien il a gagné net
   après frais essence, part Rachid, avances pas remboursées. L'app fait
   ce calcul en temps réel.

---

## Logique métier critique (à respecter dans tout le code)

### 1. Devis double colonne (BRUT vs CLIENT)

Chaque ligne de devis a :
- `prixUnitaireBrut` (DH) : ce que Dominique paie au fournisseur ou ouvrier
- `quantite` ou `surfaceM2` (selon nature du poste)
- `coutBrut` = prixUnitaireBrut × quantité (calculé)
- `margePct` (%) : marge appliquée à cette ligne (défaut paramétré globalement)
- `prixUnitaireClient` = prixUnitaireBrut × (1 + margePct/100)
- `coutClient` = prixUnitaireClient × quantité (ce que voit le client)
- `margeMontant` = coutClient - coutBrut (ce que Dominique gagne sur cette ligne)

**Le PDF imprimé pour le client n'affiche QUE `coutClient`. Les colonnes
brutes et marges sont masquées.**

### 2. Échéancier 30/40/30

Tout devis validé crée 3 paiements attendus :
- Acompte 30% à la signature
- Mi-chantier 40%
- Solde 30% à la livraison

Pourcentages **paramétrables** dans `Reglages` (au cas où). Si l'acompte
n'est pas reçu sous N jours (défaut 7), alerte sur le dashboard.

### 3. Frais kilométriques (Touareg V6 TDI 2015-2016)

Formule à implémenter dans `backend/src/lib/fraisKm.js` :

```
coutKm = (consommation_l_par_100km × prix_gasoil_dh_par_l) / 100
       + usure_dh_par_km

frais_essence = distance_aller_simple_km × 2 × (nb_aller_retour_prevus + securite_ar)
              × coutKm
```

Paramètres par défaut :
- consommation : 9.5 L/100km
- prix gasoil : 11.5 DH/L (mise à jour manuelle)
- usure : 0.8 DH/km
- securité_ar : +1 (toujours ajouter 1 A/R de sécurité)

### 4. Partage Yassine/Rachid

Sur chaque chantier :
- Commission s'applique à `DEVIS` (% du prix total facturé) — choix par défaut
- Alternative `MARGE` (% du bénéfice) — paramétrable
- Part Yassine 50% par défaut, peut être surchargée par chantier
- Part Rachid = 100% - part Yassine

Calculs nets :
- Marge totale = total_devis_client - total_brut - frais_essence
- Commission_Yassine = total_devis × % / 100 × part_Yassine
- Net_Yassine = commission_Yassine - frais_essence_avancés - avances_non_remboursées

### 5. Avances (sous-traitants ET distributeurs séparés)

Deux types d'avances tracées séparément :
- **Avance sous-traitant** (Rachid, ouvriers) : à déduire de leur part
- **Avance distributeur** (fournisseur matériaux) : à rembourser depuis
  les paiements clients

Chaque avance a : montant, date, bénéficiaire, chantier lié, statut
(remboursée/en attente).

---

## Conventions techniques

### Code style

- **Backend** : ESM (`import`/`export`), pas de CommonJS. Pas de TypeScript
  pour la V1 (on garde simple), JSDoc pour le typage.
- **Frontend** : SvelteKit en JavaScript (pas TS V1), composants Svelte
  classiques.
- **Nommage** : camelCase pour JS, snake_case pour colonnes DB, PascalCase
  pour composants Svelte.
- **Commentaires** : en français, c'est un projet francophone.

### Devises et formats

- Toutes les valeurs monétaires sont en **DH (dirhams marocains)** stockées
  en **centimes** dans la DB (entiers, pas de flottant) pour éviter les
  erreurs d'arrondi.
- Format affichage : `129 915 DH` (espace milliers, pas de décimales sauf
  besoin spécifique).
- Dates : ISO 8601 en DB, format `JJ/MM/AAAA` à l'affichage.

### Sécurité

- Mots de passe : bcrypt avec cost 12.
- JWT : access token 15 min, refresh token 7 jours.
- Toutes les requêtes DB via Prisma (pas de SQL brut sauf cas justifié).
- Validation entrées avec `zod` côté backend, jamais faire confiance au
  frontend.

### Photos chantier

- Upload via endpoint `/api/photos` (multipart).
- Compression auto avec Sharp : max 1920px largeur, qualité 80, WebP.
- Stockage dans `/var/app/uploads/chantiers/{chantierId}/`.
- Servi via Caddy en static avec cache 30j.

---

## Modules et leur état

| Module | Statut V1 | Fichier principal |
|---|---|---|
| Auth + rôles | À implémenter | `backend/src/routes/auth.js` |
| Chantiers | À implémenter | `backend/src/routes/chantiers.js` |
| Devis | À implémenter | `backend/src/routes/devis.js` |
| PDF devis | À implémenter | `backend/src/lib/pdfDevis.js` |
| Paiements | À implémenter | `backend/src/routes/paiements.js` |
| Frais km | À implémenter | `backend/src/lib/fraisKm.js` |
| Catalogue | À implémenter | `backend/src/routes/catalogue.js` |
| Avances | À implémenter | `backend/src/routes/avances.js` |
| Planning | À implémenter | `backend/src/routes/planning.js` |
| Compta | À implémenter | `backend/src/services/compta.js` |

---

## Devis de référence (cas réel)

Le devis Villa Pierre-Yves & Laurent (réfection toiture, 300 m², 129 915 DH
HT brut) sert de cas test. Il est dans `docs/devis_reference.md`. **Tout
nouveau code de devis doit pouvoir reproduire exactement ce devis.**

---

## Comportements attendus de Claude Code

Quand tu travailles sur ce projet :

1. **Lire toujours ce fichier en premier** + le `CLAUDE.md` du sous-dossier
   sur lequel tu travailles (backend ou frontend).
2. **Respecter la logique métier** ci-dessus, surtout les calculs (devis,
   frais km, parts).
3. **Tester avec le cas Villa PY** quand tu touches au module devis.
4. **Pas de surcouche inutile** : pas de Redux, pas de TypeScript V1, pas
   de tests E2E pour démarrer. On reste pragmatique.
5. **Demander avant d'ajouter une dépendance npm** — chaque package compte
   sur 4 GB RAM.
6. **Communiquer en français** dans le code (commentaires, messages
   d'erreur utilisateur, libellés UI).
