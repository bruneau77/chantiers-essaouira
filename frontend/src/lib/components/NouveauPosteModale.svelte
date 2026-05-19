<!--
  NouveauPosteModale.svelte — modale de création rapide d'un Poste
  depuis la fiche Lieu (admin uniquement).

  Props :
    - ouverte : booléen (contrôle l'affichage)
    - lieuId  : id du Lieu sur lequel créer le Poste
    - onCree(poste)  : callback appelé avec l'objet poste créé après
                       enregistrement réussi
    - onFermer()     : callback appelé quand l'utilisateur ferme/annule

  Champs : titre*, description, montantBrutCentimes, montantClientCentimes,
  statut (par défaut A_FAIRE).

  Accessible aux ADMIN uniquement (le backend renverra 403 sinon).
  Pattern identique à NouveauClientModale.
-->
<script>
	import { apiAuth } from '$lib/stores/auth.js';

	let {
		ouverte = false,
		lieuId = null,
		onCree = () => {},
		onFermer = () => {}
	} = $props();

	const STATUTS = [
		{ valeur: 'A_FAIRE', label: 'À faire' },
		{ valeur: 'EN_COURS', label: 'En cours' },
		{ valeur: 'TERMINE', label: 'Terminé' }
	];

	let titre = $state('');
	let description = $state('');
	let montantBrutDh = $state('');
	let montantClientDh = $state('');
	let statut = $state('A_FAIRE');

	let envoiEnCours = $state(false);
	let erreur = $state('');

	function reinitialiser() {
		titre = '';
		description = '';
		montantBrutDh = '';
		montantClientDh = '';
		statut = 'A_FAIRE';
		erreur = '';
		envoiEnCours = false;
	}

	function annuler() {
		reinitialiser();
		onFermer();
	}

	// Aperçu de la marge en temps réel (info, pas envoyé au backend
	// puisque le backend la recalcule).
	let margeApercu = $derived.by(() => {
		const brut = Number(montantBrutDh);
		const client = Number(montantClientDh);
		if (!Number.isFinite(brut) || !Number.isFinite(client) || brut <= 0) return null;
		const marge = client - brut;
		const pct = (marge / brut) * 100;
		return { marge, pct: pct.toFixed(1) };
	});

	function formaterDh(n) {
		if (!Number.isFinite(n)) return '—';
		return Math.round(n).toLocaleString('fr-FR').replace(/,/g, ' ') + ' DH';
	}

	async function enregistrer() {
		erreur = '';

		if (!titre.trim()) {
			erreur = 'Le titre est requis.';
			return;
		}

		const brut = Number(montantBrutDh);
		const client = Number(montantClientDh);
		if (montantBrutDh !== '' && (!Number.isFinite(brut) || brut < 0)) {
			erreur = 'Le montant brut doit être un nombre positif.';
			return;
		}
		if (montantClientDh !== '' && (!Number.isFinite(client) || client < 0)) {
			erreur = 'Le montant client doit être un nombre positif.';
			return;
		}

		const corps = {
			lieuId,
			titre: titre.trim(),
			description: description.trim() || null,
			statut,
			montantBrutCentimes: Number.isFinite(brut) ? Math.round(brut * 100) : 0,
			montantClientCentimes: Number.isFinite(client) ? Math.round(client * 100) : 0
		};

		envoiEnCours = true;
		try {
			const res = await apiAuth('/api/postes', {
				method: 'POST',
				body: JSON.stringify(corps)
			});
			const payload = await res.json();

			if (!res.ok) {
				erreur = payload.message || 'Erreur lors de la création.';
				envoiEnCours = false;
				return;
			}

			const posteCree = payload.data;
			reinitialiser();
			onCree(posteCree);
		} catch {
			erreur = 'Impossible de contacter le serveur.';
			envoiEnCours = false;
		}
	}
</script>

{#if ouverte}
	<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="titre-modale">
		<div class="modale">
			<header class="entete">
				<h2 id="titre-modale">Nouveau poste</h2>
				<button type="button" class="fermer" onclick={annuler} aria-label="Fermer">×</button>
			</header>

			<form class="formulaire" onsubmit={(e) => { e.preventDefault(); enregistrer(); }}>
				<label class="champ">
					<span class="label">Titre *</span>
					<input
						type="text"
						bind:value={titre}
						placeholder="Ex: Réfection toiture, 3 tables marbre, contrôle piscine..."
						maxlength="200"
						required
					/>
				</label>

				<label class="champ">
					<span class="label">Description</span>
					<textarea
						bind:value={description}
						placeholder="Détails optionnels"
						rows="3"
						maxlength="2000"
					></textarea>
				</label>

				<div class="ligne-deux">
					<label class="champ">
						<span class="label">Montant brut (DH)</span>
						<input
							type="number"
							inputmode="decimal"
							min="0"
							step="0.01"
							bind:value={montantBrutDh}
							placeholder="0"
						/>
					</label>
					<label class="champ">
						<span class="label">Montant client (DH)</span>
						<input
							type="number"
							inputmode="decimal"
							min="0"
							step="0.01"
							bind:value={montantClientDh}
							placeholder="0"
						/>
					</label>
				</div>

				{#if margeApercu}
					<div class="apercu-marge">
						Marge estimée : <strong>{formaterDh(margeApercu.marge)}</strong>
						(<strong>{margeApercu.pct}%</strong>)
					</div>
				{/if}

				<fieldset class="boutons-statut">
					<legend>Statut initial</legend>
					{#each STATUTS as s (s.valeur)}
						<button
							type="button"
							class="bouton-statut"
							class:actif={statut === s.valeur}
							onclick={() => (statut = s.valeur)}
						>
							{s.label}
						</button>
					{/each}
				</fieldset>

				{#if erreur}
					<p class="erreur">{erreur}</p>
				{/if}

				<div class="actions">
					<button type="button" class="bouton-secondaire" onclick={annuler} disabled={envoiEnCours}>
						Annuler
					</button>
					<button type="submit" class="bouton-primaire" disabled={envoiEnCours}>
						{envoiEnCours ? 'Création…' : 'Créer le poste'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: flex-end;
		justify-content: center;
		z-index: 200;
		padding: 0;
	}

	.modale {
		background: var(--couleur-fond-carte);
		border-radius: var(--rayon-lg) var(--rayon-lg) 0 0;
		width: 100%;
		max-width: 500px;
		max-height: 92dvh;
		display: flex;
		flex-direction: column;
		padding-bottom: var(--safe-bas);
		box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.2);
	}

	.entete {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--esp-lg);
		border-bottom: 1px solid var(--couleur-bordure);
	}

	.entete h2 {
		font-size: 20px;
		font-weight: 700;
	}

	.fermer {
		background: transparent;
		font-size: 32px;
		line-height: 1;
		color: var(--couleur-texte-secondaire);
		padding: 0 var(--esp-sm);
	}

	.formulaire {
		padding: var(--esp-lg);
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: var(--esp-md);
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
	.champ textarea:focus {
		outline: none;
		border-color: var(--couleur-primaire);
	}

	.ligne-deux {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--esp-sm);
	}

	.apercu-marge {
		padding: var(--esp-sm) var(--esp-md);
		background: var(--couleur-primaire-clair);
		border-radius: var(--rayon-md);
		font-size: 14px;
		color: var(--couleur-primaire);
	}

	.boutons-statut {
		border: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--esp-xs);
	}

	.boutons-statut legend {
		font-size: 13px;
		font-weight: 600;
		color: var(--couleur-texte-secondaire);
		margin-bottom: var(--esp-xs);
	}

	.bouton-statut {
		padding: var(--esp-sm) var(--esp-md);
		border: 1.5px solid var(--couleur-bordure-forte);
		background: var(--couleur-fond);
		border-radius: var(--rayon-md);
		font-size: 14px;
		font-weight: 500;
		color: var(--couleur-texte-secondaire);
	}

	.bouton-statut.actif {
		border-color: var(--couleur-primaire);
		background: var(--couleur-primaire);
		color: white;
	}

	.boutons-statut {
		display: flex;
		flex-direction: row;
		gap: var(--esp-sm);
	}

	.boutons-statut .bouton-statut {
		flex: 1;
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
</style>
