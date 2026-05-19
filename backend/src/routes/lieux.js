/**
 * Routes CRUD Lieux
 *
 * Endpoints (préfixe /api/lieux, monté dans server.js) :
 *   GET    /         → liste des lieux (filtres : statut, chefId, clientId)
 *   GET    /:id      → détail d'un lieu avec relations + postes
 *   POST   /         → créer un lieu (admin uniquement)
 *   PUT    /:id      → modifier un lieu (admin uniquement)
 *
 * IMPORTANT : pas de route DELETE en V1 (cf. JOURNAL 2026-05-18). Les
 * Lieux ne se suppriment pas. Le schéma Prisma a des Restrict côté
 * Postes/Depenses/BudgetLieu qui empêchent toute suppression accidentelle.
 *
 * Permissions :
 *   - Admin : tout
 *   - Chef  : voit uniquement les Lieux dont il est chefId. Ne peut
 *             ni créer ni modifier un Lieu (lecture seule sur la fiche).
 *
 * Conventions :
 *  - Validation zod sur tous les inputs
 *  - Valeurs monétaires en centimes DH (entiers)
 *  - Recalcul automatique des frais essence si distance/AR changent
 *  - Messages d'erreur en français
 */

import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { calculerFraisEssence } from '../lib/fraisKm.js'
import { selectPosteSelonRole } from '../lib/postesHelpers.js'

const prisma = new PrismaClient()

// -------------------------------------------------------------------
// Schémas zod
// -------------------------------------------------------------------

const STATUTS_LIEU = ['PROSPECT', 'EN_COURS', 'TERMINE']

const schemaCreation = z.object({
  nom: z.string().min(1, 'Le nom du lieu est requis.').max(200),
  clientId: z.number().int().positive('Client requis.'),
  chefId: z.number().int().positive().optional().nullable(),
  adresse: z.string().min(1, 'L\'adresse est requise.').max(500),
  budgetEstimatifCentimes: z.number().int().min(0).optional().nullable(),
  distanceAllerKm: z.number().int().min(0).optional().nullable(),
  nombreAllerRetourPrevu: z.number().int().min(0).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
})

const schemaModification = schemaCreation.partial()

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

/**
 * Génère une référence unique : L-AAAA-NNN (compteur annuel).
 */
async function genererReference() {
  const annee = new Date().getFullYear()
  const prefix = `L-${annee}-`

  const dernier = await prisma.lieu.findFirst({
    where: { reference: { startsWith: prefix } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  })

  let compteur = 1
  if (dernier) {
    const num = parseInt(dernier.reference.replace(prefix, ''), 10)
    if (!isNaN(num)) compteur = num + 1
  }

  return `${prefix}${String(compteur).padStart(3, '0')}`
}

/**
 * Recalcule les frais d'essence si distance et AR sont renseignés.
 */
async function calculerFraisKmSiPossible(distanceAllerKm, nombreAllerRetourPrevu) {
  if (!distanceAllerKm || !nombreAllerRetourPrevu) return 0

  const reglages = await prisma.reglages.findFirst({ where: { id: 1 } })
  if (!reglages) return 0

  return calculerFraisEssence({
    distanceAllerKm,
    nombreAllerRetourPrevu,
    reglages: {
      consommationL100km: reglages.consommationL100km,
      prixGasoilCentimes: reglages.prixGasoilCentimes,
      usureCentimesParKm: reglages.usureCentimesParKm,
      securiteAllerRetour: reglages.securiteAllerRetour,
    },
  })
}

/**
 * Include standard pour la liste : client, chef, _count des postes.
 */
const includesListe = {
  client: { select: { id: true, prenom: true, nom: true, email: true, telephone: true } },
  chef: { select: { id: true, prenom: true, nom: true } },
  _count: { select: { postes: true } },
}

/**
 * Include pour le détail : liste des postes (avec strip selon rôle),
 * paiements de chaque poste (pour calcul "encaissé" côté frontend).
 */
function includesDetail(user) {
  return {
    client: { select: { id: true, prenom: true, nom: true, email: true, telephone: true, adresse: true } },
    chef: { select: { id: true, prenom: true, nom: true, telephone: true } },
    postes: {
      select: {
        ...selectPosteSelonRole(user),
        paiements: {
          select: { id: true, montantCentimes: true, date: true, mode: true },
        },
      },
      orderBy: [{ ordre: 'asc' }, { creeLe: 'asc' }],
    },
  }
}

// -------------------------------------------------------------------
// Plugin Fastify
// -------------------------------------------------------------------

export default async function routes(fastify) {
  /**
   * GET / — Liste des lieux
   *
   * Query params optionnels :
   *   ?statut=EN_COURS  filtre par statut
   *   ?chefId=2         filtre par chef (admin seulement, ignoré sinon)
   *   ?clientId=5       filtre par client (admin seulement)
   *   ?page=1&perPage=20 pagination
   */
  fastify.get(
    '/',
    { preHandler: [fastify.authentifie] },
    async (req, reply) => {
      const { statut, chefId, clientId, page = '1', perPage = '20' } = req.query

      const where = {}

      if (statut && STATUTS_LIEU.includes(statut)) {
        where.statut = statut
      }

      // Un chef ne voit que ses lieux
      if (req.user.role === 'chef') {
        where.chefId = req.user.id
      } else {
        if (chefId) where.chefId = parseInt(chefId, 10)
        if (clientId) where.clientId = parseInt(clientId, 10)
      }

      const pageNum = Math.max(1, parseInt(page, 10) || 1)
      const limite = Math.min(50, Math.max(1, parseInt(perPage, 10) || 20))
      const offset = (pageNum - 1) * limite

      const [lieux, total] = await Promise.all([
        prisma.lieu.findMany({
          where,
          include: includesListe,
          orderBy: { creeLe: 'desc' },
          skip: offset,
          take: limite,
        }),
        prisma.lieu.count({ where }),
      ])

      return reply.send({
        data: lieux,
        pagination: { total, page: pageNum, perPage: limite },
      })
    },
  )

  /**
   * GET /:id — Détail d'un lieu (avec postes)
   * Chef : 403 s'il n'est pas le chef du lieu.
   */
  fastify.get(
    '/:id',
    { preHandler: [fastify.authentifie] },
    async (req, reply) => {
      const id = parseInt(req.params.id, 10)
      if (isNaN(id)) {
        return reply.code(400).send({
          error: 'PARAM_INVALIDE',
          message: 'Identifiant de lieu invalide.',
        })
      }

      const lieu = await prisma.lieu.findUnique({
        where: { id },
        include: includesDetail(req.user),
      })

      if (!lieu) {
        return reply.code(404).send({
          error: 'LIEU_INTROUVABLE',
          message: 'Ce lieu n\'existe pas.',
        })
      }

      if (req.user.role === 'chef' && lieu.chefId !== req.user.id) {
        return reply.code(403).send({
          error: 'ACCES_REFUSE',
          message: 'Vous n\'avez pas accès à ce lieu.',
        })
      }

      return reply.send({ data: lieu })
    },
  )

  /**
   * POST / — Créer un lieu (admin uniquement)
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

      // Vérifier l'existence du client
      const client = await prisma.utilisateur.findUnique({
        where: { id: data.clientId },
        select: { id: true, role: true },
      })
      if (!client) {
        return reply.code(400).send({
          error: 'CLIENT_INVALIDE',
          message: 'Le client sélectionné n\'existe pas.',
        })
      }

      // Vérifier l'existence du chef si fourni
      if (data.chefId) {
        const chef = await prisma.utilisateur.findUnique({
          where: { id: data.chefId },
          select: { id: true, role: true },
        })
        if (!chef || !['chef', 'admin'].includes(chef.role)) {
          return reply.code(400).send({
            error: 'CHEF_INVALIDE',
            message: 'Le chef sélectionné n\'existe pas ou n\'a pas le bon rôle.',
          })
        }
      }

      const reference = await genererReference()
      const fraisEssenceCentimes = await calculerFraisKmSiPossible(
        data.distanceAllerKm,
        data.nombreAllerRetourPrevu,
      )

      const lieu = await prisma.lieu.create({
        data: {
          reference,
          nom: data.nom,
          clientId: data.clientId,
          chefId: data.chefId ?? null,
          adresse: data.adresse,
          budgetEstimatifCentimes: data.budgetEstimatifCentimes ?? null,
          distanceAllerKm: data.distanceAllerKm ?? null,
          nombreAllerRetourPrevu: data.nombreAllerRetourPrevu ?? null,
          fraisEssenceCentimes,
          notes: data.notes ?? null,
          // statut par défaut PROSPECT (aucun Poste à la création)
        },
        include: includesListe,
      })

      return reply.code(201).send({ data: lieu })
    },
  )

  /**
   * PUT /:id — Modifier un lieu (admin uniquement)
   *
   * Note : on ne modifie PAS le statut via cette route (calculé d'après
   * les Postes). Si un statut est envoyé dans le body, il est ignoré.
   */
  fastify.put(
    '/:id',
    { preHandler: [fastify.authentifie, fastify.role(['admin'])] },
    async (req, reply) => {
      const id = parseInt(req.params.id, 10)
      if (isNaN(id)) {
        return reply.code(400).send({
          error: 'PARAM_INVALIDE',
          message: 'Identifiant de lieu invalide.',
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

      const existant = await prisma.lieu.findUnique({ where: { id } })
      if (!existant) {
        return reply.code(404).send({
          error: 'LIEU_INTROUVABLE',
          message: 'Ce lieu n\'existe pas.',
        })
      }

      // Vérifications référentielles si client/chef changent
      if (data.clientId && data.clientId !== existant.clientId) {
        const client = await prisma.utilisateur.findUnique({
          where: { id: data.clientId },
          select: { id: true },
        })
        if (!client) {
          return reply.code(400).send({
            error: 'CLIENT_INVALIDE',
            message: 'Le client sélectionné n\'existe pas.',
          })
        }
      }
      if (data.chefId && data.chefId !== existant.chefId) {
        const chef = await prisma.utilisateur.findUnique({
          where: { id: data.chefId },
          select: { id: true, role: true },
        })
        if (!chef || !['chef', 'admin'].includes(chef.role)) {
          return reply.code(400).send({
            error: 'CHEF_INVALIDE',
            message: 'Le chef sélectionné n\'existe pas ou n\'a pas le bon rôle.',
          })
        }
      }

      // Recalcul frais essence si distance ou AR changent
      const distanceFinale = data.distanceAllerKm ?? existant.distanceAllerKm
      const arFinal = data.nombreAllerRetourPrevu ?? existant.nombreAllerRetourPrevu
      const distanceAChange = 'distanceAllerKm' in data || 'nombreAllerRetourPrevu' in data

      const updateData = { ...data }
      if (distanceAChange) {
        updateData.fraisEssenceCentimes = await calculerFraisKmSiPossible(distanceFinale, arFinal)
      }

      const lieu = await prisma.lieu.update({
        where: { id },
        data: updateData,
        include: includesListe,
      })

      return reply.send({ data: lieu })
    },
  )
}
