/**
 * Serveur Fastify — point d'entrée de l'API
 *
 * Démarrage : `npm run dev` (avec --watch) ou `npm start`
 */

import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import staticPlugin from '@fastify/static'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Middleware
import authentifiePlugin from './middleware/authentifie.js'
import rolePlugin from './middleware/role.js'

// Routes
import authRoutes from './routes/auth.js'
import chantiersRoutes from './routes/chantiers.js'
import usersRoutes from './routes/users.js'
import clientsRoutes from './routes/clients.js'
import depensesRoutes from './routes/depenses.js'
import budgetsRoutes from './routes/budgets.js'
import comptaRoutes, { routesComptaChantier } from './routes/compta.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: process.env.NODE_ENV === 'production'
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true } },
  },
})

// CORS
await fastify.register(cors, {
  origin: process.env.CORS_ORIGINS?.split(',') ?? true,
  credentials: true,
})

// JWT (access tokens)
await fastify.register(jwt, {
  secret: process.env.JWT_SECRET,
  sign: { expiresIn: '15m' },
})

// Upload fichiers (photos chantier)
await fastify.register(multipart, {
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
})

// Servir les uploads en static
const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? './uploads')
await fastify.register(staticPlugin, {
  root: uploadDir,
  prefix: '/uploads/',
})

// Middleware d'authentification (décore fastify.authentifie et fastify.role)
await fastify.register(authentifiePlugin)
await fastify.register(rolePlugin)

// Health check
fastify.get('/api/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  service: 'chantiers-essaouira-api',
}))

// Routes — Auth (priorité 1) ✓
await fastify.register(authRoutes, { prefix: '/api/auth' })

// Routes — Chantiers (priorité 2) ✓
await fastify.register(chantiersRoutes, { prefix: '/api/chantiers' })
// Extensions compta du préfixe /api/chantiers :
//   GET /api/chantiers/:id/compta
//   GET /api/chantiers/:id/budgets
await fastify.register(routesComptaChantier, { prefix: '/api/chantiers' })

// Routes — Users (dropdowns frontend, admin only) ✓
await fastify.register(usersRoutes, { prefix: '/api/users' })

// Routes — Clients (création inline depuis le formulaire chantier, admin only) ✓
await fastify.register(clientsRoutes, { prefix: '/api/clients' })

// Routes — Compta (priorité 3) ✓
await fastify.register(depensesRoutes, { prefix: '/api/depenses' })
await fastify.register(budgetsRoutes, { prefix: '/api/budgets' })
await fastify.register(comptaRoutes, { prefix: '/api/compta' })

// Routes (à implémenter progressivement)
// import devisRoutes from './routes/devis.js'
// import paiementsRoutes from './routes/paiements.js'
// import avancesRoutes from './routes/avances.js'
// import catalogueRoutes from './routes/catalogue.js'
// import planningRoutes from './routes/planning.js'
// import reglagesRoutes from './routes/reglages.js'
//
// await fastify.register(chantiersRoutes, { prefix: '/api/chantiers' })
// await fastify.register(devisRoutes, { prefix: '/api/devis' })
// await fastify.register(paiementsRoutes, { prefix: '/api/paiements' })
// await fastify.register(avancesRoutes, { prefix: '/api/avances' })
// await fastify.register(catalogueRoutes, { prefix: '/api/catalogue' })
// await fastify.register(planningRoutes, { prefix: '/api/planning' })
// await fastify.register(reglagesRoutes, { prefix: '/api/reglages' })

// Démarrage
const port = parseInt(process.env.PORT ?? '3000', 10)
const host = process.env.HOST ?? '0.0.0.0'

try {
  await fastify.listen({ port, host })
  fastify.log.info(`API Chantiers Essaouira en écoute sur http://${host}:${port}`)
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
