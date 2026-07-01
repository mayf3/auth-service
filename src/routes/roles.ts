import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';
import { authRequired, requireRoles } from '../middleware/auth.js';

export const rolesRouter = Router();

// All roles must be authenticated
rolesRouter.use(authRequired);

// ─── Role definitions (enum-based) ──────────────────────────────────────

const PLATFORM_ROLES = [
  { name: 'admin', label: '管理员', scope: 'platform', description: '系统管理员，拥有全部权限' },
  { name: 'developer', label: '开发者', scope: 'platform', description: '开发工程师，可提交代码和需求' },
  { name: 'requester', label: '需求方', scope: 'platform', description: '产品经理/需求提出方' },
  { name: 'agent', label: 'Agent', scope: 'platform', description: 'AI Agent 账号' },
  { name: 'cto_agent', label: 'CTO Agent', scope: 'platform', description: '技术总监 Agent' },
];

const INTERNAL_ROLES = [
  { name: 'cto', label: '技术总监', scope: 'internal', description: '技术决策与架构审批' },
  { name: 'pm', label: '产品经理', scope: 'internal', description: '产品需求管理' },
  { name: 'developer', label: '开发工程师', scope: 'internal', description: '代码开发与自测' },
  { name: 'tester', label: '测试工程师', scope: 'internal', description: '质量测试' },
  { name: 'security', label: '安全工程师', scope: 'internal', description: '安全审查' },
  { name: 'ops', label: '运维工程师', scope: 'internal', description: '部署与运维' },
  { name: 'qa', label: '质量审查', scope: 'internal', description: '代码质量审查' },
];

const OKR_ROLES = [
  { name: 'okr_owner', label: 'OKR 负责人', scope: 'okr', description: 'OKR 目标负责人' },
  { name: 'okr_admin', label: 'OKR 管理员', scope: 'okr', description: 'OKR 系统管理员' },
  { name: 'okr_reviewer', label: 'OKR 评审', scope: 'okr', description: 'OKR 评审人' },
  { name: 'okr_member', label: 'OKR 成员', scope: 'okr', description: 'OKR 普通成员' },
  { name: 'okr_viewer', label: 'OKR 观察者', scope: 'okr', description: 'OKR 只读访问' },
];

// ─── GET /api/roles — 列出所有角色 ─────────────────────────────────────

rolesRouter.get('/', (_req, res) => {
  res.json({
    platform: PLATFORM_ROLES,
    internal: INTERNAL_ROLES,
    okr: OKR_ROLES,
  });
});

// ─── GET /api/roles/:scope — 按 scope 列出角色 ────────────────────────

rolesRouter.get('/:scope', (req, res) => {
  const scope = String(req.params.scope);
  const roleMap: Record<string, typeof PLATFORM_ROLES> = {
    platform: PLATFORM_ROLES,
    internal: INTERNAL_ROLES,
    okr: OKR_ROLES,
  };

  const roles = roleMap[scope];
  if (!roles) {
    throw new HttpError(400, `无效的 scope: ${scope}，可选值: platform, internal, okr`);
  }
  res.json({ scope, roles });
});

// ─── GET /api/roles/:scope/users — 列出指定角色的用户 ─────────────────

rolesRouter.get('/:scope/users', asyncHandler(async (req, res) => {
  const scope = String(req.params.scope);
  const roleName = req.query.role as string;

  if (!roleName) {
    throw new HttpError(400, '缺少 role 查询参数');
  }

  const roleMap: Record<string, string> = {
    platform: 'role',
    internal: 'internalRole',
    okr: 'okrRole',
  };

  const dbField = roleMap[scope];
  if (!dbField) {
    throw new HttpError(400, `无效的 scope: ${scope}`);
  }

  const users = await prisma.user.findMany({
    where: { [dbField]: roleName },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      internalRole: true,
      okrRole: true,
      department: true,
      title: true,
    },
    orderBy: { name: 'asc' },
  });

  res.json({ scope, role: roleName, users, count: users.length });
}));

// ─── PATCH /api/users/:id/role — 更新用户角色 ─────────────────────────

rolesRouter.patch('/users/:id/role', requireRoles('admin'), asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const { role, internalRole, okrRole } = req.body as {
    role?: string;
    internalRole?: string;
    okrRole?: string;
  };

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new HttpError(404, '用户不存在');

  const updateData: Record<string, unknown> = {};
  if (role !== undefined) {
    const validRoles = PLATFORM_ROLES.map(r => r.name);
    if (!validRoles.includes(role)) {
      throw new HttpError(400, `无效的 platform role: ${role}，可选值: ${validRoles.join(', ')}`);
    }
    updateData.role = role;
  }
  if (internalRole !== undefined) {
    const validRoles = INTERNAL_ROLES.map(r => r.name);
    if (!validRoles.includes(internalRole)) {
      throw new HttpError(400, `无效的 internalRole: ${internalRole}，可选值: ${validRoles.join(', ')}`);
    }
    updateData.internalRole = internalRole;
  }
  if (okrRole !== undefined) {
    const validRoles = OKR_ROLES.map(r => r.name);
    if (!validRoles.includes(okrRole)) {
      throw new HttpError(400, `无效的 okrRole: ${okrRole}，可选值: ${validRoles.join(', ')}`);
    }
    updateData.okrRole = okrRole;
  }

  if (Object.keys(updateData).length === 0) {
    throw new HttpError(400, '至少需要提供 role、internalRole 或 okrRole 中的一个');
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      internalRole: true,
      okrRole: true,
    },
  });

  res.json({ user: updated, updated: Object.keys(updateData) });
}));
