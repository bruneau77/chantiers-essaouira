/**
 * Routes CRUD Paiements
 *
 * Endpoints (préfixe /api/paiements) :
 *   POST   /     → créer un paiement reçu (admin uniquement)
 *   PATCH  /:id  → modifier (admin uniquement)
 *   DELETE /:id  → supprimer (admin uniquement)
 *
 * La LECTURE des paiements d'un poste se fait via GET /api/postes/:id
 * (include `paiements` déjà fourni par routes/postes.js).
 *
 * Note : pas de PATCH ni DELETE pour le chef en V1. Les paiements sont
 * une donnée comptable saisie par Dominique.
 *
 * Modes valides : 'CASH' | 'VIREMENT' (CHEQUE retiré en V1).
 */

import { z } from 'zod'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const MODES_VALIDES = ['CASH', 'VIREMENT']

const schemaCreation = z.object({
  posteId: z.number().int().positive('Poste requis.'),
  date: z.string().datetime().optional(),
  montantCentimes: z.number().int().positive('Le montant doit être supérieur à 0.'),
  mode: z.enum(MODES_VALIDES),
  description: z.string().max(500).optional().nullable(),
})

const schemaModification = z.object({
  date: z.string().datetime().optional(),
  montantCentimes: z.number().int().positive().optional(),
  mode: z.enum(MODES_VALIDES).optional(),
  description: z.string().max(500).optional().nullable(),
})

const includesPaiement = {
  poste: {
    select: {
      id: true,
      titre: true,
      lieu: { select: { id: true, reference: true, nom: true } },
    },
  },
}

export default async function routes(fastify) {
  /**
   * POST / — Créer un paiement (admin uniquement)
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

      const poste = await prisma.poste.findUnique({
        where: { id: data.posteId },
        select: { id: true },
      })
      if (!poste) {
        return reply.code(400).send({
          error: 'POSTE_INVALIDE',
          message: 'Le poste sélectionné n\'existe pas.',
        })
      }

      const paiement = await prisma.paiement.create({
        data: {
          posteId: data.posteId,
          date: data.date ? new Date(data.date) : new Date(),
          montantCentimes: data.montantCentimes,
          mode: data.mode,
          description: data.description ?? null,
        },
        include: includesPaiement,
      })

      return reply.code(201).send({ data: paiement })
    },
  )

  /**
   * PATCH /:id — Modifier un paiement (admin uniquement)
   */
  fastify.patch(
    '/:id',
    { preHandler: [fastify.authentifie, fastify.role(['admin'])] },
    async (req, reply) => {
      const id = parseInt(req.params.id, 10)
      if (isNaN(id)) {
        return reply.code(400).send({
          error: 'PARAM_INVALIDE',
          message: 'Identifiant de paiement invalide.',
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

      const existant = await prisma.paiement.findUnique({ where: { id } })
      if (!existant) {
        return reply.code(404).send({
          error: 'PAIEMENT_INTROUVABLE',
          message: 'Ce paiement n\'existe pas.',
        })
      }

      const updateData = { ...data }
      if ('date' in updateData) {
        updateData.date = updateData.date ? new Date(updateData.date) : existant.date
      }

      const paiement = await prisma.paiement.update({
        where: { id },
        data: updateData,
        include: includesPaiement,
      })

      return reply.send({ data: paiement })
    },
  )

  /**
   * DELETE /:id — Supprimer un paiement (admin uniquement)
   */
  fastify.delete(
    '/:id',
    { preHandler: [fastify.authentifie, fastify.role(['admin'])] },
    async (req, reply) => {
      const id = parseInt(req.params.id, 10)
      if (isNaN(id)) {
        return reply.code(400).send({
          error: 'PARAM_INVALIDE',
          message: 'Identifiant de paiement invalide.',
        })
      }

      const existant = await prisma.paiement.findUnique({ where: { id } })
      if (!existant) {
        return reply.code(404).send({
          error: 'PAIEMENT_INTROUVABLE',
          message: 'Ce paiement n\'existe pas.',
        })
      }

      await prisma.paiement.delete({ where: { id } })

      return reply.code(204).send()
    },
  )
}
