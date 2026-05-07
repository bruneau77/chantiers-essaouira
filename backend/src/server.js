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

// Health check
fastify.get('/api/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  service: 'chantiers-essaouira-api',
}))

// Routes (à implémenter progressivement avec Claude Code)
// import authRoutes from './routes/auth.js'
// import chantiersRoutes from './routes/chantiers.js'
// import devisRoutes from './routes/devis.js'
// import paiementsRoutes from './routes/paiements.js'
// import avancesRoutes from './routes/avances.js'
// import catalogueRoutes from './routes/catalogue.js'
// import planningRoutes from './routes/planning.js'
// import reglagesRoutes from './routes/reglages.js'
//
// await fastify.register(authRoutes, { prefix: '/api/auth' })
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
