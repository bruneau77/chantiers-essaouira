/**
 * Route GET /api/users — liste des utilisateurs (admin only)
 *
 * Utilisée par les dropdowns frontend (sélection chef, client, destinataire
 * de budget, etc.). Réponse minimale : id, email, prenom, nom, role.
 *
 * Filtres optionnels :
 *   ?role=chef          → ne retourne que les chefs
 *   ?role=admin         → ne retourne que les admins
 *   ?role=client        → ne retourne que les clients
 *   ?actif=true|false   → filtre actifs / inactifs (par défaut : actifs uniquement)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ROLES_VALIDES = ['admin', 'chef', 'sous_traitant', 'client']

export default async function routes(fastify) {
  fastify.get(
    '/',
    { preHandler: [fastify.authentifie, fastify.role(['admin'])] },
    async (req, reply) => {
      const { role, actif } = req.query

      const where = {}

      if (role && ROLES_VALIDES.includes(role)) {
        where.role = role
      }

      // Par défaut on ne renvoie que les utilisateurs actifs
      if (actif === 'false') {
        where.actif = false
      } else if (actif !== 'all') {
        where.actif = true
      }

      const utilisateurs = await prisma.utilisateur.findMany({
        where,
        select: {
          id: true,
          email: true,
          prenom: true,
          nom: true,
          role: true,
          telephone: true,
          actif: true,
        },
        orderBy: [{ role: 'asc' }, { prenom: 'asc' }],
      })

      return reply.send({ data: utilisateurs })
    },
  )
}
