/**
 * Routes Compta
 *
 * Endpoints :
 *   GET /api/compta/dashboard           → tableau de bord admin (admin only)
 *   GET /api/chantiers/:id/compta       → vue compta par chantier (admin + chef sur SES chantiers)
 *   GET /api/chantiers/:id/budgets      → liste des versements/remboursements d'un chantier
 *
 * Note : les 2 derniers sont montés sous /api/chantiers (préfixe différent),
 * mais on les regroupe ici pour la cohérence métier. Ils sont enregistrés
 * dans server.js sous un préfixe différent.
 *
 * Calculs (centimes DH) :
 *  - budgetRecu          = Σ BudgetChantier.montantCentimes WHERE type = VERSEMENT
 *  - totalDepense        = Σ Depense.montantCentimes WHERE estAvancePersonnelle = false
 *  - soldeRestant        = budgetRecu - totalDepense
 *  - totalAvances        = Σ Depense.montantCentimes WHERE estAvancePersonnelle = true
 *  - totalRembourse      = Σ BudgetChantier.montantCentimes WHERE type = REMBOURSEMENT
 *  - dominiqueMeDoit     = totalAvances - totalRembourse
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// -------------------------------------------------------------------
// Helpers — agrégats
// -------------------------------------------------------------------

/**
 * Calcule les totaux compta pour un chantier donné.
 * Renvoie aussi la liste des dépenses et des budgets.
 */
async function calculerComptaChantier(chantierId) {
  const [depenses, budgets] = await Promise.all([
    prisma.depense.findMany({
      where: { chantierId },
      include: {
        saisiePar: { select: { id: true, prenom: true, nom: true, role: true } },
        valideePar: { select: { id: true, prenom: true, nom: true } },
        corrigeePar: { select: { id: true, prenom: true, nom: true } },
      },
      orderBy: { date: 'desc' },
    }),
    prisma.budgetChantier.findMany({
      where: { chantierId },
      include: {
        user: { select: { id: true, prenom: true, nom: true } },
        creePar: { select: { id: true, prenom: true, nom: true } },
      },
      orderBy: { date: 'desc' },
    }),
  ])

  let budgetRecuCentimes = 0
  let totalRembourseCentimes = 0
  for (const b of budgets) {
    if (b.type === 'VERSEMENT') budgetRecuCentimes += b.montantCentimes
    else if (b.type === 'REMBOURSEMENT') totalRembourseCentimes += b.montantCentimes
  }

  let totalDepenseCentimes = 0
  let totalAvancesPersoCentimes = 0
  for (const d of depenses) {
    if (d.estAvancePersonnelle) totalAvancesPersoCentimes += d.montantCentimes
    else totalDepenseCentimes += d.montantCentimes
  }

  return {
    budgetRecuCentimes,
    totalDepenseCentimes,
    soldeRestantCentimes: budgetRecuCentimes - totalDepenseCentimes,
    totalAvancesPersoCentimes,
    totalRembourseCentimes,
    dominiqueMeDoitCentimes: totalAvancesPersoCentimes - totalRembourseCentimes,
    depenses,
    budgets,
  }
}

// -------------------------------------------------------------------
// Plugin Fastify — préfixe /api/compta
// -------------------------------------------------------------------

export default async function routesCompta(fastify) {
  /**
   * GET /api/compta/dashboard — tableau de bord admin
   *
   * Retourne :
   *   - depensesAValider[]            : toutes les dépenses A_VALIDER, tous chantiers
   *   - chantiersAvecSolde[]          : chantiers actifs avec solde budget
   *   - totalAvancesNonRembourseesCentimes : ce que Dominique doit à Rachid (cumulé)
   *   - paiementsClientsEnAttente[]   : paiements clients statut "attendu"
   */
  fastify.get(
    '/dashboard',
    { preHandler: [fastify.authentifie, fastify.role(['admin'])] },
    async (_req, reply) => {
      // 1. Dépenses à valider (toutes confondues)
      const depensesAValider = await prisma.depense.findMany({
        where: { statut: 'A_VALIDER' },
        include: {
          saisiePar: { select: { id: true, prenom: true, nom: true, role: true } },
          chantier: { select: { id: true, numero: true, titre: true } },
        },
        orderBy: { date: 'asc' },
      })

      // 2. Chantiers actifs avec leur solde budget
      const chantiersActifs = await prisma.chantier.findMany({
        where: { statut: { in: ['en_cours', 'en_attente', 'pause'] } },
        select: {
          id: true,
          numero: true,
          titre: true,
          statut: true,
          chef: { select: { id: true, prenom: true, nom: true } },
        },
        orderBy: { creeLe: 'desc' },
      })

      const chantiersAvecSolde = []
      let totalAvancesNonRembourseesCentimes = 0

      for (const c of chantiersActifs) {
        const compta = await calculerComptaChantier(c.id)
        chantiersAvecSolde.push({
          id: c.id,
          numero: c.numero,
          titre: c.titre,
          statut: c.statut,
          chef: c.chef,
          budgetRecuCentimes: compta.budgetRecuCentimes,
          totalDepenseCentimes: compta.totalDepenseCentimes,
          soldeRestantCentimes: compta.soldeRestantCentimes,
          dominiqueMeDoitCentimes: compta.dominiqueMeDoitCentimes,
        })
        totalAvancesNonRembourseesCentimes += compta.dominiqueMeDoitCentimes
      }

      // 3. Paiements clients en attente (statut "attendu")
      const paiementsClientsEnAttente = await prisma.paiement.findMany({
        where: { statut: 'attendu' },
        include: {
          chantier: {
            select: {
              id: true,
              numero: true,
              titre: true,
              client: { select: { id: true, prenom: true, nom: true } },
            },
          },
        },
        orderBy: { dateAttendue: 'asc' },
      })

      return reply.send({
        data: {
          depensesAValider,
          chantiersAvecSolde,
          totalAvancesNonRembourseesCentimes,
          paiementsClientsEnAttente,
        },
      })
    },
  )
}

// -------------------------------------------------------------------
// Plugin Fastify — préfixe /api/chantiers (extensions compta)
// -------------------------------------------------------------------

export async function routesComptaChantier(fastify) {
  /**
   * GET /api/chantiers/:id/compta — vue compta d'un chantier
   * Admin : toujours. Chef : uniquement si chefId === user.id.
   */
  fastify.get(
    '/:id/compta',
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
        select: {
          id: true,
          numero: true,
          titre: true,
          chefId: true,
          chef: { select: { id: true, prenom: true, nom: true } },
        },
      })

      if (!chantier) {
        return reply.code(404).send({
          error: 'CHANTIER_INTROUVABLE',
          message: 'Ce chantier n\'existe pas.',
        })
      }

      if (req.user.role === 'chef' && chantier.chefId !== req.user.id) {
        return reply.code(403).send({
          error: 'ACCES_REFUSE',
          message: 'Vous n\'avez pas accès à la compta de ce chantier.',
        })
      }

      const compta = await calculerComptaChantier(id)

      return reply.send({
        data: {
          chantier,
          ...compta,
        },
      })
    },
  )

  /**
   * GET /api/chantiers/:id/budgets — liste des versements/remboursements
   * Admin : toujours. Chef : uniquement si chefId === user.id.
   */
  fastify.get(
    '/:id/budgets',
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
        select: { id: true, chefId: true },
      })

      if (!chantier) {
        return reply.code(404).send({
          error: 'CHANTIER_INTROUVABLE',
          message: 'Ce chantier n\'existe pas.',
        })
      }

      if (req.user.role === 'chef' && chantier.chefId !== req.user.id) {
        return reply.code(403).send({
          error: 'ACCES_REFUSE',
          message: 'Vous n\'avez pas accès à ce chantier.',
        })
      }

      const budgets = await prisma.budgetChantier.findMany({
        where: { chantierId: id },
        include: {
          user: { select: { id: true, prenom: true, nom: true } },
          creePar: { select: { id: true, prenom: true, nom: true } },
        },
        orderBy: { date: 'desc' },
      })

      return reply.send({ data: budgets })
    },
  )
}
