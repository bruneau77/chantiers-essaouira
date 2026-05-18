<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { auth } from '$lib/stores/auth.js';
	import '../app.css';

	let { children } = $props();

	onMount(async () => {
		await auth.initialiser();
	});

	const routesPubliques = ['/login'];

	$effect(() => {
		if ($auth.chargement) return;

		const cheminActuel = $page.url.pathname;
		const estPublique = routesPubliques.includes(cheminActuel);
		const estConnecte = !!$auth.utilisateur;

		if (!estConnecte && !estPublique) {
			goto('/login');
		} else if (estConnecte && estPublique) {
			goto('/');
		}
	});
</script>

{#if $auth.chargement}
	<div class="ecran-chargement">
		<div class="spinner"></div>
	</div>
{:else}
	{@render children()}
{/if}

<style>
	.ecran-chargement {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100dvh;
		background: var(--couleur-fond);
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--couleur-bordure);
		border-top-color: var(--couleur-primaire);
		border-radius: 50%;
		animation: rotation 0.8s linear infinite;
	}

	@keyframes rotation {
		to {
			transform: rotate(360deg);
		}
	}
</style>
