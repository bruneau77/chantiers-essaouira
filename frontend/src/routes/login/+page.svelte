<script>
	import { auth } from '$lib/stores/auth.js';
	import { goto } from '$app/navigation';

	let email = $state('');
	let motDePasse = $state('');
	let afficherMdp = $state(false);
	let chargement = $state(false);
	let erreur = $state('');

	async function soumettre(evt) {
		evt.preventDefault();
		erreur = '';

		if (!email.trim()) {
			erreur = 'Entrez votre adresse e-mail';
			return;
		}
		if (!motDePasse) {
			erreur = 'Entrez votre mot de passe';
			return;
		}

		chargement = true;
		const resultat = await auth.connexion(email.trim().toLowerCase(), motDePasse);
		chargement = false;

		if (resultat.succes) {
			goto('/');
		} else {
			erreur = resultat.erreur;
			motDePasse = '';
		}
	}
</script>

<svelte:head>
	<title>Connexion — Chantiers Essaouira</title>
</svelte:head>

<div class="page">
	<div class="conteneur">
		<header class="entete">
			<div class="logo">LUDIMMO</div>
			<h1>Chantiers Essaouira</h1>
			<p class="sous-titre">Connectez-vous pour accéder à votre espace</p>
		</header>

		<form onsubmit={soumettre} class="formulaire" novalidate>
			<div class="champ">
				<label for="email">Adresse e-mail</label>
				<input
					id="email"
					type="email"
					bind:value={email}
					placeholder="votre@email.com"
					autocomplete="email"
					inputmode="email"
					autocapitalize="off"
					autocorrect="off"
					spellcheck="false"
					required
					disabled={chargement}
				/>
			</div>

			<div class="champ">
				<label for="motDePasse">Mot de passe</label>
				<div class="champ-mdp">
					<input
						id="motDePasse"
						type={afficherMdp ? 'text' : 'password'}
						bind:value={motDePasse}
						placeholder="••••••••"
						autocomplete="current-password"
						required
						disabled={chargement}
					/>
					<button
						type="button"
						class="basculer-mdp"
						onclick={() => (afficherMdp = !afficherMdp)}
						aria-label={afficherMdp ? 'Cacher le mot de passe' : 'Afficher le mot de passe'}
						tabindex="-1"
					>
						{#if afficherMdp}
							<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
								<path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
								<path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
								<line x1="2" y1="2" x2="22" y2="22" />
							</svg>
						{:else}
							<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
								<circle cx="12" cy="12" r="3" />
							</svg>
						{/if}
					</button>
				</div>
			</div>

			{#if erreur}
				<div class="message-erreur" role="alert">
					{erreur}
				</div>
			{/if}

			<button type="submit" class="bouton-primaire" disabled={chargement}>
				{#if chargement}
					<span class="spinner-bouton"></span>
					Connexion…
				{:else}
					Se connecter
				{/if}
			</button>
		</form>

		<footer class="pied">
			<p>Mot de passe oublié ? Contactez Yassine.</p>
		</footer>
	</div>
</div>

<style>
	.page {
		min-height: 100dvh;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: var(--esp-xl) var(--esp-lg);
		padding-top: max(var(--esp-xxl), var(--safe-haut));
		padding-bottom: max(var(--esp-lg), var(--safe-bas));
		background:
			radial-gradient(circle at 20% 0%, rgba(30, 77, 107, 0.05) 0%, transparent 50%),
			radial-gradient(circle at 80% 100%, rgba(200, 146, 74, 0.06) 0%, transparent 50%),
			var(--couleur-fond);
	}

	.conteneur {
		width: 100%;
		max-width: 420px;
	}

	.entete {
		text-align: center;
		margin-bottom: var(--esp-xxl);
	}

	.logo {
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.25em;
		color: var(--couleur-accent);
		margin-bottom: var(--esp-md);
	}

	h1 {
		font-size: 28px;
		font-weight: 700;
		color: var(--couleur-texte);
		margin-bottom: var(--esp-sm);
		letter-spacing: -0.02em;
	}

	.sous-titre {
		font-size: 15px;
		color: var(--couleur-texte-secondaire);
	}

	.formulaire {
		display: flex;
		flex-direction: column;
		gap: var(--esp-lg);
		background: var(--couleur-fond-carte);
		padding: var(--esp-xl) var(--esp-lg);
		border-radius: var(--rayon-lg);
		border: 1px solid var(--couleur-bordure);
		box-shadow: var(--ombre-md);
	}

	.champ {
		display: flex;
		flex-direction: column;
		gap: var(--esp-sm);
	}

	label {
		font-size: 14px;
		font-weight: 600;
		color: var(--couleur-texte);
	}

	input {
		width: 100%;
		min-height: var(--taille-tactile-grande);
		padding: 0 var(--esp-md);
		background: var(--couleur-fond-carte);
		border: 1.5px solid var(--couleur-bordure-forte);
		border-radius: var(--rayon-md);
		transition: border-color 0.15s, box-shadow 0.15s;
	}

	input:focus {
		outline: none;
		border-color: var(--couleur-primaire);
		box-shadow: 0 0 0 3px var(--couleur-primaire-clair);
	}

	input:disabled {
		background: var(--couleur-fond);
		color: var(--couleur-texte-leger);
	}

	.champ-mdp {
		position: relative;
	}

	.champ-mdp input {
		padding-right: 52px;
	}

	.basculer-mdp {
		position: absolute;
		right: var(--esp-sm);
		top: 50%;
		transform: translateY(-50%);
		width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--couleur-texte-secondaire);
		border-radius: var(--rayon-sm);
	}

	.basculer-mdp:active {
		background: var(--couleur-fond);
	}

	.message-erreur {
		padding: var(--esp-md);
		background: var(--couleur-erreur-fond);
		border: 1px solid var(--couleur-erreur);
		border-radius: var(--rayon-md);
		color: var(--couleur-erreur);
		font-size: 14px;
		font-weight: 500;
	}

	.spinner-bouton {
		width: 18px;
		height: 18px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		margin-right: var(--esp-sm);
		animation: rotation 0.7s linear infinite;
		display: inline-block;
	}

	@keyframes rotation {
		to {
			transform: rotate(360deg);
		}
	}

	.pied {
		text-align: center;
		margin-top: var(--esp-xl);
	}

	.pied p {
		font-size: 13px;
		color: var(--couleur-texte-leger);
	}
</style>
