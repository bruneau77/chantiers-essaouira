<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth, apiAuth } from '$lib/stores/auth.js';
	import { nomComplet } from '$lib/utils/nom.js';

	let lieux = $state([]);
	let chargement = $state(true);
	let erreur = $state('');
	let filtreStatut = $state('');

	const STATUTS = {
		PROSPECT: { label: 'Prospect', couleur: '#8a8a8a' },
		EN_COURS: { label: 'En cours', couleur: '#2d7a4f' },
		TERMINE: { label: 'Terminé', couleur: '#1e4d6b' }
	};

	async function chargerLieux() {
		chargement = true;
		erreur = '';
		try {
			let url = '/api/lieux';
			if (filtreStatut) url += `?statut=${filtreStatut}`;

			const res = await apiAuth(url);
			if (!res.ok) {
				const payload = await res.json();
				erreur = payload.message || 'Erreur lors du chargement.';
				return;
			}
			const payload = await res.json();
			lieux = payload.data ?? [];
		} catch {
			erreur = 'Impossible de contacter le serveur.';
		} finally {
			chargement = false;
		}
	}

	onMount(chargerLieux);

	$effect(() => {
		const _f = filtreStatut;
		chargerLieux();
	});

	function formaterDate(dateStr) {
		if (!dateStr) return '—';
		const d = new Date(dateStr);
		return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
	}
</script>

<svelte:head>
	<title>Lieux — Ludimmo</title>
</svelte:head>

<div class="page">
	<header class="entete-page">
		<h1>Lieux</h1>
	</header>

	<div class="filtres">
		<button class="filtre" class:actif={filtreStatut === ''} onclick={() => (filtreStatut = '')}>Tous</button>
		<button class="filtre" class:actif={filtreStatut === 'EN_COURS'} onclick={() => (filtreStatut = 'EN_COURS')}>En cours</button>
		<button class="filtre" class:actif={filtreStatut === 'PROSPECT'} onclick={() => (filtreStatut = 'PROSPECT')}>Prospects</button>
		<button class="filtre" class:actif={filtreStatut === 'TERMINE'} onclick={() => (filtreStatut = 'TERMINE')}>Terminés</button>
	</div>

	{#if chargement}
		<div class="etat-central"><div class="spinner"></div></div>
	{:else if erreur}
		<div class="etat-central">
			<p class="erreur-message">{erreur}</p>
			<button class="bouton-secondaire bouton-retry" onclick={chargerLieux}>Réessayer</button>
		</div>
	{:else if lieux.length === 0}
		<div class="message-vide">
			<p>Aucun lieu{filtreStatut ? ' avec ce statut' : ''}.</p>
			{#if $auth.utilisateur?.role === 'admin'}
				<p class="indication">Appuyez sur + pour créer votre premier lieu.</p>
			{:else}
				<p class="indication">Les lieux s'afficheront ici quand ils vous seront assignés.</p>
			{/if}
		</div>
	{:else}
		<div class="liste-lieux">
			{#each lieux as lieu (lieu.id)}
				<button class="carte-lieu" onclick={() => goto(`/lieux/${lieu.id}`)}>
					<div class="carte-entete">
						<span class="reference">{lieu.reference}</span>
						<span
							class="badge-statut"
							style:background={STATUTS[lieu.statut]?.couleur ?? '#8a8a8a'}
						>
							{STATUTS[lieu.statut]?.label ?? lieu.statut}
						</span>
					</div>
					<h2 class="titre">{lieu.nom}</h2>
					<p class="adresse">{lieu.adresse}</p>
					<div class="carte-pied">
						<span class="client">{nomComplet(lieu.client)}</span>
						<span class="date">{formaterDate(lieu.creeLe)}</span>
					</div>
					{#if lieu._count?.postes !== undefined}
						<div class="compteurs">
							<span class="compteur">{lieu._count.postes} poste{lieu._count.postes > 1 ? 's' : ''}</span>
						</div>
					{/if}
				</button>
			{/each}
		</div>
	{/if}

	{#if $auth.utilisateur?.role === 'admin'}
		<button class="fab" onclick={() => goto('/lieux/nouveau')} aria-label="Nouveau lieu">
			<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
				<path d="M12 5v14M5 12h14" />
			</svg>
		</button>
	{/if}
</div>

<style>
	.page { padding: var(--esp-lg); }

	.entete-page { margin-bottom: var(--esp-lg); }
	h1 { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; }

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
	}
	.filtre.actif {
		background: var(--couleur-primaire);
		color: white;
		border-color: var(--couleur-primaire);
	}

	.liste-lieux {
		display: flex;
		flex-direction: column;
		gap: var(--esp-md);
	}

	.carte-lieu {
		display: block;
		width: 100%;
		text-align: left;
		background: var(--couleur-fond-carte);
		border: 1px solid var(--couleur-bordure);
		border-radius: var(--rayon-lg);
		padding: var(--esp-md);
		box-shadow: var(--ombre-sm);
	}
	.carte-lieu:active { box-shadow: var(--ombre-md); }

	.carte-entete {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--esp-sm);
	}

	.reference {
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

	.bouton-secondaire { width: auto; padding: 0 var(--esp-lg); }

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
	}
	.fab:active { transform: scale(0.92); }
</style>
