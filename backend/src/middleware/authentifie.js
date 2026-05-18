/**
 * Middleware d'authentification — vérifie le JWT d'accès et charge l'utilisateur.
 *
 * Usage dans une route Fastify :
 *
 *   fastify.get('/', { preHandler: [fastify.authentifie] }, async (req) => {
 *     req.user // { id, role, email, prenom }
 *   })
 *
 * À enregistrer dans server.js via fastify.decorate('authentifie', ...).
 */

import fp from 'fastify-plugin'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * preHandler Fastify. Lit le header Authorization: Bearer <token>,
 * vérifie le JWT, charge l'utilisateur depuis la DB, attache req.user.
 *
 * Réponses :
 *  - 401 NON_AUTHENTIFIE si pas de token, token invalide, ou utilisateur inactif/supprimé.
 */
async function authentifie(req, reply) {
  // Récupère le token depuis Authorization: Bearer xxx
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return reply.code(401).send({
      error: 'NON_AUTHENTIFIE',
      message: 'Token d\'accès manquant ou mal formé.',
    })
  }

  const token = header.slice('Bearer '.length).trim()

  let payload
  try {
    payload = req.server.jwt.verify(token)
  } catch (err) {
    return reply.code(401).send({
      error: 'TOKEN_INVALIDE',
      message: 'Token d\'accès invalide ou expiré.',
    })
  }

  // Recharge l'utilisateur depuis la DB pour avoir un état frais
  // (rôle, actif). On évite le cache pour qu'une désactivation soit
  // effective immédiatement.
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      prenom: true,
      nom: true,
      role: true,
      actif: true,
      partDefautPct: true,
    },
  })

  if (!utilisateur || !utilisateur.actif) {
    return reply.code(401).send({
      error: 'UTILISATEUR_INTROUVABLE',
      message: 'Utilisateur introuvable ou désactivé.',
    })
  }

  req.user = utilisateur
}

/**
 * Plugin Fastify — décore l'instance avec fastify.authentifie.
 * Encapsulé avec fastify-plugin pour que la décoration soit visible
 * dans toutes les routes (pas seulement la scope locale).
 */
export default fp(async function (fastify) {
  fastify.decorate('authentifie', authentifie)
})
