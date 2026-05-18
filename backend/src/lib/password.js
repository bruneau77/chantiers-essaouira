/**
 * Helpers de hash / vérification de mot de passe (bcrypt).
 *
 * Convention projet : cost = 12 (cf. CLAUDE.md). Suffisamment robuste
 * tout en restant rapide sur les 4 GB RAM du VPS Hostinger.
 */

import bcrypt from 'bcrypt'

const COST = 12

/**
 * Hashe un mot de passe en clair.
 * @param {string} motDePasseClair
 * @returns {Promise<string>} hash bcrypt
 */
export async function hasherMotDePasse(motDePasseClair) {
  if (typeof motDePasseClair !== 'string' || motDePasseClair.length === 0) {
    throw new Error('Mot de passe vide')
  }
  return bcrypt.hash(motDePasseClair, COST)
}

/**
 * Vérifie un mot de passe en clair contre son hash bcrypt.
 * @param {string} motDePasseClair
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export async function verifierMotDePasse(motDePasseClair, hash) {
  if (!motDePasseClair || !hash) return false
  return bcrypt.compare(motDePasseClair, hash)
}
