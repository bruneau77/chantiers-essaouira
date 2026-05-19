<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { auth, apiAuth } from '$lib/stores/auth.js';
	import { badgeAValider } from '$lib/stores/badgeAValider.js';

	// Refonte 2026-05-18 : libellé « Chantiers » → « Lieux ». La route reste
	// « / » (homepage role-adaptive : admin voit les Postes EN_COURS, chef
	// voit ses Lieux). La page /lieux (avec filtres) est accessible depuis
	// la home admin via le bouton « Tous les lieux ».
	const tousLesOnglets = [
		{ lien: '/', label: 'Lieux', roles: ['admin', 'chef'], icone: 'lieux' },
		{ lien: '/photos', label: 'Photos', roles: ['admin', 'chef'], icone: 'photos' },
		{ lien: '/compta', label: 'Compta', roles: ['admin', 'chef'], icone: 'compta' },
		{ lien: '/profil', label: 'Profil', roles: ['admin', 'chef'], icone: 'profil' }
	];

	let onglets = $derived(
		$auth.utilisateur
			? tousLesOnglets.filter((o) => o.roles.includes($auth.utilisateur.role))
			: []
	);

	async function rafraichirBadge() {
		if ($auth.utilisateur?.role !== 'admin') {
			badgeAValider.reset();
			return;
		}
		try {
			const res = await apiAuth('/api/depenses/a-valider/count');
			if (!res.ok) return;
			const payload = await res.json();
			badgeAValider.definir(payload.data?.count ?? 0);
		} catch {
			// silencieux : on garde la valeur courante en cas d'erreur réseau
		}
	}

	onMount(() => {
		rafraichirBadge();
		const interval = setInterval(rafraichirBadge, 60_000);
		return () => clearInterval(interval);
	});

	let chemin = $derived($page.url.pathname);
	$effect(() => {
		chemin;
		rafraichirBadge();
	});

	function estActif(lien) {
		const chemin = $page.url.pathname;
		if (lien === '/') return chemin === '/' || chemin.startsWith('/lieux');
		return chemin.startsWith(lien);
	}
</script>

<nav class="nav-bas">
	{#each onglets as onglet (onglet.lien)}
		<a
			href={onglet.lien}
			class="onglet"
			class:actif={estActif(onglet.lien)}
			aria-current={estActif(onglet.lien) ? 'page' : undefined}
		>
			<span class="icone" aria-hidden="true">
				{#if onglet.icone === 'compta' && $badgeAValider > 0}
					<span class="badge" aria-label="{$badgeAValider} dépenses à valider">{$badgeAValider}</span>
				{/if}
				{#if onglet.icone === 'lieux'}
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M3 21h18" />
						<path d="M5 21V7l8-4v18" />
						<path d="M19 21V11l-6-4" />
						<path d="M9 9h.01" />
						<path d="M9 13h.01" />
						<path d="M9 17h.01" />
					</svg>
				{:else if onglet.icone === 'photos'}
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
						<circle cx="12" cy="13" r="3" />
					</svg>
				{:else if onglet.icone === 'compta'}
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<rect x="2" y="5" width="20" height="14" rx="2" />
						<line x1="2" y1="10" x2="22" y2="10" />
					</svg>
				{:else if onglet.icone === 'profil'}
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
						<circle cx="12" cy="7" r="4" />
					</svg>
				{/if}
			</span>
			<span class="label">{onglet.label}</span>
		</a>
	{/each}
</nav>

<style>
	.nav-bas {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		justify-content: space-around;
		align-items: stretch;
		background: var(--couleur-fond-carte);
		border-top: 1px solid var(--couleur-bordure);
		padding-bottom: var(--safe-bas);
		z-index: 100;
		box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.04);
	}

	.onglet {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		min-height: var(--hauteur-nav);
		padding: 8px 4px;
		color: var(--couleur-texte-secondaire);
		text-decoration: none;
		transition: color 0.15s;
		position: relative;
	}

	.onglet:active {
		background: var(--couleur-fond);
	}

	.onglet.actif {
		color: var(--couleur-primaire);
	}

	.onglet.actif::before {
		content: '';
		position: absolute;
		top: 0;
		left: 50%;
		transform: translateX(-50%);
		width: 32px;
		height: 3px;
		background: var(--couleur-primaire);
		border-radius: 0 0 3px 3px;
	}

	.icone {
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
	}

	.badge {
		position: absolute;
		top: -6px;
		right: -10px;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		background: #b03a2e;
		color: white;
		border-radius: 9px;
		font-size: 11px;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}

	.label {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.02em;
	}
</style>
