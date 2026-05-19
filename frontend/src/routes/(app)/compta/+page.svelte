<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth, apiAuth } from '$lib/stores/auth.js';
	import DepenseRow from '$lib/components/DepenseRow.svelte';
	import { nomComplet } from '$lib/utils/nom.js';

	// Refonte 2026-05-18 : dashboard admin adapté
	//   - lieuxAvecSolde remplace chantiersAvecSolde
	//   - creancesARecouvrer (nouveau) remplace l'ancienne section
	//     "paiements clients en attente" qui s'appuyait sur l'échéancier
	//     30/40/30 supprimé. Liste les Postes TERMINE non intégralement
	//     payés, triés par termineLe asc.

	let chargement = $state(true);
	let erreur = $state('');

	let dashboard = $state(null);
	let mesLieux = $state([]);

	function formaterDh(c) {
		if (c === null || c === undefined) return '—';
		const dh = Math.round(c / 100);
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

	async function chargerMesLieux() {
		chargement = true;
		erreur = '';
		try {
			const res = await apiAuth('/api/lieux');
			if (!res.ok) {
				const payload = await res.json();
				erreur = payload.message || 'Erreur de chargement.';
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
			chargerDashboard();
		} else {
			chargerMesLieux();
		}
	});

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
		<div class="etat-central"><div class="spinner"></div></div>
	{:else if erreur}
		<div class="etat-central"><p class="erreur-message">{erreur}</p></div>
	{:else if $auth.utilisateur?.role === 'admin' && dashboard}
		<!-- VUE ADMIN -->

		<!-- À valider -->
		{#if dashboard.depensesAValider.length > 0}
			<section class="section a-valider">
				<h2 class="section-titre">
					À valider <span class="badge-titre">{dashboard.depensesAValider.length}</span>
				</h2>
				<div class="liste-depenses">
					{#each dashboard.depensesAValider as depense (depense.id)}
						<DepenseRow {depense} avecLieu={true} onChange={onDepenseChangee} />
					{/each}
				</div>
			</section>
		{/if}

		<!-- Créances à recouvrer -->
		{#if dashboard.creancesARecouvrer && dashboard.creancesARecouvrer.length > 0}
			<section class="section creances">
				<h2 class="section-titre">
					Créances à recouvrer <span class="badge-titre">{dashboard.creancesARecouvrer.length}</span>
				</h2>
				<p class="aide">Postes terminés dont le client n'a pas réglé l'intégralité.</p>
				<div class="liste-creances">
					{#each dashboard.creancesARecouvrer as c (c.poste.id)}
						<button
							class="ligne-creance"
							onclick={() => goto(`/lieux/${c.lieu.id}/postes/${c.poste.id}`)}
						>
							<div class="creance-haut">
								<span class="creance-lieu">{c.lieu.reference} — {c.lieu.nom}</span>
								<span class="creance-reste">{formaterDh(c.resteCentimes)}</span>
							</div>
							<p class="creance-poste">{c.poste.titre}</p>
							<p class="creance-meta">
								Payé {formaterDh(c.totalPayeCentimes)} / {formaterDh(c.montantClientCentimes)}
								· Terminé le {formaterDate(c.termineLe)}
							</p>
						</button>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Soldes par lieu -->
		{#if dashboard.lieuxAvecSolde && dashboard.lieuxAvecSolde.length > 0}
			<section class="section">
				<h2 class="section-titre">Soldes par lieu (en cours)</h2>
				<div class="liste-lieux">
					{#each dashboard.lieuxAvecSolde as l (l.id)}
						<button class="ligne-lieu" onclick={() => goto(`/lieux/${l.id}/compta`)}>
							<div class="lieu-haut">
								<span class="lieu-ref">{l.reference}</span>
								<span class="lieu-nom">{l.nom}</span>
							</div>
							{#if l.chef}
								<p class="lieu-chef">Chef : {nomComplet(l.chef)}</p>
							{/if}
							<div class="grille-mini">
								<div class="mini-stat">
									<span class="mini-label">Budget reçu</span>
									<span class="mini-valeur">{formaterDh(l.budgetRecuCentimes)}</span>
								</div>
								<div class="mini-stat">
									<span class="mini-label">Dépensé</span>
									<span class="mini-valeur depense">{formaterDh(l.totalDepenseCentimes)}</span>
								</div>
								<div class="mini-stat total" class:negatif={l.soldeRestantCentimes < 0}>
									<span class="mini-label">Solde</span>
									<span class="mini-valeur">{formaterDh(l.soldeRestantCentimes)}</span>
								</div>
							</div>
							{#if l.dominiqueMeDoitCentimes > 0}
								<p class="lieu-due">Dominique doit : <strong>{formaterDh(l.dominiqueMeDoitCentimes)}</strong></p>
							{/if}
						</button>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Avances totales cumulées -->
		{#if dashboard.totalAvancesNonRembourseesCentimes > 0}
			<section class="section avances-total">
				<h2 class="section-titre">Avances cumulées non remboursées</h2>
				<div class="carte-avance">
					<span class="avance-label">Total que Dominique doit à Rachid</span>
					<span class="avance-valeur">{formaterDh(dashboard.totalAvancesNonRembourseesCentimes)}</span>
				</div>
			</section>
		{/if}

		<section class="section">
			<a href="/compta/general" class="bouton-secondaire">Compta générale (à venir)</a>
		</section>
	{:else if $auth.utilisateur?.role === 'chef'}
		<!-- VUE CHEF -->
		{#if mesLieux.length === 0}
			<div class="message-vide"><p>Aucun lieu pour le moment.</p></div>
		{:else}
			<section class="section">
				<h2 class="section-titre">Mes lieux</h2>
				<div class="liste-lieux">
					{#each mesLieux as l (l.id)}
						<button class="ligne-lieu" onclick={() => goto(`/lieux/${l.id}/compta`)}>
							<div class="lieu-haut">
								<span class="lieu-ref">{l.reference}</span>
								<span class="lieu-nom">{l.nom}</span>
							</div>
							<p class="lieu-chef">Voir la compta du lieu →</p>
						</button>
					{/each}
				</div>
			</section>
		{/if}
	{/if}
</div>

<style>
	.page { padding: var(--esp-lg); padding-bottom: calc(var(--hauteur-nav) + var(--safe-bas) + var(--esp-xxl)); }

	.entete { margin-bottom: var(--esp-lg); }
	h1 { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; }
	.sous-titre { font-size: 14px; color: var(--couleur-texte-secondaire); margin-top: var(--esp-xs); }

	.section { margin-bottom: var(--esp-xl); }
	.section-titre {
		font-size: 14px; font-weight: 700; color: var(--couleur-texte-secondaire);
		text-transform: uppercase; letter-spacing: 0.05em;
		margin-bottom: var(--esp-sm);
		display: flex; align-items: center; gap: var(--esp-sm);
	}

	.badge-titre {
		background: var(--couleur-primaire); color: white;
		font-size: 11px; padding: 2px 8px; border-radius: 10px;
	}

	.a-valider .badge-titre { background: #c97b2b; }
	.creances .badge-titre { background: #b03a2e; }

	.aide {
		font-size: 13px; color: var(--couleur-texte-leger);
		margin-bottom: var(--esp-sm);
	}

	.liste-depenses, .liste-creances, .liste-lieux {
		display: flex; flex-direction: column; gap: var(--esp-sm);
	}

	.ligne-creance {
		display: block; width: 100%; text-align: left;
		background: var(--couleur-fond-carte); border: 1px solid var(--couleur-bordure);
		border-left: 4px solid #b03a2e;
		border-radius: var(--rayon-md); padding: var(--esp-md);
	}
	.creance-haut { display: flex; justify-content: space-between; align-items: baseline; }
	.creance-lieu { font-size: 12px; font-weight: 600; color: var(--couleur-texte-leger); letter-spacing: 0.04em; }
	.creance-reste { font-size: 18px; font-weight: 700; color: var(--couleur-erreur); }
	.creance-poste { font-size: 15px; font-weight: 600; color: var(--couleur-texte); margin: var(--esp-xs) 0; }
	.creance-meta { font-size: 12px; color: var(--couleur-texte-leger); }

	.ligne-lieu {
		display: block; width: 100%; text-align: left;
		background: var(--couleur-fond-carte); border: 1px solid var(--couleur-bordure);
		border-radius: var(--rayon-md); padding: var(--esp-md);
	}
	.lieu-haut { display: flex; gap: var(--esp-sm); align-items: baseline; margin-bottom: var(--esp-xs); }
	.lieu-ref { font-size: 12px; font-weight: 600; color: var(--couleur-texte-leger); letter-spacing: 0.04em; }
	.lieu-nom { font-size: 15px; font-weight: 600; color: var(--couleur-texte); }
	.lieu-chef { font-size: 13px; color: var(--couleur-texte-secondaire); margin-bottom: var(--esp-sm); }

	.grille-mini {
		display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--esp-xs);
		margin-top: var(--esp-sm);
	}
	.mini-stat {
		background: var(--couleur-fond); border-radius: var(--rayon-md);
		padding: var(--esp-sm); display: flex; flex-direction: column; gap: 2px;
	}
	.mini-stat.total { background: var(--couleur-primaire-clair); }
	.mini-stat.total.negatif { background: rgba(176, 58, 46, 0.08); }
	.mini-label { font-size: 10px; color: var(--couleur-texte-leger); text-transform: uppercase; letter-spacing: 0.04em; }
	.mini-valeur { font-size: 14px; font-weight: 700; color: var(--couleur-texte); }
	.mini-valeur.depense { color: #c97b2b; }

	.lieu-due {
		font-size: 13px; color: var(--couleur-erreur);
		margin-top: var(--esp-sm); padding-top: var(--esp-sm);
		border-top: 1px dashed var(--couleur-bordure);
	}

	.carte-avance {
		background: rgba(176, 58, 46, 0.08); border: 1px solid var(--couleur-erreur);
		border-radius: var(--rayon-md); padding: var(--esp-md);
		display: flex; flex-direction: column; gap: var(--esp-xs);
	}
	.avance-label { font-size: 12px; color: var(--couleur-erreur); text-transform: uppercase; letter-spacing: 0.04em; }
	.avance-valeur { font-size: 24px; font-weight: 700; color: var(--couleur-erreur); }

	.bouton-secondaire {
		display: block; padding: var(--esp-md);
		background: var(--couleur-fond-carte); border: 1.5px solid var(--couleur-bordure-forte);
		color: var(--couleur-texte-secondaire); border-radius: var(--rayon-md);
		font-weight: 600; text-align: center; text-decoration: none;
	}

	.message-vide {
		background: var(--couleur-fond-carte); border: 1px dashed var(--couleur-bordure-forte);
		border-radius: var(--rayon-lg); padding: var(--esp-xxl); text-align: center;
	}
	.message-vide p { font-size: 16px; color: var(--couleur-texte-secondaire); }

	.etat-central { display: flex; flex-direction: column; align-items: center; padding: var(--esp-xxl); }
	.spinner {
		width: 32px; height: 32px; border: 3px solid var(--couleur-bordure);
		border-top-color: var(--couleur-primaire); border-radius: 50%;
		animation: rotation 0.8s linear infinite;
	}
	@keyframes rotation { to { transform: rotate(360deg); } }
	.erreur-message { color: var(--couleur-erreur); font-size: 15px; text-align: center; }
</style>
