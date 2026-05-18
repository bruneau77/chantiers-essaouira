/**
 * Middleware de vérification de rôle.
 *
 * Usage dans une route Fastify (ordre important : authentifie AVANT role) :
 *
 *   fastify.get('/admin-only',
 *     { preHandler: [fastify.authentifie, fastify.role(['admin'])] },
 *     async (req) => {...}
 *   )
 *
 *   // Plusieurs rôles autorisés :
 *   fastify.post('/devis',
 *     { preHandler: [fastify.authentifie, fastify.role(['admin', 'chef'])] },
 *     async (req) => {...}
 *   )
 *
 * Rôles métier (cf. CLAUDE.md) :
 *  - 'admin'         : Yassine — tout, y compris paramètres et marges brutes
 *  - 'chef'          : Dominique — chantiers, devis, paiements, avances
 *  - 'sous_traitant' : Rachid — ses chantiers, sa part, avancement, photos
 *  - 'client'        : ses devis (vue client), avancement, échéancier
 */

import fp from 'fastify-plugin'

const ROLES_VALIDES = ['admin', 'chef', 'sous_traitant', 'client']

/**
 * Factory : renvoie un preHandler qui vérifie que req.user.role est
 * dans la liste autorisée.
 *
 * @param {string[]} rolesAutorises
 * @returns {Function} preHandler Fastify
 */
function role(rolesAutorises) {
  if (!Array.isArray(rolesAutorises) || rolesAutorises.length === 0) {
    throw new Error('role() attend un tableau non vide de rôles autorisés')
  }
  for (const r of rolesAutorises) {
    if (!ROLES_VALIDES.includes(r)) {
      throw new Error(`Rôle inconnu : "${r}". Rôles valides : ${ROLES_VALIDES.join(', ')}`)
    }
  }

  return async function (req, reply) {
    if (!req.user) {
      // Defensive : normalement authentifie() a déjà tourné avant
      return reply.code(401).send({
        error: 'NON_AUTHENTIFIE',
        message: 'Authentification requise.',
      })
    }

    if (!rolesAutorises.includes(req.user.role)) {
      return reply.code(403).send({
        error: 'ACCES_REFUSE',
        message: `Accès réservé aux rôles : ${rolesAutorises.join(', ')}.`,
      })
    }
  }
}

/**
 * Plugin Fastify — décore l'instance avec fastify.role.
 */
export default fp(async function (fastify) {
  fastify.decorate('role', role)
})
