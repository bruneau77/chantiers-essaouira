/**
 * Helpers d'affichage des noms d'utilisateurs.
 *
 * Pourquoi un helper plutôt que `{u.prenom} {u.nom}` inline ?
 *  - Sur les prénoms composés (Pierre-Jean, Marie-Claire, etc.), le
 *    navigateur peut couper la ligne au tiret en wrap responsive
 *    → rendu visuel « Pierre- \n Jean GONZALES » qu'on perçoit comme
 *    un espace parasite avant le tiret.
 *  - On remplace les tirets normaux par des tirets insécables U+2011
 *    qui ont le MÊME rendu visuel mais ne sont pas des points de break.
 *  - Centraliser permet aussi d'ajuster le format (initiales, casse,
 *    etc.) à un seul endroit pour toute l'app.
 */

const TIRET_INSECABLE = '‑' // U+2011 NON-BREAKING HYPHEN

/**
 * Retourne le nom complet d'un utilisateur, avec tirets insécables sur
 * les prénoms/noms composés.
 *
 * Exemples :
 *   nomComplet({ prenom: 'Pierre-Jean', nom: 'GONZALES' })
 *     → 'Pierre‑Jean GONZALES'   (le tiret est U+2011, identique visuellement)
 *   nomComplet({ prenom: 'Rachid', nom: 'El Mansouri' })
 *     → 'Rachid El Mansouri'
 *   nomComplet(null) → ''
 *
 * @param {{prenom?: string|null, nom?: string|null} | null | undefined} u
 * @returns {string}
 */
export function nomComplet(u) {
	if (!u) return ''
	const prenom = (u.prenom ?? '').trim().replace(/-/g, TIRET_INSECABLE)
	const nom = (u.nom ?? '').trim().replace(/-/g, TIRET_INSECABLE)
	if (!prenom && !nom) return ''
	if (!prenom) return nom
	if (!nom) return prenom
	return `${prenom} ${nom}`
}
