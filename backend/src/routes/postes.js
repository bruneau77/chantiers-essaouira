/**
 * Routes CRUD Postes
 *
 * Endpoints (préfixe /api/postes) :
 *   GET    /         → liste (filtres : lieuId, statut)
 *   GET    /:id      → détail d'un poste + paiements
 *   POST   /         → créer un poste (admin uniquement)
 *   PATCH  /:id      → modifier (admin = libre ; chef = statut uniquement,
 *                                                machine à états)
 *   DELETE /:id      → supprimer (admin, refuse 409 si paiements/dépenses)
 *
 * Permissions chef (résumé) :
 *   - Lecture : ses Postes uniquement (filtrés via lieu.chefId)
 *   - Strip des montants côté API (defense in depth)
 *   - PATCH : `statut` uniquement, transitions A_FAIRE↔EN_COURS↔TERMINE
 *             (pas de retour en A_FAIRE). 422 si transition interdite.
 *   - POST/DELETE : interdits.
 *
 * Calculs auto :
 *   - margeCentimes = montantClientCentimes - montantBrutCentimes
 *   - margePourcent = brut > 0 ? (marge / brut) * 100 : 0
 *   - termineLe = renseigné quand statut passe à TERMINE, remis à null sinon
 *
 * Effets de bord :
 *   - Toute mutation déclenche recalculerStatutLieu(lieuId) dans la
 *     même transaction Prisma (atomique).
 */

import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import {
  selectPosteSelonRole,
  transitionAutorisee,
  recalculerStatutLieu,
  STATUTS_POSTE,
} from '../lib/postesHelpers.js'

const prisma = new PrismaClient()

// -------------------------------------------------------------------
// Schémas zod
// -------------------------------------------------------------------

const schemaCreation = z.object({
  lieuId: z.number().int().positive('Lieu requis.'),
  titre: z.string().min(1, 'Le titre est requis.').max(200),
  description: z.string().max(2000).optional().nullable(),
  ordre: z.number().int().min(0).optional(),
  statut: z.enum(STATUTS_POSTE).optional(),
  montantBrutCentimes: z.number().int().min(0).optional(),
  montantClientCentimes: z.number().int().min(0).optional(),
})

// Schéma admin (modification libre). On exclut explicitement lieuId
// (un Poste ne change pas de Lieu) et les champs marge (calculés).
const schemaModifAdmin = z.object({
  titre: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  ordre: z.number().int().min(0).optional(),
  statut: z.enum(STATUTS_POSTE).optional(),
  montantBrutCentimes: z.number().int().min(0).optional(),
  montantClientCentimes: z.number().int().min(0).optional(),
}).strict()

// Schéma chef (statut uniquement, .strict() refuse tout autre champ)
const schemaModifChef = z.object({
  statut: z.enum(STATUTS_POSTE),
}).strict()

// -------------------------------------------------------------------
// Helpers internes
// -------------------------------------------------------------------

/**
 * Calcule marge + pourcent à partir de brut / client.
 */
function calculerMarge(montantBrutCentimes, montantClientCentimes) {
  const margeCentimes = montantClientCentimes - montantBrutCentimes
  const margePourcent = montantBrutCentimes > 0
    ? parseFloat(((margeCentimes / montantBrutCentimes) * 100).toFixed(2))
    : 0
  return { margeCentimes, margePourcent }
}

/**
 * Charge le poste avec le lieu attaché pour vérification d'accès.
 * Retourne null + envoie la réponse d'erreur si introuvable / accès refusé.
 */
async function chargerPosteAvecAcces(id, user, reply) {
  const poste = await prisma.poste.findUnique({
    where: { id },
    include: { lieu: { select: { id: true, chefId: true } } },
  })
  if (!poste) {
    reply.code(404).send({
      error: 'POSTE_INTROUVABLE',
      message: 'Ce poste n\'existe pas.',
    })
    return null
  }
  if (user.role === 'chef' && poste.lieu.chefId !== user.id) {
    reply.code(403).send({
      error: 'ACCES_REFUSE',
      message: 'Vous n\'avez pas accès à ce poste.',
    })
    return null
  }
  return poste
}

const includesDetail = (user) => ({
  ...selectPosteSelonRole(user),
  lieu: {
    select: {
      id: true, reference: true, nom: true,
      chefId: true, clientId: true,
    },
  },
  paiements: {
    select: { id: true, date: true, montantCentimes: true, mode: true, description: true, creeLe: true },
    orderBy: { date: 'desc' },
  },
})

// -------------------------------------------------------------------
// Plugin Fastify
// -------------------------------------------------------------------

export default async function routes(fastify) {
  /**
   * GET / — Liste des postes
   *
   * Query params :
   *   ?lieuId=N    filtre par lieu
   *   ?statut=...  filtre par statut
   *
   * Le chef ne voit que les postes des Lieux dont il est chef
   * (filtre WHERE lieu.chefId === user.id appliqué quel que soit ?lieuId).
   */
  fastify.get(
    '/',
    { preHandler: [fastify.authentifie] },
    async (req, reply) => {
      const { lieuId, statut } = req.query

      const where = {}

      if (lieuId) {
        const id = parseInt(lieuId, 10)
        if (!isNaN(id)) where.lieuId = id
      }

      if (statut && STATUTS_POSTE.includes(statut)) {
        where.statut = statut
      }

      // Chef : restreint aux postes de ses Lieux
      if (req.user.role === 'chef') {
        where.lieu = { chefId: req.user.id }
      }

      // L'include `select` est appliqué via selectPosteSelonRole.
      // Pour combiner select + relations, on doit utiliser `select`
      // partout (Prisma refuse select + include mixés).
      const postes = await prisma.poste.findMany({
        where,
        select: {
          ...selectPosteSelonRole(req.user),
          lieu: { select: { id: true, reference: true, nom: true, chefId: true } },
        },
        orderBy: [{ ordre: 'asc' }, { creeLe: 'desc' }],
      })

      return reply.send({ data: postes })
    },
  )

  /**
   * GET /:id — Détail d'un poste (avec paiements)
   * Chef : 403 si pas chef du Lieu.
   */
  fastify.get(
    '/:id',
    { preHandler: [fastify.authentifie] },
    async (req, reply) => {
      const id = parseInt(req.params.id, 10)
      if (isNaN(id)) {
        return reply.code(400).send({
          error: 'PARAM_INVALIDE',
          message: 'Identifiant de poste invalide.',
        })
      }

      // On récupère le poste avec lieu.chefId pour l'autorisation,
      // puis on renvoie une projection filtrée par rôle.
      const posteAccess = await prisma.poste.findUnique({
        where: { id },
        select: { id: true, lieu: { select: { chefId: true } } },
      })
      if (!posteAccess) {
        return reply.code(404).send({
          error: 'POSTE_INTROUVABLE',
          message: 'Ce poste n\'existe pas.',
        })
      }
      if (req.user.role === 'chef' && posteAccess.lieu.chefId !== req.user.id) {
        return reply.code(403).send({
          error: 'ACCES_REFUSE',
          message: 'Vous n\'avez pas accès à ce poste.',
        })
      }

      const poste = await prisma.poste.findUnique({
        where: { id },
        select: includesDetail(req.user),
      })

      return reply.send({ data: poste })
    },
  )

  /**
   * POST / — Créer un poste (admin uniquement)
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

      const lieu = await prisma.lieu.findUnique({
        where: { id: data.lieuId },
        select: { id: true },
      })
      if (!lieu) {
        return reply.code(400).send({
          error: 'LIEU_INVALIDE',
          message: 'Le lieu sélectionné n\'existe pas.',
        })
      }

      const brut = data.montantBrutCentimes ?? 0
      const client = data.montantClientCentimes ?? 0
      const { margeCentimes, margePourcent } = calculerMarge(brut, client)
      const statut = data.statut ?? 'A_FAIRE'

      const poste = await prisma.$transaction(async (tx) => {
        const cree = await tx.poste.create({
          data: {
            lieuId: data.lieuId,
            titre: data.titre,
            description: data.description ?? null,
            ordre: data.ordre ?? 0,
            statut,
            termineLe: statut === 'TERMINE' ? new Date() : null,
            montantBrutCentimes: brut,
            montantClientCentimes: client,
            margeCentimes,
            margePourcent,
          },
        })
        await recalculerStatutLieu(tx, data.lieuId)
        return cree
      })

      // Renvoyer avec strip selon rôle (admin ici par préHandler)
      const posteRendu = await prisma.poste.findUnique({
        where: { id: poste.id },
        select: selectPosteSelonRole(req.user),
      })

      return reply.code(201).send({ data: posteRendu })
    },
  )

  /**
   * PATCH /:id — Modifier un poste
   *
   * Admin : tous les champs autorisés (schemaModifAdmin).
   * Chef  : `statut` uniquement (schemaModifChef.strict() refuse tout
   *         autre champ avec 400 VALIDATION). Transition validée par
   *         la machine à états → 422 TRANSITION_INTERDITE si KO.
   */
  fastify.patch(
    '/:id',
    { preHandler: [fastify.authentifie, fastify.role(['admin', 'chef'])] },
    async (req, reply) => {
      const id = parseInt(req.params.id, 10)
      if (isNaN(id)) {
        return reply.code(400).send({
          error: 'PARAM_INVALIDE',
          message: 'Identifiant de poste invalide.',
        })
      }

      const estAdmin = req.user.role === 'admin'

      // Validation différenciée par rôle
      let data
      try {
        const schema = estAdmin ? schemaModifAdmin : schemaModifChef
        data = schema.parse(req.body ?? {})
      } catch (err) {
        return reply.code(400).send({
          error: 'VALIDATION',
          message: 'Données invalides.',
          details: err.errors,
        })
      }

      const poste = await chargerPosteAvecAcces(id, req.user, reply)
      if (!poste) return // reply déjà envoyée

      // Validation transition statut
      if (data.statut && data.statut !== poste.statut) {
        if (!transitionAutorisee(req.user.role, poste.statut, data.statut)) {
          return reply.code(422).send({
            error: 'TRANSITION_INTERDITE',
            message: `Transition ${poste.statut} → ${data.statut} non autorisée pour ce rôle.`,
          })
        }
      }

      // Préparation des champs à écrire
      const updateData = { ...data }

      // Gestion termineLe (admin ou chef peu importe)
      if (data.statut) {
        if (data.statut === 'TERMINE' && poste.statut !== 'TERMINE') {
          updateData.termineLe = new Date()
        } else if (data.statut !== 'TERMINE' && poste.statut === 'TERMINE') {
          updateData.termineLe = null
        }
      }

      // Recalcul marge (admin uniquement, le chef ne peut pas envoyer
      // de montants — schemaModifChef.strict() les refuse)
      const brutFinal = data.montantBrutCentimes ?? poste.montantBrutCentimes
      const clientFinal = data.montantClientCentimes ?? poste.montantClientCentimes
      if ('montantBrutCentimes' in data || 'montantClientCentimes' in data) {
        const { margeCentimes, margePourcent } = calculerMarge(brutFinal, clientFinal)
        updateData.margeCentimes = margeCentimes
        updateData.margePourcent = margePourcent
      }

      await prisma.$transaction(async (tx) => {
        await tx.poste.update({ where: { id }, data: updateData })
        await recalculerStatutLieu(tx, poste.lieuId)
      })

      const posteRendu = await prisma.poste.findUnique({
        where: { id },
        select: selectPosteSelonRole(req.user),
      })

      return reply.send({ data: posteRendu })
    },
  )

  /**
   * DELETE /:id — Supprimer un poste (admin uniquement)
   *
   * Pré-vérification :
   *   - 0 paiement rattaché ET
   *   - 0 dépense rattachée (via posteId)
   * Sinon 409 POSTE_NON_SUPPRIMABLE.
   *
   * Note : le schéma Prisma a aussi `onDelete: Restrict` sur Paiement →
   * Poste comme filet de sécurité. Pour Depense.posteId c'est SetNull
   * mais on choisit de refuser quand même la suppression pour éviter
   * de désynchroniser silencieusement la compta.
   */
  fastify.delete(
    '/:id',
    { preHandler: [fastify.authentifie, fastify.role(['admin'])] },
    async (req, reply) => {
      const id = parseInt(req.params.id, 10)
      if (isNaN(id)) {
        return reply.code(400).send({
          error: 'PARAM_INVALIDE',
          message: 'Identifiant de poste invalide.',
        })
      }

      const poste = await prisma.poste.findUnique({
        where: { id },
        select: { id: true, lieuId: true },
      })
      if (!poste) {
        return reply.code(404).send({
          error: 'POSTE_INTROUVABLE',
          message: 'Ce poste n\'existe pas.',
        })
      }

      const [nbPaiements, nbDepenses] = await Promise.all([
        prisma.paiement.count({ where: { posteId: id } }),
        prisma.depense.count({ where: { posteId: id } }),
      ])

      if (nbPaiements > 0 || nbDepenses > 0) {
        return reply.code(409).send({
          error: 'POSTE_NON_SUPPRIMABLE',
          message: `Ce poste a ${nbPaiements} paiement(s) et ${nbDepenses} dépense(s) rattaché(s) et ne peut pas être supprimé.`,
        })
      }

      await prisma.$transaction(async (tx) => {
        await tx.poste.delete({ where: { id } })
        await recalculerStatutLieu(tx, poste.lieuId)
      })

      return reply.code(204).send()
    },
  )
}
