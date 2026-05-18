/**
 * Routes CRUD Chantiers
 *
 * Endpoints (préfixe /api/chantiers, monté dans server.js) :
 *   GET    /           → liste des chantiers (filtrable par statut, chef)
 *   GET    /:id        → détail d'un chantier avec relations
 *   POST   /           → créer un chantier (admin uniquement)
 *   PUT    /:id        → modifier un chantier (admin uniquement)
 *   DELETE /:id        → supprimer un chantier (admin uniquement)
 *
 * Conventions :
 *  - Validation zod sur tous les inputs
 *  - Toutes les valeurs monétaires en centimes DH
 *  - Recalcul automatique des frais essence si distance/AR changent
 *  - Messages en français
 */

import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { calculerFraisEssence } from '../lib/fraisKm.js'

const prisma = new PrismaClient()

// -------------------------------------------------------------------
// Schémas zod
// -------------------------------------------------------------------

const STATUTS_VALIDES = [
  'prospect', 'en_attente', 'en_cours', 'pause',
  'termine', 'cloture', 'annule',
]

const schemaCreation = z.object({
  titre: z.string().min(1, 'Le titre est requis.').max(200),
  description: z.string().max(2000).optional(),
  adresseChantier: z.string().min(1, 'L\'adresse du chantier est requise.').max(500),
  numero: z.string().min(1).max(50).optional(),
  chefId: z.number().int().positive('Chef de chantier requis.'),
  clientId: z.number().int().positive('Client requis.'),
  sousTraitantId: z.number().int().positive().optional().nullable(),
  statut: z.enum(STATUTS_VALIDES).optional(),
  distanceAllerKm: z.number().int().min(0).optional().nullable(),
  nombreAllerRetourPrevu: z.number().int().min(0).optional().nullable(),
  partChefPctSpecial: z.number().int().min(0).max(100).optional().nullable(),
  dateDebutPrevue: z.string().datetime().optional().nullable(),
  dateFinPrevue: z.string().datetime().optional().nullable(),
  dateDebutReelle: z.string().datetime().optional().nullable(),
  dateFinReelle: z.string().datetime().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
})

const schemaModification = schemaCreation.partial()

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

/**
 * Génère un numéro de chantier unique : CH-AAAA-NNN
 */
async function genererNumero() {
  const annee = new Date().getFullYear()
  const prefix = `CH-${annee}-`

  const dernier = await prisma.chantier.findFirst({
    where: { numero: { startsWith: prefix } },
    orderBy: { numero: 'desc' },
    select: { numero: true },
  })

  let compteur = 1
  if (dernier) {
    const num = parseInt(dernier.numero.replace(prefix, ''), 10)
    if (!isNaN(num)) compteur = num + 1
  }

  return `${prefix}${String(compteur).padStart(3, '0')}`
}

/**
 * Recalcule les frais d'essence si distance et AR sont renseignés.
 * Récupère les réglages globaux pour les paramètres voiture.
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
 * Includes standard pour charger les relations des chantiers.
 */
const includesChantier = {
  chef: { select: { id: true, prenom: true, nom: true, email: true, role: true } },
  client: { select: { id: true, prenom: true, nom: true, email: true, telephone: true } },
  sousTraitant: { select: { id: true, prenom: true, nom: true } },
  _count: { select: { devis: true, photos: true, paiements: true } },
}

const includesDetail = {
  ...includesChantier,
  devis: {
    select: {
      id: true, numero: true, statut: true, version: true,
      totalClientCentimes: true, totalBrutCentimes: true,
      dateEmission: true,
    },
    orderBy: { creeLe: 'desc' },
  },
  paiements: {
    select: {
      id: true, type: true, statut: true,
      montantCentimes: true, dateAttendue: true, dateRecue: true,
    },
    orderBy: { dateAttendue: 'asc' },
  },
  photos: {
    select: { id: true, titre: true, cheminFichier: true, uploadeLe: true },
    orderBy: { uploadeLe: 'desc' },
    take: 5,
  },
}

// -------------------------------------------------------------------
// Plugin Fastify
// -------------------------------------------------------------------

export default async function routes(fastify) {
  /**
   * GET / — Liste des chantiers
   *
   * Query params optionnels :
   *   ?statut=en_cours      filtre par statut
   *   ?chefId=2             filtre par chef
   *   ?page=1&perPage=20    pagination
   */
  fastify.get(
    '/',
    { preHandler: [fastify.authentifie] },
    async (req, reply) => {
      const { statut, chefId, page = '1', perPage = '20' } = req.query

      const where = {}

      // Filtre par statut
      if (statut && STATUTS_VALIDES.includes(statut)) {
        where.statut = statut
      }

      // Filtre par chef (un chef ne voit que ses chantiers)
      if (req.user.role === 'chef') {
        where.chefId = req.user.id
      } else if (chefId) {
        where.chefId = parseInt(chefId, 10)
      }

      const pageNum = Math.max(1, parseInt(page, 10) || 1)
      const limite = Math.min(50, Math.max(1, parseInt(perPage, 10) || 20))
      const offset = (pageNum - 1) * limite

      const [chantiers, total] = await Promise.all([
        prisma.chantier.findMany({
          where,
          include: includesChantier,
          orderBy: { creeLe: 'desc' },
          skip: offset,
          take: limite,
        }),
        prisma.chantier.count({ where }),
      ])

      return reply.send({
        data: chantiers,
        pagination: { total, page: pageNum, perPage: limite },
      })
    },
  )

  /**
   * GET /:id — Détail d'un chantier
   */
  fastify.get(
    '/:id',
    { preHandler: [fastify.authentifie] },
    async (req, reply) => {
      const id = parseInt(req.params.id, 10)
      if (isNaN(id)) {
        return reply.code(400).send({
          error: 'PARAM_INVALIDE',
          message: 'Identifiant de chantier invalide.',
        })
      }

      const chantier = await prisma.chantier.findUnique({
        where: { id },
        include: includesDetail,
      })

      if (!chantier) {
        return reply.code(404).send({
          error: 'CHANTIER_INTROUVABLE',
          message: 'Ce chantier n\'existe pas.',
        })
      }

      // [DEBUG typo prenom] à retirer une fois le bug trouvé
      // Imprime les codes Unicode de chaque caractère du prénom client
      // pour démasquer tout espace invisible (U+00A0, U+202F, U+200B, etc.)
      if (chantier.client) {
        const p = chantier.client.prenom ?? ''
        const codes = [...p].map((c) => `${c}=U+${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`).join(' ')
        console.log(`[DEBUG prenom client] chantier ${id} client.prenom = "${p}" (longueur ${p.length}) | codes: ${codes}`)
      }

      // Un chef ne peut voir que ses propres chantiers
      if (req.user.role === 'chef' && chantier.chefId !== req.user.id) {
        return reply.code(403).send({
          error: 'ACCES_REFUSE',
          message: 'Vous n\'avez pas accès à ce chantier.',
        })
      }

      return reply.send({ data: chantier })
    },
  )

  /**
   * POST / — Créer un chantier (admin uniquement)
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

      // Vérifier que le chef existe et a le bon rôle
      const chef = await prisma.utilisateur.findUnique({ where: { id: data.chefId } })
      if (!chef || !['chef', 'admin'].includes(chef.role)) {
        return reply.code(400).send({
          error: 'CHEF_INVALIDE',
          message: 'Le chef de chantier sélectionné n\'existe pas ou n\'a pas le bon rôle.',
        })
      }

      // Vérifier que le client existe
      const client = await prisma.utilisateur.findUnique({ where: { id: data.clientId } })
      if (!client) {
        return reply.code(400).send({
          error: 'CLIENT_INVALIDE',
          message: 'Le client sélectionné n\'existe pas.',
        })
      }

      // Générer numéro si non fourni
      const numero = data.numero || await genererNumero()

      // Calcul frais essence
      const fraisEssenceCentimes = await calculerFraisKmSiPossible(
        data.distanceAllerKm,
        data.nombreAllerRetourPrevu,
      )

      const chantier = await prisma.chantier.create({
        data: {
          numero,
          titre: data.titre,
          description: data.description ?? null,
          adresseChantier: data.adresseChantier,
          chefId: data.chefId,
          clientId: data.clientId,
          sousTraitantId: data.sousTraitantId ?? null,
          statut: data.statut ?? 'prospect',
          distanceAllerKm: data.distanceAllerKm ?? null,
          nombreAllerRetourPrevu: data.nombreAllerRetourPrevu ?? null,
          fraisEssenceCentimes,
          partChefPctSpecial: data.partChefPctSpecial ?? null,
          dateDebutPrevue: data.dateDebutPrevue ? new Date(data.dateDebutPrevue) : null,
          dateFinPrevue: data.dateFinPrevue ? new Date(data.dateFinPrevue) : null,
          dateDebutReelle: data.dateDebutReelle ? new Date(data.dateDebutReelle) : null,
          dateFinReelle: data.dateFinReelle ? new Date(data.dateFinReelle) : null,
          notes: data.notes ?? null,
        },
        include: includesChantier,
      })

      return reply.code(201).send({ data: chantier })
    },
  )

  /**
   * PUT /:id — Modifier un chantier (admin uniquement)
   */
  fastify.put(
    '/:id',
    { preHandler: [fastify.authentifie, fastify.role(['admin'])] },
    async (req, reply) => {
      const id = parseInt(req.params.id, 10)
      if (isNaN(id)) {
        return reply.code(400).send({
          error: 'PARAM_INVALIDE',
          message: 'Identifiant de chantier invalide.',
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

      // Vérifier que le chantier existe
      const existant = await prisma.chantier.findUnique({ where: { id } })
      if (!existant) {
        return reply.code(404).send({
          error: 'CHANTIER_INTROUVABLE',
          message: 'Ce chantier n\'existe pas.',
        })
      }

      // Recalcul frais essence si distance ou AR changent
      const distanceFinale = data.distanceAllerKm ?? existant.distanceAllerKm
      const arFinal = data.nombreAllerRetourPrevu ?? existant.nombreAllerRetourPrevu
      const distanceAChange = 'distanceAllerKm' in data || 'nombreAllerRetourPrevu' in data

      const updateData = { ...data }

      // Convertir les dates string en Date
      for (const champ of ['dateDebutPrevue', 'dateFinPrevue', 'dateDebutReelle', 'dateFinReelle']) {
        if (champ in updateData) {
          updateData[champ] = updateData[champ] ? new Date(updateData[champ]) : null
        }
      }

      if (distanceAChange) {
        updateData.fraisEssenceCentimes = await calculerFraisKmSiPossible(distanceFinale, arFinal)
      }

      const chantier = await prisma.chantier.update({
        where: { id },
        data: updateData,
        include: includesChantier,
      })

      return reply.send({ data: chantier })
    },
  )

  /**
   * DELETE /:id — Supprimer un chantier (admin uniquement)
   *
   * Cascade Prisma : les devis, paiements, photos, interventions liés
   * sont supprimés automatiquement (onDelete: Cascade dans le schéma).
   */
  fastify.delete(
    '/:id',
    { preHandler: [fastify.authentifie, fastify.role(['admin'])] },
    async (req, reply) => {
      const id = parseInt(req.params.id, 10)
      if (isNaN(id)) {
        return reply.code(400).send({
          error: 'PARAM_INVALIDE',
          message: 'Identifiant de chantier invalide.',
        })
      }

      const existant = await prisma.chantier.findUnique({ where: { id } })
      if (!existant) {
        return reply.code(404).send({
          error: 'CHANTIER_INTROUVABLE',
          message: 'Ce chantier n\'existe pas.',
        })
      }

      await prisma.chantier.delete({ where: { id } })

      return reply.code(204).send()
    },
  )
}
