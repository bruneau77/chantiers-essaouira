<!--
  NouveauClientModale.svelte — modale de création rapide d'un client
  depuis un formulaire de création/édition de chantier.

  Props :
    - ouverte : booléen (contrôle l'affichage)
    - onCree(client) : callback appelé avec l'objet client créé après
                       enregistrement réussi (id, prenom, nom, role, ...)
    - onFermer() : callback appelé quand l'utilisateur ferme/annule

  Champs : prenom*, nom*, telephone, email (validé si présent), adresse, notes.
  Accessible aux ADMIN uniquement (le backend renverra 403 sinon).
-->
<script>
	import { apiAuth } from '$lib/stores/auth.js';

	let {
		ouverte = false,
		onCree = () => {},
		onFermer = () => {}
	} = $props();

	// État du formulaire — primitives uniquement (cf. règle Svelte 5
	// `state_referenced_locally` : ne pas référencer une prop dans un
	// initialiseur $state)
	let prenom = $state('');
	let nom = $state('');
	let telephone = $state('');
	let email = $state('');
	let adresse = $state('');
	let notes = $state('');

	let envoiEnCours = $state(false);
	let erreur = $state('');

	function reinitialiser() {
		prenom = '';
		nom = '';
		telephone = '';
		email = '';
		adresse = '';
		notes = '';
		erreur = '';
		envoiEnCours = false;
	}

	function annuler() {
		reinitialiser();
		onFermer();
	}

	async function enregistrer() {
		erreur = '';

		if (!prenom.trim()) {
			erreur = 'Le prénom est requis.';
			return;
		}
		if (!nom.trim()) {
			erreur = 'Le nom est requis.';
			return;
		}

		// Validation email basique côté client (le backend re-valide)
		const emailNet = email.trim();
		if (emailNet && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNet)) {
			erreur = 'Email invalide.';
			return;
		}

		const corps = {
			prenom: prenom.trim(),
			nom: nom.trim(),
			telephone: telephone.trim() || null,
			email: emailNet || null,
			adresse: adresse.trim() || null,
			notes: notes.trim() || null
		};

		envoiEnCours = true;
		try {
			const res = await apiAuth('/api/clients', {
				method: 'POST',
				body: JSON.stringify(corps)
			});
			const payload = await res.json();

			if (!res.ok) {
				erreur = payload.message || 'Erreur lors de la création.';
				envoiEnCours = false;
				return;
			}

			// Succès → on remonte l'objet client au parent, qui s'occupera
			// de fermer la modale et sélectionner le client dans son dropdown.
			const clientCree = payload.data;
			reinitialiser();
			onCree(clientCree);
		} catch {
			erreur = 'Impossible de contacter le serveur.';
			envoiEnCours = false;
		}
	}

	// Fermeture sur ESC (UX clavier sur desktop)
	function onKeydown(e) {
		if (e.key === 'Escape' && ouverte && !envoiEnCours) {
			annuler();
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if ouverte}
	<!-- Voile + modale -->
	<div
		class="voile"
		onclick={annuler}
		onkeydown={(e) => { if (e.key === 'Enter') annuler(); }}
		role="button"
		tabindex="-1"
		aria-label="Fermer"
	></div>

	<div class="modale" role="dialog" aria-modal="true" aria-labelledby="titre-modale-client">
		<header class="entete">
			<h2 id="titre-modale-client">Nouveau client</h2>
			<button class="bouton-fermer" onclick={annuler} aria-label="Fermer" type="button">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		</header>

		<form class="formulaire" onsubmit={(e) => { e.preventDefault(); enregistrer(); }}>
			<div class="ligne-double">
				<label class="champ">
					<span class="label">Prénom *</span>
					<input type="text" bind:value={prenom} maxlength="100" required autofocus />
				</label>
				<label class="champ">
					<span class="label">Nom *</span>
					<input type="text" bind:value={nom} maxlength="100" required />
				</label>
			</div>

			<label class="champ">
				<span class="label">Téléphone</span>
				<input type="tel" bind:value={telephone} maxlength="50" placeholder="+212 6 ..." />
			</label>

			<label class="champ">
				<span class="label">Email</span>
				<input type="email" bind:value={email} placeholder="optionnel" />
			</label>

			<label class="champ">
				<span class="label">Adresse / Ville</span>
				<input type="text" bind:value={adresse} maxlength="500" placeholder="Ex : Ounara, Essaouira" />
			</label>

			<label class="champ">
				<span class="label">Notes</span>
				<textarea bind:value={notes} maxlength="5000" rows="3" placeholder="Notes internes…"></textarea>
			</label>

			{#if erreur}
				<p class="erreur">{erreur}</p>
			{/if}

			<div class="actions">
				<button type="button" class="bouton-secondaire" onclick={annuler} disabled={envoiEnCours}>
					Annuler
				</button>
				<button type="submit" class="bouton-principal" disabled={envoiEnCours}>
					{envoiEnCours ? 'Création…' : 'Créer le client'}
				</button>
			</div>
		</form>
	</div>
{/if}

<style>
	.voile {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 1000;
	}

	.modale {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: min(95vw, 480px);
		max-height: 90vh;
		overflow-y: auto;
		background: var(--couleur-fond-carte);
		border-radius: var(--rayon-lg);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
		z-index: 1001;
		display: flex;
		flex-direction: column;
	}

	.entete {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--esp-lg);
		border-bottom: 1px solid var(--couleur-bordure);
	}
	.entete h2 {
		font-size: 18px;
		font-weight: 700;
		margin: 0;
	}
	.bouton-fermer {
		background: transparent;
		border: none;
		padding: 4px;
		color: var(--couleur-texte-secondaire);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.bouton-fermer:hover { color: var(--couleur-texte); }

	.formulaire {
		display: flex;
		flex-direction: column;
		gap: var(--esp-md);
		padding: var(--esp-lg);
	}

	.ligne-double {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--esp-sm);
	}

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

	input[type="text"],
	input[type="tel"],
	input[type="email"],
	textarea {
		font-size: 16px;
		padding: 12px;
		border: 1.5px solid var(--couleur-bordure-forte);
		border-radius: var(--rayon-sm);
		background: var(--couleur-fond);
		color: var(--couleur-texte);
		width: 100%;
		font-family: inherit;
	}
	input:focus,
	textarea:focus {
		outline: none;
		border-color: var(--couleur-primaire);
	}
	textarea {
		resize: vertical;
		min-height: 60px;
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
		border: none;
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
</style>
