/**
 * Route POST /api/clients — créer un nouveau client (admin only)
 *
 * Un "client" est techniquement un `Utilisateur` avec role='client'.
 * Cette route est un wrapper léger qui :
 *   - valide les champs métier d'une fiche client (prenom + nom obligatoires)
 *   - autorise email ET motDePasseHash null (clients qui ne se connectent
 *     pas à l'app — accès futur via URL secrète par chantier, cf. décision
 *     "Espace client" du journal)
 *   - force role='client'
 *
 * Pour LISTER les clients, on utilise `GET /api/users?role=client` (déjà
 * disponible dans routes/users.js — pas de duplication).
 */

import { z } from 'zod'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Email optionnel mais validé si fourni. On accepte aussi chaîne vide
// (le frontend envoie souvent `email: ''` plutôt que d'omettre le champ).
const schemaCreation = z.object({
  prenom: z.string().min(1, 'Le prénom est requis.').max(100),
  nom: z.string().min(1, 'Le nom est requis.').max(100),
  telephone: z.string().max(50).optional().nullable(),
  email: z.union([
    z.string().email('Email invalide.'),
    z.literal(''),
    z.null(),
  ]).optional(),
  adresse: z.string().max(500).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
})

export default async function routes(fastify) {
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

      // Normalisation : chaîne vide → null pour les champs optionnels
      const emailNorm = data.email && data.email.trim() ? data.email.trim() : null
      const telNorm = data.telephone && data.telephone.trim() ? data.telephone.trim() : null
      const adresseNorm = data.adresse && data.adresse.trim() ? data.adresse.trim() : null
      const notesNorm = data.notes && data.notes.trim() ? data.notes.trim() : null

      // Si email fourni : vérifier qu'il n'est pas déjà utilisé
      if (emailNorm) {
        const existant = await prisma.utilisateur.findUnique({
          where: { email: emailNorm },
          select: { id: true },
        })
        if (existant) {
          return reply.code(409).send({
            error: 'EMAIL_DEJA_UTILISE',
            message: 'Un utilisateur avec cet email existe déjà.',
          })
        }
      }

      // NB : on n'inclut PAS `motDePasseHash` dans data — pour un champ
      // optionnel, Prisma attend qu'on OMETTE le champ plutôt que de le
      // passer à null explicite (cas marginal du client TypeScript qui
      // peut rester strict sur les nullables même après une migration).
      // La colonne SQL recevra NULL par défaut.
      const client = await prisma.utilisateur.create({
        data: {
          email: emailNorm,
          prenom: data.prenom.trim(),
          nom: data.nom.trim(),
          telephone: telNorm,
          adresse: adresseNorm,
          notes: notesNorm,
          role: 'client',
        },
        select: {
          id: true,
          email: true,
          prenom: true,
          nom: true,
          telephone: true,
          adresse: true,
          notes: true,
          role: true,
          actif: true,
        },
      })

      return reply.code(201).send({ data: client })
    },
  )
}
