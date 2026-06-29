<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { auth, apiAuth } from '$lib/stores/auth.js';

	const lieuId = $derived(parseInt($page.params.id, 10));
	const posteId = $derived(parseInt($page.params.posteId, 10));
	const estAdmin = $derived($auth.utilisateur?.role === 'admin');

	const STATUTS_LIEU_POSTE = {
		A_FAIRE: 'À faire',
		EN_COURS: 'En cours',
		TERMINE: 'Terminé'
	};

	// Champs modifiables
	let titre = $state('');
	let description = $state('');
	let montantBrutDh = $state('');
	let montantClientDh = $state('');
	let ordre = $state('');

	// Champs lecture seule
	let statut = $state('');
	let termineLe = $state(null);
	let refLieu = $state('');

	let chargement = $state(true);
	let enCours = $state(false);
	let erreur = $state('');

	function formaterDh(c) {
		if (c === null || c === undefined) return '—';
		const dh = Math.round(c / 100);
		return dh.toLocaleString('fr-FR').replace(/,/g, ' ') + ' DH';
	}

	function formaterDate(s) {
		if (!s) return '—';
		return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
	}

	// Marge calculée en direct (aperçu, le backend recalcule la valeur finale)
	let margeCentimesPreview = $derived(
		Math.round((Number(montantClientDh) || 0) * 100) - Math.round((Number(montantBrutDh) || 0) * 100)
	);
	let margePourcentPreview = $derived(
		(Number(montantBrutDh) || 0) > 0
			? ((margeCentimesPreview / (Math.round((Number(montantBrutDh) || 0) * 100))) * 100).toFixed(2)
			: '0.00'
	);

	async function chargerPoste() {
		chargement = true;
		erreur = '';
		try {
			const res = await apiAuth(`/api/postes/${posteId}`);
			if (!res.ok) {
				const p = await res.json();
				erreur = p.message || 'Poste introuvable.';
				return;
			}
			const poste = (await res.json()).data;

			titre = poste.titre ?? '';
			description = poste.description ?? '';
			montantBrutDh = poste.montantBrutCentimes != null ? String(poste.montantBrutCentimes / 100) : '';
			montantClientDh = poste.montantClientCentimes != null ? String(poste.montantClientCentimes / 100) : '';
			ordre = poste.ordre != null ? String(poste.ordre) : '';

			statut = poste.statut ?? '';
			termineLe = poste.termineLe ?? null;
			refLieu = poste.lieu ? `${poste.lieu.reference} — ${poste.lieu.nom}` : '';
		} catch {
			erreur = 'Impossible de contacter le serveur.';
		} finally {
			chargement = false;
		}
	}

	onMount(() => {
		if (!estAdmin) {
			goto(`/lieux/${lieuId}/postes/${posteId}`);
			return;
		}
		chargerPoste();
	});

	async function enregistrer() {
		erreur = '';

		if (!titre.trim()) { erreur = 'Le titre est requis.'; return; }

		enCours = true;

		try {
			// .strict() côté backend : on n'envoie QUE les champs modifiables.
			const body = {
				titre: titre.trim(),
				description: description.trim() || null
			};

			const brut = Number(montantBrutDh);
			body.montantBrutCentimes = Number.isFinite(brut) && brut > 0 ? Math.round(brut * 100) : 0;

			const client = Number(montantClientDh);
			body.montantClientCentimes = Number.isFinite(client) && client > 0 ? Math.round(client * 100) : 0;

			const ord = parseInt(ordre, 10);
			if (!isNaN(ord) && ord >= 0) body.ordre = ord;

			const res = await apiAuth(`/api/postes/${posteId}`, {
				method: 'PATCH',
				body: JSON.stringify(body)
			});

			const payload = await res.json();

			if (!res.ok) {
				erreur = payload.message || 'Erreur lors de l\'enregistrement.';
				return;
			}

			goto(`/lieux/${lieuId}/postes/${posteId}`);
		} catch {
			erreur = 'Impossible de contacter le serveur.';
		} finally {
			enCours = false;
		}
	}
</script>

<svelte:head>
	<title>Modifier le poste — Ludimmo</title>
</svelte:head>

<div class="page">
	<button class="bouton-retour" onclick={() => goto(`/lieux/${lieuId}/postes/${posteId}`)}>
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M19 12H5M12 19l-7-7 7-7" />
		</svg>
		Fiche du poste
	</button>

	<header class="entete">
		<h1>Modifier le poste</h1>
		{#if refLieu}<p class="ref-lieu">{refLieu}</p>{/if}
	</header>

	{#if chargement}
		<div class="etat-central"><div class="spinner"></div></div>
	{:else}
		<form class="formulaire" onsubmit={(e) => { e.preventDefault(); enregistrer(); }}>
			<!-- Champs non modifiables -->
			<div class="bloc-lecture">
				<div class="info-ligne">
					<span class="info-label">Statut</span>
					<span class="info-valeur">{STATUTS_LIEU_POSTE[statut] ?? statut ?? '—'}</span>
				</div>
				<div class="info-ligne">
					<span class="info-label">Terminé le</span>
					<span class="info-valeur">{formaterDate(termineLe)}</span>
				</div>
				<p class="note-lecture">Le statut se modifie via les boutons de transition sur la fiche. La marge et la date de fin sont gérées automatiquement.</p>
			</div>

			<!-- Champs modifiables -->
			<label class="champ">
				<span class="label">Titre *</span>
				<input type="text" bind:value={titre} placeholder="Ex: Plomberie, Peinture…" maxlength="200" required />
			</label>

			<label class="champ">
				<span class="label">Description</span>
				<textarea bind:value={description} rows="3" maxlength="2000" placeholder="Détails de l'intervention"></textarea>
			</label>

			<div class="ligne-deux">
				<label class="champ">
					<span class="label">Coût brut (DH)</span>
					<input type="number" inputmode="decimal" min="0" step="0.01" bind:value={montantBrutDh} placeholder="0" />
				</label>
				<label class="champ">
					<span class="label">Prix client (DH)</span>
					<input type="number" inputmode="decimal" min="0" step="0.01" bind:value={montantClientDh} placeholder="0" />
				</label>
			</div>

			<!-- Aperçu marge (lecture seule, recalculée par le backend) -->
			<div class="apercu-marge">
				<span class="info-label">Marge (aperçu)</span>
				<span class="info-valeur">
					{formaterDh(margeCentimesPreview)}
					<span class="marge-pct">({margePourcentPreview}%)</span>
				</span>
			</div>

			<label class="champ">
				<span class="label">Ordre d'affichage (optionnel)</span>
				<input type="number" inputmode="numeric" min="0" bind:value={ordre} placeholder="0" />
			</label>

			{#if erreur}
				<p class="erreur">{erreur}</p>
			{/if}

			<div class="actions">
				<button type="button" class="bouton-secondaire" onclick={() => goto(`/lieux/${lieuId}/postes/${posteId}`)} disabled={enCours}>
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
		display: inline-flex; align-items: center; gap: var(--esp-xs);
		font-size: 14px; color: var(--couleur-primaire); font-weight: 500;
		margin-bottom: var(--esp-lg);
	}

	.entete { margin-bottom: var(--esp-lg); }
	h1 { font-size: 24px; font-weight: 700; }
	.ref-lieu { font-size: 13px; color: var(--couleur-texte-leger); margin-top: var(--esp-xs); }

	.formulaire { display: flex; flex-direction: column; gap: var(--esp-md); }

	.bloc-lecture {
		background: var(--couleur-fond-carte); border: 1px solid var(--couleur-bordure);
		border-radius: var(--rayon-md); padding: var(--esp-md); opacity: 0.7;
	}
	.info-ligne { display: flex; justify-content: space-between; padding: var(--esp-xs) 0; gap: var(--esp-md); }
	.info-label { font-size: 14px; color: var(--couleur-texte-secondaire); }
	.info-valeur { font-size: 14px; color: var(--couleur-texte); text-align: right; font-weight: 500; }
	.note-lecture { font-size: 12px; font-style: italic; color: var(--couleur-texte-leger); margin-top: var(--esp-sm); }

	.apercu-marge {
		display: flex; justify-content: space-between; align-items: baseline;
		background: var(--couleur-fond-carte); border: 1px solid var(--couleur-bordure);
		border-radius: var(--rayon-md); padding: var(--esp-md);
	}
	.marge-pct { font-size: 12px; font-weight: 400; color: var(--couleur-texte-leger); margin-left: var(--esp-xs); }

	.champ { display: flex; flex-direction: column; gap: var(--esp-xs); }
	.label { font-size: 13px; font-weight: 600; color: var(--couleur-texte-secondaire); }
	.champ input, .champ textarea {
		padding: var(--esp-md); border: 1px solid var(--couleur-bordure-forte);
		border-radius: var(--rayon-md); font-size: 16px; background: var(--couleur-fond);
		min-height: var(--taille-tactile); font-family: inherit;
	}
	.champ input:focus, .champ textarea:focus { outline: none; border-color: var(--couleur-primaire); }

	.ligne-deux { display: grid; grid-template-columns: 1fr 1fr; gap: var(--esp-sm); }

	.erreur {
		color: var(--couleur-erreur); font-size: 14px; padding: var(--esp-sm);
		background: rgba(176, 58, 46, 0.08); border-radius: var(--rayon-md);
	}

	.actions { display: flex; gap: var(--esp-sm); margin-top: var(--esp-md); }
	.bouton-primaire, .bouton-secondaire {
		flex: 1; padding: var(--esp-md); border-radius: var(--rayon-md);
		font-size: 15px; font-weight: 600; min-height: var(--taille-tactile);
	}
	.bouton-primaire { background: var(--couleur-primaire); color: white; }
	.bouton-primaire:disabled { opacity: 0.6; }
	.bouton-secondaire { background: transparent; color: var(--couleur-texte-secondaire); border: 1.5px solid var(--couleur-bordure-forte); }

	.etat-central { display: flex; align-items: center; justify-content: center; padding: var(--esp-xxl); }
	.spinner {
		width: 32px; height: 32px; border: 3px solid var(--couleur-bordure);
		border-top-color: var(--couleur-primaire); border-radius: 50%;
		animation: rotation 0.8s linear infinite;
	}
	@keyframes rotation { to { transform: rotate(360deg); } }
</style>
