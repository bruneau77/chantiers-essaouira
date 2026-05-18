<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { auth, apiAuth } from '$lib/stores/auth.js';
	import { nomComplet } from '$lib/utils/nom.js';

	let chantier = $state(null);
	let chargement = $state(true);
	let erreur = $state('');

	const STATUTS = {
		prospect: { label: 'Prospect', couleur: '#8a8a8a' },
		en_attente: { label: 'En attente', couleur: '#c97b2b' },
		en_cours: { label: 'En cours', couleur: '#2d7a4f' },
		pause: { label: 'Pause', couleur: '#b03a2e' },
		termine: { label: 'Terminé', couleur: '#1e4d6b' },
		cloture: { label: 'Clôturé', couleur: '#5a5a5a' },
		annule: { label: 'Annulé', couleur: '#b03a2e' },
	};

	function formaterDate(dateStr) {
		if (!dateStr) return '—';
		const d = new Date(dateStr);
		return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
	}

	function formaterDh(centimes) {
		if (!centimes && centimes !== 0) return '—';
		const dh = Math.round(centimes / 100);
		return dh.toLocaleString('fr-FR').replace(/,/g, ' ') + ' DH';
	}

	onMount(async () => {
		const id = $page.params.id;
		try {
			const res = await apiAuth(`/api/chantiers/${id}`);
			if (!res.ok) {
				const payload = await res.json();
				erreur = payload.message || 'Chantier introuvable.';
				return;
			}
			const payload = await res.json();
			chantier = payload.data;
		} catch (e) {
			erreur = 'Impossible de contacter le serveur.';
		} finally {
			chargement = false;
		}
	});

	// Changement de statut rapide (admin seulement)
	let changementStatutEnCours = $state(false);

	async function changerStatut(nouveauStatut) {
		changementStatutEnCours = true;
		try {
			const res = await apiAuth(`/api/chantiers/${chantier.id}`, {
				method: 'PUT',
				body: JSON.stringify({ statut: nouveauStatut }),
			});
			if (res.ok) {
				const payload = await res.json();
				chantier = { ...chantier, ...payload.data };
			}
		} catch (e) {
			// silencieux
		} finally {
			changementStatutEnCours = false;
		}
	}
</script>

<svelte:head>
	<title>{chantier?.titre ?? 'Chantier'} — Ludimmo</title>
</svelte:head>

<div class="page">
	<!-- Retour -->
	<button class="bouton-retour" onclick={() => goto('/')}>
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M19 12H5M12 19l-7-7 7-7" />
		</svg>
		Chantiers
	</button>

	{#if chargement}
		<div class="etat-central">
			<div class="spinner"></div>
		</div>
	{:else if erreur}
		<div class="etat-central">
			<p class="erreur-message">{erreur}</p>
			<button class="bouton-secondaire" onclick={() => goto('/')}>Retour à la liste</button>
		</div>
	{:else if chantier}
		<!-- En-tête -->
		<header class="entete">
			<div class="entete-ligne">
				<span class="numero">{chantier.numero}</span>
				<span
					class="badge-statut"
					style:background={STATUTS[chantier.statut]?.couleur ?? '#8a8a8a'}
				>
					{STATUTS[chantier.statut]?.label ?? chantier.statut}
				</span>
			</div>
			<h1>{chantier.titre}</h1>
			<p class="adresse">{chantier.adresseChantier}</p>
		</header>

		{#if chantier.description}
			<p class="description">{chantier.description}</p>
		{/if}

		<!-- Actions rapides statut (admin) -->
		{#if $auth.utilisateur?.role === 'admin'}
			<div class="actions-statut">
				{#if chantier.statut === 'prospect'}
					<button class="bouton-action" onclick={() => changerStatut('en_attente')} disabled={changementStatutEnCours}>
						Passer en attente
					</button>
				{:else if chantier.statut === 'en_attente'}
					<button class="bouton-action" onclick={() => changerStatut('en_cours')} disabled={changementStatutEnCours}>
						Démarrer le chantier
					</button>
				{:else if chantier.statut === 'en_cours'}
					<button class="bouton-action" onclick={() => changerStatut('termine')} disabled={changementStatutEnCours}>
						Marquer terminé
					</button>
					<button class="bouton-action secondaire" onclick={() => changerStatut('pause')} disabled={changementStatutEnCours}>
						Mettre en pause
					</button>
				{:else if chantier.statut === 'pause'}
					<button class="bouton-action" onclick={() => changerStatut('en_cours')} disabled={changementStatutEnCours}>
						Reprendre
					</button>
				{:else if chantier.statut === 'termine'}
					<button class="bouton-action" onclick={() => changerStatut('cloture')} disabled={changementStatutEnCours}>
						Clôturer
					</button>
				{/if}
			</div>
		{/if}

		<!-- Infos -->
		<div class="section">
			<h2 class="section-titre">Intervenants</h2>
			<div class="carte-info">
				<div class="info-ligne">
					<span class="info-label">Client</span>
					<span class="info-valeur">{nomComplet(chantier.client)}</span>
				</div>
				{#if chantier.client?.telephone}
					<div class="info-ligne">
						<span class="info-label">Tél. client</span>
						<a href="tel:{chantier.client.telephone}" class="info-valeur lien">{chantier.client.telephone}</a>
					</div>
				{/if}
				<div class="info-ligne">
					<span class="info-label">Chef</span>
					<span class="info-valeur">{nomComplet(chantier.chef)}</span>
				</div>
				{#if chantier.sousTraitant}
					<div class="info-ligne">
						<span class="info-label">Sous-traitant</span>
						<span class="info-valeur">{nomComplet(chantier.sousTraitant)}</span>
					</div>
				{/if}
			</div>
		</div>

		<!-- Dates -->
		<div class="section">
			<h2 class="section-titre">Dates</h2>
			<div class="carte-info">
				<div class="info-ligne">
					<span class="info-label">Début prévu</span>
					<span class="info-valeur">{formaterDate(chantier.dateDebutPrevue)}</span>
				</div>
				<div class="info-ligne">
					<span class="info-label">Fin prévue</span>
					<span class="info-valeur">{formaterDate(chantier.dateFinPrevue)}</span>
				</div>
				{#if chantier.dateDebutReelle}
					<div class="info-ligne">
						<span class="info-label">Début réel</span>
						<span class="info-valeur">{formaterDate(chantier.dateDebutReelle)}</span>
					</div>
				{/if}
				{#if chantier.dateFinReelle}
					<div class="info-ligne">
						<span class="info-label">Fin réelle</span>
						<span class="info-valeur">{formaterDate(chantier.dateFinReelle)}</span>
					</div>
				{/if}
			</div>
		</div>

		<!-- Frais kilométriques -->
		{#if chantier.distanceAllerKm}
			<div class="section">
				<h2 class="section-titre">Frais kilométriques</h2>
				<div class="carte-info">
					<div class="info-ligne">
						<span class="info-label">Distance aller</span>
						<span class="info-valeur">{chantier.distanceAllerKm} km</span>
					</div>
					<div class="info-ligne">
						<span class="info-label">A/R prévus</span>
						<span class="info-valeur">{chantier.nombreAllerRetourPrevu ?? '—'}</span>
					</div>
					<div class="info-ligne total">
						<span class="info-label">Frais essence estimés</span>
						<span class="info-valeur">{formaterDh(chantier.fraisEssenceCentimes)}</span>
					</div>
				</div>
			</div>
		{/if}

		<!-- Compta (raccourci) -->
		<div class="section">
			<a href="/chantiers/{chantier.id}/compta" class="bouton-compta">
				<span>📊 Compta du chantier</span>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M9 18l6-6-6-6" />
				</svg>
			</a>
		</div>

		<!-- Devis (aperçu) -->
		<div class="section">
			<h2 class="section-titre">Devis</h2>
			{#if chantier.devis && chantier.devis.length > 0}
				<div class="liste-mini">
					{#each chantier.devis as devis}
						<div class="mini-carte">
							<div class="mini-entete">
								<span class="mini-numero">{devis.numero}</span>
								<span class="mini-statut">{devis.statut}</span>
							</div>
							<span class="mini-montant">{formaterDh(devis.totalClientCentimes)}</span>
						</div>
					{/each}
				</div>
			{:else}
				<p class="texte-vide">Aucun devis pour ce chantier.</p>
			{/if}
		</div>

		<!-- Paiements (aperçu) -->
		<div class="section">
			<h2 class="section-titre">Paiements</h2>
			{#if chantier.paiements && chantier.paiements.length > 0}
				<div class="liste-mini">
					{#each chantier.paiements as p}
						<div class="mini-carte">
							<div class="mini-entete">
								<span class="mini-numero">{p.type}</span>
								<span class="mini-statut" class:recu={p.statut === 'recu'}>{p.statut}</span>
							</div>
							<span class="mini-montant">{formaterDh(p.montantCentimes)}</span>
						</div>
					{/each}
				</div>
			{:else}
				<p class="texte-vide">Aucun paiement enregistré.</p>
			{/if}
		</div>

		<!-- Notes -->
		{#if chantier.notes}
			<div class="section">
				<h2 class="section-titre">Notes</h2>
				<div class="carte-info">
					<p class="notes-texte">{chantier.notes}</p>
				</div>
			</div>
		{/if}

		<!-- Photos (aperçu) -->
		{#if chantier.photos && chantier.photos.length > 0}
			<div class="section">
				<h2 class="section-titre">Photos récentes</h2>
				<div class="grille-photos">
					{#each chantier.photos as photo}
						<div class="photo-miniature">
							<img src="/uploads/{photo.cheminFichier}" alt={photo.titre ?? 'Photo chantier'} />
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
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

	.numero {
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
	.description {
		font-size: 15px;
		color: var(--couleur-texte-secondaire);
		line-height: 1.5;
		margin-bottom: var(--esp-lg);
	}

	/* Actions statut */
	.actions-statut {
		display: flex;
		gap: var(--esp-sm);
		margin-bottom: var(--esp-xl);
	}

	.bouton-action {
		flex: 1;
		padding: var(--esp-md);
		background: var(--couleur-primaire);
		color: white;
		font-weight: 600;
		font-size: 14px;
		border-radius: var(--rayon-md);
		min-height: var(--taille-tactile);
	}
	.bouton-action:active:not(:disabled) { opacity: 0.85; }
	.bouton-action.secondaire {
		background: transparent;
		color: var(--couleur-texte-secondaire);
		border: 1.5px solid var(--couleur-bordure-forte);
	}

	.bouton-compta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--esp-md);
		background: var(--couleur-fond-carte);
		border: 1px solid var(--couleur-bordure);
		border-left: 4px solid var(--couleur-primaire);
		border-radius: var(--rayon-md);
		color: var(--couleur-texte);
		text-decoration: none;
		font-size: 15px;
		font-weight: 600;
		min-height: var(--taille-tactile);
	}
	.bouton-compta:active { opacity: 0.85; }

	/* Sections */
	.section { margin-bottom: var(--esp-xl); }
	.section-titre {
		font-size: 15px;
		font-weight: 700;
		color: var(--couleur-texte);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin-bottom: var(--esp-md);
	}

	.carte-info {
		background: var(--couleur-fond-carte);
		border: 1px solid var(--couleur-bordure);
		border-radius: var(--rayon-lg);
		overflow: hidden;
	}

	.info-ligne {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--esp-md);
		border-bottom: 1px solid var(--couleur-bordure);
	}
	.info-ligne:last-child { border-bottom: none; }
	.info-ligne.total { background: var(--couleur-primaire-clair); }

	.info-label { font-size: 14px; color: var(--couleur-texte-secondaire); }
	.info-valeur { font-size: 14px; font-weight: 600; color: var(--couleur-texte); }
	.info-valeur.lien { color: var(--couleur-primaire); }

	.notes-texte {
		padding: var(--esp-md);
		font-size: 14px;
		color: var(--couleur-texte-secondaire);
		line-height: 1.6;
		white-space: pre-wrap;
	}

	/* Mini cartes devis/paiements */
	.liste-mini { display: flex; flex-direction: column; gap: var(--esp-sm); }
	.mini-carte {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: var(--couleur-fond-carte);
		border: 1px solid var(--couleur-bordure);
		border-radius: var(--rayon-md);
		padding: var(--esp-md);
	}
	.mini-entete { display: flex; flex-direction: column; gap: 2px; }
	.mini-numero { font-size: 13px; font-weight: 600; }
	.mini-statut { font-size: 12px; color: var(--couleur-texte-leger); text-transform: capitalize; }
	.mini-statut.recu { color: var(--couleur-succes); font-weight: 600; }
	.mini-montant { font-size: 15px; font-weight: 700; color: var(--couleur-texte); }

	.texte-vide {
		font-size: 14px;
		color: var(--couleur-texte-leger);
		padding: var(--esp-md);
		background: var(--couleur-fond-carte);
		border: 1px dashed var(--couleur-bordure-forte);
		border-radius: var(--rayon-md);
		text-align: center;
	}

	/* Photos */
	.grille-photos {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--esp-sm);
	}
	.photo-miniature {
		aspect-ratio: 1;
		border-radius: var(--rayon-md);
		overflow: hidden;
		background: var(--couleur-bordure);
	}
	.photo-miniature img { width: 100%; height: 100%; object-fit: cover; }

	/* États */
	.etat-central {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--esp-xxl);
	}
	.spinner {
		width: 32px; height: 32px;
		border: 3px solid var(--couleur-bordure);
		border-top-color: var(--couleur-primaire);
		border-radius: 50%;
		animation: rotation 0.8s linear infinite;
	}
	@keyframes rotation { to { transform: rotate(360deg); } }
	.erreur-message { color: var(--couleur-erreur); margin-bottom: var(--esp-md); text-align: center; }
</style>
