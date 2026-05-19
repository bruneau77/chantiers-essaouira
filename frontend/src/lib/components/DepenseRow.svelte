<script>
	import { auth, apiAuth } from '$lib/stores/auth.js';
	import { badgeAValider } from '$lib/stores/badgeAValider.js';
	import { nomComplet } from '$lib/utils/nom.js';
	import AjoutDepenseForm from './AjoutDepenseForm.svelte';

	// Refonte 2026-05-18 :
	//   - chantierId → lieuId (props et navigation)
	//   - affichage du Poste rattaché si présent (depense.poste)
	//   - affichage du fournisseur (texte libre) si présent
	//   - prop avecLieu (ex-avecChantier) : utile sur le dashboard admin
	//     qui agrège les dépenses tous lieux confondus
	let {
		depense,
		avecLieu = false,
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

	const peutEditer = $derived(estAdmin || (estProprietaire && estAValider));
	const peutSupprimer = $derived(estAdmin || (estProprietaire && estAValider));

	async function valider() {
		actionEnCours = true;
		erreur = '';
		try {
			const res = await apiAuth(`/api/depenses/${depense.id}/valider`, {
				method: 'PATCH',
				body: JSON.stringify({})
			});
			if (!res.ok) {
				const p = await res.json();
				erreur = p.message || 'Erreur lors de la validation.';
				return;
			}
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
			const res = await apiAuth(`/api/depenses/${depense.id}`, {
				method: 'DELETE',
				body: JSON.stringify({})
			});
			if (!res.ok && res.status !== 204) {
				const p = await res.json();
				erreur = p.message || 'Erreur lors de la suppression.';
				return;
			}
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
		lieuId={depense.lieuId}
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

		{#if depense.poste}
			<p class="info-extra">
				<span class="info-icone" aria-hidden="true">📍</span>
				Poste : <strong>{depense.poste.titre}</strong>
			</p>
		{/if}

		{#if depense.fournisseur}
			<p class="info-extra">
				<span class="info-icone" aria-hidden="true">🏪</span>
				Fournisseur : {depense.fournisseur}
			</p>
		{/if}

		<div class="meta">
			<span>{formaterDate(depense.date)}</span>
			{#if depense.saisiePar}
				<span>· {nomComplet(depense.saisiePar)}</span>
			{/if}
			{#if avecLieu && depense.lieu}
				<span>· <a href="/lieux/{depense.lieu.id}/compta" class="lien-lieu">{depense.lieu.reference}</a></span>
			{/if}
		</div>

		{#if depense.corrigeePar && depense.corrigeeLe}
			<p class="audit">Modifié par {nomComplet(depense.corrigeePar)} le {formaterDate(depense.corrigeeLe)}</p>
		{/if}

		{#if erreur}
			<p class="erreur">{erreur}</p>
		{/if}

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
	}
	.tag-statut {
		font-size: 11px;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 10px;
	}
	.tag-a-valider { background: #fef3e5; color: #c97b2b; }
	.tag-validee { background: #e8f5ec; color: #2d7a4f; }

	.montant {
		font-size: 18px;
		font-weight: 700;
		color: var(--couleur-texte);
	}

	.description {
		font-size: 14px;
		color: var(--couleur-texte);
		line-height: 1.4;
	}

	.info-extra {
		font-size: 13px;
		color: var(--couleur-texte-secondaire);
		display: flex;
		align-items: center;
		gap: var(--esp-xs);
	}

	.info-icone {
		font-size: 14px;
	}

	.meta {
		font-size: 12px;
		color: var(--couleur-texte-leger);
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.lien-lieu {
		color: var(--couleur-primaire);
		font-weight: 600;
		text-decoration: none;
	}

	.audit {
		font-size: 11px;
		color: var(--couleur-texte-leger);
		font-style: italic;
	}

	.erreur {
		color: var(--couleur-erreur);
		font-size: 13px;
	}

	.actions {
		display: flex;
		gap: var(--esp-sm);
		margin-top: var(--esp-xs);
	}

	.bouton {
		padding: var(--esp-sm) var(--esp-md);
		border-radius: var(--rayon-md);
		font-size: 13px;
		font-weight: 600;
		min-height: 36px;
	}

	.bouton-valider {
		background: #2d7a4f;
		color: white;
	}

	.bouton-modifier {
		background: transparent;
		color: var(--couleur-primaire);
		border: 1.5px solid var(--couleur-primaire);
	}

	.bouton-supprimer {
		background: transparent;
		color: var(--couleur-erreur);
		border: 1.5px solid rgba(176, 58, 46, 0.3);
		padding: var(--esp-sm);
	}

	.bouton:disabled {
		opacity: 0.5;
	}
</style>
