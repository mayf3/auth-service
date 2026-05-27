import dotenv from 'dotenv';
dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: parseInt(process.env.PORT ?? '4001', 10),

  // Database — connects to ADC's PostgreSQL
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/agent_dev_center',

  // JWT — unified secret from /opt/.sso-env
  JWT_SECRET: process.env.JWT_SECRET ?? '',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET ?? '',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '7d',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',

  // JWT Identity
  JWT_ISSUER: process.env.JWT_ISSUER ?? 'auth-service',
  JWT_AUDIENCE: process.env.JWT_AUDIENCE ?? 'unified-platform',
  JWT_VERSION: 'v1',

  // Registration
  REGISTER_INVITE_CODE: process.env.REGISTER_INVITE_CODE ?? '',

  // Agent Token Secret (for token-login)
  AGENT_TOKEN_SECRET: process.env.AGENT_TOKEN_SECRET ?? process.env.JWT_SECRET_SSO ?? '',
} as const;

// Validate required secrets
if (!env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET is required');
}
