<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { auth, apiAuth } from '$lib/stores/auth.js';
	import { nomComplet } from '$lib/utils/nom.js';
	import DepenseRow from '$lib/components/DepenseRow.svelte';
	import AjoutDepenseForm from '$lib/components/AjoutDepenseForm.svelte';

	let compta = $state(null);
	let chargement = $state(true);
	let erreur = $state('');

	let modeAjoutBudget = $state(false);
	let modeAjoutDepense = $state(false);

	const id = $derived(parseInt($page.params.id, 10));
	const estAdmin = $derived($auth.utilisateur?.role === 'admin');

	function formaterDh(c) {
		if (c === null || c === undefined) return '—';
		const dh = Math.round(c / 100);
		return dh.toLocaleString('fr-FR').replace(/,/g, ' ') + ' DH';
	}

	function formaterDate(s) {
		if (!s) return '—';
		return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
	}

	async function charger() {
		chargement = true;
		erreur = '';
		try {
			const res = await apiAuth(`/api/lieux/${id}/compta`);
			if (!res.ok) {
				const p = await res.json();
				erreur = p.message || 'Erreur de chargement.';
				return;
			}
			const payload = await res.json();
			compta = payload.data;
		} catch {
			erreur = 'Impossible de contacter le serveur.';
		} finally {
			chargement = false;
		}
	}

	onMount(charger);

	function onDepenseChangee() {
		modeAjoutDepense = false;
		charger();
	}

	// --- Formulaire admin : versement / remboursement ---
	let typeBudget = $state('VERSEMENT');
	let montantBudgetDh = $state('');
	let descriptionBudget = $state('');
	let envoiBudgetEnCours = $state(false);
	let erreurBudget = $state('');

	async function enregistrerBudget() {
		erreurBudget = '';
		const montant = Number(montantBudgetDh);
		if (!Number.isFinite(montant) || montant <= 0) {
			erreurBudget = 'Le montant doit être un nombre positif.';
			return;
		}
		if (!compta?.lieu?.chef) {
			erreurBudget = 'Aucun chef défini sur ce lieu — impossible de créer un versement.';
			return;
		}
		envoiBudgetEnCours = true;
		try {
			const res = await apiAuth('/api/budgets', {
				method: 'POST',
				body: JSON.stringify({
					lieuId: id,
					userId: compta.lieu.chef.id,
					type: typeBudget,
					montantCentimes: Math.round(montant * 100),
					description: descriptionBudget.trim() || null
				})
			});
			if (!res.ok) {
				const p = await res.json();
				erreurBudget = p.message || 'Erreur lors de la création.';
				return;
			}
			modeAjoutBudget = false;
			montantBudgetDh = '';
			descriptionBudget = '';
			typeBudget = 'VERSEMENT';
			await charger();
		} catch {
			erreurBudget = 'Impossible de contacter le serveur.';
		} finally {
			envoiBudgetEnCours = false;
		}
	}
</script>

<svelte:head>
	<title>Compta — {compta?.lieu?.nom ?? 'Lieu'} — Ludimmo</title>
</svelte:head>

<div class="page">
	<button class="bouton-retour" onclick={() => goto(`/lieux/${id}`)}>
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M19 12H5M12 19l-7-7 7-7" />
		</svg>
		Retour
	</button>

	{#if chargement}
		<div class="etat-central"><div class="spinner"></div></div>
	{:else if erreur}
		<div class="etat-central"><p class="erreur-message">{erreur}</p></div>
	{:else if compta}
		<header class="entete">
			<p class="reference">{compta.lieu.reference}</p>
			<h1>Compta — {compta.lieu.nom}</h1>
			{#if compta.lieu.chef}
				<p class="meta">Chef : {nomComplet(compta.lieu.chef)}</p>
			{/if}
		</header>

		<!-- Synthèse financière -->
		<section class="section">
			<h2 class="section-titre">Synthèse</h2>
			<div class="grille-stats">
				<div class="stat">
					<span class="stat-label">Budget reçu</span>
					<span class="stat-valeur">{formaterDh(compta.budgetRecuCentimes)}</span>
				</div>
				<div class="stat">
					<span class="stat-label">Dépensé</span>
					<span class="stat-valeur depense">{formaterDh(compta.totalDepenseCentimes)}</span>
				</div>
				<div class="stat-total" class:negatif={compta.soldeRestantCentimes < 0}>
					<span class="stat-label">Solde restant</span>
					<span class="stat-valeur">{formaterDh(compta.soldeRestantCentimes)}</span>
				</div>
			</div>

			{#if compta.totalAvancesPersoCentimes > 0 || compta.totalRembourseCentimes > 0}
				<div class="bloc-avance">
					<h3>Avances personnelles Rachid</h3>
					<div class="ligne-avance">
						<span>Total avancé</span>
						<span>{formaterDh(compta.totalAvancesPersoCentimes)}</span>
					</div>
					<div class="ligne-avance">
						<span>Total remboursé</span>
						<span>{formaterDh(compta.totalRembourseCentimes)}</span>
					</div>
					<div class="ligne-avance total" class:du={compta.dominiqueMeDoitCentimes > 0}>
						<span>Dominique doit</span>
						<span>{formaterDh(compta.dominiqueMeDoitCentimes)}</span>
					</div>
				</div>
			{/if}
		</section>

		<!-- Budgets (admin uniquement pour création) -->
		<section class="section">
			<div class="section-entete">
				<h2 class="section-titre">Versements & remboursements</h2>
				{#if estAdmin && !modeAjoutBudget}
					<button class="bouton-ajout" onclick={() => (modeAjoutBudget = true)}>+ Versement</button>
				{/if}
			</div>

			{#if modeAjoutBudget}
				<form class="form-budget" onsubmit={(e) => { e.preventDefault(); enregistrerBudget(); }}>
					<div class="boutons-type">
						<button type="button" class:actif={typeBudget === 'VERSEMENT'} onclick={() => (typeBudget = 'VERSEMENT')}>Versement</button>
						<button type="button" class:actif={typeBudget === 'REMBOURSEMENT'} onclick={() => (typeBudget = 'REMBOURSEMENT')}>Remboursement</button>
					</div>
					<label class="champ">
						<span class="label">Montant (DH)</span>
						<input type="number" inputmode="decimal" min="0.01" step="0.01" bind:value={montantBudgetDh} required />
					</label>
					<label class="champ">
						<span class="label">Description (optionnel)</span>
						<input type="text" bind:value={descriptionBudget} maxlength="500" />
					</label>
					{#if erreurBudget}<p class="erreur">{erreurBudget}</p>{/if}
					<div class="actions">
						<button type="button" class="bouton-secondaire" onclick={() => (modeAjoutBudget = false)} disabled={envoiBudgetEnCours}>Annuler</button>
						<button type="submit" class="bouton-primaire" disabled={envoiBudgetEnCours}>{envoiBudgetEnCours ? 'Envoi…' : 'Enregistrer'}</button>
					</div>
				</form>
			{/if}

			{#if !compta.budgets || compta.budgets.length === 0}
				<p class="texte-vide">Aucun versement enregistré.</p>
			{:else}
				<div class="liste-budgets">
					{#each compta.budgets as b (b.id)}
						<div class="ligne-budget" class:remboursement={b.type === 'REMBOURSEMENT'}>
							<div class="ligne-budget-haut">
								<span class="type-label">{b.type === 'VERSEMENT' ? 'Versement' : 'Remboursement'}</span>
								<span class="montant">{formaterDh(b.montantCentimes)}</span>
							</div>
							<div class="ligne-budget-meta">
								<span>{formaterDate(b.date)}</span>
								{#if b.poste}
									<span>· Poste : <strong>{b.poste.titre}</strong></span>
								{:else}
									<span>· Global au lieu</span>
								{/if}
								{#if b.description}
									<span>· {b.description}</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<!-- Dépenses -->
		<section class="section">
			<div class="section-entete">
				<h2 class="section-titre">Dépenses</h2>
				{#if !modeAjoutDepense}
					<button class="bouton-ajout" onclick={() => (modeAjoutDepense = true)}>+ Dépense</button>
				{/if}
			</div>

			{#if modeAjoutDepense}
				<div class="bloc-form-depense">
					<AjoutDepenseForm
						lieuId={id}
						onTermine={(ok) => { if (ok) onDepenseChangee(); else modeAjoutDepense = false; }}
						onAnnule={() => (modeAjoutDepense = false)}
					/>
				</div>
			{/if}

			{#if !compta.depenses || compta.depenses.length === 0}
				<p class="texte-vide">Aucune dépense enregistrée.</p>
			{:else}
				<div class="liste-depenses">
					{#each compta.depenses as d (d.id)}
						<DepenseRow depense={d} onChange={charger} />
					{/each}
				</div>
			{/if}
		</section>
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
	.reference { font-size: 12px; font-weight: 600; color: var(--couleur-texte-leger); letter-spacing: 0.04em; }
	h1 { font-size: 22px; font-weight: 700; margin: var(--esp-xs) 0; }
	.meta { font-size: 13px; color: var(--couleur-texte-secondaire); }

	.section { margin-bottom: var(--esp-xl); }
	.section-entete { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--esp-sm); }
	.section-titre {
		font-size: 14px; font-weight: 700; color: var(--couleur-texte-secondaire);
		text-transform: uppercase; letter-spacing: 0.05em;
	}
	.bouton-ajout {
		font-size: 13px; font-weight: 600; color: var(--couleur-primaire);
		padding: var(--esp-xs) var(--esp-sm);
	}

	.grille-stats {
		display: grid; grid-template-columns: 1fr 1fr; gap: var(--esp-sm);
		margin-bottom: var(--esp-md);
	}
	.stat, .stat-total {
		background: var(--couleur-fond-carte); border: 1px solid var(--couleur-bordure);
		border-radius: var(--rayon-md); padding: var(--esp-md);
		display: flex; flex-direction: column; gap: var(--esp-xs);
	}
	.stat-total { grid-column: span 2; background: var(--couleur-primaire-clair); border-color: var(--couleur-primaire); }
	.stat-total.negatif { background: rgba(176, 58, 46, 0.08); border-color: var(--couleur-erreur); }
	.stat-label { font-size: 12px; color: var(--couleur-texte-secondaire); text-transform: uppercase; letter-spacing: 0.04em; }
	.stat-valeur { font-size: 20px; font-weight: 700; color: var(--couleur-texte); }
	.stat-valeur.depense { color: #c97b2b; }

	.bloc-avance {
		background: var(--couleur-fond-carte); border: 1px solid var(--couleur-bordure);
		border-radius: var(--rayon-md); padding: var(--esp-md);
	}
	.bloc-avance h3 { font-size: 13px; font-weight: 700; margin-bottom: var(--esp-sm); color: var(--couleur-texte-secondaire); }
	.ligne-avance { display: flex; justify-content: space-between; padding: var(--esp-xs) 0; font-size: 14px; }
	.ligne-avance.total { font-weight: 700; padding-top: var(--esp-sm); border-top: 1px solid var(--couleur-bordure); margin-top: var(--esp-xs); }
	.ligne-avance.du { color: var(--couleur-erreur); }

	.form-budget {
		background: var(--couleur-fond-carte); border: 1px solid var(--couleur-bordure);
		border-radius: var(--rayon-md); padding: var(--esp-md); margin-bottom: var(--esp-md);
		display: flex; flex-direction: column; gap: var(--esp-md);
	}
	.boutons-type { display: flex; gap: var(--esp-sm); }
	.boutons-type button {
		flex: 1; padding: var(--esp-sm) var(--esp-md);
		border: 1.5px solid var(--couleur-bordure-forte); border-radius: var(--rayon-md);
		font-weight: 600; font-size: 14px; color: var(--couleur-texte-secondaire); background: var(--couleur-fond);
	}
	.boutons-type button.actif { background: var(--couleur-primaire); color: white; border-color: var(--couleur-primaire); }

	.champ { display: flex; flex-direction: column; gap: var(--esp-xs); }
	.label { font-size: 13px; font-weight: 600; color: var(--couleur-texte-secondaire); }
	.champ input {
		padding: var(--esp-md); border: 1px solid var(--couleur-bordure-forte);
		border-radius: var(--rayon-md); font-size: 16px; min-height: var(--taille-tactile);
	}

	.erreur {
		color: var(--couleur-erreur); font-size: 14px;
		padding: var(--esp-sm); background: rgba(176, 58, 46, 0.08);
		border-radius: var(--rayon-md);
	}

	.actions { display: flex; gap: var(--esp-sm); margin-top: var(--esp-xs); }
	.bouton-primaire, .bouton-secondaire {
		flex: 1; padding: var(--esp-md); border-radius: var(--rayon-md);
		font-size: 15px; font-weight: 600; min-height: var(--taille-tactile);
	}
	.bouton-primaire { background: var(--couleur-primaire); color: white; }
	.bouton-primaire:disabled { opacity: 0.6; }
	.bouton-secondaire { background: transparent; color: var(--couleur-texte-secondaire); border: 1.5px solid var(--couleur-bordure-forte); }

	.bloc-form-depense {
		background: var(--couleur-fond-carte); border: 1px solid var(--couleur-bordure);
		border-radius: var(--rayon-md); padding: var(--esp-md); margin-bottom: var(--esp-md);
	}

	.liste-budgets { display: flex; flex-direction: column; gap: var(--esp-sm); }
	.ligne-budget {
		background: var(--couleur-fond-carte); border: 1px solid var(--couleur-bordure);
		border-radius: var(--rayon-md); padding: var(--esp-md);
		border-left: 4px solid #2d7a4f;
	}
	.ligne-budget.remboursement { border-left-color: #c97b2b; }
	.ligne-budget-haut { display: flex; justify-content: space-between; align-items: baseline; }
	.type-label { font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--couleur-texte-secondaire); letter-spacing: 0.04em; }
	.montant { font-size: 18px; font-weight: 700; color: var(--couleur-texte); }
	.ligne-budget-meta { font-size: 12px; color: var(--couleur-texte-leger); margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px; }

	.liste-depenses { display: flex; flex-direction: column; gap: var(--esp-sm); }

	.texte-vide {
		font-size: 14px; color: var(--couleur-texte-leger); font-style: italic;
		padding: var(--esp-md); text-align: center;
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
