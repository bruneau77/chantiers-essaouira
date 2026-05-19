/**
 * Routes administratives — opérations de maintenance (admin only).
 *
 * Endpoints (préfixe /api/admin) :
 *   POST /recalculer-statuts → recalcule le statut de TOUS les Lieux
 *                              à partir de l'état de leurs Postes
 *
 * Ces routes ne sont pas exposées dans l'UI V1. Elles sont prévues
 * pour usage curl/Postman par un admin en cas de :
 *   - désynchronisation suspectée du statut Lieu
 *   - import de données externes
 *   - debug
 */

import { PrismaClient } from '@prisma/client'
import { recalculerStatutLieu } from '../lib/postesHelpers.js'

const prisma = new PrismaClient()

export default async function routes(fastify) {
  /**
   * POST /recalculer-statuts
   * Parcourt tous les Lieux et recalcule leur statut. Retourne le
   * nombre total traité et le nombre dont le statut a changé.
   *
   * Idempotent : peut être relancé sans danger.
   */
  fastify.post(
    '/recalculer-statuts',
    { preHandler: [fastify.authentifie, fastify.role(['admin'])] },
    async (_req, reply) => {
      const lieux = await prisma.lieu.findMany({
        select: { id: true, statut: true },
      })

      let lieuxModifies = 0

      // Chaque lieu dans sa propre transaction (recalc + update si besoin).
      // recalculerStatutLieu fait déjà le check "ne pas écrire si pas de
      // changement" — on compte les changements effectifs ici en
      // re-comparant avant/après.
      for (const lieu of lieux) {
        const nouveauStatut = await prisma.$transaction(async (tx) => {
          return recalculerStatutLieu(tx, lieu.id)
        })
        if (nouveauStatut !== lieu.statut) lieuxModifies++
      }

      return reply.send({
        data: {
          lieuxTraites: lieux.length,
          lieuxModifies,
        },
      })
    },
  )
}
