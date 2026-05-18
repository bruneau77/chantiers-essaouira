<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth, apiAuth } from '$lib/stores/auth.js';
	import NouveauClientModale from '$lib/components/NouveauClientModale.svelte';
	import { nomComplet } from '$lib/utils/nom.js';

	// Sentinelle pour l'option "+ Nouveau client…" du <select>.
	// Quand `clientId` prend cette valeur, on intercepte côté `onchange`
	// pour ouvrir la modale plutôt que de soumettre.
	const SENTINEL_NOUVEAU_CLIENT = '__nouveau__';

	let titre = $state('');
	let adresseChantier = $state('');
	let description = $state('');
	let clientId = $state('');
	let chefId = $state('');
	let distanceAllerKm = $state('');
	let nombreAllerRetourPrevu = $state('');
	let notes = $state('');

	let utilisateurs = $state([]);
	let chargementUtilisateurs = $state(true);
	let enCours = $state(false);
	let erreur = $state('');

	let modaleClientOuverte = $state(false);

	// Charge les utilisateurs depuis l'API (remplace l'ancienne liste hardcodée).
	// Filtrage par rôle fait côté composant pour les dropdowns.
	async function chargerUtilisateurs() {
		chargementUtilisateurs = true;
		try {
			const res = await apiAuth('/api/users');
			if (!res.ok) {
				erreur = 'Impossible de charger la liste des utilisateurs.';
				return;
			}
			const payload = await res.json();
			utilisateurs = payload.data ?? [];
		} catch {
			erreur = 'Impossible de contacter le serveur.';
		} finally {
			chargementUtilisateurs = false;
		}
	}

	onMount(chargerUtilisateurs);

	let chefs = $derived(utilisateurs.filter((u) => ['chef', 'admin'].includes(u.role)));
	let clients = $derived(
		utilisateurs
			.filter((u) => u.role === 'client')
			.sort((a, b) => `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`, 'fr'))
	);

	const estAdmin = $derived($auth.utilisateur?.role === 'admin');

	// Intercepte le changement du <select> client : si valeur sentinelle,
	// on ouvre la modale et on remet le select sur "vide" pour ne pas
	// piéger une éventuelle soumission ultérieure.
	function onChangeClient(e) {
		const val = e.currentTarget.value;
		if (val === SENTINEL_NOUVEAU_CLIENT) {
			clientId = '';
			modaleClientOuverte = true;
		} else {
			clientId = val;
		}
	}

	// Callback de la modale après création réussie : on ajoute le client
	// à la liste locale (évite un re-fetch complet) et on le sélectionne.
	function onClientCree(nouveauClient) {
		utilisateurs = [...utilisateurs, nouveauClient];
		clientId = String(nouveauClient.id);
		modaleClientOuverte = false;
	}

	async function creerChantier() {
		erreur = '';

		if (!titre.trim()) { erreur = 'Le titre est requis.'; return; }
		if (!adresseChantier.trim()) { erreur = 'L\'adresse est requise.'; return; }
		if (!clientId) { erreur = 'Sélectionnez un client.'; return; }
		if (!chefId) { erreur = 'Sélectionnez un chef de chantier.'; return; }

		enCours = true;

		try {
			const body = {
				titre: titre.trim(),
				adresseChantier: adresseChantier.trim(),
				chefId: parseInt(chefId, 10),
				clientId: parseInt(clientId, 10),
			};

			if (description.trim()) body.description = description.trim();
			if (notes.trim()) body.notes = notes.trim();

			const dist = parseInt(distanceAllerKm, 10);
			if (!isNaN(dist) && dist > 0) body.distanceAllerKm = dist;

			const ar = parseInt(nombreAllerRetourPrevu, 10);
			if (!isNaN(ar) && ar > 0) body.nombreAllerRetourPrevu = ar;

			const res = await apiAuth('/api/chantiers', {
				method: 'POST',
				body: JSON.stringify(body),
			});

			const payload = await res.json();

			if (!res.ok) {
				erreur = payload.message || 'Erreur lors de la création.';
				return;
			}

			goto(`/chantiers/${payload.data.id}`);
		} catch {
			erreur = 'Impossible de contacter le serveur.';
		} finally {
			enCours = false;
		}
	}
</script>

<svelte:head>
	<title>Nouveau chantier — Ludimmo</title>
</svelte:head>

<div class="page">
	<header class="entete-page">
		<button class="bouton-retour" onclick={() => goto('/')}>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M19 12H5M12 19l-7-7 7-7" />
			</svg>
			Retour
		</button>
		<h1>Nouveau chantier</h1>
	</header>

	{#if erreur}
		<div class="alerte-erreur">{erreur}</div>
	{/if}

	<form class="formulaire" onsubmit={(e) => { e.preventDefault(); creerChantier(); }}>
		<!-- Titre -->
		<div class="champ">
			<label for="titre">Titre du chantier *</label>
			<input
				id="titre"
				type="text"
				bind:value={titre}
				placeholder="Ex : Réfection toiture Villa Laurent"
				required
			/>
		</div>

		<!-- Adresse -->
		<div class="champ">
			<label for="adresse">Adresse du chantier *</label>
			<input
				id="adresse"
				type="text"
				bind:value={adresseChantier}
				placeholder="Ex : 12 Derb Jdid, Médina, Essaouira"
				required
			/>
		</div>

		<!-- Description -->
		<div class="champ">
			<label for="description">Description</label>
			<textarea
				id="description"
				bind:value={description}
				placeholder="Détails du chantier…"
				rows="3"
			></textarea>
		</div>

		<!-- Client -->
		<div class="champ">
			<label for="client">Client *</label>
			<!-- Note : pas de bind:value, on utilise onchange pour intercepter
			     la valeur sentinelle. La valeur courante est portée par l'attribut
			     value={clientId}. -->
			<select id="client" value={clientId} onchange={onChangeClient} required disabled={chargementUtilisateurs}>
				<option value="">{chargementUtilisateurs ? 'Chargement…' : 'Choisir un client…'}</option>
				{#if estAdmin}
					<option value={SENTINEL_NOUVEAU_CLIENT}>+ Nouveau client…</option>
				{/if}
				{#each clients as c (c.id)}
					<option value={c.id}>{nomComplet(c)}</option>
				{/each}
			</select>
		</div>

		<!-- Chef de chantier -->
		<div class="champ">
			<label for="chef">Chef de chantier *</label>
			<select id="chef" bind:value={chefId} required disabled={chargementUtilisateurs}>
				<option value="">{chargementUtilisateurs ? 'Chargement…' : 'Choisir un chef…'}</option>
				{#each chefs as c (c.id)}
					<option value={c.id}>{nomComplet(c)} ({c.role})</option>
				{/each}
			</select>
		</div>

		<!-- Distance et A/R -->
		<div class="ligne-double">
			<div class="champ">
				<label for="distance">Distance aller (km)</label>
				<input
					id="distance"
					type="number"
					inputmode="numeric"
					bind:value={distanceAllerKm}
					placeholder="Ex : 8"
					min="0"
				/>
			</div>
			<div class="champ">
				<label for="ar">A/R prévus</label>
				<input
					id="ar"
					type="number"
					inputmode="numeric"
					bind:value={nombreAllerRetourPrevu}
					placeholder="Ex : 15"
					min="0"
				/>
			</div>
		</div>

		<!-- Notes -->
		<div class="champ">
			<label for="notes">Notes</label>
			<textarea
				id="notes"
				bind:value={notes}
				placeholder="Notes internes…"
				rows="2"
			></textarea>
		</div>

		<!-- Bouton soumettre -->
		<button type="submit" class="bouton-primaire" disabled={enCours}>
			{enCours ? 'Création en cours…' : 'Créer le chantier'}
		</button>
	</form>
</div>

<!-- Modale "Nouveau client" — admin only (le backend renverra 403 sinon) -->
<NouveauClientModale
	ouverte={modaleClientOuverte}
	onCree={onClientCree}
	onFermer={() => (modaleClientOuverte = false)}
/>

<style>
	.page { padding: var(--esp-lg); }

	.entete-page { margin-bottom: var(--esp-xl); }

	.bouton-retour {
		display: inline-flex;
		align-items: center;
		gap: var(--esp-xs);
		font-size: 14px;
		color: var(--couleur-primaire);
		font-weight: 500;
		margin-bottom: var(--esp-md);
	}

	h1 { font-size: 24px; font-weight: 700; }

	.alerte-erreur {
		background: var(--couleur-erreur-fond);
		color: var(--couleur-erreur);
		padding: var(--esp-md);
		border-radius: var(--rayon-md);
		font-size: 14px;
		font-weight: 500;
		margin-bottom: var(--esp-lg);
	}

	.formulaire {
		display: flex;
		flex-direction: column;
		gap: var(--esp-lg);
	}

	.champ {
		display: flex;
		flex-direction: column;
		gap: var(--esp-xs);
	}

	.champ label {
		font-size: 14px;
		font-weight: 600;
		color: var(--couleur-texte-secondaire);
	}

	.champ input,
	.champ textarea,
	.champ select {
		width: 100%;
		padding: var(--esp-md);
		background: var(--couleur-fond-carte);
		border: 1.5px solid var(--couleur-bordure);
		border-radius: var(--rayon-md);
		font-size: 16px;
		transition: border-color 0.15s;
	}

	.champ input:focus,
	.champ textarea:focus,
	.champ select:focus {
		outline: none;
		border-color: var(--couleur-primaire);
	}

	.champ textarea { resize: vertical; }

	.ligne-double {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--esp-md);
	}

	.bouton-primaire {
		padding: var(--esp-md);
		background: var(--couleur-primaire);
		color: white;
		font-weight: 700;
		font-size: 15px;
		border-radius: var(--rayon-md);
		min-height: var(--taille-tactile);
		border: none;
		margin-top: var(--esp-sm);
	}
	.bouton-primaire:disabled { opacity: 0.5; }
</style>
