<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth, apiAuth } from '$lib/stores/auth.js';
	import DepenseRow from '$lib/components/DepenseRow.svelte';
	import { nomComplet } from '$lib/utils/nom.js';

	let chargement = $state(true);
	let erreur = $state('');

	// État admin
	let dashboard = $state(null);
	// État chef
	let mesChantiers = $state([]);

	function formaterDh(centimes) {
		if (centimes === null || centimes === undefined) return '—';
		const dh = Math.round(centimes / 100);
		return dh.toLocaleString('fr-FR').replace(/,/g, ' ') + ' DH';
	}

	function formaterDate(s) {
		if (!s) return '—';
		return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
	}

	async function chargerDashboard() {
		chargement = true;
		erreur = '';
		try {
			const res = await apiAuth('/api/compta/dashboard');
			if (!res.ok) {
				const payload = await res.json();
				erreur = payload.message || 'Erreur de chargement.';
				return;
			}
			const payload = await res.json();
			dashboard = payload.data;
		} catch {
			erreur = 'Impossible de contacter le serveur.';
		} finally {
			chargement = false;
		}
	}

	async function chargerMesChantiers() {
		chargement = true;
		erreur = '';
		try {
			const res = await apiAuth('/api/chantiers');
			if (!res.ok) {
				const payload = await res.json();
				erreur = payload.message || 'Erreur de chargement.';
				return;
			}
			const payload = await res.json();
			mesChantiers = payload.data ?? [];
		} catch {
			erreur = 'Impossible de contacter le serveur.';
		} finally {
			chargement = false;
		}
	}

	onMount(() => {
		if ($auth.utilisateur?.role === 'admin') {
			chargerDashboard();
		} else {
			chargerMesChantiers();
		}
	});

	// Callback quand une dépense est validée ou modifiée → recharger
	function onDepenseChangee() {
		if ($auth.utilisateur?.role === 'admin') chargerDashboard();
	}
</script>

<svelte:head>
	<title>Compta — Ludimmo</title>
</svelte:head>

<div class="page">
	<header class="entete">
		<h1>Compta</h1>
		{#if $auth.utilisateur?.role === 'admin'}
			<p class="sous-titre">Tableau de bord global</p>
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
	{:else if $auth.utilisateur?.role === 'admin' && dashboard}
		<!-- ====================================================== -->
		<!--                    VUE ADMIN                            -->
		<!-- ====================================================== -->

		<!-- Section À valider -->
		{#if dashboard.depensesAValider.length > 0}
			<section class="section a-valider">
				<h2 class="section-titre">
					À valider
					<span class="badge-titre">{dashboard.depensesAValider.length}</span>
				</h2>
				<div class="liste-depenses">
					{#each dashboard.depensesAValider as depense (depense.id)}
						<DepenseRow
							{depense}
							avecChantier={true}
							onChange={onDepenseChangee}
						/>
					{/each}
				</div>
			</section>
		{:else}
			<section class="section">
				<div class="message-vide-positif">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="20 6 9 17 4 12"></polyline>
					</svg>
					Aucune dépense en attente de validation.
				</div>
			</section>
		{/if}

		<!-- KPI : ce que Dominique doit à Rachid (cumulé) -->
		<section class="section">
			<h2 class="section-titre">Avances Rachid (cumul)</h2>
			<div class="carte-kpi" class:rouge={dashboard.totalAvancesNonRembourseesCentimes > 0}>
				<span class="kpi-label">Total non remboursé</span>
				<span class="kpi-valeur">{formaterDh(dashboard.totalAvancesNonRembourseesCentimes)}</span>
			</div>
		</section>

		<!-- Chantiers actifs avec solde -->
		<section class="section">
			<h2 class="section-titre">Chantiers actifs</h2>
			{#if dashboard.chantiersAvecSolde.length === 0}
				<p class="texte-vide">Aucun chantier actif pour le moment.</p>
			{:else}
				<div class="liste-chantiers">
					{#each dashboard.chantiersAvecSolde as c (c.id)}
						<a href="/chantiers/{c.id}/compta" class="carte-chantier">
							<div class="carte-entete">
								<span class="numero">{c.numero}</span>
								<span class="badge-statut statut-{c.statut}">{c.statut.replace('_', ' ')}</span>
							</div>
							<h3>{c.titre}</h3>
							{#if c.chef}
								<p class="chef">Chef : {nomComplet(c.chef)}</p>
							{/if}
							<div class="kpi-ligne">
								<div class="kpi-mini">
									<span class="kpi-mini-label">Budget reçu</span>
									<span class="kpi-mini-valeur">{formaterDh(c.budgetRecuCentimes)}</span>
								</div>
								<div class="kpi-mini">
									<span class="kpi-mini-label">Dépensé</span>
									<span class="kpi-mini-valeur">{formaterDh(c.totalDepenseCentimes)}</span>
								</div>
								<div class="kpi-mini" class:rouge={c.soldeRestantCentimes < 0}>
									<span class="kpi-mini-label">Solde</span>
									<span class="kpi-mini-valeur">{formaterDh(c.soldeRestantCentimes)}</span>
								</div>
							</div>
							{#if c.dominiqueMeDoitCentimes > 0}
								<p class="alerte-avance">⚠️ Avances Rachid non remboursées : {formaterDh(c.dominiqueMeDoitCentimes)}</p>
							{/if}
						</a>
					{/each}
				</div>
			{/if}
		</section>

		<!-- Paiements clients en attente -->
		<section class="section">
			<h2 class="section-titre">Paiements clients en attente</h2>
			{#if dashboard.paiementsClientsEnAttente.length === 0}
				<p class="texte-vide">Aucun paiement en attente.</p>
			{:else}
				<div class="liste-paiements">
					{#each dashboard.paiementsClientsEnAttente as p (p.id)}
						<div class="carte-paiement">
							<div class="paiement-entete">
								<span class="paiement-type">{p.type.replace('_', ' ')}</span>
								<span class="paiement-montant">{formaterDh(p.montantCentimes)}</span>
							</div>
							<p class="paiement-meta">
								{p.chantier.numero} — {p.chantier.titre}
								{#if p.chantier.client}
									· {nomComplet(p.chantier.client)}
								{/if}
							</p>
							{#if p.dateAttendue}
								<p class="paiement-date">Attendu le {formaterDate(p.dateAttendue)}</p>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<!-- Lien compta générale (placeholder) -->
		<section class="section">
			<a href="/compta/general" class="lien-secondaire">
				Compta générale analytique →
			</a>
		</section>

	{:else if $auth.utilisateur?.role === 'chef'}
		<!-- ====================================================== -->
		<!--                     VUE CHEF                            -->
		<!-- ====================================================== -->
		<section class="section">
			<p class="instruction">Sélectionne un chantier pour voir sa compta.</p>
			{#if mesChantiers.length === 0}
				<p class="texte-vide">Aucun chantier ne t'est attribué pour le moment.</p>
			{:else}
				<div class="liste-chantiers">
					{#each mesChantiers as c (c.id)}
						<a href="/chantiers/{c.id}/compta" class="carte-chantier">
							<div class="carte-entete">
								<span class="numero">{c.numero}</span>
								<span class="badge-statut statut-{c.statut}">{c.statut.replace('_', ' ')}</span>
							</div>
							<h3>{c.titre}</h3>
							<p class="adresse">{c.adresseChantier}</p>
						</a>
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

	.entete { margin-bottom: var(--esp-lg); }
	h1 { font-size: 24px; font-weight: 700; }
	.sous-titre { font-size: 14px; color: var(--couleur-texte-secondaire); margin-top: var(--esp-xs); }

	.section { margin-bottom: var(--esp-xl); }
	.section-titre {
		font-size: 15px;
		font-weight: 700;
		color: var(--couleur-texte);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin-bottom: var(--esp-md);
		display: flex;
		align-items: center;
		gap: var(--esp-sm);
	}

	.badge-titre {
		background: #b03a2e;
		color: white;
		font-size: 12px;
		font-weight: 700;
		padding: 2px 8px;
		border-radius: 10px;
		text-transform: none;
		letter-spacing: 0;
	}

	.section.a-valider .section-titre { color: #b03a2e; }

	.liste-depenses { display: flex; flex-direction: column; gap: var(--esp-sm); }

	.message-vide-positif {
		display: flex;
		align-items: center;
		gap: var(--esp-sm);
		padding: var(--esp-md);
		background: #e7f5ed;
		color: #2d7a4f;
		border: 1px solid #b6dec5;
		border-radius: var(--rayon-md);
		font-size: 14px;
		font-weight: 600;
	}

	/* KPI cumul */
	.carte-kpi {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--esp-md);
		background: var(--couleur-fond-carte);
		border: 1px solid var(--couleur-bordure);
		border-radius: var(--rayon-lg);
	}
	.carte-kpi.rouge { border-color: #e0a8a0; background: #fdf3f1; }
	.kpi-label { font-size: 14px; color: var(--couleur-texte-secondaire); }
	.kpi-valeur { font-size: 18px; font-weight: 700; color: var(--couleur-texte); }
	.carte-kpi.rouge .kpi-valeur { color: #b03a2e; }

	/* Liste chantiers */
	.liste-chantiers { display: flex; flex-direction: column; gap: var(--esp-md); }
	.carte-chantier {
		display: block;
		background: var(--couleur-fond-carte);
		border: 1px solid var(--couleur-bordure);
		border-radius: var(--rayon-lg);
		padding: var(--esp-md);
		text-decoration: none;
		color: inherit;
		transition: transform 0.1s;
	}
	.carte-chantier:active { transform: scale(0.99); }

	.carte-entete {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--esp-xs);
	}
	.numero { font-size: 12px; font-weight: 600; color: var(--couleur-texte-leger); letter-spacing: 0.04em; }
	.badge-statut {
		font-size: 10px;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 10px;
		text-transform: uppercase;
		color: white;
		background: #8a8a8a;
	}
	.badge-statut.statut-en_cours { background: #2d7a4f; }
	.badge-statut.statut-en_attente { background: #c97b2b; }
	.badge-statut.statut-pause { background: #b03a2e; }
	.carte-chantier h3 { font-size: 16px; font-weight: 600; margin-bottom: var(--esp-xs); }
	.chef, .adresse { font-size: 13px; color: var(--couleur-texte-secondaire); margin-bottom: var(--esp-sm); }

	.kpi-ligne {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--esp-sm);
		margin-top: var(--esp-sm);
	}
	.kpi-mini {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--esp-sm);
		background: var(--couleur-fond);
		border-radius: var(--rayon-sm);
	}
	.kpi-mini-label { font-size: 11px; color: var(--couleur-texte-leger); text-transform: uppercase; letter-spacing: 0.04em; }
	.kpi-mini-valeur { font-size: 14px; font-weight: 700; }
	.kpi-mini.rouge .kpi-mini-valeur { color: #b03a2e; }

	.alerte-avance {
		margin-top: var(--esp-sm);
		padding: var(--esp-sm);
		background: #fdf3f1;
		color: #b03a2e;
		border-radius: var(--rayon-sm);
		font-size: 13px;
		font-weight: 600;
	}

	/* Paiements */
	.liste-paiements { display: flex; flex-direction: column; gap: var(--esp-sm); }
	.carte-paiement {
		background: var(--couleur-fond-carte);
		border: 1px solid var(--couleur-bordure);
		border-radius: var(--rayon-md);
		padding: var(--esp-md);
	}
	.paiement-entete {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--esp-xs);
	}
	.paiement-type { font-size: 13px; font-weight: 600; text-transform: capitalize; }
	.paiement-montant { font-size: 16px; font-weight: 700; color: var(--couleur-primaire); }
	.paiement-meta { font-size: 12px; color: var(--couleur-texte-secondaire); }
	.paiement-date { font-size: 12px; color: var(--couleur-texte-leger); margin-top: 2px; }

	/* Divers */
	.instruction { font-size: 15px; color: var(--couleur-texte-secondaire); margin-bottom: var(--esp-md); }
	.texte-vide {
		font-size: 14px;
		color: var(--couleur-texte-leger);
		padding: var(--esp-md);
		background: var(--couleur-fond-carte);
		border: 1px dashed var(--couleur-bordure-forte);
		border-radius: var(--rayon-md);
		text-align: center;
	}

	.lien-secondaire {
		display: block;
		text-align: center;
		padding: var(--esp-md);
		font-size: 14px;
		color: var(--couleur-primaire);
		text-decoration: none;
		font-weight: 600;
		border: 1px dashed var(--couleur-bordure-forte);
		border-radius: var(--rayon-md);
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
