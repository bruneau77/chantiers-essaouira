<script>
	import { goto } from '$app/navigation';
</script>

<svelte:head>
	<title>Compta générale — Ludimmo</title>
</svelte:head>

<div class="page">
	<button class="bouton-retour" onclick={() => goto('/compta')}>
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M19 12H5M12 19l-7-7 7-7" />
		</svg>
		Compta
	</button>

	<header class="entete">
		<h1>Compta générale</h1>
		<p class="sous-titre">Analytique — CA, dépenses par catégorie, marge brute</p>
	</header>

	<div class="placeholder">
		<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
			<circle cx="12" cy="12" r="10" />
			<polyline points="12 6 12 12 16 14" />
		</svg>
		<p>À venir prochainement.</p>
		<p class="sous-texte">
			Cette page affichera le CA encaissé par mois/année, les dépenses globales
			ventilées par catégorie, et la marge brute consolidée.
		</p>
	</div>
</div>

<style>
	.page {
		padding: var(--esp-lg);
		padding-bottom: calc(var(--hauteur-nav) + var(--safe-bas) + var(--esp-xxl));
	}

	.bouton-retour {
		display: inline-flex;
		align-items: center;
		gap: var(--esp-xs);
		font-size: 14px;
		color: var(--couleur-primaire);
		font-weight: 500;
		margin-bottom: var(--esp-lg);
	}

	.entete { margin-bottom: var(--esp-xl); }
	h1 { font-size: 24px; font-weight: 700; }
	.sous-titre { font-size: 14px; color: var(--couleur-texte-secondaire); margin-top: var(--esp-xs); }

	.placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--esp-md);
		padding: var(--esp-xxl) var(--esp-lg);
		background: var(--couleur-fond-carte);
		border: 1px dashed var(--couleur-bordure-forte);
		border-radius: var(--rayon-lg);
		color: var(--couleur-texte-secondaire);
		text-align: center;
	}
	.placeholder p { font-size: 16px; font-weight: 600; }
	.placeholder .sous-texte { font-size: 13px; font-weight: 400; line-height: 1.5; }
</style>
