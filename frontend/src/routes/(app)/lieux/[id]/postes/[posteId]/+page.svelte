<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { auth, apiAuth } from '$lib/stores/auth.js';
	import AjoutDepenseForm from '$lib/components/AjoutDepenseForm.svelte';

	const lieuId = $derived(parseInt($page.params.id, 10));
	const posteId = $derived(parseInt($page.params.posteId, 10));

	const estAdmin = $derived($auth.utilisateur?.role === 'admin');

	const STATUTS = {
		A_FAIRE: { label: 'À faire', couleur: '#8a8a8a' },
		EN_COURS: { label: 'En cours', couleur: '#2d7a4f' },
		TERMINE: { label: 'Terminé', couleur: '#1e4d6b' }
	};

	// Transitions autorisées pour le chef (identique à backend/postesHelpers).
	// Si le rôle est admin, toutes les transitions sont libres.
	const TRANSITIONS_CHEF = {
		A_FAIRE: ['EN_COURS'],
		EN_COURS: ['TERMINE'],
		TERMINE: ['EN_COURS']
	};

	let poste = $state(null);
	let depensesAffectees = $state([]);
	let budgetsAffectes = $state([]);
	let chargement = $state(true);
	let erreur = $state('');

	let modeAjoutPaiement = $state(false);
	let modeAjoutDepense = $state(false);

	// Form paiement (admin uniquement)
	let datePaiement = $state(new Date().toISOString().slice(0, 10));
	let montantPaiementDh = $state('');
	let modePaiement = $state('VIREMENT');
	let descriptionPaiement = $state('');
	let envoiPaiementEnCours = $state(false);
	let erreurPaiement = $state('');

	// État transition statut
	let transitionEnCours = $state(false);
	let erreurTransition = $state('');

	function formaterDh(c) {
		if (c === null || c === undefined) return '—';
		const dh = Math.round(c / 100);
		return dh.toLocaleString('fr-FR').replace(/,/g, ' ') + ' DH';
	}

	function formaterDate(s) {
		if (!s) return '—';
		return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
	}

	function transitionAutorisee(statutActuel, cible) {
		if (estAdmin) return true;
		if (statutActuel === cible) return true;
		const autorisees = TRANSITIONS_CHEF[statutActuel] ?? [];
		return autorisees.includes(cible);
	}

	let totalPayeCentimes = $derived(
		poste?.paiements ? poste.paiements.reduce((s, p) => s + p.montantCentimes, 0) : 0
	);

	let resteARecevoirCentimes = $derived(
		(poste?.montantClientCentimes ?? 0) - totalPayeCentimes
	);

	// Peut-on supprimer ce Poste ? (admin uniquement + zéro paiement + zéro dépense)
	let peutSupprimer = $derived(
		estAdmin &&
		(poste?.paiements?.length ?? 0) === 0 &&
		depensesAffectees.length === 0
	);

	async function chargerPoste() {
		try {
			const res = await apiAuth(`/api/postes/${posteId}`);
			if (!res.ok) {
				const p = await res.json();
				erreur = p.message || 'Poste introuvable.';
				return false;
			}
			const payload = await res.json();
			poste = payload.data;
			return true;
		} catch {
			erreur = 'Impossible de contacter le serveur.';
			return false;
		}
	}

	async function chargerCompta() {
		try {
			const res = await apiAuth(`/api/lieux/${lieuId}/compta`);
			if (!res.ok) return;
			const payload = await res.json();
			const data = payload.data ?? {};
			depensesAffectees = (data.depenses ?? []).filter((d) => d.posteId === posteId);
			budgetsAffectes = (data.budgets ?? []).filter((b) => b.posteId === posteId);
		} catch {
			// silencieux : compta secondaire à l'affichage du Poste
		}
	}

	async function chargerTout() {
		chargement = true;
		erreur = '';
		const ok = await chargerPoste();
		if (ok) await chargerCompta();
		chargement = false;
	}

	onMount(chargerTout);

	async function changerStatut(nouveau) {
		if (!poste || poste.statut === nouveau) return;
		erreurTransition = '';
		transitionEnCours = true;
		try {
			const res = await apiAuth(`/api/postes/${posteId}`, {
				method: 'PATCH',
				body: JSON.stringify({ statut: nouveau })
			});
			if (!res.ok) {
				const p = await res.json();
				erreurTransition = p.message || 'Erreur lors du changement de statut.';
				return;
			}
			await chargerTout();
		} catch {
			erreurTransition = 'Impossible de contacter le serveur.';
		} finally {
			transitionEnCours = false;
		}
	}

	async function enregistrerPaiement() {
		erreurPaiement = '';
		const montant = Number(montantPaiementDh);
		if (!Number.isFinite(montant) || montant <= 0) {
			erreurPaiement = 'Le montant doit être un nombre positif.';
			return;
		}
		envoiPaiementEnCours = true;
		try {
			const res = await apiAuth('/api/paiements', {
				method: 'POST',
				body: JSON.stringify({
					posteId,
					date: new Date(datePaiement + 'T12:00:00').toISOString(),
					montantCentimes: Math.round(montant * 100),
					mode: modePaiement,
					description: descriptionPaiement.trim() || null
				})
			});
			if (!res.ok) {
				const p = await res.json();
				erreurPaiement = p.message || 'Erreur lors de la création du paiement.';
				return;
			}
			modeAjoutPaiement = false;
			datePaiement = new Date().toISOString().slice(0, 10);
			montantPaiementDh = '';
			modePaiement = 'VIREMENT';
			descriptionPaiement = '';
			await chargerTout();
		} catch {
			erreurPaiement = 'Impossible de contacter le serveur.';
		} finally {
			envoiPaiementEnCours = false;
		}
	}

	async function supprimerPoste() {
		if (!confirm('Supprimer définitivement ce poste ? Cette action est irréversible.')) return;
		try {
			const res = await apiAuth(`/api/postes/${posteId}`, {
				method: 'DELETE',
				body: JSON.stringify({})
			});
			if (res.status === 204) {
				goto(`/lieux/${lieuId}`);
				return;
			}
			const p = await res.json();
			alert(p.message || 'Erreur lors de la suppression.');
		} catch {
			alert('Impossible de contacter le serveur.');
		}
	}

	function onDepenseChangee() {
		modeAjoutDepense = false;
		chargerTout();
	}
</script>

<svelte:head>
	<title>{poste?.titre ?? 'Poste'} — Ludimmo</title>
</svelte:head>

<div class="page">
	<button class="bouton-retour" onclick={() => goto(`/lieux/${lieuId}`)}>
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M19 12H5M12 19l-7-7 7-7" />
		</svg>
		Retour au lieu
	</button>

	{#if chargement}
		<div class="etat-central"><div class="spinner"></div></div>
	{:else if erreur}
		<div class="etat-central"><p class="erreur-message">{erreur}</p></div>
	{:else if poste}
		<header class="entete">
			<div class="entete-ligne">
				{#if poste.lieu}
					<span class="ref-lieu">{poste.lieu.reference} — {poste.lieu.nom}</span>
				{/if}
				<span class="badge-statut" style:background={STATUTS[poste.statut]?.couleur ?? '#8a8a8a'}>
					{STATUTS[poste.statut]?.label ?? poste.statut}
				</span>
			</div>
			<h1>{poste.titre}</h1>
		</header>

		{#if poste.description}
			<p class="description">{poste.description}</p>
		{/if}

		<!-- Transition de statut -->
		<section class="section">
			<h2 class="section-titre">Statut</h2>
			<div class="boutons-statut">
				{#each ['A_FAIRE', 'EN_COURS', 'TERMINE'] as s (s)}
					{@const autorisee = transitionAutorisee(poste.statut, s)}
					{@const actif = poste.statut === s}
					<button
						class="bouton-statut"
						class:actif
						disabled={transitionEnCours || actif || !autorisee}
						title={!autorisee ? 'Transition réservée à l\'administrateur' : ''}
						onclick={() => changerStatut(s)}
					>
						{STATUTS[s].label}
					</button>
				{/each}
			</div>
			{#if poste.termineLe}
				<p class="info-termine">Terminé le {formaterDate(poste.termineLe)}.</p>
			{/if}
			{#if erreurTransition}<p class="erreur">{erreurTransition}</p>{/if}
		</section>

		<!-- Montants (admin uniquement, defense in depth + strip API) -->
		{#if estAdmin && poste.montantBrutCentimes !== undefined}
			<section class="section">
				<h2 class="section-titre">Montants</h2>
				<div class="carte-info">
					<div class="info-ligne">
						<span class="info-label">Coût brut</span>
						<span class="info-valeur">{formaterDh(poste.montantBrutCentimes)}</span>
					</div>
					<div class="info-ligne">
						<span class="info-label">Prix client</span>
						<span class="info-valeur">{formaterDh(poste.montantClientCentimes)}</span>
					</div>
					<div class="info-ligne">
						<span class="info-label">Marge</span>
						<span class="info-valeur">
							{formaterDh(poste.margeCentimes)}
							<span class="marge-pct">({poste.margePourcent?.toFixed(2) ?? '0.00'}%)</span>
						</span>
					</div>
				</div>
			</section>
		{/if}

		<!-- Paiements reçus -->
		<section class="section">
			<div class="section-entete">
				<h2 class="section-titre">Paiements reçus</h2>
				{#if estAdmin && !modeAjoutPaiement}
					<button class="bouton-ajout" onclick={() => (modeAjoutPaiement = true)}>+ Paiement</button>
				{/if}
			</div>

			{#if estAdmin}
				<div class="resume-paiements">
					<div class="resume-ligne">
						<span>Total payé</span>
						<strong>{formaterDh(totalPayeCentimes)}</strong>
					</div>
					{#if poste.montantClientCentimes > 0}
						<div class="resume-ligne" class:du={resteARecevoirCentimes > 0}>
							<span>Reste à recevoir</span>
							<strong>{formaterDh(resteARecevoirCentimes)}</strong>
						</div>
					{/if}
				</div>
			{/if}

			{#if modeAjoutPaiement}
				<form class="form-paiement" onsubmit={(e) => { e.preventDefault(); enregistrerPaiement(); }}>
					<div class="boutons-mode">
						<button type="button" class:actif={modePaiement === 'VIREMENT'} onclick={() => (modePaiement = 'VIREMENT')}>Virement</button>
						<button type="button" class:actif={modePaiement === 'CASH'} onclick={() => (modePaiement = 'CASH')}>Cash</button>
					</div>
					<label class="champ">
						<span class="label">Date</span>
						<input type="date" bind:value={datePaiement} required />
					</label>
					<label class="champ">
						<span class="label">Montant (DH)</span>
						<input type="number" inputmode="decimal" min="0.01" step="0.01" bind:value={montantPaiementDh} required />
					</label>
					<label class="champ">
						<span class="label">Description (optionnel)</span>
						<input type="text" bind:value={descriptionPaiement} maxlength="500" />
					</label>
					{#if erreurPaiement}<p class="erreur">{erreurPaiement}</p>{/if}
					<div class="actions">
						<button type="button" class="bouton-secondaire" onclick={() => (modeAjoutPaiement = false)} disabled={envoiPaiementEnCours}>Annuler</button>
						<button type="submit" class="bouton-primaire" disabled={envoiPaiementEnCours}>{envoiPaiementEnCours ? 'Envoi…' : 'Enregistrer'}</button>
					</div>
				</form>
			{/if}

			{#if !poste.paiements || poste.paiements.length === 0}
				<p class="texte-vide">Aucun paiement enregistré.</p>
			{:else}
				<div class="liste-paiements">
					{#each poste.paiements as p (p.id)}
						<div class="ligne-paiement">
							<div class="paiement-haut">
								<span class="mode-label {p.mode}">{p.mode === 'VIREMENT' ? 'Virement' : 'Cash'}</span>
								<span class="montant">{formaterDh(p.montantCentimes)}</span>
							</div>
							<div class="paiement-meta">
								<span>{formaterDate(p.date)}</span>
								{#if p.description}<span>· {p.description}</span>{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<!-- Dépenses affectées -->
		<section class="section">
			<div class="section-entete">
				<h2 class="section-titre">Dépenses affectées</h2>
				{#if !modeAjoutDepense}
					<button class="bouton-ajout" onclick={() => (modeAjoutDepense = true)}>+ Dépense</button>
				{/if}
			</div>

			{#if modeAjoutDepense}
				<div class="bloc-form">
					<AjoutDepenseForm
						lieuId={lieuId}
						posteIdInitial={posteId}
						onTermine={(ok) => { if (ok) onDepenseChangee(); else modeAjoutDepense = false; }}
						onAnnule={() => (modeAjoutDepense = false)}
					/>
				</div>
			{/if}

			{#if depensesAffectees.length === 0}
				<p class="texte-vide">Aucune dépense affectée à ce poste.</p>
			{:else}
				<div class="liste-mini">
					{#each depensesAffectees as d (d.id)}
						<div class="ligne-mini">
							<div class="mini-haut">
								<span class="cat-mini cat-{d.categorie}">{d.categorie}</span>
								<span class="montant-mini">{formaterDh(d.montantCentimes)}</span>
							</div>
							<p class="mini-desc">{d.description}</p>
							{#if d.fournisseur}<p class="mini-meta">Fournisseur : {d.fournisseur}</p>{/if}
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<!-- Budgets affectés -->
		{#if budgetsAffectes.length > 0}
			<section class="section">
				<h2 class="section-titre">Budgets affectés</h2>
				<div class="liste-mini">
					{#each budgetsAffectes as b (b.id)}
						<div class="ligne-mini">
							<div class="mini-haut">
								<span class="type-mini">{b.type}</span>
								<span class="montant-mini">{formaterDh(b.montantCentimes)}</span>
							</div>
							<p class="mini-meta">{formaterDate(b.date)}{b.description ? ' · ' + b.description : ''}</p>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Suppression (admin uniquement) -->
		{#if estAdmin}
			<section class="section danger">
				<button
					class="bouton-supprimer"
					disabled={!peutSupprimer}
					title={!peutSupprimer ? 'Impossible : ce poste a des paiements ou dépenses rattachés.' : ''}
					onclick={supprimerPoste}
				>
					Supprimer ce poste
				</button>
				{#if !peutSupprimer}
					<p class="aide-suppression">
						Vous ne pouvez supprimer ce poste que si aucun paiement ni dépense ne lui est rattaché.
					</p>
				{/if}
			</section>
		{/if}
	{/if}
</div>

<style>
	.page { padding: var(--esp-lg); padding-bottom: calc(var(--hauteur-nav) + var(--safe-bas) + var(--esp-xxl)); }

	.bouton-retour {
		display: inline-flex; align-items: center; gap: var(--esp-xs);
		font-size: 14px; color: var(--couleur-primaire); font-weight: 500;
		margin-bottom: var(--esp-lg);
	}

	.entete { margin-bottom: var(--esp-md); }
	.entete-ligne {
		display: flex; justify-content: space-between; align-items: center;
		margin-bottom: var(--esp-sm); flex-wrap: wrap; gap: var(--esp-xs);
	}
	.ref-lieu { font-size: 12px; font-weight: 600; color: var(--couleur-texte-leger); }
	.badge-statut {
		font-size: 11px; font-weight: 600; color: white;
		padding: 2px 10px; border-radius: 12px; text-transform: uppercase;
	}
	h1 { font-size: 24px; font-weight: 700; }

	.description {
		font-size: 15px; color: var(--couleur-texte-secondaire); line-height: 1.5;
		margin-bottom: var(--esp-lg);
	}

	.section { margin-bottom: var(--esp-lg); }
	.section.danger {
		margin-top: var(--esp-xl); padding-top: var(--esp-lg);
		border-top: 1px solid var(--couleur-bordure);
	}
	.section-entete { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--esp-sm); }
	.section-titre {
		font-size: 14px; font-weight: 700; color: var(--couleur-texte-secondaire);
		text-transform: uppercase; letter-spacing: 0.05em;
	}
	.bouton-ajout {
		font-size: 13px; font-weight: 600; color: var(--couleur-primaire);
		padding: var(--esp-xs) var(--esp-sm);
	}

	.boutons-statut { display: flex; gap: var(--esp-sm); }
	.bouton-statut {
		flex: 1; padding: var(--esp-md);
		border: 1.5px solid var(--couleur-bordure-forte); border-radius: var(--rayon-md);
		background: var(--couleur-fond); font-size: 14px; font-weight: 600;
		color: var(--couleur-texte-secondaire); min-height: var(--taille-tactile);
	}
	.bouton-statut.actif { background: var(--couleur-primaire); color: white; border-color: var(--couleur-primaire); }
	.bouton-statut:disabled:not(.actif) { opacity: 0.4; cursor: not-allowed; }
	.info-termine { font-size: 12px; color: var(--couleur-texte-leger); margin-top: var(--esp-xs); }

	.carte-info {
		background: var(--couleur-fond-carte); border: 1px solid var(--couleur-bordure);
		border-radius: var(--rayon-md); padding: var(--esp-md);
	}
	.info-ligne { display: flex; justify-content: space-between; padding: var(--esp-xs) 0; }
	.info-label { font-size: 14px; color: var(--couleur-texte-secondaire); }
	.info-valeur { font-size: 14px; font-weight: 600; color: var(--couleur-texte); }
	.marge-pct { font-size: 12px; font-weight: 400; color: var(--couleur-texte-leger); margin-left: var(--esp-xs); }

	.resume-paiements {
		background: var(--couleur-primaire-clair); border-radius: var(--rayon-md);
		padding: var(--esp-md); margin-bottom: var(--esp-md);
		display: flex; flex-direction: column; gap: var(--esp-xs);
	}
	.resume-ligne { display: flex; justify-content: space-between; font-size: 14px; }
	.resume-ligne.du { color: var(--couleur-erreur); }

	.form-paiement {
		background: var(--couleur-fond-carte); border: 1px solid var(--couleur-bordure);
		border-radius: var(--rayon-md); padding: var(--esp-md); margin-bottom: var(--esp-md);
		display: flex; flex-direction: column; gap: var(--esp-md);
	}
	.boutons-mode { display: flex; gap: var(--esp-sm); }
	.boutons-mode button {
		flex: 1; padding: var(--esp-sm); border: 1.5px solid var(--couleur-bordure-forte);
		border-radius: var(--rayon-md); font-weight: 600; font-size: 14px;
		color: var(--couleur-texte-secondaire); background: var(--couleur-fond);
	}
	.boutons-mode button.actif { background: var(--couleur-primaire); color: white; border-color: var(--couleur-primaire); }

	.champ { display: flex; flex-direction: column; gap: var(--esp-xs); }
	.label { font-size: 13px; font-weight: 600; color: var(--couleur-texte-secondaire); }
	.champ input {
		padding: var(--esp-md); border: 1px solid var(--couleur-bordure-forte);
		border-radius: var(--rayon-md); font-size: 16px; min-height: var(--taille-tactile);
		font-family: inherit;
	}

	.erreur {
		color: var(--couleur-erreur); font-size: 14px;
		padding: var(--esp-sm); background: rgba(176, 58, 46, 0.08);
		border-radius: var(--rayon-md); margin-top: var(--esp-xs);
	}

	.actions { display: flex; gap: var(--esp-sm); }
	.bouton-primaire, .bouton-secondaire {
		flex: 1; padding: var(--esp-md); border-radius: var(--rayon-md);
		font-size: 15px; font-weight: 600; min-height: var(--taille-tactile);
	}
	.bouton-primaire { background: var(--couleur-primaire); color: white; }
	.bouton-primaire:disabled { opacity: 0.6; }
	.bouton-secondaire { background: transparent; color: var(--couleur-texte-secondaire); border: 1.5px solid var(--couleur-bordure-forte); }

	.bloc-form {
		background: var(--couleur-fond-carte); border: 1px solid var(--couleur-bordure);
		border-radius: var(--rayon-md); padding: var(--esp-md); margin-bottom: var(--esp-md);
	}

	.liste-paiements, .liste-mini { display: flex; flex-direction: column; gap: var(--esp-sm); }

	.ligne-paiement, .ligne-mini {
		background: var(--couleur-fond-carte); border: 1px solid var(--couleur-bordure);
		border-radius: var(--rayon-md); padding: var(--esp-md);
	}
	.paiement-haut, .mini-haut { display: flex; justify-content: space-between; align-items: baseline; }
	.mode-label {
		font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px;
		text-transform: uppercase; color: white; letter-spacing: 0.04em;
	}
	.mode-label.VIREMENT { background: #1e4d6b; }
	.mode-label.CASH { background: #2d7a4f; }
	.montant { font-size: 18px; font-weight: 700; }
	.paiement-meta, .mini-meta { font-size: 12px; color: var(--couleur-texte-leger); margin-top: 4px; }
	.mini-desc { font-size: 14px; color: var(--couleur-texte); margin: var(--esp-xs) 0; }

	.cat-mini {
		font-size: 10px; font-weight: 700; padding: 2px 6px;
		border-radius: 8px; color: white; text-transform: uppercase;
	}
	.cat-mini.cat-ACOMPTE { background: #1e4d6b; }
	.cat-mini.cat-MATERIEL { background: #c8924a; }
	.cat-mini.cat-REPAS { background: #7a5a2b; }

	.type-mini {
		font-size: 10px; font-weight: 700; color: var(--couleur-texte-secondaire);
		text-transform: uppercase; letter-spacing: 0.04em;
	}

	.montant-mini { font-size: 16px; font-weight: 700; }

	.texte-vide {
		font-size: 14px; color: var(--couleur-texte-leger); font-style: italic;
		padding: var(--esp-md); text-align: center;
	}

	.bouton-supprimer {
		width: 100%; padding: var(--esp-md);
		background: transparent; color: var(--couleur-erreur);
		border: 1.5px solid var(--couleur-erreur); border-radius: var(--rayon-md);
		font-weight: 600; font-size: 14px; min-height: var(--taille-tactile);
	}
	.bouton-supprimer:disabled {
		opacity: 0.4; cursor: not-allowed; border-color: var(--couleur-bordure-forte);
		color: var(--couleur-texte-leger);
	}
	.aide-suppression {
		font-size: 12px; color: var(--couleur-texte-leger);
		margin-top: var(--esp-sm); text-align: center;
	}

	.etat-central { display: flex; flex-direction: column; align-items: center; padding: var(--esp-xxl); }
	.spinner {
		width: 32px; height: 32px; border: 3px solid var(--couleur-bordure);
		border-top-color: var(--couleur-primaire); border-radius: 50%;
		animation: rotation 0.8s linear infinite;
	}
	@keyframes rotation { to { transform: rotate(360deg); } }
	.erreur-message { color: var(--couleur-erreur); font-size: 15px; text-align: center; }
</style>
