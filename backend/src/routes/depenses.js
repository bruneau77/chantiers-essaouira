/**
 * Routes CRUD Dépenses (chef + admin)
 *
 * Endpoints (préfixe /api/depenses) :
 *   GET    /a-valider/count  → entier (badge NavBas, admin only)
 *   POST   /                 → créer (chef sur ses lieux + admin partout)
 *   PATCH  /:id              → modifier (chef sa dépense non validée + admin toujours)
 *   PATCH  /:id/valider      → admin only
 *   DELETE /:id              → chef sa dépense non validée + admin toujours
 *
 * Refonte Lieu/Poste (session 2026-05-18) :
 *   - `chantierId` → `lieuId` (obligatoire)
 *   - `posteId` optionnel : permet d'affecter la dépense à un Poste précis
 *     du Lieu (vérification que le Poste appartient bien au Lieu)
 *   - `fournisseur` String? : texte libre (« Hassan menuisier », distributeur,
 *     etc.). Pas de modèle Fournisseur persistant en V1.
 *
 * Règles métier (inchangées par rapport à la version pré-refonte) :
 *  - Saisie chef          → statut A_VALIDER
 *  - Saisie admin         → statut VALIDEE auto
 *  - Chef peut modifier/supprimer sa propre dépense tant que A_VALIDER
 *  - Admin modifie une dépense A_VALIDER → validation auto + audit corrigee*
 *  - Admin modifie une dépense VALIDEE  → audit seulement
 */

import { z } from 'zod'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// -------------------------------------------------------------------
// Constantes & schémas zod
// -------------------------------------------------------------------

const CATEGORIES_VALIDES = ['ACOMPTE', 'MATERIEL', 'REPAS']

const schemaCreation = z.object({
  lieuId: z.number().int().positive('Lieu requis.'),
  posteId: z.number().int().positive().optional().nullable(),
  date: z.string().datetime().optional(), // par défaut : maintenant
  categorie: z.enum(CATEGORIES_VALIDES),
  montantCentimes: z.number().int().positive('Le montant doit être supérieur à 0.'),
  description: z.string().min(1, 'Description requise.').max(500),
  fournisseur: z.string().max(200).optional().nullable(),
  estAvancePersonnelle: z.boolean().optional().default(false),
})

const schemaModification = z.object({
  posteId: z.number().int().positive().optional().nullable(),
  date: z.string().datetime().optional(),
  categorie: z.enum(CATEGORIES_VALIDES).optional(),
  montantCentimes: z.number().int().positive().optional(),
  description: z.string().min(1).max(500).optional(),
  fournisseur: z.string().max(200).optional().nullable(),
  estAvancePersonnelle: z.boolean().optional(),
})

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

/**
 * Vérifie l'accès à un Lieu pour l'utilisateur courant.
 *   - admin : toujours
 *   - chef  : uniquement si chefId === user.id
 *
 * Retourne le Lieu (id, chefId) si OK, sinon envoie l'erreur et renvoie null.
 */
async function verifierAccesLieu(lieuId, user, reply) {
  const lieu = await prisma.lieu.findUnique({
    where: { id: lieuId },
    select: { id: true, chefId: true },
  })

  if (!lieu) {
    reply.code(404).send({
      error: 'LIEU_INTROUVABLE',
      message: 'Ce lieu n\'existe pas.',
    })
    return null
  }

  if (user.role === 'chef' && lieu.chefId !== user.id) {
    reply.code(403).send({
      error: 'ACCES_REFUSE',
      message: 'Vous ne pouvez agir que sur vos propres lieux.',
    })
    return null
  }

  return lieu
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

const includesDepense = {
  saisiePar: { select: { id: true, prenom: true, nom: true, role: true } },
  valideePar: { select: { id: true, prenom: true, nom: true } },
  corrigeePar: { select: { id: true, prenom: true, nom: true } },
  poste: { select: { id: true, titre: true, statut: true } },
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
   * Chef : sur SES Lieux uniquement, statut A_VALIDER.
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

      const lieu = await verifierAccesLieu(data.lieuId, req.user, reply)
      if (!lieu) return

      const posteOK = await verifierPosteDuLieu(data.posteId, data.lieuId, reply)
      if (!posteOK) return

      const estAdmin = req.user.role === 'admin'
      const maintenant = new Date()

      const depense = await prisma.depense.create({
        data: {
          lieuId: data.lieuId,
          posteId: data.posteId ?? null,
          saisieParId: req.user.id,
          date: data.date ? new Date(data.date) : maintenant,
          categorie: data.categorie,
          montantCentimes: data.montantCentimes,
          description: data.description,
          fournisseur: data.fournisseur?.trim() || null,
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
   *  - Chef : sa propre dépense ET tant que A_VALIDER
   *  - Admin : toujours. Si A_VALIDER → validation auto + audit. Si
   *    VALIDEE → audit seulement.
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
        include: { lieu: { select: { id: true, chefId: true } } },
      })

      if (!depense) {
        return reply.code(404).send({
          error: 'DEPENSE_INTROUVABLE',
          message: 'Cette dépense n\'existe pas.',
        })
      }

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

      // Si posteId est modifié, vérifier qu'il appartient au même Lieu
      if ('posteId' in data && data.posteId) {
        const posteOK = await verifierPosteDuLieu(data.posteId, depense.lieuId, reply)
        if (!posteOK) return
      }

      const updateData = { ...data }
      if ('date' in updateData) {
        updateData.date = updateData.date ? new Date(updateData.date) : depense.date
      }
      if ('fournisseur' in updateData) {
        updateData.fournisseur = updateData.fournisseur?.trim() || null
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
   *  - Chef : sa propre dépense ET A_VALIDER
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
