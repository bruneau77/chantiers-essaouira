<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth, apiAuth } from '$lib/stores/auth.js';
	import { nomComplet } from '$lib/utils/nom.js';

	// Refonte 2026-05-18 : homepage role-adaptive.
	//   - admin : liste des Postes EN_COURS tous Lieux confondus
	//             (vision « qu'est-ce qui bouge en ce moment »)
	//   - chef  : liste de SES Lieux (filtre serveur via /api/lieux)

	let chargement = $state(true);
	let erreur = $state('');
	let postesEnCours = $state([]);
	let mesLieux = $state([]);

	const STATUTS_LIEU = {
		PROSPECT: { label: 'Prospect', couleur: '#8a8a8a' },
		EN_COURS: { label: 'En cours', couleur: '#2d7a4f' },
		TERMINE: { label: 'Terminé', couleur: '#1e4d6b' }
	};

	function formaterDh(centimes) {
		if (centimes === null || centimes === undefined) return '—';
		const dh = Math.round(centimes / 100);
		return dh.toLocaleString('fr-FR').replace(/,/g, ' ') + ' DH';
	}

	function totalPaye(poste) {
		if (!poste.paiements) return 0;
		return poste.paiements.reduce((s, p) => s + p.montantCentimes, 0);
	}

	async function chargerPourAdmin() {
		try {
			const res = await apiAuth('/api/postes?statut=EN_COURS');
			if (!res.ok) {
				const p = await res.json();
				erreur = p.message || 'Erreur de chargement.';
				return;
			}
			const payload = await res.json();
			postesEnCours = payload.data ?? [];
		} catch {
			erreur = 'Impossible de contacter le serveur.';
		} finally {
			chargement = false;
		}
	}

	async function chargerPourChef() {
		try {
			const res = await apiAuth('/api/lieux');
			if (!res.ok) {
				const p = await res.json();
				erreur = p.message || 'Erreur de chargement.';
				return;
			}
			const payload = await res.json();
			mesLieux = payload.data ?? [];
		} catch {
			erreur = 'Impossible de contacter le serveur.';
		} finally {
			chargement = false;
		}
	}

	onMount(() => {
		if ($auth.utilisateur?.role === 'admin') {
			chargerPourAdmin();
		} else {
			chargerPourChef();
		}
	});
</script>

<svelte:head>
	<title>Accueil — Ludimmo</title>
</svelte:head>

<div class="page">
	<header class="entete-page">
		<p class="bonjour">Bonjour, {$auth.utilisateur?.prenom || ''}</p>
		{#if $auth.utilisateur?.role === 'admin'}
			<h1>Postes en cours</h1>
			<p class="sous-titre">Ce qui bouge en ce moment sur tous les lieux.</p>
		{:else}
			<h1>Mes lieux</h1>
		{/if}
	</header>

	{#if chargement}
		<div class="etat-central">
			<div class="spinner"></div>
		</div>
	{:else if erreur}
		<div class="etat-central">
			<p class="erreur-message">{erreur}</p>
		</div>
	{:else if $auth.utilisateur?.role === 'admin'}
		<!-- VUE ADMIN — Postes EN_COURS -->
		{#if postesEnCours.length === 0}
			<div class="message-vide">
				<p>Aucun poste en cours.</p>
				<p class="indication">Tous vos postes sont soit à faire, soit terminés.</p>
			</div>
		{:else}
			<div class="liste-cartes">
				{#each postesEnCours as poste (poste.id)}
					<button
						class="carte"
						onclick={() => goto(`/lieux/${poste.lieu.id}/postes/${poste.id}`)}
					>
						<div class="carte-meta">
							<span class="ref-lieu">{poste.lieu.reference}</span>
							<span class="nom-lieu">{poste.lieu.nom}</span>
						</div>
						<h2 class="titre-poste">{poste.titre}</h2>
						{#if poste.montantClientCentimes !== undefined}
							<div class="ligne-montant">
								<span class="label-montant">Montant client</span>
								<span class="valeur-montant">{formaterDh(poste.montantClientCentimes)}</span>
							</div>
						{/if}
					</button>
				{/each}
			</div>
		{/if}

		<div class="actions-globales">
			<a href="/lieux" class="bouton-secondaire">Tous les lieux</a>
		</div>
	{:else}
		<!-- VUE CHEF — Mes Lieux -->
		{#if mesLieux.length === 0}
			<div class="message-vide">
				<p>Aucun lieu ne vous est assigné pour le moment.</p>
			</div>
		{:else}
			<div class="liste-cartes">
				{#each mesLieux as lieu (lieu.id)}
					<button class="carte" onclick={() => goto(`/lieux/${lieu.id}`)}>
						<div class="carte-entete">
							<span class="ref-lieu">{lieu.reference}</span>
							<span
								class="badge-statut"
								style:background={STATUTS_LIEU[lieu.statut]?.couleur ?? '#8a8a8a'}
							>
								{STATUTS_LIEU[lieu.statut]?.label ?? lieu.statut}
							</span>
						</div>
						<h2 class="titre-lieu">{lieu.nom}</h2>
						<p class="adresse">{lieu.adresse}</p>
						{#if lieu.client}
							<p class="client">{nomComplet(lieu.client)}</p>
						{/if}
						{#if lieu._count?.postes}
							<p class="compteur">{lieu._count.postes} poste{lieu._count.postes > 1 ? 's' : ''}</p>
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.page { padding: var(--esp-lg); }

	.entete-page { margin-bottom: var(--esp-lg); }
	.bonjour { font-size: 14px; color: var(--couleur-texte-secondaire); margin-bottom: var(--esp-xs); }
	h1 { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; }
	.sous-titre { font-size: 13px; color: var(--couleur-texte-leger); margin-top: var(--esp-xs); }

	.liste-cartes {
		display: flex;
		flex-direction: column;
		gap: var(--esp-md);
	}

	.carte {
		display: block;
		width: 100%;
		text-align: left;
		background: var(--couleur-fond-carte);
		border: 1px solid var(--couleur-bordure);
		border-radius: var(--rayon-lg);
		padding: var(--esp-md);
		box-shadow: var(--ombre-sm);
	}
	.carte:active { box-shadow: var(--ombre-md); }

	.carte-meta {
		display: flex;
		gap: var(--esp-sm);
		align-items: baseline;
		margin-bottom: var(--esp-sm);
	}

	.ref-lieu {
		font-size: 12px;
		font-weight: 600;
		color: var(--couleur-texte-leger);
		letter-spacing: 0.04em;
	}

	.nom-lieu {
		font-size: 13px;
		color: var(--couleur-texte-secondaire);
		font-weight: 500;
	}

	.titre-poste {
		font-size: 17px;
		font-weight: 600;
		color: var(--couleur-texte);
		margin-bottom: var(--esp-sm);
	}

	.titre-lieu {
		font-size: 17px;
		font-weight: 600;
		color: var(--couleur-texte);
		margin-bottom: var(--esp-xs);
	}

	.carte-entete {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--esp-sm);
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

	.adresse {
		font-size: 14px;
		color: var(--couleur-texte-secondaire);
		margin-bottom: var(--esp-sm);
	}

	.client {
		font-size: 13px;
		color: var(--couleur-texte-leger);
		font-weight: 500;
	}

	.compteur {
		font-size: 12px;
		color: var(--couleur-primaire);
		background: var(--couleur-primaire-clair);
		padding: 2px 8px;
		border-radius: 8px;
		font-weight: 500;
		display: inline-block;
		margin-top: var(--esp-sm);
	}

	.ligne-montant {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		padding-top: var(--esp-sm);
		border-top: 1px dashed var(--couleur-bordure);
	}

	.label-montant {
		font-size: 12px;
		color: var(--couleur-texte-leger);
	}

	.valeur-montant {
		font-size: 16px;
		font-weight: 700;
		color: var(--couleur-texte);
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
	}

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

	.actions-globales {
		margin-top: var(--esp-lg);
		display: flex;
		justify-content: center;
	}

	.bouton-secondaire {
		display: inline-block;
		padding: var(--esp-md) var(--esp-lg);
		background: var(--couleur-fond-carte);
		border: 1.5px solid var(--couleur-bordure-forte);
		color: var(--couleur-primaire);
		border-radius: var(--rayon-md);
		font-weight: 600;
		font-size: 14px;
		text-decoration: none;
	}
</style>
