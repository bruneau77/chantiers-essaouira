/**
 * Routes d'authentification.
 *
 * Endpoints (préfixe /api/auth, monté dans server.js) :
 *   POST   /login    → { accessToken, refreshToken, user }
 *   POST   /refresh  → { accessToken }
 *   POST   /logout   → 204
 *   GET    /me       → { user } (protégé)
 *
 * Conventions projet :
 *  - Validation entrées avec zod (cf. backend/CLAUDE.md)
 *  - Messages utilisateurs en français
 *  - Réponses : { data: ... } pour succès, { error, message } pour erreurs
 */

import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { verifierMotDePasse } from '../lib/password.js'
import {
  signerAccessToken,
  creerRefreshToken,
  verifierRefreshToken,
  revoquerRefreshToken,
} from '../lib/tokens.js'

const prisma = new PrismaClient()

// -------------------------------------------------------------------
// Schémas zod
// -------------------------------------------------------------------

const schemaLogin = z.object({
  email: z.string().email('Email invalide.').toLowerCase(),
  motDePasse: z.string().min(1, 'Mot de passe requis.'),
})

const schemaRefresh = z.object({
  refreshToken: z.string().min(20, 'Refresh token invalide.'),
})

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

/**
 * Sérialise un utilisateur pour la réponse API (sans hash mot de passe).
 */
function sanitiserUtilisateur(u) {
  return {
    id: u.id,
    email: u.email,
    prenom: u.prenom,
    nom: u.nom,
    telephone: u.telephone ?? null,
    role: u.role,
    partDefautPct: u.partDefautPct,
  }
}

// -------------------------------------------------------------------
// Plugin Fastify
// -------------------------------------------------------------------

export default async function routes(fastify) {
  /**
   * POST /login
   * Body : { email, motDePasse }
   * → { data: { accessToken, refreshToken, user } }
   */
  fastify.post('/login', async (req, reply) => {
    let data
    try {
      data = schemaLogin.parse(req.body ?? {})
    } catch (err) {
      return reply.code(400).send({
        error: 'VALIDATION',
        message: 'Email ou mot de passe au mauvais format.',
        details: err.errors,
      })
    }

    const utilisateur = await prisma.utilisateur.findUnique({
      where: { email: data.email },
    })

    // Message identique en cas d'utilisateur inconnu ou mauvais mot de passe
    // pour ne pas révéler l'existence d'un compte (énumération d'emails).
    const erreurAuth = {
      error: 'IDENTIFIANTS_INVALIDES',
      message: 'Email ou mot de passe incorrect.',
    }

    if (!utilisateur || !utilisateur.actif) {
      return reply.code(401).send(erreurAuth)
    }

    // Garde : un compte sans motDePasseHash (typiquement un client créé
    // depuis le formulaire chantier, sans accès à l'app) ne peut pas se
    // connecter. On renvoie la MÊME erreur générique que pour un mauvais
    // mot de passe, pour ne pas révéler l'existence du compte.
    if (!utilisateur.motDePasseHash) {
      return reply.code(401).send(erreurAuth)
    }

    const ok = await verifierMotDePasse(data.motDePasse, utilisateur.motDePasseHash)
    if (!ok) {
      return reply.code(401).send(erreurAuth)
    }

    // Génère les tokens
    const accessToken = signerAccessToken(fastify, utilisateur)
    const { token: refreshToken, expireLe } = await creerRefreshToken(prisma, utilisateur.id)

    return reply.send({
      data: {
        accessToken,
        refreshToken,
        refreshExpireLe: expireLe.toISOString(),
        user: sanitiserUtilisateur(utilisateur),
      },
    })
  })

  /**
   * POST /refresh
   * Body : { refreshToken }
   * → { data: { accessToken } }
   *
   * Note : on ne fait PAS de rotation du refresh token pour la V1 (simplicité).
   * Le client peut continuer d'utiliser le même refresh jusqu'à expiration.
   */
  fastify.post('/refresh', async (req, reply) => {
    let data
    try {
      data = schemaRefresh.parse(req.body ?? {})
    } catch (err) {
      return reply.code(400).send({
        error: 'VALIDATION',
        message: 'Refresh token manquant.',
      })
    }

    const enreg = await verifierRefreshToken(prisma, data.refreshToken)
    if (!enreg) {
      return reply.code(401).send({
        error: 'REFRESH_INVALIDE',
        message: 'Refresh token invalide ou expiré. Veuillez vous reconnecter.',
      })
    }

    const accessToken = signerAccessToken(fastify, enreg.utilisateur)
    return reply.send({ data: { accessToken } })
  })

  /**
   * POST /logout
   * Body : { refreshToken } (optionnel)
   * → 204
   *
   * Invalide le refresh token côté serveur. L'access token n'est pas
   * révocable (par design, durée 15 min seulement).
   */
  fastify.post('/logout', async (req, reply) => {
    const token = req.body?.refreshToken
    if (token) {
      await revoquerRefreshToken(prisma, token)
    }
    return reply.code(204).send()
  })

  /**
   * GET /me
   * Header : Authorization: Bearer <accessToken>
   * → { data: { user } }
   */
  fastify.get(
    '/me',
    { preHandler: [fastify.authentifie] },
    async (req, reply) => {
      return reply.send({ data: { user: req.user } })
    },
  )
}
