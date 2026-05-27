import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { authRouter } from './routes/auth.js';
import { HttpError } from './utils/http-error.js';
import { prisma } from './lib/prisma.js';

const app = express();

// CORS
app.use(cors({
  origin(origin, callback) {
    callback(null, true); // Allow all origins for service-to-service
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'auth-service',
    version: '1.0.0',
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/auth', authRouter);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[ERROR] ${err.message}`, err.stack);
  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof HttpError ? err.message : '服务器内部错误';
  res.status(status).json({ message, ...(status === 500 ? {} : {}) });
});

// Start
app.listen(env.PORT, () => {
  console.log(`\n  🔐 auth-service v1.0.0`);
  console.log(`  📡 http://localhost:${env.PORT}`);
  console.log(`  🏷️  issuer: ${env.JWT_ISSUER} | audience: ${env.JWT_AUDIENCE}`);
  console.log(`  🔑 JWT secret: ${env.JWT_SECRET.slice(0, 8)}...\n`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[SIGTERM] Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});
