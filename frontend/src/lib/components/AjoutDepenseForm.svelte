<script>
	import { onMount } from 'svelte';
	import { apiAuth } from '$lib/stores/auth.js';

	// Refonte 2026-05-18 :
	//   - prop renommée : chantierId → lieuId
	//   - nouveau prop optionnel posteIdInitial : pré-sélectionne le Poste
	//     quand le formulaire est ouvert depuis une fiche Poste
	//   - chargement de la liste des Postes du Lieu (sans montants pour
	//     le chef — déjà strippés côté API)
	//   - nouveau champ fournisseur (texte libre)
	let {
		lieuId,
		posteIdInitial = null,
		depenseExistante = null, // si fourni → mode édition
		onTermine = () => {},     // callback(success: bool)
		onAnnule = () => {}
	} = $props();

	const CATEGORIES = [
		{ valeur: 'ACOMPTE', label: 'Acompte', descriptionDefaut: 'Acompte ouvrier' },
		{ valeur: 'MATERIEL', label: 'Matériel', descriptionDefaut: 'Petit matériel chantier' },
		{ valeur: 'REPAS', label: 'Repas', descriptionDefaut: 'Repas équipe' }
	];

	const enEdition = !!depenseExistante;

	// État du formulaire — primitives uniquement (règle Svelte 5 :
	// ne pas référencer un prop dans un initialiseur $state)
	let categorie = $state('ACOMPTE');
	let date = $state(new Date().toISOString().slice(0, 10));
	let montantDh = $state('');
	let description = $state('Acompte ouvrier');
	let fournisseur = $state('');
	let posteId = $state('');
	let estAvancePersonnelle = $state(false);

	// Chargement async de la liste des Postes pour le dropdown
	let postes = $state([]);
	let chargementPostes = $state(true);

	// Pré-remplissage en mode édition
	if (depenseExistante) {
		categorie = depenseExistante.categorie;
		date = new Date(depenseExistante.date).toISOString().slice(0, 10);
		montantDh = Math.round(depenseExistante.montantCentimes / 100).toString();
		description = depenseExistante.description;
		fournisseur = depenseExistante.fournisseur ?? '';
		posteId = depenseExistante.posteId ? String(depenseExistante.posteId) : '';
		estAvancePersonnelle = depenseExistante.estAvancePersonnelle ?? false;
	} else if (posteIdInitial) {
		posteId = String(posteIdInitial);
	}

	let envoiEnCours = $state(false);
	let erreur = $state('');

	const descriptionsDefaut = CATEGORIES.map((c) => c.descriptionDefaut);

	function choisirCategorie(cat) {
		const defaut = CATEGORIES.find((c) => c.valeur === cat).descriptionDefaut;
		if (description === '' || descriptionsDefaut.includes(description)) {
			description = defaut;
		}
		categorie = cat;
	}

	async function chargerPostes() {
		if (!lieuId) return;
		try {
			const res = await apiAuth(`/api/postes?lieuId=${lieuId}`);
			if (res.ok) {
				const payload = await res.json();
				postes = payload.data ?? [];
			}
		} catch {
			// silencieux : le dropdown reste vide, dépense sans poste reste possible
		} finally {
			chargementPostes = false;
		}
	}

	onMount(chargerPostes);

	async function enregistrer() {
		erreur = '';

		const montant = Number(montantDh);
		if (!Number.isFinite(montant) || montant <= 0) {
			erreur = 'Le montant doit être un nombre positif.';
			return;
		}
		if (!description.trim()) {
			erreur = 'La description est requise.';
			return;
		}

		const corps = {
			date: new Date(date + 'T12:00:00').toISOString(),
			categorie,
			montantCentimes: Math.round(montant * 100),
			description: description.trim(),
			fournisseur: fournisseur.trim() || null,
			posteId: posteId ? parseInt(posteId, 10) : null,
			estAvancePersonnelle
		};

		envoiEnCours = true;
		try {
			let res;
			if (enEdition) {
				res = await apiAuth(`/api/depenses/${depenseExistante.id}`, {
					method: 'PATCH',
					body: JSON.stringify(corps)
				});
			} else {
				res = await apiAuth('/api/depenses', {
					method: 'POST',
					body: JSON.stringify({ ...corps, lieuId })
				});
			}

			if (!res.ok) {
				const payload = await res.json();
				erreur = payload.message || 'Erreur lors de l\'enregistrement.';
				return;
			}

			onTermine(true);
		} catch {
			erreur = 'Impossible de contacter le serveur.';
		} finally {
			envoiEnCours = false;
		}
	}
</script>

<form class="formulaire" onsubmit={(e) => { e.preventDefault(); enregistrer(); }}>
	<h3 class="titre">{enEdition ? 'Modifier la dépense' : 'Nouvelle dépense'}</h3>

	<div class="boutons-categorie">
		{#each CATEGORIES as cat (cat.valeur)}
			<button
				type="button"
				class="bouton-cat cat-{cat.valeur}"
				class:actif={categorie === cat.valeur}
				onclick={() => choisirCategorie(cat.valeur)}
			>
				{cat.label}
			</button>
		{/each}
	</div>

	<label class="champ">
		<span class="label">Date</span>
		<input type="date" bind:value={date} required />
	</label>

	<label class="champ">
		<span class="label">Montant (DH)</span>
		<input
			type="number"
			inputmode="decimal"
			min="0.01"
			step="0.01"
			bind:value={montantDh}
			placeholder="0"
			required
		/>
	</label>

	<label class="champ">
		<span class="label">Description</span>
		<input type="text" bind:value={description} maxlength="500" required />
	</label>

	<label class="champ">
		<span class="label">Fournisseur (optionnel)</span>
		<input
			type="text"
			bind:value={fournisseur}
			placeholder="Ex: Hassan menuisier, distributeur ciment…"
			maxlength="200"
		/>
	</label>

	<label class="champ">
		<span class="label">Affecter à un poste (optionnel)</span>
		<select bind:value={posteId} disabled={chargementPostes}>
			<option value="">— Aucun (dépense globale au lieu) —</option>
			{#each postes as p (p.id)}
				<option value={String(p.id)}>{p.titre} ({p.statut})</option>
			{/each}
		</select>
	</label>

	<label class="case-cochee">
		<input type="checkbox" bind:checked={estAvancePersonnelle} />
		<span>Avance personnelle (à rembourser par Dominique)</span>
	</label>

	{#if erreur}
		<p class="erreur">{erreur}</p>
	{/if}

	<div class="actions">
		<button type="button" class="bouton-secondaire" onclick={onAnnule} disabled={envoiEnCours}>
			Annuler
		</button>
		<button type="submit" class="bouton-primaire" disabled={envoiEnCours}>
			{envoiEnCours ? 'Envoi…' : enEdition ? 'Enregistrer' : 'Ajouter'}
		</button>
	</div>
</form>

<style>
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: var(--esp-md);
	}

	.titre {
		font-size: 18px;
		font-weight: 700;
		margin-bottom: var(--esp-xs);
	}

	.boutons-categorie {
		display: flex;
		gap: var(--esp-sm);
	}

	.bouton-cat {
		flex: 1;
		padding: var(--esp-sm) var(--esp-md);
		border: 1.5px solid var(--couleur-bordure-forte);
		background: var(--couleur-fond);
		border-radius: var(--rayon-md);
		font-size: 14px;
		font-weight: 500;
		color: var(--couleur-texte-secondaire);
	}

	.bouton-cat.actif {
		border-color: var(--couleur-primaire);
		background: var(--couleur-primaire);
		color: white;
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
	.champ select {
		padding: var(--esp-md);
		border: 1px solid var(--couleur-bordure-forte);
		border-radius: var(--rayon-md);
		font-size: 16px;
		background: var(--couleur-fond);
		min-height: var(--taille-tactile);
		font-family: inherit;
	}

	.champ input:focus,
	.champ select:focus {
		outline: none;
		border-color: var(--couleur-primaire);
	}

	.case-cochee {
		display: flex;
		align-items: center;
		gap: var(--esp-sm);
		font-size: 14px;
		color: var(--couleur-texte-secondaire);
		padding: var(--esp-sm) 0;
	}

	.case-cochee input {
		width: 20px;
		height: 20px;
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
		margin-top: var(--esp-sm);
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
</style>
