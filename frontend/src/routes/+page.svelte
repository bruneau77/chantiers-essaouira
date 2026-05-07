<!--
  Page d'accueil — placeholder. À remplacer par le tableau de bord
  réel quand le module Auth sera prêt (voir frontend/CLAUDE.md).
-->
<script>
  let appName = $state('Chantiers Essaouira')
</script>

<svelte:head>
  <title>{appName}</title>
</svelte:head>

<main>
  <h1>{appName}</h1>
  <p class="sous-titre">Ludimmo Travaux — Gestion de chantiers</p>

  <section class="placeholder">
    <h2>🚧 Application en construction</h2>
    <p>
      Le squelette du projet est en place. Prochaines étapes avec Claude Code :
    </p>
    <ol>
      <li>Implémenter le module Auth (<code>backend/src/routes/auth.js</code>)</li>
      <li>Construire la page Connexion + layout avec nav bottom</li>
      <li>Construire le tableau de bord (KPIs + alertes)</li>
      <li>Module Chantiers (liste + détail)</li>
      <li>Module Devis (le cœur — double colonne brut/client)</li>
      <li>Échéancier paiements 30/40/30</li>
      <li>Catalogue matériaux</li>
      <li>Comptabilité Yassine/Rachid</li>
      <li>Planning interventions</li>
      <li>PWA (manifest + service worker)</li>
    </ol>

    <p class="indice">
      Lance <code>claude</code> à la racine du projet pour reprendre le développement.
    </p>
  </section>
</main>

<style>
  :global(html) {
    font-family: system-ui, -apple-system, sans-serif;
    color: #1A1714;
    background: #FAFAF7;
  }
  :global(body) {
    margin: 0;
    min-height: 100vh;
  }
  main {
    max-width: 720px;
    margin: 0 auto;
    padding: 32px 20px;
  }
  h1 {
    font-size: 28px;
    margin: 0 0 4px;
    font-weight: 500;
  }
  .sous-titre {
    color: #6B6B6B;
    margin: 0 0 32px;
  }
  .placeholder {
    background: #FFFFFF;
    border: 1px solid #E8E5DD;
    border-radius: 10px;
    padding: 24px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }
  .placeholder h2 {
    margin-top: 0;
    font-size: 20px;
    font-weight: 500;
  }
  .placeholder ol {
    line-height: 1.8;
  }
  code {
    background: #F0EDE5;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.9em;
  }
  .indice {
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid #E8E5DD;
    color: #6B6B6B;
    font-size: 14px;
  }
</style>
