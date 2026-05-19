<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { auth, apiAuth } from '$lib/stores/auth.js';
	import { nomComplet } from '$lib/utils/nom.js';
	import NouveauPosteModale from '$lib/components/NouveauPosteModale.svelte';

	let lieu = $state(null);
	let chargement = $state(true);
	let erreur = $state('');
	let modalePoste = $state(false);

	const STATUTS_LIEU = {
		PROSPECT: { label: 'Prospect', couleur: '#8a8a8a' },
		EN_COURS: { label: 'En cours', couleur: '#2d7a4f' },
		TERMINE: { label: 'Terminé', couleur: '#1e4d6b' }
	};

	const STATUTS_POSTE = {
		A_FAIRE: { label: 'À faire', couleur: '#8a8a8a' },
		EN_COURS: { label: 'En cours', couleur: '#2d7a4f' },
		TERMINE: { label: 'Terminé', couleur: '#1e4d6b' }
	};

	const estAdmin = $derived($auth.utilisateur?.role === 'admin');
	const id = $derived(parseInt($page.params.id, 10));

	function formaterDh(centimes) {
		if (centimes === null || centimes === undefined) return '—';
		const dh = Math.round(centimes / 100);
		return dh.toLocaleString('fr-FR').replace(/,/g, ' ') + ' DH';
	}

	function totalPayeCentimes(poste) {
		if (!poste?.paiements) return 0;
		return poste.paiements.reduce((s, p) => s + p.montantCentimes, 0);
	}

	async function chargerLieu() {
		chargement = true;
		erreur = '';
		try {
			const res = await apiAuth(`/api/lieux/${id}`);
			if (!res.ok) {
				const payload = await res.json();
				erreur = payload.message || 'Lieu introuvable.';
				return;
			}
			const payload = await res.json();
			lieu = payload.data;
		} catch {
			erreur = 'Impossible de contacter le serveur.';
		} finally {
			chargement = false;
		}
	}

	onMount(chargerLieu);

	function onPosteCree() {
		modalePoste = false;
		chargerLieu();
	}
</script>

<svelte:head>
	<title>{lieu?.nom ?? 'Lieu'} — Ludimmo</title>
</svelte:head>

<div class="page">
	<button class="bouton-retour" onclick={() => goto('/lieux')}>
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M19 12H5M12 19l-7-7 7-7" />
		</svg>
		Lieux
	</button>

	{#if chargement}
		<div class="etat-central"><div class="spinner"></div></div>
	{:else if erreur}
		<div class="etat-central">
			<p class="erreur-message">{erreur}</p>
			<button class="bouton-secondaire" onclick={() => goto('/lieux')}>Retour à la liste</button>
		</div>
	{:else if lieu}
		<header class="entete">
			<div class="entete-ligne">
				<span class="reference">{lieu.reference}</span>
				<span class="badge-statut" style:background={STATUTS_LIEU[lieu.statut]?.couleur ?? '#8a8a8a'}>
					{STATUTS_LIEU[lieu.statut]?.label ?? lieu.statut}
				</span>
			</div>
			<h1>{lieu.nom}</h1>
			<p class="adresse">{lieu.adresse}</p>
		</header>

		<!-- Intervenants -->
		<div class="section">
			<h2 class="section-titre">Intervenants</h2>
			<div class="carte-info">
				<div class="info-ligne">
					<span class="info-label">Client</span>
					<span class="info-valeur">{nomComplet(lieu.client)}</span>
				</div>
				{#if lieu.client?.telephone}
					<div class="info-ligne">
						<span class="info-label">Tél. client</span>
						<a href="tel:{lieu.client.telephone}" class="info-valeur lien">{lieu.client.telephone}</a>
					</div>
				{/if}
				<div class="info-ligne">
					<span class="info-label">Chef</span>
					<span class="info-valeur">{lieu.chef ? nomComplet(lieu.chef) : '—'}</span>
				</div>
				{#if lieu.chef?.telephone}
					<div class="info-ligne">
						<span class="info-label">Tél. chef</span>
						<a href="tel:{lieu.chef.telephone}" class="info-valeur lien">{lieu.chef.telephone}</a>
					</div>
				{/if}
			</div>
		</div>

		<!-- Frais kilométriques -->
		{#if lieu.distanceAllerKm}
			<div class="section">
				<h2 class="section-titre">Frais kilométriques</h2>
				<div class="carte-info">
					<div class="info-ligne">
						<span class="info-label">Distance aller</span>
						<span class="info-valeur">{lieu.distanceAllerKm} km</span>
					</div>
					<div class="info-ligne">
						<span class="info-label">A/R prévus</span>
						<span class="info-valeur">{lieu.nombreAllerRetourPrevu ?? '—'}</span>
					</div>
					{#if estAdmin}
						<div class="info-ligne total">
							<span class="info-label">Frais essence estimés</span>
							<span class="info-valeur">{formaterDh(lieu.fraisEssenceCentimes)}</span>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Budget estimatif (admin) -->
		{#if estAdmin && lieu.budgetEstimatifCentimes}
			<div class="section">
				<h2 class="section-titre">Budget estimatif</h2>
				<div class="carte-info">
					<div class="info-ligne">
						<span class="info-label">Montant</span>
						<span class="info-valeur">{formaterDh(lieu.budgetEstimatifCentimes)}</span>
					</div>
				</div>
			</div>
		{/if}

		<!-- Lien Compta -->
		<div class="section">
			<a href="/lieux/{lieu.id}/compta" class="bouton-compta">
				<span>📊 Compta du lieu</span>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M9 18l6-6-6-6" />
				</svg>
			</a>
		</div>

		<!-- Postes -->
		<div class="section">
			<div class="section-entete">
				<h2 class="section-titre">Postes</h2>
				{#if estAdmin}
					<button class="bouton-ajout" onclick={() => (modalePoste = true)}>+ Nouveau poste</button>
				{/if}
			</div>

			{#if !lieu.postes || lieu.postes.length === 0}
				<p class="texte-vide">Aucun poste pour ce lieu.</p>
			{:else}
				<div class="liste-postes">
					{#each lieu.postes as poste (poste.id)}
						<button
							class="carte-poste"
							onclick={() => goto(`/lieux/${lieu.id}/postes/${poste.id}`)}
						>
							<div class="poste-entete">
								<span class="poste-titre">{poste.titre}</span>
								<span
									class="badge-poste"
									style:background={STATUTS_POSTE[poste.statut]?.couleur ?? '#8a8a8a'}
								>
									{STATUTS_POSTE[poste.statut]?.label ?? poste.statut}
								</span>
							</div>
							{#if estAdmin && poste.montantClientCentimes !== undefined}
								<div class="poste-montants">
									<span class="montant-client">{formaterDh(poste.montantClientCentimes)}</span>
									<span class="paye">payé {formaterDh(totalPayeCentimes(poste))}</span>
								</div>
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		{#if lieu.notes}
			<div class="section">
				<h2 class="section-titre">Notes</h2>
				<div class="carte-info">
					<p class="notes-texte">{lieu.notes}</p>
				</div>
			</div>
		{/if}
	{/if}

	<NouveauPosteModale
		ouverte={modalePoste}
		lieuId={id}
		onCree={onPosteCree}
		onFermer={() => (modalePoste = false)}
	/>
</div>

<style>
	.page { padding: var(--esp-lg); padding-bottom: calc(var(--hauteur-nav) + var(--safe-bas) + var(--esp-xxl)); }

	.bouton-retour {
		display: inline-flex;
		align-items: center;
		gap: var(--esp-xs);
		font-size: 14px;
		color: var(--couleur-primaire);
		font-weight: 500;
		margin-bottom: var(--esp-lg);
	}

	.entete { margin-bottom: var(--esp-lg); }
	.entete-ligne {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--esp-sm);
	}
	.reference {
		font-size: 13px;
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
	}

	h1 { font-size: 24px; font-weight: 700; margin-bottom: var(--esp-xs); }
	.adresse { font-size: 15px; color: var(--couleur-texte-secondaire); }

	.section { margin-bottom: var(--esp-lg); }
	.section-entete {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--esp-sm);
	}
	.section-titre {
		font-size: 14px;
		font-weight: 700;
		color: var(--couleur-texte-secondaire);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.bouton-ajout {
		font-size: 13px;
		font-weight: 600;
		color: var(--couleur-primaire);
		padding: var(--esp-xs) var(--esp-sm);
	}

	.carte-info {
		background: var(--couleur-fond-carte);
		border: 1px solid var(--couleur-bordure);
		border-radius: var(--rayon-md);
		padding: var(--esp-md);
	}

	.info-ligne {
		display: flex;
		justify-content: space-between;
		padding: var(--esp-xs) 0;
		gap: var(--esp-md);
	}
	.info-ligne.total {
		padding-top: var(--esp-sm);
		margin-top: var(--esp-xs);
		border-top: 1px solid var(--couleur-bordure);
		font-weight: 600;
	}
	.info-label {
		font-size: 14px;
		color: var(--couleur-texte-secondaire);
	}
	.info-valeur {
		font-size: 14px;
		color: var(--couleur-texte);
		text-align: right;
		font-weight: 500;
	}
	.lien {
		color: var(--couleur-primaire);
		text-decoration: none;
	}

	.notes-texte {
		font-size: 14px;
		color: var(--couleur-texte);
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.bouton-compta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--esp-md);
		background: var(--couleur-fond-carte);
		border: 1px solid var(--couleur-bordure);
		border-radius: var(--rayon-md);
		color: var(--couleur-texte);
		font-weight: 600;
		text-decoration: none;
	}

	.liste-postes {
		display: flex;
		flex-direction: column;
		gap: var(--esp-sm);
	}

	.carte-poste {
		display: block;
		width: 100%;
		text-align: left;
		background: var(--couleur-fond-carte);
		border: 1px solid var(--couleur-bordure);
		border-radius: var(--rayon-md);
		padding: var(--esp-md);
	}

	.poste-entete {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--esp-sm);
	}

	.poste-titre {
		font-size: 15px;
		font-weight: 600;
		color: var(--couleur-texte);
		flex: 1;
	}

	.badge-poste {
		font-size: 10px;
		font-weight: 700;
		color: white;
		padding: 2px 8px;
		border-radius: 10px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.poste-montants {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-top: var(--esp-sm);
		padding-top: var(--esp-sm);
		border-top: 1px dashed var(--couleur-bordure);
		font-size: 13px;
	}

	.montant-client {
		font-weight: 700;
		color: var(--couleur-texte);
	}

	.paye {
		color: var(--couleur-texte-leger);
	}

	.texte-vide {
		font-size: 14px;
		color: var(--couleur-texte-leger);
		font-style: italic;
		padding: var(--esp-md);
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

	.bouton-secondaire {
		padding: var(--esp-md) var(--esp-lg);
		background: transparent;
		color: var(--couleur-primaire);
		border: 1.5px solid var(--couleur-primaire);
		border-radius: var(--rayon-md);
		font-weight: 600;
	}
</style>
