<script>
	import NavBas from '$lib/components/NavBas.svelte';

	let { children } = $props();
</script>

<div class="app">
	<main class="contenu">
		{@render children()}
	</main>
	<NavBas />
</div>

<style>
	.app {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}

	.contenu {
		flex: 1;
		padding-bottom: calc(var(--hauteur-nav) + var(--safe-bas) + var(--esp-md));
		padding-top: var(--safe-haut);
	}
</style>
