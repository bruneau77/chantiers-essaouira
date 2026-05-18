<script>
	import { auth, apiAuth } from '$lib/stores/auth.js';
	import { badgeAValider } from '$lib/stores/badgeAValider.js';
	import { nomComplet } from '$lib/utils/nom.js';
	import AjoutDepenseForm from './AjoutDepenseForm.svelte';

	let {
		depense,
		avecChantier = false,  // affiche le nom du chantier (utile sur tableau de bord admin)
		onChange = () => {}
	} = $props();

	let modeEdition = $state(false);
	let actionEnCours = $state(false);
	let erreur = $state('');

	const LABELS_CATEGORIE = {
		ACOMPTE: 'Acompte',
		MATERIEL: 'Matériel',
		REPAS: 'Repas'
	};

	function formaterDh(c) {
		if (c === null || c === undefined) return '—';
		const dh = Math.round(c / 100);
		return dh.toLocaleString('fr-FR').replace(/,/g, ' ') + ' DH';
	}

	function formaterDate(s) {
		if (!s) return '—';
		return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
	}

	const estAdmin = $derived($auth.utilisateur?.role === 'admin');
	const estProprietaire = $derived(depense.saisieParId === $auth.utilisateur?.id);
	const estAValider = $derived(depense.statut === 'A_VALIDER');

	// Chef peut éditer/supprimer sa propre dépense tant que A_VALIDER
	// Admin peut toujours éditer
	const peutEditer = $derived(estAdmin || (estProprietaire && estAValider));
	const peutSupprimer = $derived(estAdmin || (estProprietaire && estAValider));

	async function valider() {
		actionEnCours = true;
		erreur = '';
		try {
			// apiAuth force toujours Content-Type: application/json → Fastify
			// refuse un body vide avec ce header. On envoie un objet JSON vide.
			const res = await apiAuth(`/api/depenses/${depense.id}/valider`, {
				method: 'PATCH',
				body: JSON.stringify({})
			});
			if (!res.ok) {
				const p = await res.json();
				erreur = p.message || 'Erreur lors de la validation.';
				return;
			}
			// Décrément immédiat du badge NavBas sans attendre le polling 60 s.
			badgeAValider.decrementer();
			onChange();
		} catch {
			erreur = 'Impossible de contacter le serveur.';
		} finally {
			actionEnCours = false;
		}
	}

	async function supprimer() {
		if (!confirm(`Supprimer cette dépense de ${formaterDh(depense.montantCentimes)} ?`)) return;
		actionEnCours = true;
		erreur = '';
		try {
			// Idem valider() : apiAuth force Content-Type: application/json,
			// donc on doit fournir un body JSON même vide.
			const res = await apiAuth(`/api/depenses/${depense.id}`, {
				method: 'DELETE',
				body: JSON.stringify({})
			});
			if (!res.ok && res.status !== 204) {
				const p = await res.json();
				erreur = p.message || 'Erreur lors de la suppression.';
				return;
			}
			// Si on supprime une dépense qui était encore A_VALIDER, le compteur
			// du badge admin baisse. Si elle était déjà VALIDEE, pas d'impact.
			if (depense.statut === 'A_VALIDER') {
				badgeAValider.decrementer();
			}
			onChange();
		} catch {
			erreur = 'Impossible de contacter le serveur.';
		} finally {
			actionEnCours = false;
		}
	}

	function onEditionTerminee(success) {
		modeEdition = false;
		if (success) onChange();
	}
</script>

{#if modeEdition}
	<AjoutDepenseForm
		chantierId={depense.chantierId}
		depenseExistante={depense}
		onTermine={onEditionTerminee}
		onAnnule={() => (modeEdition = false)}
	/>
{:else}
	<div class="depense" class:a-valider={estAValider} class:validee={!estAValider}>
		<div class="entete">
			<div class="entete-gauche">
				<span class="categorie cat-{depense.categorie}">{LABELS_CATEGORIE[depense.categorie] ?? depense.categorie}</span>
				{#if depense.estAvancePersonnelle}
					<span class="tag-avance">Avance perso</span>
				{/if}
				{#if estAValider}
					<span class="tag-statut tag-a-valider">À valider</span>
				{:else}
					<span class="tag-statut tag-validee">Validée</span>
				{/if}
			</div>
			<span class="montant">{formaterDh(depense.montantCentimes)}</span>
		</div>

		<p class="description">{depense.description}</p>

		<div class="meta">
			<span>{formaterDate(depense.date)}</span>
			{#if depense.saisiePar}
				<span>· {nomComplet(depense.saisiePar)}</span>
			{/if}
			{#if avecChantier && depense.chantier}
				<span>· <a href="/chantiers/{depense.chantier.id}/compta" class="lien-chantier">{depense.chantier.numero}</a></span>
			{/if}
		</div>

		{#if depense.corrigeePar && depense.corrigeeLe}
			<p class="audit">Modifié par {nomComplet(depense.corrigeePar)} le {formaterDate(depense.corrigeeLe)}</p>
		{/if}

		{#if erreur}
			<p class="erreur">{erreur}</p>
		{/if}

		<!-- Boutons d'action -->
		<div class="actions">
			{#if estAdmin && estAValider}
				<button class="bouton bouton-valider" onclick={valider} disabled={actionEnCours}>
					Valider
				</button>
				<button class="bouton bouton-modifier" onclick={() => (modeEdition = true)} disabled={actionEnCours}>
					Modifier
				</button>
			{:else if peutEditer}
				<button class="bouton bouton-modifier" onclick={() => (modeEdition = true)} disabled={actionEnCours}>
					Modifier
				</button>
			{/if}
			{#if peutSupprimer}
				<button class="bouton bouton-supprimer" onclick={supprimer} disabled={actionEnCours} aria-label="Supprimer">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="3 6 5 6 21 6"></polyline>
						<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
						<path d="M10 11v6M14 11v6"></path>
					</svg>
				</button>
			{/if}
		</div>
	</div>
{/if}

<style>
	.depense {
		background: var(--couleur-fond-carte);
		border: 1px solid var(--couleur-bordure);
		border-radius: var(--rayon-md);
		padding: var(--esp-md);
		display: flex;
		flex-direction: column;
		gap: var(--esp-xs);
	}
	.depense.a-valider { border-left: 4px solid #c97b2b; }
	.depense.validee { border-left: 4px solid #2d7a4f; opacity: 0.95; }

	.entete {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--esp-sm);
	}
	.entete-gauche {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		align-items: center;
	}

	.categorie {
		font-size: 11px;
		font-weight: 700;
		padding: 2px 8px;
		border-radius: 10px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: white;
	}
	.cat-ACOMPTE { background: #1e4d6b; }
	.cat-MATERIEL { background: #c8924a; }
	.cat-REPAS { background: #7a5a2b; }

	.tag-avance {
		font-size: 11px;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 10px;
		background: #fdf3f1;
		color: #b03a2e;
		border: 1px solid #e0a8a0;
	}

	.tag-statut {
		font-size: 11px;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 10px;
	}
	.tag-a-valider { background: #fdf3e8; color: #c97b2b; border: 1px solid #e8c89c; }
	.tag-validee { background: #e7f5ed; color: #2d7a4f; border: 1px solid #b6dec5; }

	.montant {
		font-size: 16px;
		font-weight: 700;
		color: var(--couleur-texte);
		white-space: nowrap;
	}

	.description {
		font-size: 14px;
		color: var(--couleur-texte);
		line-height: 1.4;
	}

	.meta {
		font-size: 12px;
		color: var(--couleur-texte-leger);
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.lien-chantier { color: var(--couleur-primaire); text-decoration: none; font-weight: 600; }

	.audit {
		font-size: 11px;
		color: var(--couleur-texte-leger);
		font-style: italic;
	}

	.erreur {
		font-size: 13px;
		color: var(--couleur-erreur);
		padding: var(--esp-xs);
		background: #fdf3f1;
		border-radius: var(--rayon-sm);
	}

	.actions {
		display: flex;
		gap: var(--esp-sm);
		margin-top: var(--esp-xs);
	}

	.bouton {
		padding: 8px var(--esp-md);
		border-radius: var(--rayon-sm);
		font-size: 13px;
		font-weight: 600;
		min-height: 36px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
	}
	.bouton:active:not(:disabled) { opacity: 0.85; }
	.bouton:disabled { opacity: 0.5; cursor: not-allowed; }

	.bouton-valider { background: #2d7a4f; color: white; flex: 1; }
	.bouton-modifier {
		background: var(--couleur-fond);
		color: var(--couleur-primaire);
		border: 1.5px solid var(--couleur-primaire);
		flex: 1;
	}
	.bouton-supprimer {
		background: transparent;
		color: #b03a2e;
		border: 1.5px solid #e0a8a0;
		padding: 8px 12px;
	}
</style>
