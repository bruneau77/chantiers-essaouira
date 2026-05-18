<script>
	import { apiAuth } from '$lib/stores/auth.js';

	let {
		chantierId,
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

	// État du formulaire
	// IMPORTANT Svelte 5 : ne PAS référencer un prop directement dans un
	// initialiseur $state(...) — ça déclenche le warning state_referenced_locally
	// et casse la réactivité du binding (bind:checked notamment).
	// On initialise avec des primitives, puis on charge les valeurs depuis
	// la prop dans un bloc d'init exécuté une seule fois au montage.
	let categorie = $state('ACOMPTE');
	let date = $state(new Date().toISOString().slice(0, 10));
	let montantDh = $state('');
	let description = $state('Acompte ouvrier');
	let estAvancePersonnelle = $state(false);

	if (depenseExistante) {
		categorie = depenseExistante.categorie;
		date = new Date(depenseExistante.date).toISOString().slice(0, 10);
		montantDh = Math.round(depenseExistante.montantCentimes / 100).toString();
		description = depenseExistante.description;
		estAvancePersonnelle = depenseExistante.estAvancePersonnelle ?? false;
	}

	let envoiEnCours = $state(false);
	let erreur = $state('');

	// Quand on clique sur un bouton catégorie : pré-remplir description si vide ou égale à
	// la description par défaut d'une autre catégorie (pour ne pas écraser une saisie volontaire)
	const descriptionsDefaut = CATEGORIES.map((c) => c.descriptionDefaut);

	function choisirCategorie(cat) {
		const defaut = CATEGORIES.find((c) => c.valeur === cat).descriptionDefaut;
		if (description === '' || descriptionsDefaut.includes(description)) {
			description = defaut;
		}
		categorie = cat;
	}

	async function enregistrer() {
		erreur = '';

		// Validation côté client
		// `<input type="number">` renvoie déjà un Number ou '' via bind:value.
		// On normalise via Number() pour gérer string ET number sans planter.
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
					body: JSON.stringify({ ...corps, chantierId })
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

	<!-- Boutons rapides catégorie -->
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

	<!-- Date -->
	<label class="champ">
		<span class="label">Date</span>
		<input type="date" bind:value={date} required />
	</label>

	<!-- Montant -->
	<label class="champ">
		<span class="label">Montant</span>
		<div class="champ-monnaie">
			<input
				type="number"
				inputmode="decimal"
				step="1"
				min="0"
				bind:value={montantDh}
				placeholder="0"
				required
			/>
			<span class="suffixe">DH</span>
		</div>
	</label>

	<!-- Description -->
	<label class="champ">
		<span class="label">Description</span>
		<input
			type="text"
			bind:value={description}
			maxlength="500"
			required
		/>
	</label>

	<!-- Avance perso -->
	<label class="case-cocher">
		<input type="checkbox" bind:checked={estAvancePersonnelle} />
		<span>Avance personnelle (à me rembourser)</span>
	</label>

	{#if erreur}
		<p class="erreur">{erreur}</p>
	{/if}

	<div class="actions">
		{#if enEdition}
			<button type="button" class="bouton-secondaire" onclick={onAnnule} disabled={envoiEnCours}>
				Annuler
			</button>
		{/if}
		<button type="submit" class="bouton-principal" disabled={envoiEnCours}>
			{envoiEnCours ? 'Enregistrement…' : enEdition ? 'Enregistrer' : 'Ajouter la dépense'}
		</button>
	</div>
</form>

<style>
	.formulaire {
		display: flex;
		flex-direction: column;
		gap: var(--esp-md);
		background: var(--couleur-fond-carte);
		border: 1px solid var(--couleur-bordure);
		border-radius: var(--rayon-lg);
		padding: var(--esp-md);
	}

	.titre {
		font-size: 16px;
		font-weight: 700;
		margin-bottom: var(--esp-xs);
	}

	.boutons-categorie {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--esp-sm);
	}
	.bouton-cat {
		padding: var(--esp-md) var(--esp-sm);
		border-radius: var(--rayon-md);
		font-size: 13px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--couleur-texte-secondaire);
		background: var(--couleur-fond);
		border: 1.5px solid var(--couleur-bordure);
		min-height: 48px;
	}
	.bouton-cat.actif.cat-ACOMPTE { background: #1e4d6b; color: white; border-color: #1e4d6b; }
	.bouton-cat.actif.cat-MATERIEL { background: #c8924a; color: white; border-color: #c8924a; }
	.bouton-cat.actif.cat-REPAS { background: #7a5a2b; color: white; border-color: #7a5a2b; }

	.champ {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.label {
		font-size: 12px;
		font-weight: 600;
		color: var(--couleur-texte-secondaire);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	input[type="date"],
	input[type="text"],
	input[type="number"] {
		font-size: 16px; /* éviter le zoom iOS */
		padding: 12px;
		border: 1.5px solid var(--couleur-bordure-forte);
		border-radius: var(--rayon-sm);
		background: var(--couleur-fond);
		color: var(--couleur-texte);
		width: 100%;
	}
	input:focus {
		outline: none;
		border-color: var(--couleur-primaire);
	}

	.champ-monnaie {
		position: relative;
		display: flex;
		align-items: center;
	}
	.champ-monnaie input { padding-right: 48px; }
	.suffixe {
		position: absolute;
		right: 12px;
		font-size: 14px;
		font-weight: 600;
		color: var(--couleur-texte-secondaire);
		pointer-events: none;
	}

	.case-cocher {
		display: flex;
		align-items: center;
		gap: var(--esp-sm);
		font-size: 14px;
		color: var(--couleur-texte);
		min-height: 44px;
	}
	.case-cocher input[type="checkbox"] {
		width: 20px;
		height: 20px;
		accent-color: var(--couleur-primaire);
	}

	.erreur {
		padding: var(--esp-sm);
		background: #fdf3f1;
		color: #b03a2e;
		border-radius: var(--rayon-sm);
		font-size: 13px;
	}

	.actions {
		display: flex;
		gap: var(--esp-sm);
		margin-top: var(--esp-sm);
	}

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
	.bouton-principal:active:not(:disabled) { opacity: 0.85; }

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
</style>
