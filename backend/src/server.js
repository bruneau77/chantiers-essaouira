/**
 * Serveur Fastify — point d'entrée de l'API
 *
 * Démarrage : `npm run dev` (avec --watch) ou `npm start`
 *
 * Architecture refonte 2026-05-18 (cf. docs/JOURNAL.md) :
 *   - /api/auth          : authentification (login, refresh, logout, me)
 *   - /api/users         : liste utilisateurs (dropdowns admin)
 *   - /api/clients       : création client inline (admin)
 *   - /api/lieux         : CRUD Lieux + extensions compta (/:id/compta, /:id/budgets)
 *   - /api/postes        : CRUD Postes (admin + chef avec restrictions)
 *   - /api/paiements     : CRUD Paiements (admin)
 *   - /api/depenses      : CRUD Dépenses (admin + chef)
 *   - /api/budgets       : CRUD BudgetLieu (admin)
 *   - /api/compta        : dashboard admin
 *   - /api/admin         : maintenance (recalculer-statuts)
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
import usersRoutes from './routes/users.js'
import clientsRoutes from './routes/clients.js'
import lieuxRoutes from './routes/lieux.js'
import postesRoutes from './routes/postes.js'
import paiementsRoutes from './routes/paiements.js'
import depensesRoutes from './routes/depenses.js'
import budgetsRoutes from './routes/budgets.js'
import comptaRoutes, { routesComptaLieu } from './routes/compta.js'
import adminRoutes from './routes/admin.js'

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

// Upload fichiers (module Photos prévu mais sans API en V1)
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

// -------------------------------------------------------------------
// Routes — montage
// -------------------------------------------------------------------

// Auth (priorité 1) ✓
await fastify.register(authRoutes, { prefix: '/api/auth' })

// Utilisateurs (dropdowns admin) ✓
await fastify.register(usersRoutes, { prefix: '/api/users' })

// Clients (création inline) ✓
await fastify.register(clientsRoutes, { prefix: '/api/clients' })

// Lieux + extensions compta (compta/budgets d'un lieu) ✓
await fastify.register(lieuxRoutes, { prefix: '/api/lieux' })
await fastify.register(routesComptaLieu, { prefix: '/api/lieux' })

// Postes ✓
await fastify.register(postesRoutes, { prefix: '/api/postes' })

// Paiements ✓
await fastify.register(paiementsRoutes, { prefix: '/api/paiements' })

// Compta — dépenses, budgets, dashboard ✓
await fastify.register(depensesRoutes, { prefix: '/api/depenses' })
await fastify.register(budgetsRoutes, { prefix: '/api/budgets' })
await fastify.register(comptaRoutes, { prefix: '/api/compta' })

// Admin — maintenance ✓
await fastify.register(adminRoutes, { prefix: '/api/admin' })

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
