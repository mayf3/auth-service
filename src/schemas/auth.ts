import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('邮箱格式不正确'),
    password: z.string().min(1, '请输入密码'),
  }),
});

export const tokenLoginSchema = z.object({
  body: z.object({
    token: z.string().min(1, '请提供 Agent Token').optional(),
    name: z.string().optional(),
    role: z.string().optional(),
  }),
});

// Registration — role is ALWAYS forced to 'requester', admin/cto_agent not allowed
export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(50),
    email: z.string().email(),
    password: z.string().min(8, '密码至少 8 位').max(100).optional(),
    inviteCode: z.string().optional(),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    oldPassword: z.string().min(1),
    newPassword: z.string().min(8, '新密码至少 8 位').max(100),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, '请提供 refreshToken'),
  }),
});
