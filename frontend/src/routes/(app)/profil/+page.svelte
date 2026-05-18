<script>
	import { auth } from '$lib/stores/auth.js';
	import { nomComplet } from '$lib/utils/nom.js';

	let utilisateur = $derived($auth.utilisateur);

	const libellesRole = {
		admin: 'Administrateur',
		chef: 'Chef de chantier'
	};

	function deconnecter() {
		if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
			auth.deconnexion();
		}
	}
</script>

<svelte:head>
	<title>Profil — Ludimmo</title>
</svelte:head>

<div class="page">
	<header class="entete-page">
		<h1>Profil</h1>
	</header>

	{#if utilisateur}
		<div class="carte">
			<div class="avatar">
				{(utilisateur.prenom?.[0] || utilisateur.email[0]).toUpperCase()}
			</div>

			<div class="info">
				{#if utilisateur.prenom || utilisateur.nom}
					<p class="nom">{nomComplet(utilisateur)}</p>
				{/if}
				<p class="email">{utilisateur.email}</p>
				<span class="badge-role">
					{libellesRole[utilisateur.role] || utilisateur.role}
				</span>
			</div>
		</div>

		<button class="bouton-deconnexion" onclick={deconnecter}>
			Se déconnecter
		</button>
	{/if}
</div>

<style>
	.page { padding: var(--esp-lg); }
	.entete-page { margin-bottom: var(--esp-xl); }
	h1 { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; }

	.carte {
		background: var(--couleur-fond-carte);
		border: 1px solid var(--couleur-bordure);
		border-radius: var(--rayon-lg);
		padding: var(--esp-lg);
		display: flex;
		align-items: center;
		gap: var(--esp-md);
		margin-bottom: var(--esp-xl);
		box-shadow: var(--ombre-sm);
	}

	.avatar {
		width: 56px;
		height: 56px;
		flex-shrink: 0;
		background: var(--couleur-primaire);
		color: white;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 22px;
		font-weight: 600;
	}

	.info { flex: 1; min-width: 0; }
	.nom { font-size: 17px; font-weight: 600; margin-bottom: 2px; }
	.email {
		font-size: 14px;
		color: var(--couleur-texte-secondaire);
		margin-bottom: var(--esp-sm);
		word-break: break-all;
	}

	.badge-role {
		display: inline-block;
		padding: 3px 10px;
		background: var(--couleur-accent-clair);
		color: var(--couleur-accent);
		border-radius: 999px;
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.bouton-deconnexion {
		width: 100%;
		min-height: var(--taille-tactile-grande);
		padding: 0 var(--esp-lg);
		background: var(--couleur-fond-carte);
		color: var(--couleur-erreur);
		border: 1.5px solid var(--couleur-erreur);
		border-radius: var(--rayon-md);
		font-weight: 600;
		font-size: 16px;
	}

	.bouton-deconnexion:active {
		background: var(--couleur-erreur-fond);
	}
</style>
