import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';
import { authRequired } from '../middleware/auth.js';

export const usersRouter = Router();
usersRouter.use(authRequired);

function toSafeUser(user: any) {
  return {
    id: user.id, name: user.name, email: user.email, role: user.role,
    internalRole: user.internalRole ?? null, okrRole: user.okrRole ?? null, agentId: user.agentId ?? null,
  };
}

// GET /api/users — List users
usersRouter.get('/', asyncHandler(async (req, res) => {
  const role = req.query.role as string | undefined;
  const search = req.query.search as string | undefined;
  const agentId = req.query.agentId as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 200, 500);

  const where: any = {};
  if (role) where.role = role;
  if (agentId) where.agentId = agentId;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { agentId: { contains: search, mode: 'insensitive' } },
    ];
  }

  const users = await prisma.user.findMany({ where, take: limit, orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true, role: true, internalRole: true, okrRole: true, agentId: true },
  });
  res.json({ success: true, data: users.map(toSafeUser) });
}));

// GET /api/users/:id — Get user by ID
usersRouter.get('/:id', asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: String(req.params.id) },
    select: { id: true, name: true, email: true, role: true, internalRole: true, okrRole: true, agentId: true },
  });
  if (!user) throw new HttpError(404, '用户不存在');
  res.json({ success: true, data: toSafeUser(user) });
}));
