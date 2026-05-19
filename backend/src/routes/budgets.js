/**
 * Routes CRUD Budgets Lieu (admin only)
 *
 * Endpoints (préfixe /api/budgets) :
 *   POST   /     → créer un versement / remboursement
 *   PATCH  /:id  → modifier
 *   DELETE /:id  → supprimer
 *
 * La LECTURE des budgets d'un lieu se fait via
 * GET /api/lieux/:id/budgets (défini dans routes/compta.js sous le
 * préfixe /api/lieux pour rester collé au domaine Lieu).
 *
 * Refonte Lieu/Poste (session 2026-05-18) :
 *   - `chantierId` → `lieuId` (obligatoire)
 *   - `posteId` optionnel : permet d'affecter un versement à un Poste
 *     précis (vérification que le Poste appartient bien au Lieu)
 *
 * Types :
 *   - VERSEMENT     : Dominique donne du cash à Rachid pour démarrer
 *   - REMBOURSEMENT : Dominique rembourse une avance personnelle Rachid
 */

import { z } from 'zod'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TYPES_VALIDES = ['VERSEMENT', 'REMBOURSEMENT']

const schemaCreation = z.object({
  lieuId: z.number().int().positive('Lieu requis.'),
  posteId: z.number().int().positive().optional().nullable(),
  userId: z.number().int().positive('Destinataire requis.'),
  date: z.string().datetime().optional(),
  montantCentimes: z.number().int().positive('Le montant doit être supérieur à 0.'),
  type: z.enum(TYPES_VALIDES),
  description: z.string().max(500).optional().nullable(),
})

const schemaModification = z.object({
  posteId: z.number().int().positive().optional().nullable(),
  date: z.string().datetime().optional(),
  montantCentimes: z.number().int().positive().optional(),
  type: z.enum(TYPES_VALIDES).optional(),
  description: z.string().max(500).optional().nullable(),
})

const includesBudget = {
  user: { select: { id: true, prenom: true, nom: true, role: true } },
  creePar: { select: { id: true, prenom: true, nom: true } },
  lieu: { select: { id: true, reference: true, nom: true } },
  poste: { select: { id: true, titre: true } },
}

/**
 * Vérifie qu'un Poste appartient bien au Lieu indiqué.
 * Si posteId est null/undefined, OK (affectation optionnelle).
 */
async function verifierPosteDuLieu(posteId, lieuId, reply) {
  if (!posteId) return true
  const poste = await prisma.poste.findUnique({
    where: { id: posteId },
    select: { lieuId: true },
  })
  if (!poste || poste.lieuId !== lieuId) {
    reply.code(400).send({
      error: 'POSTE_INVALIDE',
      message: 'Le poste sélectionné n\'appartient pas à ce lieu.',
    })
    return false
  }
  return true
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
      const lieu = await prisma.lieu.findUnique({ where: { id: data.lieuId } })
      if (!lieu) {
        return reply.code(400).send({
          error: 'LIEU_INVALIDE',
          message: 'Le lieu sélectionné n\'existe pas.',
        })
      }

      const posteOK = await verifierPosteDuLieu(data.posteId, data.lieuId, reply)
      if (!posteOK) return

      const destinataire = await prisma.utilisateur.findUnique({ where: { id: data.userId } })
      if (!destinataire) {
        return reply.code(400).send({
          error: 'DESTINATAIRE_INVALIDE',
          message: 'Le destinataire sélectionné n\'existe pas.',
        })
      }

      const budget = await prisma.budgetLieu.create({
        data: {
          lieuId: data.lieuId,
          posteId: data.posteId ?? null,
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

      const existant = await prisma.budgetLieu.findUnique({ where: { id } })
      if (!existant) {
        return reply.code(404).send({
          error: 'BUDGET_INTROUVABLE',
          message: 'Ce budget n\'existe pas.',
        })
      }

      // Si posteId est modifié, vérifier qu'il appartient au même Lieu
      if ('posteId' in data && data.posteId) {
        const posteOK = await verifierPosteDuLieu(data.posteId, existant.lieuId, reply)
        if (!posteOK) return
      }

      const updateData = { ...data }
      if ('date' in updateData) {
        updateData.date = updateData.date ? new Date(updateData.date) : existant.date
      }

      const budget = await prisma.budgetLieu.update({
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

      const existant = await prisma.budgetLieu.findUnique({ where: { id } })
      if (!existant) {
        return reply.code(404).send({
          error: 'BUDGET_INTROUVABLE',
          message: 'Ce budget n\'existe pas.',
        })
      }

      await prisma.budgetLieu.delete({ where: { id } })

      return reply.code(204).send()
    },
  )
}
