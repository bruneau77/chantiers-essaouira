/**
 * Routes Compta
 *
 * Endpoints :
 *   GET /api/compta/dashboard         → tableau de bord admin (admin only)
 *   GET /api/lieux/:id/compta         → vue compta d'un lieu (admin + chef sur SES lieux)
 *   GET /api/lieux/:id/budgets        → liste des versements/remboursements d'un lieu
 *
 * Les 2 derniers sont montés sous /api/lieux (extension du domaine
 * Lieu), enregistrés dans server.js via l'export `routesComptaLieu`.
 *
 * Calculs (centimes DH) — par Lieu :
 *  - budgetRecu          = Σ BudgetLieu.montantCentimes WHERE type = VERSEMENT
 *  - totalDepense        = Σ Depense.montantCentimes WHERE estAvancePersonnelle = false
 *  - soldeRestant        = budgetRecu - totalDepense
 *  - totalAvancesPerso   = Σ Depense.montantCentimes WHERE estAvancePersonnelle = true
 *  - totalRembourse      = Σ BudgetLieu.montantCentimes WHERE type = REMBOURSEMENT
 *  - dominiqueMeDoit     = totalAvancesPerso - totalRembourse
 *
 * Refonte 2026-05-18 :
 *  - chantier → lieu partout
 *  - Dashboard admin remplace la section "paiements clients en attente"
 *    par "créances à recouvrer" : Postes TERMINE non intégralement payés,
 *    triés par termineLe asc (la plus ancienne créance d'abord).
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// -------------------------------------------------------------------
// Helpers — agrégats par Lieu
// -------------------------------------------------------------------

/**
 * Calcule les totaux compta pour un Lieu donné.
 * Renvoie aussi la liste des dépenses et des budgets.
 */
async function calculerComptaLieu(lieuId) {
  const [depenses, budgets] = await Promise.all([
    prisma.depense.findMany({
      where: { lieuId },
      include: {
        saisiePar: { select: { id: true, prenom: true, nom: true, role: true } },
        valideePar: { select: { id: true, prenom: true, nom: true } },
        corrigeePar: { select: { id: true, prenom: true, nom: true } },
        poste: { select: { id: true, titre: true, statut: true } },
      },
      orderBy: { date: 'desc' },
    }),
    prisma.budgetLieu.findMany({
      where: { lieuId },
      include: {
        user: { select: { id: true, prenom: true, nom: true } },
        creePar: { select: { id: true, prenom: true, nom: true } },
        poste: { select: { id: true, titre: true } },
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

/**
 * Calcule les créances à recouvrer (dashboard admin).
 *
 * Retourne la liste des Postes TERMINE dont la somme des paiements
 * est strictement inférieure à montantClientCentimes. Triés par
 * termineLe ascendant (la plus vieille créance d'abord).
 */
async function calculerCreancesARecouvrer() {
  // On charge tous les Postes TERMINE avec leurs paiements et le Lieu.
  // Le volume est faible en V1 (quelques dizaines de postes max), on
  // ne s'embête pas avec un raw SQL.
  const postesTermine = await prisma.poste.findMany({
    where: { statut: 'TERMINE' },
    select: {
      id: true,
      titre: true,
      montantClientCentimes: true,
      termineLe: true,
      lieu: { select: { id: true, reference: true, nom: true } },
      paiements: { select: { montantCentimes: true } },
    },
    orderBy: { termineLe: 'asc' },
  })

  const creances = []
  for (const p of postesTermine) {
    const totalPayeCentimes = p.paiements.reduce((s, pa) => s + pa.montantCentimes, 0)
    const resteCentimes = p.montantClientCentimes - totalPayeCentimes
    if (resteCentimes > 0) {
      creances.push({
        lieu: p.lieu,
        poste: { id: p.id, titre: p.titre },
        montantClientCentimes: p.montantClientCentimes,
        totalPayeCentimes,
        resteCentimes,
        termineLe: p.termineLe,
      })
    }
  }
  return creances
}

// -------------------------------------------------------------------
// Plugin Fastify — préfixe /api/compta
// -------------------------------------------------------------------

export default async function routesCompta(fastify) {
  /**
   * GET /api/compta/dashboard — tableau de bord admin
   *
   * Retourne :
   *   - depensesAValider[]             : toutes les dépenses A_VALIDER, tous lieux
   *   - lieuxAvecSolde[]               : lieux EN_COURS avec leur solde budget
   *   - totalAvancesNonRembourseesCentimes : ce que Dominique doit à Rachid (cumulé)
   *   - creancesARecouvrer[]           : Postes TERMINE non intégralement payés
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
          lieu: { select: { id: true, reference: true, nom: true } },
          poste: { select: { id: true, titre: true } },
        },
        orderBy: { date: 'asc' },
      })

      // 2. Lieux en cours avec leur solde budget
      const lieuxActifs = await prisma.lieu.findMany({
        where: { statut: 'EN_COURS' },
        select: {
          id: true,
          reference: true,
          nom: true,
          statut: true,
          chef: { select: { id: true, prenom: true, nom: true } },
        },
        orderBy: { creeLe: 'desc' },
      })

      const lieuxAvecSolde = []
      let totalAvancesNonRembourseesCentimes = 0

      for (const l of lieuxActifs) {
        const compta = await calculerComptaLieu(l.id)
        lieuxAvecSolde.push({
          id: l.id,
          reference: l.reference,
          nom: l.nom,
          statut: l.statut,
          chef: l.chef,
          budgetRecuCentimes: compta.budgetRecuCentimes,
          totalDepenseCentimes: compta.totalDepenseCentimes,
          soldeRestantCentimes: compta.soldeRestantCentimes,
          dominiqueMeDoitCentimes: compta.dominiqueMeDoitCentimes,
        })
        totalAvancesNonRembourseesCentimes += compta.dominiqueMeDoitCentimes
      }

      // 3. Créances à recouvrer (remplace l'ancienne section "paiements
      //    clients en attente" qui s'appuyait sur l'échéancier 30/40/30
      //    supprimé).
      const creancesARecouvrer = await calculerCreancesARecouvrer()

      return reply.send({
        data: {
          depensesAValider,
          lieuxAvecSolde,
          totalAvancesNonRembourseesCentimes,
          creancesARecouvrer,
        },
      })
    },
  )
}

// -------------------------------------------------------------------
// Plugin Fastify — préfixe /api/lieux (extensions compta)
// -------------------------------------------------------------------

export async function routesComptaLieu(fastify) {
  /**
   * GET /api/lieux/:id/compta — vue compta d'un lieu
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
          message: 'Identifiant de lieu invalide.',
        })
      }

      const lieu = await prisma.lieu.findUnique({
        where: { id },
        select: {
          id: true,
          reference: true,
          nom: true,
          chefId: true,
          chef: { select: { id: true, prenom: true, nom: true } },
        },
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
          message: 'Vous n\'avez pas accès à la compta de ce lieu.',
        })
      }

      const compta = await calculerComptaLieu(id)

      return reply.send({
        data: {
          lieu,
          ...compta,
        },
      })
    },
  )

  /**
   * GET /api/lieux/:id/budgets — liste des versements/remboursements
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
          message: 'Identifiant de lieu invalide.',
        })
      }

      const lieu = await prisma.lieu.findUnique({
        where: { id },
        select: { id: true, chefId: true },
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

      const budgets = await prisma.budgetLieu.findMany({
        where: { lieuId: id },
        include: {
          user: { select: { id: true, prenom: true, nom: true } },
          creePar: { select: { id: true, prenom: true, nom: true } },
          poste: { select: { id: true, titre: true } },
        },
        orderBy: { date: 'desc' },
      })

      return reply.send({ data: budgets })
    },
  )
}
