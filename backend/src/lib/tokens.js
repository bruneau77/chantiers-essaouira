/**
 * Génération et vérification des tokens (access JWT + refresh opaque).
 *
 * - Access token : JWT signé par @fastify/jwt (durée 15 min), payload
 *   { sub, role, email, prenom }.
 * - Refresh token : chaîne opaque aléatoire (96 chars hex), stockée
 *   en DB (table RefreshToken), durée 7 jours. Choix volontaire de NE PAS
 *   utiliser un JWT pour le refresh car son seul intérêt est d'être
 *   révocable côté serveur — une chaîne random + DB est plus simple et
 *   tout aussi sûre.
 *
 * On passe l'instance Fastify en paramètre pour pouvoir utiliser
 * fastify.jwt.sign / fastify.jwt.verify sans ajouter de dépendance.
 */

import crypto from 'node:crypto'

const DUREE_REFRESH_JOURS = 7

/**
 * Signe un access token court pour un utilisateur donné.
 *
 * @param {object} fastify - instance Fastify (a fastify.jwt depuis @fastify/jwt)
 * @param {object} utilisateur - { id, role, email, prenom }
 * @returns {string} JWT signé
 */
export function signerAccessToken(fastify, utilisateur) {
  return fastify.jwt.sign(
    {
      sub: utilisateur.id,
      role: utilisateur.role,
      email: utilisateur.email,
      prenom: utilisateur.prenom,
    },
    // expiresIn est déjà à 15m dans la config server.js mais on le précise
    // pour ne pas dépendre de l'ordre des sign options.
    { expiresIn: '15m' },
  )
}

/**
 * Vérifie un access token et renvoie le payload décodé.
 * @throws si invalide ou expiré.
 */
export function verifierAccessToken(fastify, token) {
  return fastify.jwt.verify(token)
}

/**
 * Crée un refresh token (chaîne random) et l'enregistre en DB.
 *
 * @param {object} prisma - PrismaClient
 * @param {number} utilisateurId
 * @returns {Promise<{token: string, expireLe: Date}>}
 */
export async function creerRefreshToken(prisma, utilisateurId) {
  const token = crypto.randomBytes(48).toString('hex')
  const expireLe = new Date(Date.now() + DUREE_REFRESH_JOURS * 24 * 60 * 60 * 1000)

  await prisma.refreshToken.create({
    data: {
      token,
      utilisateurId,
      expireLe,
    },
  })

  return { token, expireLe }
}

/**
 * Vérifie qu'un refresh token existe en DB et n'est pas expiré.
 * Renvoie l'enregistrement (avec utilisateur joint) ou null.
 *
 * @param {object} prisma
 * @param {string} token
 */
export async function verifierRefreshToken(prisma, token) {
  if (!token || typeof token !== 'string') return null

  const enreg = await prisma.refreshToken.findUnique({
    where: { token },
    include: { utilisateur: true },
  })

  if (!enreg) return null

  if (enreg.expireLe.getTime() < Date.now()) {
    // Expiré → on nettoie l'enregistrement orphelin
    await prisma.refreshToken.delete({ where: { id: enreg.id } }).catch(() => {})
    return null
  }

  if (!enreg.utilisateur.actif) return null

  return enreg
}

/**
 * Révoque un refresh token précis (logout courant).
 */
export async function revoquerRefreshToken(prisma, token) {
  if (!token) return
  await prisma.refreshToken.deleteMany({ where: { token } })
}

/**
 * Révoque TOUS les refresh tokens d'un utilisateur (logout global / sécurité).
 */
export async function revoquerTousRefreshTokens(prisma, utilisateurId) {
  await prisma.refreshToken.deleteMany({ where: { utilisateurId } })
}
