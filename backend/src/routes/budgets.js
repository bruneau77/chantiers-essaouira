/**
 * Routes CRUD Budgets de chantier (admin only)
 *
 * Endpoints (préfixe /api/budgets) :
 *   POST   /                 → créer un versement / remboursement
 *   PATCH  /:id              → modifier
 *   DELETE /:id              → supprimer
 *
 * Le `GET /api/chantiers/:id/budgets` (liste pour un chantier) est défini
 * dans routes/chantiersExtensions.js pour rester collé au préfixe /chantiers.
 *
 * Types :
 *   - VERSEMENT     : Dominique donne du cash à Rachid en début de chantier
 *   - REMBOURSEMENT : Dominique rembourse une avance personnelle de Rachid
 */

import { z } from 'zod'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TYPES_VALIDES = ['VERSEMENT', 'REMBOURSEMENT']

const schemaCreation = z.object({
  chantierId: z.number().int().positive('Chantier requis.'),
  userId: z.number().int().positive('Destinataire requis.'),
  date: z.string().datetime().optional(),
  montantCentimes: z.number().int().positive('Le montant doit être supérieur à 0.'),
  type: z.enum(TYPES_VALIDES),
  description: z.string().max(500).optional().nullable(),
})

const schemaModification = z.object({
  date: z.string().datetime().optional(),
  montantCentimes: z.number().int().positive().optional(),
  type: z.enum(TYPES_VALIDES).optional(),
  description: z.string().max(500).optional().nullable(),
})

const includesBudget = {
  user: { select: { id: true, prenom: true, nom: true, role: true } },
  creePar: { select: { id: true, prenom: true, nom: true } },
  chantier: { select: { id: true, numero: true, titre: true } },
}

export default async function routes(fastify) {
  /**
   * POST / — Créer un versement / remboursement (admin only)
   */
  fastify.post(
    '/',
    { preHandler: [fastify.authentifie, fastify.role(['admin'])] },
    async (req, reply) => {
      let data
      try {
        data = schemaCreation.parse(req.body ?? {})
      } catch (err) {
        return reply.code(400).send({
          error: 'VALIDATION',
          message: 'Données invalides.',
          details: err.errors,
        })
      }

      // Vérifs d'existence
      const chantier = await prisma.chantier.findUnique({ where: { id: data.chantierId } })
      if (!chantier) {
        return reply.code(400).send({
          error: 'CHANTIER_INVALIDE',
          message: 'Le chantier sélectionné n\'existe pas.',
        })
      }

      const destinataire = await prisma.utilisateur.findUnique({ where: { id: data.userId } })
      if (!destinataire) {
        return reply.code(400).send({
          error: 'DESTINATAIRE_INVALIDE',
          message: 'Le destinataire sélectionné n\'existe pas.',
        })
      }

      const budget = await prisma.budgetChantier.create({
        data: {
          chantierId: data.chantierId,
          userId: data.userId,
          date: data.date ? new Date(data.date) : new Date(),
          montantCentimes: data.montantCentimes,
          type: data.type,
          description: data.description ?? null,
          creeParId: req.user.id,
        },
        include: includesBudget,
      })

      return reply.code(201).send({ data: budget })
    },
  )

  /**
   * PATCH /:id — Modifier (admin only)
   */
  fastify.patch(
    '/:id',
    { preHandler: [fastify.authentifie, fastify.role(['admin'])] },
    async (req, reply) => {
      const id = parseInt(req.params.id, 10)
      if (isNaN(id)) {
        return reply.code(400).send({
          error: 'PARAM_INVALIDE',
          message: 'Identifiant de budget invalide.',
        })
      }

      let data
      try {
        data = schemaModification.parse(req.body ?? {})
      } catch (err) {
        return reply.code(400).send({
          error: 'VALIDATION',
          message: 'Données invalides.',
          details: err.errors,
        })
      }

      const existant = await prisma.budgetChantier.findUnique({ where: { id } })
      if (!existant) {
        return reply.code(404).send({
          error: 'BUDGET_INTROUVABLE',
          message: 'Ce budget n\'existe pas.',
        })
      }

      const updateData = { ...data }
      if ('date' in updateData) {
        updateData.date = updateData.date ? new Date(updateData.date) : existant.date
      }

      const budget = await prisma.budgetChantier.update({
        where: { id },
        data: updateData,
        include: includesBudget,
      })

      return reply.send({ data: budget })
    },
  )

  /**
   * DELETE /:id — Supprimer (admin only)
   */
  fastify.delete(
    '/:id',
    { preHandler: [fastify.authentifie, fastify.role(['admin'])] },
    async (req, reply) => {
      const id = parseInt(req.params.id, 10)
      if (isNaN(id)) {
        return reply.code(400).send({
          error: 'PARAM_INVALIDE',
          message: 'Identifiant de budget invalide.',
        })
      }

      const existant = await prisma.budgetChantier.findUnique({ where: { id } })
      if (!existant) {
        return reply.code(404).send({
          error: 'BUDGET_INTROUVABLE',
          message: 'Ce budget n\'existe pas.',
        })
      }

      await prisma.budgetChantier.delete({ where: { id } })

      return reply.code(204).send()
    },
  )
}
