/**
 * Store partagé pour le compteur de dépenses « À valider ».
 *
 * Pourquoi un store ?
 *  - `NavBas` affiche le badge sur l'onglet Compta côté admin.
 *  - Quand l'admin valide ou supprime une dépense depuis une autre page
 *    (ex: tableau de bord /compta), il faut que le badge baisse
 *    immédiatement sans attendre le polling de 60 s.
 *
 * Usage :
 *  - `badgeAValider.definir(n)` : utilisé par NavBas après un fetch
 *    de `/api/depenses/a-valider/count` (source de vérité serveur).
 *  - `badgeAValider.decrementer()` : appelé après une action UI qui
 *    fait sortir une dépense de l'état A_VALIDER (validation, suppression
 *    d'une dépense A_VALIDER, modification admin qui déclenche la
 *    validation auto). Le polling 60 s reste comme filet de sécurité
 *    si on a oublié un cas.
 *  - `badgeAValider.incrementer()` : non utilisé en V1 (l'admin ne crée
 *    pas de dépense A_VALIDER, ses dépenses passent directement en VALIDEE).
 */

import { writable } from 'svelte/store'

function creerStoreBadge() {
	const { subscribe, set, update } = writable(0)

	return {
		subscribe,
		/** Définit la valeur courante (jamais négative). */
		definir(n) {
			set(Math.max(0, n ?? 0))
		},
		/** Décrémente d'1, plancher à 0. */
		decrementer() {
			update((n) => Math.max(0, n - 1))
		},
		/** Incrémente d'1. */
		incrementer() {
			update((n) => n + 1)
		},
		/** Remet à zéro (ex: au logout, ou si l'utilisateur n'est plus admin). */
		reset() {
			set(0)
		}
	}
}

export const badgeAValider = creerStoreBadge()
