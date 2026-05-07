# Backend — Contexte pour Claude Code

API REST Fastify + Prisma + PostgreSQL pour Chantiers Essaouira.

## Architecture

```
backend/
├── prisma/
│   ├── schema.prisma   # Schéma DB (12 tables)
│   └── seed.js         # Données initiales + cas Villa PY
├── src/
│   ├── server.js       # Point d'entrée Fastify
│   ├── routes/         # Endpoints REST par domaine
│   │   ├── auth.js          # Login, refresh, logout
│   │   ├── chantiers.js     # CRUD chantiers + photos
│   │   ├── devis.js         # CRUD devis + génération PDF
│   │   ├── paiements.js     # Échéancier + relances
│   │   ├── avances.js       # ST + distributeurs
│   │   ├── catalogue.js     # Matériaux + fournisseurs
│   │   ├── planning.js      # Interventions
│   │   └── reglages.js      # Paramètres système
│   ├── services/       # Logique métier complexe
│   │   └── compta.js        # Calculs parts Yassine/Rachid, agrégats
│   ├── middleware/     # Auth, rôles, validation
│   │   ├── authentifie.js   # Vérifie JWT
│   │   └── role.js          # Vérifie rôle requis
│   └── lib/            # Fonctions pures réutilisables
│       ├── fraisKm.js       # Calcul frais km Touareg
│       ├── calculsDevis.js  # Logique double colonne brut/client
│       └── pdfDevis.js      # Génération PDF (Puppeteer)
```

## Conventions

### Routes Fastify

Toujours utiliser le pattern :

```js
export default async function routes(fastify) {
  fastify.get('/', { preHandler: [fastify.authentifie] }, async (req, reply) => {
    // ...
  })
}
```

### Validation des entrées

**Toujours valider avec zod** avant de toucher à la DB :

```js
import { z } from 'zod'

const schema = z.object({
  titre: z.string().min(1).max(200),
  prixUnitaireBrutCentimes: z.number().int().positive(),
  margePct: z.number().int().min(0).max(100),
})

const data = schema.parse(req.body)  // throw si invalide
```

### Centimes DH partout

**Règle absolue** : toutes les valeurs monétaires sont en centimes (entiers).
Conversion DH → centimes en entrée API, conversion centimes → DH affichage
côté frontend uniquement.

```js
// ❌ Mauvais
const prix = 11.50  // float, erreurs d'arrondi

// ✓ Bon
const prixCentimes = 1150  // entier, exact
```

### Réponses API

Format standardisé :

```js
// Succès
return reply.send({ data: result })

// Liste paginée
return reply.send({
  data: items,
  pagination: { total, page, perPage }
})

// Erreur métier
return reply.code(400).send({
  error: 'CODE_ERREUR',
  message: 'Message lisible en français'
})
```

## Modules à implémenter

Quand tu implémentes un module, suis cet ordre :

1. **Lire le schéma Prisma** concerné dans `prisma/schema.prisma`
2. **Écrire les fonctions pures** dans `lib/` si calculs complexes
3. **Écrire le service** dans `services/` si logique transversale
4. **Écrire les routes** dans `routes/`
5. **Tester avec un curl ou via Prisma Studio** (`npx prisma studio`)
6. **Mettre à jour le `server.js`** pour enregistrer les routes

### Module Auth (priorité 1)

Endpoints attendus :
- `POST /api/auth/login` → `{ accessToken, refreshToken, user }`
- `POST /api/auth/refresh` → `{ accessToken }`
- `POST /api/auth/logout` → invalide refresh token

Décorer Fastify avec :
- `fastify.authentifie` : middleware vérifiant le JWT, attachant `req.user`
- `fastify.role(['admin', 'chef'])` : factory middleware vérifiant le rôle

### Module Devis (priorité 2)

Endpoints :
- `GET /api/devis` : liste (filtrable par chantier, statut)
- `GET /api/devis/:id` : détail avec lignes
- `POST /api/devis` : création (brouillon)
- `POST /api/devis/:id/lignes` : ajouter ligne
- `PUT /api/devis/:id/lignes/:ligneId` : modifier ligne
- `DELETE /api/devis/:id/lignes/:ligneId`
- `POST /api/devis/:id/valider` : passer en `envoye`, créer échéancier
- `GET /api/devis/:id/pdf?vue=client` : générer PDF
- `GET /api/devis/:id/pdf?vue=interne` : PDF avec colonne brute (admin/chef seulement)

**Important** : à chaque modification de ligne, recalculer les totaux du devis.

### Module Frais km (priorité 3)

Pas de routes propres, utilisé depuis le module Chantiers :
- Quand un chantier est créé/modifié avec `distanceAllerKm` et `nombreAllerRetourPrevu`
- Recalculer `fraisEssenceCentimes` automatiquement avec `lib/fraisKm.js`

### Module Compta (priorité 4)

Service calculant pour un chantier ou tous :
- Marge totale = total client - total brut - frais essence - avances non remboursées
- Part Yassine = commission appliquée selon `baseCommission` (DEVIS ou MARGE)
- Part Rachid = complément
- Net dans la poche = part - frais essence avancés - avances Yassine non remboursées

Endpoint : `GET /api/compta/chantier/:id` et `GET /api/compta/global?periode=mois`

## Tests métier

À chaque modification du module Devis, vérifier que le seed reproduit
exactement les chiffres du devis Villa PY (cas test) :
- Total brut : ~129 915 DH (selon les lignes seed)
- Total client (marge 15%) : ~149 402 DH
- Acompte 30% : ~44 821 DH

Si le seed casse, c'est qu'on a touché à la logique de calcul.
