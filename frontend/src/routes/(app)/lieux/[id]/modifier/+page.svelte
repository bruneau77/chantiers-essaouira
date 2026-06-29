<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { auth, apiAuth } from '$lib/stores/auth.js';
	import { nomComplet } from '$lib/utils/nom.js';

	const STATUTS_LIEU = {
		PROSPECT: 'Prospect',
		EN_COURS: 'En cours',
		TERMINE: 'Terminé'
	};

	const id = $derived(parseInt($page.params.id, 10));
	const estAdmin = $derived($auth.utilisateur?.role === 'admin');

	// Champs modifiables
	let nom = $state('');
	let adresse = $state('');
	let chefId = $state('');
	let distanceAllerKm = $state('');
	let nombreAllerRetourPrevu = $state('');
	let budgetEstimatifDh = $state('');
	let notes = $state('');

	// Champs lecture seule (affichés mais non modifiables)
	let reference = $state('');
	let clientLabel = $state('');
	let statut = $state('');
	let fraisEssenceCentimes = $state(null);

	let utilisateurs = $state([]);
	let chargement = $state(true);
	let enCours = $state(false);
	let erreur = $state('');

	let chefs = $derived(utilisateurs.filter((u) => ['chef', 'admin'].includes(u.role)));

	function formaterDh(centimes) {
		if (centimes === null || centimes === undefined) return '—';
		const dh = Math.round(centimes / 100);
		return dh.toLocaleString('fr-FR').replace(/,/g, ' ') + ' DH';
	}

	async function chargerDonnees() {
		chargement = true;
		erreur = '';
		try {
			const [resLieu, resUsers] = await Promise.all([
				apiAuth(`/api/lieux/${id}`),
				apiAuth('/api/users')
			]);

			if (!resLieu.ok) {
				const p = await resLieu.json();
				erreur = p.message || 'Lieu introuvable.';
				return;
			}

			const lieu = (await resLieu.json()).data;
			if (resUsers.ok) {
				utilisateurs = (await resUsers.json()).data ?? [];
			}

			// Pré-remplissage des champs modifiables
			nom = lieu.nom ?? '';
			adresse = lieu.adresse ?? '';
			chefId = lieu.chefId != null ? String(lieu.chefId) : (lieu.chef?.id != null ? String(lieu.chef.id) : '');
			distanceAllerKm = lieu.distanceAllerKm != null ? String(lieu.distanceAllerKm) : '';
			nombreAllerRetourPrevu = lieu.nombreAllerRetourPrevu != null ? String(lieu.nombreAllerRetourPrevu) : '';
			budgetEstimatifDh = lieu.budgetEstimatifCentimes != null ? String(lieu.budgetEstimatifCentimes / 100) : '';
			notes = lieu.notes ?? '';

			// Champs lecture seule
			reference = lieu.reference ?? '';
			clientLabel = lieu.client ? nomComplet(lieu.client) : '—';
			statut = lieu.statut ?? '';
			fraisEssenceCentimes = lieu.fraisEssenceCentimes ?? null;
		} catch {
			erreur = 'Impossible de contacter le serveur.';
		} finally {
			chargement = false;
		}
	}

	onMount(() => {
		if (!estAdmin) {
			goto(`/lieux/${id}`);
			return;
		}
		chargerDonnees();
	});

	async function enregistrer() {
		erreur = '';

		if (!nom.trim()) { erreur = 'Le nom du lieu est requis.'; return; }
		if (!adresse.trim()) { erreur = 'L\'adresse est requise.'; return; }

		enCours = true;

		try {
			const body = {
				nom: nom.trim(),
				adresse: adresse.trim(),
				notes: notes.trim()
			};

			body.chefId = chefId ? parseInt(chefId, 10) : null;

			const dist = parseInt(distanceAllerKm, 10);
			body.distanceAllerKm = !isNaN(dist) && dist > 0 ? dist : null;

			const ar = parseInt(nombreAllerRetourPrevu, 10);
			body.nombreAllerRetourPrevu = !isNaN(ar) && ar > 0 ? ar : null;

			const budget = Number(budgetEstimatifDh);
			body.budgetEstimatifCentimes =
				Number.isFinite(budget) && budget > 0 ? Math.round(budget * 100) : null;

			const res = await apiAuth(`/api/lieux/${id}`, {
				method: 'PUT',
				body: JSON.stringify(body)
			});

			const payload = await res.json();

			if (!res.ok) {
				erreur = payload.message || 'Erreur lors de l\'enregistrement.';
				return;
			}

			goto(`/lieux/${id}`);
		} catch {
			erreur = 'Impossible de contacter le serveur.';
		} finally {
			enCours = false;
		}
	}
</script>

<svelte:head>
	<title>Modifier le lieu — Ludimmo</title>
</svelte:head>

<div class="page">
	<button class="bouton-retour" onclick={() => goto(`/lieux/${id}`)}>
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M19 12H5M12 19l-7-7 7-7" />
		</svg>
		Fiche du lieu
	</button>

	<header class="entete">
		<h1>Modifier le lieu</h1>
	</header>

	{#if chargement}
		<div class="etat-central"><div class="spinner"></div></div>
	{:else}
		<form class="formulaire" onsubmit={(e) => { e.preventDefault(); enregistrer(); }}>
			<!-- Champs non modifiables -->
			<div class="bloc-lecture">
				<div class="info-ligne">
					<span class="info-label">Référence</span>
					<span class="info-valeur">{reference || '—'}</span>
				</div>
				<div class="info-ligne">
					<span class="info-label">Client</span>
					<span class="info-valeur">{clientLabel}</span>
				</div>
				<div class="info-ligne">
					<span class="info-label">Statut</span>
					<span class="info-valeur">{STATUTS_LIEU[statut] ?? statut ?? '—'}</span>
				</div>
				<div class="info-ligne">
					<span class="info-label">Frais essence estimés</span>
					<span class="info-valeur">{formaterDh(fraisEssenceCentimes)}</span>
				</div>
				<p class="note-lecture">Ces champs sont gérés automatiquement et ne sont pas modifiables ici.</p>
			</div>

			<!-- Champs modifiables -->
			<label class="champ">
				<span class="label">Nom du lieu *</span>
				<input type="text" bind:value={nom} placeholder="Ex: Villa Pierre-Yves, Riad Médina…" maxlength="200" required />
			</label>

			<label class="champ">
				<span class="label">Adresse *</span>
				<input type="text" bind:value={adresse} placeholder="Adresse précise" maxlength="500" required />
			</label>

			<label class="champ">
				<span class="label">Chef de chantier</span>
				<select bind:value={chefId}>
					<option value="">— Aucun —</option>
					{#each chefs as ch (ch.id)}
						<option value={String(ch.id)}>{nomComplet(ch)}</option>
					{/each}
				</select>
			</label>

			<div class="ligne-deux">
				<label class="champ">
					<span class="label">Distance aller (km)</span>
					<input type="number" inputmode="numeric" min="0" bind:value={distanceAllerKm} placeholder="0" />
				</label>
				<label class="champ">
					<span class="label">A/R prévus</span>
					<input type="number" inputmode="numeric" min="0" bind:value={nombreAllerRetourPrevu} placeholder="0" />
				</label>
			</div>

			<label class="champ">
				<span class="label">Budget estimatif (DH)</span>
				<input type="number" inputmode="decimal" min="0" step="0.01" bind:value={budgetEstimatifDh} placeholder="0" />
			</label>

			<label class="champ">
				<span class="label">Notes</span>
				<textarea bind:value={notes} rows="3" maxlength="5000" placeholder="Détails libres"></textarea>
			</label>

			{#if erreur}
				<p class="erreur">{erreur}</p>
			{/if}

			<div class="actions">
				<button type="button" class="bouton-secondaire" onclick={() => goto(`/lieux/${id}`)} disabled={enCours}>
					Annuler
				</button>
				<button type="submit" class="bouton-primaire" disabled={enCours}>
					{enCours ? 'Enregistrement…' : 'Enregistrer'}
				</button>
			</div>
		</form>
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
	h1 { font-size: 24px; font-weight: 700; }

	.formulaire {
		display: flex;
		flex-direction: column;
		gap: var(--esp-md);
	}

	.bloc-lecture {
		background: var(--couleur-fond-carte);
		border: 1px solid var(--couleur-bordure);
		border-radius: var(--rayon-md);
		padding: var(--esp-md);
		opacity: 0.7;
	}
	.info-ligne {
		display: flex;
		justify-content: space-between;
		padding: var(--esp-xs) 0;
		gap: var(--esp-md);
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
	.note-lecture {
		font-size: 12px;
		font-style: italic;
		color: var(--couleur-texte-leger);
		margin-top: var(--esp-sm);
	}

	.champ {
		display: flex;
		flex-direction: column;
		gap: var(--esp-xs);
	}

	.label {
		font-size: 13px;
		font-weight: 600;
		color: var(--couleur-texte-secondaire);
	}

	.champ input,
	.champ select,
	.champ textarea {
		padding: var(--esp-md);
		border: 1px solid var(--couleur-bordure-forte);
		border-radius: var(--rayon-md);
		font-size: 16px;
		background: var(--couleur-fond);
		min-height: var(--taille-tactile);
		font-family: inherit;
	}

	.champ input:focus,
	.champ select:focus,
	.champ textarea:focus {
		outline: none;
		border-color: var(--couleur-primaire);
	}

	.ligne-deux {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--esp-sm);
	}

	.erreur {
		color: var(--couleur-erreur);
		font-size: 14px;
		padding: var(--esp-sm);
		background: rgba(176, 58, 46, 0.08);
		border-radius: var(--rayon-md);
	}

	.actions {
		display: flex;
		gap: var(--esp-sm);
		margin-top: var(--esp-md);
	}

	.bouton-primaire,
	.bouton-secondaire {
		flex: 1;
		padding: var(--esp-md);
		border-radius: var(--rayon-md);
		font-size: 15px;
		font-weight: 600;
		min-height: var(--taille-tactile);
	}

	.bouton-primaire {
		background: var(--couleur-primaire);
		color: white;
	}

	.bouton-primaire:disabled {
		opacity: 0.6;
	}

	.bouton-secondaire {
		background: transparent;
		color: var(--couleur-texte-secondaire);
		border: 1.5px solid var(--couleur-bordure-forte);
	}

	.etat-central {
		display: flex;
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
</style>
