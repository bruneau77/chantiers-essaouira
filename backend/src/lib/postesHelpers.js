/**
 * Helpers partagés autour du modèle Poste.
 *
 * Trois utilitaires :
 *  - selectPosteSelonRole(user)       : retourne le `select:` Prisma à utiliser
 *                                        selon le rôle (strip des montants pour le chef)
 *  - transitionAutorisee(role, ...)   : valide une transition de statut Poste
 *                                        selon la machine à états du rôle
 *  - recalculerStatutLieu(prismaOrTx, lieuId) :
 *                                        recalcule le statut du Lieu d'après ses Postes,
 *                                        et persiste si changement.
 *
 * Utilisé par routes/postes.js (mutations + listes), routes/lieux.js
 * (include postes filtré par rôle) et routes/admin.js (recalc en bloc).
 */

// -------------------------------------------------------------------
// Strip des montants pour le rôle chef
// -------------------------------------------------------------------
const CHAMPS_POSTE_PUBLICS = {
  id: true,
  lieuId: true,
  titre: true,
  description: true,
  statut: true,
  ordre: true,
  termineLe: true,
  creeLe: true,
  modifieLe: true,
}

const CHAMPS_POSTE_MONTANTS = {
  montantBrutCentimes: true,
  montantClientCentimes: true,
  margeCentimes: true,
  margePourcent: true,
}

/**
 * Retourne le `select:` Prisma à appliquer sur un Poste selon le rôle
 * de l'utilisateur courant. Pour le rôle 'chef', les 4 champs montants
 * sont strippés (defense in depth — le frontend ne doit jamais voir
 * ces valeurs pour un chef, même via un bug d'affichage).
 *
 * @param {{ role: string }} user
 * @returns {object} select Prisma
 */
export function selectPosteSelonRole(user) {
  if (user?.role === 'admin') {
    return { ...CHAMPS_POSTE_PUBLICS, ...CHAMPS_POSTE_MONTANTS }
  }
  return { ...CHAMPS_POSTE_PUBLICS }
}

// -------------------------------------------------------------------
// Machine à états des transitions Poste
// -------------------------------------------------------------------
/**
 * Transitions de statut Poste autorisées pour le rôle 'chef'.
 * Le rôle 'admin' a toutes les transitions libres.
 *
 * Règles métier (cf. JOURNAL session 2026-05-18) :
 *   - A_FAIRE  → EN_COURS  : autorisé
 *   - EN_COURS → TERMINE   : autorisé
 *   - TERMINE  → EN_COURS  : autorisé (correction d'erreur)
 *   - TERMINE  → A_FAIRE   : interdit (chef)
 *   - EN_COURS → A_FAIRE   : interdit (chef)
 */
const TRANSITIONS_CHEF = {
  A_FAIRE: ['EN_COURS'],
  EN_COURS: ['TERMINE'],
  TERMINE: ['EN_COURS'],
}

export const STATUTS_POSTE = ['A_FAIRE', 'EN_COURS', 'TERMINE']

/**
 * Vérifie qu'une transition de statut est autorisée pour ce rôle.
 * - admin : toutes les transitions sont autorisées (y compris no-op)
 * - chef  : selon la machine à états ci-dessus (no-op autorisé aussi)
 *
 * @param {string} role
 * @param {string} ancienStatut
 * @param {string} nouveauStatut
 * @returns {boolean}
 */
export function transitionAutorisee(role, ancienStatut, nouveauStatut) {
  if (role === 'admin') return true
  if (ancienStatut === nouveauStatut) return true
  const autorisees = TRANSITIONS_CHEF[ancienStatut] ?? []
  return autorisees.includes(nouveauStatut)
}

// -------------------------------------------------------------------
// Recalcul du statut du Lieu d'après ses Postes
// -------------------------------------------------------------------
/**
 * Recalcule le statut d'un Lieu à partir de l'état de ses Postes :
 *   - PROSPECT  : aucun Poste, OU tous les Postes sont A_FAIRE
 *   - TERMINE   : tous les Postes sont TERMINE (et il y en a au moins un)
 *   - EN_COURS  : sinon (au moins un EN_COURS, ou mix A_FAIRE/TERMINE)
 *
 * Persiste si la valeur calculée diffère du statut courant. Retourne
 * le nouveau statut.
 *
 * Accepte un client Prisma ou un transaction `tx` — à utiliser dans
 * la même transaction que la mutation du Poste pour rester atomique.
 *
 * @param {import('@prisma/client').PrismaClient | object} prismaOrTx
 * @param {number} lieuId
 * @returns {Promise<string>} nouveau statut
 */
export async function recalculerStatutLieu(prismaOrTx, lieuId) {
  const postes = await prismaOrTx.poste.findMany({
    where: { lieuId },
    select: { statut: true },
  })

  let nouveauStatut
  if (postes.length === 0) {
    nouveauStatut = 'PROSPECT'
  } else if (postes.every((p) => p.statut === 'A_FAIRE')) {
    nouveauStatut = 'PROSPECT'
  } else if (postes.every((p) => p.statut === 'TERMINE')) {
    nouveauStatut = 'TERMINE'
  } else {
    nouveauStatut = 'EN_COURS'
  }

  // On évite un UPDATE si pas de changement (économise un coup de DB
  // et un trigger @updatedAt inutile)
  const lieu = await prismaOrTx.lieu.findUnique({
    where: { id: lieuId },
    select: { statut: true },
  })
  if (lieu && lieu.statut !== nouveauStatut) {
    await prismaOrTx.lieu.update({
      where: { id: lieuId },
      data: { statut: nouveauStatut },
    })
  }

  return nouveauStatut
}
