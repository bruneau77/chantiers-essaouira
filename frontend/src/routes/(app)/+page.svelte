<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth, apiAuth } from '$lib/stores/auth.js';
	import { nomComplet } from '$lib/utils/nom.js';

	let chantiers = $state([]);
	let chargement = $state(true);
	let erreur = $state('');
	let filtreStatut = $state('');

	const STATUTS = {
		prospect: { label: 'Prospect', couleur: '#8a8a8a' },
		en_attente: { label: 'En attente', couleur: '#c97b2b' },
		en_cours: { label: 'En cours', couleur: '#2d7a4f' },
		pause: { label: 'Pause', couleur: '#b03a2e' },
		termine: { label: 'Terminé', couleur: '#1e4d6b' },
		cloture: { label: 'Clôturé', couleur: '#5a5a5a' },
		annule: { label: 'Annulé', couleur: '#b03a2e' },
	};

	async function chargerChantiers() {
		chargement = true;
		erreur = '';
		try {
			let url = '/api/chantiers';
			if (filtreStatut) url += `?statut=${filtreStatut}`;

			const res = await apiAuth(url);
			if (!res.ok) {
				const payload = await res.json();
				erreur = payload.message || 'Erreur lors du chargement.';
				return;
			}
			const payload = await res.json();
			chantiers = payload.data ?? [];
		} catch (e) {
			erreur = 'Impossible de contacter le serveur.';
		} finally {
			chargement = false;
		}
	}

	onMount(() => {
		chargerChantiers();
	});

	// Recharger quand le filtre change
	$effect(() => {
		// On lit filtreStatut pour créer la dépendance réactive
		const _f = filtreStatut;
		chargerChantiers();
	});

	function formaterDate(dateStr) {
		if (!dateStr) return '—';
		const d = new Date(dateStr);
		return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
	}
</script>

<svelte:head>
	<title>Chantiers — Ludimmo</title>
</svelte:head>

<div class="page">
	<header class="entete-page">
		<p class="bonjour">Bonjour, {$auth.utilisateur?.prenom || ''}</p>
		<h1>Chantiers</h1>
	</header>

	<!-- Filtres -->
	<div class="filtres">
		<button
			class="filtre"
			class:actif={filtreStatut === ''}
			onclick={() => filtreStatut = ''}
		>Tous</button>
		<button
			class="filtre"
			class:actif={filtreStatut === 'en_cours'}
			onclick={() => filtreStatut = 'en_cours'}
		>En cours</button>
		<button
			class="filtre"
			class:actif={filtreStatut === 'prospect'}
			onclick={() => filtreStatut = 'prospect'}
		>Prospects</button>
		<button
			class="filtre"
			class:actif={filtreStatut === 'termine'}
			onclick={() => filtreStatut = 'termine'}
		>Terminés</button>
	</div>

	<!-- Contenu -->
	{#if chargement}
		<div class="etat-central">
			<div class="spinner"></div>
		</div>
	{:else if erreur}
		<div class="etat-central">
			<p class="erreur-message">{erreur}</p>
			<button class="bouton-secondaire bouton-retry" onclick={chargerChantiers}>
				Réessayer
			</button>
		</div>
	{:else if chantiers.length === 0}
		<div class="message-vide">
			<p>Aucun chantier{filtreStatut ? ' avec ce statut' : ''}.</p>
			{#if $auth.utilisateur?.role === 'admin'}
				<p class="indication">Appuyez sur + pour créer votre premier chantier.</p>
			{:else}
				<p class="indication">Les chantiers s'afficheront ici quand ils vous seront assignés.</p>
			{/if}
		</div>
	{:else}
		<div class="liste-chantiers">
			{#each chantiers as chantier (chantier.id)}
				<button
					class="carte-chantier"
					onclick={() => goto(`/chantiers/${chantier.id}`)}
				>
					<div class="carte-entete">
						<span class="numero">{chantier.numero}</span>
						<span
							class="badge-statut"
							style:background={STATUTS[chantier.statut]?.couleur ?? '#8a8a8a'}
						>
							{STATUTS[chantier.statut]?.label ?? chantier.statut}
						</span>
					</div>
					<h2 class="titre">{chantier.titre}</h2>
					<p class="adresse">{chantier.adresseChantier}</p>
					<div class="carte-pied">
						<span class="client">
							{nomComplet(chantier.client)}
						</span>
						<span class="date">{formaterDate(chantier.creeLe)}</span>
					</div>
					{#if chantier._count}
						<div class="compteurs">
							{#if chantier._count.devis > 0}
								<span class="compteur">{chantier._count.devis} devis</span>
							{/if}
							{#if chantier._count.photos > 0}
								<span class="compteur">{chantier._count.photos} photos</span>
							{/if}
						</div>
					{/if}
				</button>
			{/each}
		</div>
	{/if}

	<!-- Bouton FAB pour créer (admin seulement) -->
	{#if $auth.utilisateur?.role === 'admin'}
		<button
			class="fab"
			onclick={() => goto('/chantiers/nouveau')}
			aria-label="Nouveau chantier"
		>
			<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
				<path d="M12 5v14M5 12h14" />
			</svg>
		</button>
	{/if}
</div>

<style>
	.page { padding: var(--esp-lg); }

	.entete-page { margin-bottom: var(--esp-lg); }
	.bonjour { font-size: 14px; color: var(--couleur-texte-secondaire); margin-bottom: var(--esp-xs); }
	h1 { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; }

	/* Filtres horizontaux */
	.filtres {
		display: flex;
		gap: var(--esp-sm);
		margin-bottom: var(--esp-lg);
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
	}
	.filtres::-webkit-scrollbar { display: none; }

	.filtre {
		flex-shrink: 0;
		padding: var(--esp-sm) var(--esp-md);
		border-radius: 20px;
		font-size: 14px;
		font-weight: 500;
		background: var(--couleur-fond-carte);
		border: 1px solid var(--couleur-bordure);
		color: var(--couleur-texte-secondaire);
		transition: all 0.15s;
	}
	.filtre.actif {
		background: var(--couleur-primaire);
		color: white;
		border-color: var(--couleur-primaire);
	}

	/* Liste des cartes */
	.liste-chantiers {
		display: flex;
		flex-direction: column;
		gap: var(--esp-md);
	}

	.carte-chantier {
		display: block;
		width: 100%;
		text-align: left;
		background: var(--couleur-fond-carte);
		border: 1px solid var(--couleur-bordure);
		border-radius: var(--rayon-lg);
		padding: var(--esp-md);
		box-shadow: var(--ombre-sm);
		transition: box-shadow 0.15s;
	}
	.carte-chantier:active {
		box-shadow: var(--ombre-md);
	}

	.carte-entete {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--esp-sm);
	}

	.numero {
		font-size: 12px;
		font-weight: 600;
		color: var(--couleur-texte-leger);
		letter-spacing: 0.04em;
	}

	.badge-statut {
		font-size: 11px;
		font-weight: 600;
		color: white;
		padding: 2px 10px;
		border-radius: 12px;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.titre {
		font-size: 17px;
		font-weight: 600;
		color: var(--couleur-texte);
		margin-bottom: var(--esp-xs);
	}

	.adresse {
		font-size: 14px;
		color: var(--couleur-texte-secondaire);
		margin-bottom: var(--esp-md);
	}

	.carte-pied {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 13px;
		color: var(--couleur-texte-leger);
	}

	.client { font-weight: 500; }

	.compteurs {
		display: flex;
		gap: var(--esp-sm);
		margin-top: var(--esp-sm);
	}
	.compteur {
		font-size: 12px;
		color: var(--couleur-primaire);
		background: var(--couleur-primaire-clair);
		padding: 2px 8px;
		border-radius: 8px;
		font-weight: 500;
	}

	/* États centraux */
	.etat-central {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--esp-xxl) var(--esp-lg);
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--couleur-bordure);
		border-top-color: var(--couleur-primaire);
		border-radius: 50%;
		animation: rotation 0.8s linear infinite;
	}
	@keyframes rotation { to { transform: rotate(360deg); } }

	.erreur-message {
		color: var(--couleur-erreur);
		font-size: 15px;
		text-align: center;
		margin-bottom: var(--esp-md);
	}

	.bouton-retry { width: auto; padding: 0 var(--esp-lg); }

	.message-vide {
		background: var(--couleur-fond-carte);
		border: 1px dashed var(--couleur-bordure-forte);
		border-radius: var(--rayon-lg);
		padding: var(--esp-xxl) var(--esp-lg);
		text-align: center;
	}
	.message-vide p {
		font-size: 16px;
		font-weight: 500;
		color: var(--couleur-texte-secondaire);
	}
	.indication {
		font-size: 13px !important;
		font-weight: 400 !important;
		color: var(--couleur-texte-leger) !important;
		margin-top: var(--esp-sm);
	}

	/* Bouton flottant + */
	.fab {
		position: fixed;
		bottom: calc(var(--hauteur-nav) + var(--safe-bas) + var(--esp-lg));
		right: var(--esp-lg);
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: var(--couleur-primaire);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: var(--ombre-lg);
		z-index: 10;
		transition: transform 0.15s;
	}
	.fab:active {
		transform: scale(0.92);
	}
</style>
