<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth, apiAuth } from '$lib/stores/auth.js';
	import NouveauClientModale from '$lib/components/NouveauClientModale.svelte';
	import { nomComplet } from '$lib/utils/nom.js';

	// Sentinelle pour l'option "+ Nouveau client…" du <select>.
	const SENTINEL_NOUVEAU_CLIENT = '__nouveau__';

	let nom = $state('');
	let adresse = $state('');
	let clientId = $state('');
	let chefId = $state('');
	let distanceAllerKm = $state('');
	let nombreAllerRetourPrevu = $state('');
	let budgetEstimatifDh = $state('');
	let notes = $state('');

	let utilisateurs = $state([]);
	let chargementUtilisateurs = $state(true);
	let enCours = $state(false);
	let erreur = $state('');

	let modaleClientOuverte = $state(false);

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

	function onChangeClient(e) {
		const val = e.currentTarget.value;
		if (val === SENTINEL_NOUVEAU_CLIENT) {
			clientId = '';
			modaleClientOuverte = true;
		} else {
			clientId = val;
		}
	}

	function onClientCree(nouveauClient) {
		utilisateurs = [...utilisateurs, nouveauClient];
		clientId = String(nouveauClient.id);
		modaleClientOuverte = false;
	}

	async function creerLieu() {
		erreur = '';

		if (!nom.trim()) { erreur = 'Le nom du lieu est requis.'; return; }
		if (!adresse.trim()) { erreur = 'L\'adresse est requise.'; return; }
		if (!clientId) { erreur = 'Sélectionnez un client.'; return; }

		enCours = true;

		try {
			const body = {
				nom: nom.trim(),
				adresse: adresse.trim(),
				clientId: parseInt(clientId, 10)
			};

			if (chefId) body.chefId = parseInt(chefId, 10);
			if (notes.trim()) body.notes = notes.trim();

			const dist = parseInt(distanceAllerKm, 10);
			if (!isNaN(dist) && dist > 0) body.distanceAllerKm = dist;

			const ar = parseInt(nombreAllerRetourPrevu, 10);
			if (!isNaN(ar) && ar > 0) body.nombreAllerRetourPrevu = ar;

			const budget = Number(budgetEstimatifDh);
			if (Number.isFinite(budget) && budget > 0) {
				body.budgetEstimatifCentimes = Math.round(budget * 100);
			}

			const res = await apiAuth('/api/lieux', {
				method: 'POST',
				body: JSON.stringify(body)
			});

			const payload = await res.json();

			if (!res.ok) {
				erreur = payload.message || 'Erreur lors de la création.';
				return;
			}

			goto(`/lieux/${payload.data.id}`);
		} catch {
			erreur = 'Impossible de contacter le serveur.';
		} finally {
			enCours = false;
		}
	}
</script>

<svelte:head>
	<title>Nouveau lieu — Ludimmo</title>
</svelte:head>

<div class="page">
	<button class="bouton-retour" onclick={() => goto('/lieux')}>
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M19 12H5M12 19l-7-7 7-7" />
		</svg>
		Lieux
	</button>

	<header class="entete">
		<h1>Nouveau lieu</h1>
	</header>

	<form class="formulaire" onsubmit={(e) => { e.preventDefault(); creerLieu(); }}>
		<label class="champ">
			<span class="label">Nom du lieu *</span>
			<input type="text" bind:value={nom} placeholder="Ex: Villa Pierre-Yves, Riad Médina…" maxlength="200" required />
		</label>

		<label class="champ">
			<span class="label">Adresse *</span>
			<input type="text" bind:value={adresse} placeholder="Adresse précise" maxlength="500" required />
		</label>

		<label class="champ">
			<span class="label">Client *</span>
			<select onchange={onChangeClient} value={clientId} disabled={chargementUtilisateurs} required>
				<option value="" disabled>— Sélectionner —</option>
				{#if estAdmin}
					<option value={SENTINEL_NOUVEAU_CLIENT}>+ Nouveau client…</option>
				{/if}
				{#each clients as c (c.id)}
					<option value={String(c.id)}>{nomComplet(c)}</option>
				{/each}
			</select>
		</label>

		<label class="champ">
			<span class="label">Chef de chantier (optionnel)</span>
			<select bind:value={chefId} disabled={chargementUtilisateurs}>
				<option value="">— Aucun pour le moment —</option>
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
			<span class="label">Budget estimatif (DH, optionnel)</span>
			<input type="number" inputmode="decimal" min="0" step="0.01" bind:value={budgetEstimatifDh} placeholder="0" />
		</label>

		<label class="champ">
			<span class="label">Notes (optionnel)</span>
			<textarea bind:value={notes} rows="3" maxlength="5000" placeholder="Détails libres"></textarea>
		</label>

		{#if erreur}
			<p class="erreur">{erreur}</p>
		{/if}

		<div class="actions">
			<button type="button" class="bouton-secondaire" onclick={() => goto('/lieux')} disabled={enCours}>
				Annuler
			</button>
			<button type="submit" class="bouton-primaire" disabled={enCours}>
				{enCours ? 'Création…' : 'Créer le lieu'}
			</button>
		</div>
	</form>

	<NouveauClientModale
		ouverte={modaleClientOuverte}
		onCree={onClientCree}
		onFermer={() => (modaleClientOuverte = false)}
	/>
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
</style>
