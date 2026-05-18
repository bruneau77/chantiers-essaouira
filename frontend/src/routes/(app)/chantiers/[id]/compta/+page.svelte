<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { auth, apiAuth } from '$lib/stores/auth.js';
	import DepenseRow from '$lib/components/DepenseRow.svelte';
	import AjoutDepenseForm from '$lib/components/AjoutDepenseForm.svelte';

	let compta = $state(null);
	let chargement = $state(true);
	let erreur = $state('');

	// Pour l'admin : formulaire de versement / remboursement
	let modeAjoutBudget = $state(false);

	// Pour les deux : formulaire d'ajout de dépense
	let modeAjoutDepense = $state(false);

	const id = $derived(parseInt($page.params.id, 10));

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
			const res = await apiAuth(`/api/chantiers/${id}/compta`);
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

	// Pour l'admin : enregistrer un versement / remboursement
	let typeBudget = $state('VERSEMENT');
	let montantBudgetDh = $state('');
	let descriptionBudget = $state('');
	let envoiBudgetEnCours = $state(false);
	let erreurBudget = $state('');

	async function enregistrerBudget() {
		erreurBudget = '';
		// `<input type="number">` renvoie déjà un Number ou '' via bind:value.
		// On normalise via Number() pour gérer string ET number sans planter.
		const montant = Number(montantBudgetDh);
		if (!Number.isFinite(montant) || montant <= 0) {
			erreurBudget = 'Le montant doit être un nombre positif.';
			return;
		}
		envoiBudgetEnCours = true;
		try {
			const res = await apiAuth('/api/budgets', {
				method: 'POST',
				body: JSON.stringify({
					chantierId: id,
					userId: compta.chantier.chefId,
					date: new Date().toISOString(),
					montantCentimes: Math.round(montant * 100),
					type: typeBudget,
					description: descriptionBudget.trim() || null
				})
			});
			if (!res.ok) {
				const p = await res.json();
				erreurBudget = p.message || 'Erreur lors de l\'enregistrement.';
				return;
			}
			modeAjoutBudget = false;
			typeBudget = 'VERSEMENT';
			montantBudgetDh = '';
			descriptionBudget = '';
			charger();
		} catch {
			erreurBudget = 'Impossible de contacter le serveur.';
		} finally {
			envoiBudgetEnCours = false;
		}
	}

	const estAdmin = $derived($auth.utilisateur?.role === 'admin');
</script>

<svelte:head>
	<title>Compta — {compta?.chantier?.titre ?? 'Chantier'}</title>
</svelte:head>

<div class="page">
	<button class="bouton-retour" onclick={() => goto(`/chantiers/${id}`)}>
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M19 12H5M12 19l-7-7 7-7" />
		</svg>
		Fiche chantier
	</button>

	{#if chargement}
		<div class="etat-central">
			<div class="spinner"></div>
		</div>
	{:else if erreur}
		<div class="etat-central">
			<p class="erreur-message">{erreur}</p>
		</div>
	{:else if compta}
		<header class="entete">
			<span class="numero">{compta.chantier.numero}</span>
			<h1>Compta — {compta.chantier.titre}</h1>
		</header>

		<!-- ====================================================== -->
		<!--               BUDGET REÇU DE DOMINIQUE                  -->
		<!-- ====================================================== -->
		<section class="section bloc-budget">
			<h2 class="section-titre">💰 Budget reçu de Dominique</h2>
			<div class="carte-info">
				<div class="info-ligne">
					<span class="info-label">Total reçu</span>
					<span class="info-valeur">{formaterDh(compta.budgetRecuCentimes)}</span>
				</div>
				<div class="info-ligne">
					<span class="info-label">Total dépensé</span>
					<span class="info-valeur">{formaterDh(compta.totalDepenseCentimes)}</span>
				</div>
				<div class="info-ligne total" class:negatif={compta.soldeRestantCentimes < 0}>
					<span class="info-label">Solde restant</span>
					<span class="info-valeur">{formaterDh(compta.soldeRestantCentimes)}</span>
				</div>
			</div>

			{#if estAdmin}
				{#if modeAjoutBudget}
					<form class="formulaire-budget" onsubmit={(e) => { e.preventDefault(); enregistrerBudget(); }}>
						<h3>Nouveau versement / remboursement</h3>

						<div class="boutons-type">
							<button
								type="button"
								class="bouton-type"
								class:actif={typeBudget === 'VERSEMENT'}
								onclick={() => (typeBudget = 'VERSEMENT')}
							>Versement</button>
							<button
								type="button"
								class="bouton-type"
								class:actif={typeBudget === 'REMBOURSEMENT'}
								onclick={() => (typeBudget = 'REMBOURSEMENT')}
							>Remboursement</button>
						</div>

						<label class="champ">
							<span class="label">Montant</span>
							<div class="champ-monnaie">
								<input type="number" inputmode="decimal" min="0" step="1" bind:value={montantBudgetDh} required />
								<span class="suffixe">DH</span>
							</div>
						</label>

						<label class="champ">
							<span class="label">Description (optionnel)</span>
							<input type="text" bind:value={descriptionBudget} maxlength="500" />
						</label>

						{#if erreurBudget}
							<p class="erreur-inline">{erreurBudget}</p>
						{/if}

						<div class="actions">
							<button type="button" class="bouton-secondaire" onclick={() => (modeAjoutBudget = false)} disabled={envoiBudgetEnCours}>
								Annuler
							</button>
							<button type="submit" class="bouton-principal" disabled={envoiBudgetEnCours}>
								{envoiBudgetEnCours ? 'Enregistrement…' : 'Enregistrer'}
							</button>
						</div>
					</form>
				{:else}
					<button class="bouton-ajouter" onclick={() => (modeAjoutBudget = true)}>
						+ Versement / remboursement
					</button>
				{/if}
			{/if}
		</section>

		<!-- ====================================================== -->
		<!--             MES AVANCES PERSONNELLES                    -->
		<!-- ====================================================== -->
		<section class="section">
			<h2 class="section-titre">💸 Mes avances personnelles</h2>
			<div class="carte-info">
				<div class="info-ligne">
					<span class="info-label">Avancé</span>
					<span class="info-valeur">{formaterDh(compta.totalAvancesPersoCentimes)}</span>
				</div>
				<div class="info-ligne">
					<span class="info-label">Remboursé</span>
					<span class="info-valeur">{formaterDh(compta.totalRembourseCentimes)}</span>
				</div>
				<div class="info-ligne total" class:negatif={compta.dominiqueMeDoitCentimes > 0}>
					<span class="info-label">Dominique me doit</span>
					<span class="info-valeur">{formaterDh(compta.dominiqueMeDoitCentimes)}</span>
				</div>
			</div>
		</section>

		<!-- ====================================================== -->
		<!--                    MES DÉPENSES                         -->
		<!-- ====================================================== -->
		<section class="section">
			<h2 class="section-titre">📋 {estAdmin ? 'Dépenses' : 'Mes dépenses'}</h2>

			{#if modeAjoutDepense}
				<AjoutDepenseForm
					chantierId={id}
					onTermine={(s) => { modeAjoutDepense = false; if (s) charger(); }}
					onAnnule={() => (modeAjoutDepense = false)}
				/>
			{:else}
				<button class="bouton-ajouter principal" onclick={() => (modeAjoutDepense = true)}>
					+ Ajouter une dépense
				</button>
			{/if}

			{#if compta.depenses.length === 0}
				<p class="texte-vide">Aucune dépense enregistrée pour ce chantier.</p>
			{:else}
				<div class="liste-depenses">
					{#each compta.depenses as depense (depense.id)}
						<DepenseRow
							{depense}
							onChange={onDepenseChangee}
						/>
					{/each}
				</div>
			{/if}
		</section>
	{/if}
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
	.numero {
		font-size: 12px;
		font-weight: 600;
		color: var(--couleur-texte-leger);
		letter-spacing: 0.04em;
	}
	h1 { font-size: 22px; font-weight: 700; margin-top: var(--esp-xs); }

	.section { margin-bottom: var(--esp-xl); }
	.section-titre {
		font-size: 15px;
		font-weight: 700;
		color: var(--couleur-texte);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin-bottom: var(--esp-md);
	}

	.carte-info {
		background: var(--couleur-fond-carte);
		border: 1px solid var(--couleur-bordure);
		border-radius: var(--rayon-lg);
		overflow: hidden;
		margin-bottom: var(--esp-md);
	}
	.info-ligne {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--esp-md);
		border-bottom: 1px solid var(--couleur-bordure);
	}
	.info-ligne:last-child { border-bottom: none; }
	.info-ligne.total { background: var(--couleur-primaire-clair); font-weight: 700; }
	.info-ligne.total.negatif { background: #fdf3f1; }
	.info-ligne.total.negatif .info-valeur { color: #b03a2e; }
	.info-label { font-size: 14px; color: var(--couleur-texte-secondaire); }
	.info-valeur { font-size: 14px; font-weight: 600; color: var(--couleur-texte); }
	.info-ligne.total .info-label,
	.info-ligne.total .info-valeur { font-size: 15px; color: var(--couleur-texte); }

	.bouton-ajouter {
		display: block;
		width: 100%;
		padding: var(--esp-md);
		background: var(--couleur-fond);
		color: var(--couleur-primaire);
		border: 1.5px dashed var(--couleur-primaire);
		border-radius: var(--rayon-md);
		font-size: 14px;
		font-weight: 600;
		min-height: var(--taille-tactile);
		margin-bottom: var(--esp-md);
	}
	.bouton-ajouter.principal {
		background: var(--couleur-primaire);
		color: white;
		border-style: solid;
	}
	.bouton-ajouter:active { opacity: 0.85; }

	.liste-depenses {
		display: flex;
		flex-direction: column;
		gap: var(--esp-sm);
	}

	.texte-vide {
		font-size: 14px;
		color: var(--couleur-texte-leger);
		padding: var(--esp-md);
		background: var(--couleur-fond-carte);
		border: 1px dashed var(--couleur-bordure-forte);
		border-radius: var(--rayon-md);
		text-align: center;
	}

	/* Formulaire budget */
	.formulaire-budget {
		display: flex;
		flex-direction: column;
		gap: var(--esp-md);
		background: var(--couleur-fond-carte);
		border: 1px solid var(--couleur-bordure);
		border-radius: var(--rayon-lg);
		padding: var(--esp-md);
	}
	.formulaire-budget h3 { font-size: 16px; font-weight: 700; }

	.boutons-type {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--esp-sm);
	}
	.bouton-type {
		padding: var(--esp-md);
		border-radius: var(--rayon-md);
		font-size: 13px;
		font-weight: 700;
		color: var(--couleur-texte-secondaire);
		background: var(--couleur-fond);
		border: 1.5px solid var(--couleur-bordure);
		min-height: 48px;
	}
	.bouton-type.actif { background: var(--couleur-primaire); color: white; border-color: var(--couleur-primaire); }

	.champ { display: flex; flex-direction: column; gap: 4px; }
	.label {
		font-size: 12px; font-weight: 600;
		color: var(--couleur-texte-secondaire);
		text-transform: uppercase; letter-spacing: 0.04em;
	}
	input[type="text"], input[type="number"] {
		font-size: 16px;
		padding: 12px;
		border: 1.5px solid var(--couleur-bordure-forte);
		border-radius: var(--rayon-sm);
		background: var(--couleur-fond);
		color: var(--couleur-texte);
		width: 100%;
	}
	input:focus { outline: none; border-color: var(--couleur-primaire); }
	.champ-monnaie { position: relative; display: flex; align-items: center; }
	.champ-monnaie input { padding-right: 48px; }
	.suffixe {
		position: absolute; right: 12px;
		font-size: 14px; font-weight: 600;
		color: var(--couleur-texte-secondaire);
		pointer-events: none;
	}

	.actions { display: flex; gap: var(--esp-sm); }
	.bouton-principal {
		flex: 1;
		padding: var(--esp-md);
		background: var(--couleur-primaire);
		color: white;
		font-weight: 700;
		font-size: 15px;
		border-radius: var(--rayon-md);
		min-height: var(--taille-tactile);
	}
	.bouton-principal:disabled { opacity: 0.5; }
	.bouton-secondaire {
		flex: 1;
		padding: var(--esp-md);
		background: transparent;
		color: var(--couleur-texte-secondaire);
		font-weight: 600;
		font-size: 15px;
		border-radius: var(--rayon-md);
		border: 1.5px solid var(--couleur-bordure-forte);
		min-height: var(--taille-tactile);
	}

	.erreur-inline {
		padding: var(--esp-sm);
		background: #fdf3f1;
		color: #b03a2e;
		border-radius: var(--rayon-sm);
		font-size: 13px;
	}

	.etat-central {
		display: flex; flex-direction: column;
		align-items: center; justify-content: center;
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
	.erreur-message { color: var(--couleur-erreur); text-align: center; }
</style>
