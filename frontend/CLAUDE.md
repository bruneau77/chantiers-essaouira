# Frontend — Contexte pour Claude Code

SvelteKit en mode PWA, mobile-first, français uniquement.

## Architecture

```
frontend/
├── src/
│   ├── routes/                 # Pages
│   │   ├── +layout.svelte      # Layout global (nav bottom mobile)
│   │   ├── +page.svelte        # Tableau de bord
│   │   ├── connexion/+page.svelte
│   │   ├── chantiers/
│   │   │   ├── +page.svelte           # Liste
│   │   │   ├── nouveau/+page.svelte   # Création
│   │   │   └── [id]/+page.svelte      # Détail
│   │   ├── devis/...
│   │   ├── paiements/...
│   │   ├── catalogue/...
│   │   ├── planning/...
│   │   ├── compta/...
│   │   └── reglages/...
│   ├── lib/
│   │   ├── components/         # Composants réutilisables
│   │   ├── stores/             # État global (utilisateur, etc.)
│   │   └── utils/
│   │       ├── api.js          # Wrapper fetch + JWT
│   │       ├── format.js       # formaterDh, formaterDate, etc.
│   │       └── permissions.js  # Helpers rôles
│   └── app.html
├── static/
│   ├── manifest.json           # PWA manifest
│   ├── service-worker.js       # Offline support
│   └── icons/
└── svelte.config.js
```

## Conventions Svelte 5

Ce projet utilise **Svelte 5 avec runes** :

```svelte
<script>
  // ✓ Bon — Svelte 5
  let count = $state(0)
  let double = $derived(count * 2)

  function increment() { count++ }
</script>

<button onclick={increment}>{count} (double = {double})</button>
```

Pas d'ancienne syntaxe `$:` réactive. Toujours `$state`, `$derived`, `$effect`.

## Style et UI

### Approche

- **Mobile-first absolu**. Design pour iPhone/Android d'abord, desktop ensuite.
- **Pas de framework CSS** (Tailwind, Bootstrap). On écrit du CSS direct dans
  les composants Svelte (scopé par défaut).
- **Police système** : SF/Segoe/Roboto via `font-family: system-ui`. Rapide,
  pas de webfont à télécharger.
- **Tailles confortables tactiles** : boutons min 44px de hauteur (Apple
  HIG), zones de tap espacées.

### Palette (à définir dans `app.css`)

```css
:root {
  --bg: #FAFAF7;
  --surface: #FFFFFF;
  --text: #1A1714;
  --text-secondary: #6B6B6B;
  --primary: #C8B89A;       /* Or cendré (cohérent avec LÜME/Ludimmo) */
  --primary-dark: #8A7A65;  /* Terre */
  --success: #2D7D5E;
  --warning: #C97B2B;
  --danger: #B23B3B;
  --border: #E8E5DD;
  --radius: 10px;
  --shadow: 0 1px 3px rgba(0,0,0,0.06);
}
```

### Composants à construire en premier

1. **`<Carte>`** : conteneur card avec bord arrondi et ombre douce
2. **`<Bouton>`** : bouton avec variants (primaire / secondaire / danger)
3. **`<Champ>`** : input avec label flottant et validation
4. **`<MontantDh>`** : affichage monétaire formaté (`129 915 DH`)
5. **`<NavBas>`** : barre nav bottom mobile (Accueil/Devis/+/Planning/Compta)

## API client

Le wrapper `lib/utils/api.js` doit gérer :

- Ajout automatique du JWT en header `Authorization: Bearer ...`
- Refresh automatique du token si 401
- Erreurs réseau → message utilisateur en français
- URL base = `import.meta.env.VITE_API_URL` (par défaut `http://localhost:3000/api`)

```js
// Exemple d'usage
import { api } from '$lib/utils/api.js'

const chantiers = await api.get('/chantiers')
const nouveau = await api.post('/chantiers', { titre: '...' })
```

## PWA

- **Manifest** : nom "Chantiers Essaouira", icône Ludimmo, theme color
  `#C8B89A`, display `standalone`, orientation `any`.
- **Service worker** : cache statique des assets + cache des dernières
  données chantiers/devis pour mode offline.
- **Détection d'installation** : afficher un bouton "Ajouter à l'écran
  d'accueil" sur mobile la première fois.

## Comportements UX critiques

1. **Saisie chantier mobile** : un seul champ visible à la fois en focus,
   clavier numérique pour les montants, photos via caméra directe.
2. **Devis double colonne** : toggle "Vue interne / Vue client" en haut de
   l'écran, change l'affichage en temps réel.
3. **Échéancier paiements** : grosses checkboxes pour cocher "reçu",
   sélecteur de date qui s'ouvre au tap.
4. **Mode offline** : si pas de réseau, afficher un bandeau jaune en haut
   et permettre la saisie locale (sync au retour du réseau).
5. **Confirmation actions destructives** : suppression chantier/devis
   demande confirmation explicite (modale).

## Pages prioritaires V1

Ordre d'implémentation suggéré :

1. Connexion + layout global avec nav bottom
2. Tableau de bord (KPIs + alertes)
3. Liste chantiers
4. Détail chantier
5. Création/édition devis (la pièce critique — focus à 100%)
6. Échéancier paiements
7. Catalogue matériaux
8. Planning
9. Comptabilité
10. Réglages

## Génération PDF côté frontend ?

**Non** : le PDF est généré côté backend via Puppeteer pour garantir un
rendu identique sur tous les téléphones. Le frontend appelle juste
`GET /api/devis/:id/pdf?vue=client` et déclenche le téléchargement.
