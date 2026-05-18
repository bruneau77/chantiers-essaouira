/**
 * Routes CRUD Dépenses chantier
 *
 * Endpoints (préfixe /api/depenses) :
 *   GET    /a-valider/count  → entier (badge NavBas, admin only)
 *   POST   /                 → créer (chef sur ses chantiers + admin partout)
 *   PATCH  /:id              → modifier (chef sa dépense non validée + admin toujours)
 *   PATCH  /:id/valider      → admin only
 *   DELETE /:id              → chef sa dépense non validée + admin toujours
 *
 * Règles métier (cf. cahier des charges) :
 *  - Saisie chef          → statut A_VALIDER
 *  - Saisie admin         → statut VALIDEE auto (l'admin valide à la création)
 *  - Chef peut modifier/supprimer sa propre dépense tant que A_VALIDER
 *  - Admin peut Valider (statut → VALIDEE, lock pour le chef) ou Modifier
 *    (modif + lock auto, traçabilité corrigeeParId/corrigeeLe)
 *  - Une dépense VALIDEE est modifiable uniquement par admin (chef en lecture)
 */

import { z } from 'zod'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// -------------------------------------------------------------------
// Constantes & schémas zod
// -------------------------------------------------------------------

const CATEGORIES_VALIDES = ['ACOMPTE', 'MATERIEL', 'REPAS']

const schemaCreation = z.object({
  chantierId: z.number().int().positive('Chantier requis.'),
  date: z.string().datetime().optional(), // par défaut : maintenant
  categorie: z.enum(CATEGORIES_VALIDES),
  montantCentimes: z.number().int().positive('Le montant doit être supérieur à 0.'),
  description: z.string().min(1, 'Description requise.').max(500),
  estAvancePersonnelle: z.boolean().optional().default(false),
})

const schemaModification = z.object({
  date: z.string().datetime().optional(),
  categorie: z.enum(CATEGORIES_VALIDES).optional(),
  montantCentimes: z.number().int().positive().optional(),
  description: z.string().min(1).max(500).optional(),
  estAvancePersonnelle: z.boolean().optional(),
})

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

/**
 * Vérifie que l'utilisateur a le droit de voir/manipuler les dépenses
 * d'un chantier donné.
 *  - admin : toujours
 *  - chef  : uniquement si chefId === user.id
 *
 * Retourne le chantier si OK, sinon envoie la réponse d'erreur et retourne null.
 */
async function verifierAccesChantier(chantierId, user, reply) {
  const chantier = await prisma.chantier.findUnique({
    where: { id: chantierId },
    select: { id: true, chefId: true },
  })

  if (!chantier) {
    reply.code(404).send({
      error: 'CHANTIER_INTROUVABLE',
      message: 'Ce chantier n\'existe pas.',
    })
    return null
  }

  if (user.role === 'chef' && chantier.chefId !== user.id) {
    reply.code(403).send({
      error: 'ACCES_REFUSE',
      message: 'Vous ne pouvez agir que sur vos propres chantiers.',
    })
    return null
  }

  return chantier
}

const includesDepense = {
  saisiePar: { select: { id: true, prenom: true, nom: true, role: true } },
  valideePar: { select: { id: true, prenom: true, nom: true } },
  corrigeePar: { select: { id: true, prenom: true, nom: true } },
}

// -------------------------------------------------------------------
// Plugin Fastify
// -------------------------------------------------------------------

export default async function routes(fastify) {
  /**
   * GET /a-valider/count — compteur de dépenses A_VALIDER (admin only)
   * Sert au badge sur l'onglet Compta du NavBas.
   */
  fastify.get(
    '/a-valider/count',
    { preHandler: [fastify.authentifie, fastify.role(['admin'])] },
    async (_req, reply) => {
      const count = await prisma.depense.count({ where: { statut: 'A_VALIDER' } })
      return reply.send({ data: { count } })
    },
  )

  /**
   * POST / — Créer une dépense
   * Chef : uniquement sur ses chantiers, statut A_VALIDER.
   * Admin : partout, statut VALIDEE auto (validation à la création).
   */
  fastify.post(
    '/',
    { preHandler: [fastify.authentifie, fastify.role(['admin', 'chef'])] },
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

      const chantier = await verifierAccesChantier(data.chantierId, req.user, reply)
      if (!chantier) return

      // Si l'auteur est admin, la dépense est créée directement en VALIDEE
      // (validation automatique cohérente avec la règle "modif admin = validation").
      // Si l'auteur est chef, la dépense entre en A_VALIDER comme prévu.
      const estAdmin = req.user.role === 'admin'
      const maintenant = new Date()

      const depense = await prisma.depense.create({
        data: {
          chantierId: data.chantierId,
          saisieParId: req.user.id,
          date: data.date ? new Date(data.date) : maintenant,
          categorie: data.categorie,
          montantCentimes: data.montantCentimes,
          description: data.description,
          estAvancePersonnelle: data.estAvancePersonnelle ?? false,
          statut: estAdmin ? 'VALIDEE' : 'A_VALIDER',
          valideeParId: estAdmin ? req.user.id : null,
          valideeLe: estAdmin ? maintenant : null,
        },
        include: includesDepense,
      })

      return reply.code(201).send({ data: depense })
    },
  )

  /**
   * PATCH /:id — Modifier une dépense
   *  - Chef : uniquement sa propre dépense ET tant qu'elle est A_VALIDER
   *  - Admin : toujours. Si la dépense est A_VALIDER, la modif vaut validation
   *    automatique (statut → VALIDEE), traçabilité corrigeeParId/corrigeeLe.
   */
  fastify.patch(
    '/:id',
    { preHandler: [fastify.authentifie, fastify.role(['admin', 'chef'])] },
    async (req, reply) => {
      const id = parseInt(req.params.id, 10)
      if (isNaN(id)) {
        return reply.code(400).send({
          error: 'PARAM_INVALIDE',
          message: 'Identifiant de dépense invalide.',
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

      const depense = await prisma.depense.findUnique({
        where: { id },
        include: { chantier: { select: { id: true, chefId: true } } },
      })

      if (!depense) {
        return reply.code(404).send({
          error: 'DEPENSE_INTROUVABLE',
          message: 'Cette dépense n\'existe pas.',
        })
      }

      // Règles de permission
      const estAdmin = req.user.role === 'admin'
      const estChef = req.user.role === 'chef'

      if (estChef) {
        if (depense.saisieParId !== req.user.id) {
          return reply.code(403).send({
            error: 'ACCES_REFUSE',
            message: 'Vous ne pouvez modifier que vos propres dépenses.',
          })
        }
        if (depense.statut !== 'A_VALIDER') {
          return reply.code(403).send({
            error: 'DEPENSE_VERROUILLEE',
            message: 'Cette dépense a été validée, vous ne pouvez plus la modifier.',
          })
        }
      }

      const updateData = { ...data }
      if ('date' in updateData) {
        updateData.date = updateData.date ? new Date(updateData.date) : depense.date
      }

      // Si admin modifie une dépense A_VALIDER → validation auto + audit
      if (estAdmin && depense.statut === 'A_VALIDER') {
        updateData.statut = 'VALIDEE'
        updateData.valideeParId = req.user.id
        updateData.valideeLe = new Date()
        updateData.corrigeeParId = req.user.id
        updateData.corrigeeLe = new Date()
      } else if (estAdmin) {
        // Admin modifie une dépense déjà validée → audit seulement
        updateData.corrigeeParId = req.user.id
        updateData.corrigeeLe = new Date()
      }

      const depenseMaj = await prisma.depense.update({
        where: { id },
        data: updateData,
        include: includesDepense,
      })

      return reply.send({ data: depenseMaj })
    },
  )

  /**
   * PATCH /:id/valider — Valider une dépense (admin only)
   * Statut A_VALIDER → VALIDEE, sans modifier les champs métier.
   */
  fastify.patch(
    '/:id/valider',
    { preHandler: [fastify.authentifie, fastify.role(['admin'])] },
    async (req, reply) => {
      const id = parseInt(req.params.id, 10)
      if (isNaN(id)) {
        return reply.code(400).send({
          error: 'PARAM_INVALIDE',
          message: 'Identifiant de dépense invalide.',
        })
      }

      const depense = await prisma.depense.findUnique({ where: { id } })
      if (!depense) {
        return reply.code(404).send({
          error: 'DEPENSE_INTROUVABLE',
          message: 'Cette dépense n\'existe pas.',
        })
      }

      if (depense.statut === 'VALIDEE') {
        return reply.code(400).send({
          error: 'DEJA_VALIDEE',
          message: 'Cette dépense est déjà validée.',
        })
      }

      const depenseMaj = await prisma.depense.update({
        where: { id },
        data: {
          statut: 'VALIDEE',
          valideeParId: req.user.id,
          valideeLe: new Date(),
        },
        include: includesDepense,
      })

      return reply.send({ data: depenseMaj })
    },
  )

  /**
   * DELETE /:id — Supprimer une dépense
   *  - Chef : uniquement sa propre dépense ET A_VALIDER
   *  - Admin : toujours
   */
  fastify.delete(
    '/:id',
    { preHandler: [fastify.authentifie, fastify.role(['admin', 'chef'])] },
    async (req, reply) => {
      const id = parseInt(req.params.id, 10)
      if (isNaN(id)) {
        return reply.code(400).send({
          error: 'PARAM_INVALIDE',
          message: 'Identifiant de dépense invalide.',
        })
      }

      const depense = await prisma.depense.findUnique({ where: { id } })
      if (!depense) {
        return reply.code(404).send({
          error: 'DEPENSE_INTROUVABLE',
          message: 'Cette dépense n\'existe pas.',
        })
      }

      if (req.user.role === 'chef') {
        if (depense.saisieParId !== req.user.id) {
          return reply.code(403).send({
            error: 'ACCES_REFUSE',
            message: 'Vous ne pouvez supprimer que vos propres dépenses.',
          })
        }
        if (depense.statut !== 'A_VALIDER') {
          return reply.code(403).send({
            error: 'DEPENSE_VERROUILLEE',
            message: 'Cette dépense a été validée, vous ne pouvez plus la supprimer.',
          })
        }
      }

      await prisma.depense.delete({ where: { id } })

      return reply.code(204).send()
    },
  )
}
