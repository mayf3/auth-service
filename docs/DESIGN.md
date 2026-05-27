# Mini Design Doc: 统一鉴权服务 (auth-service)

**需求**: bd89ea13-e55b-4f95-abc1-1e86f0be5bec  
**作者**: backend-engineer-2  
**日期**: 2026-05-27  
**优先级**: P1

---

## Why — 为什么做

### 现状问题

当前鉴权架构存在 **3 个核心问题**：

1. **单点故障**: LLM Todo (port 3458) 没有自己的登录接口，依赖 ADC (port 4000) 签发 JWT。ADC 一挂或重建，所有依赖 JWT 的平台都无法登录。
2. **密钥混乱**: 
   - `/opt/.sso-env` 的 `JWT_SECRET` = `efaae9...`（ADC 用）
   - ADC compose `.env` 的 `JWT_SECRET_SSO` = `06ca9b...`（Agent Token 用）
   - LLM Todo 容器的 `SSO_JWT_SECRET` = `efaae9...`（从 docker inspect 看）
   - LLM Todo `.env` 文件的 `SSO_JWT_SECRET` = `06ca9b...`（不一致）
   - Agent Token 用 `06ca9b...` 签发，但 LLM Todo 容器用 `efaae9...` 验证 — **不匹配就验证失败**
3. **耦合过深**: login.sh 的工作流是先向 ADC 拿 JWT，再通过 sso-login 同步到 LLM Todo。ADC 是瓶颈。

### 目标

搭建独立的 auth-service，使 JWT 签发与任何业务服务解耦。ADC 和 LLM Todo 都只做 JWT **验证**，不做签发。

---

## What — 做什么

### auth-service 职责

1. **Email/Password 登录** — 验证凭证，签发 JWT
2. **Agent Token 登录** — 用 token 换取 JWT（自动注册 agent）
3. **JWT 签发** — 统一密钥，统一 payload 格式
4. **Token 刷新** — refresh token 机制
5. **用户管理** — 注册、改密码、查看用户信息

### auth-service 不做什么

- 不做业务逻辑（需求管理、todo 等）
- 不替代 ADC 的用户数据库，而是 **共享同一数据库的 users 表**
- 不做 SSO 回调（不再需要，所有服务直连 auth-service）

---

## How — 技术设计

### 架构

```
login.sh / Agent
     │
     ▼
auth-service (port 3001)  ← 独立部署，Docker化
     │  签发 JWT (secret: UNIFIED_JWT_SECRET)
     │
     ├──► ADC (port 4000)    验证 JWT → 读用户数据
     └──► LLM Todo (port 3458)  验证 JWT → 读用户数据
```

### JWT 格式

```json
{
  "sub": "user-uuid",
  "name": "backend-engineer-2",
  "role": "developer",
  "iss": "auth-service",
  "aud": "unified-platform",
  "type": "access",
  "version": "v1",
  "iat": 1779857441,
  "exp": 1780462241
}
```

### 统一密钥

所有服务使用同一个 `JWT_SECRET`（从 `/opt/.sso-env` 的 `efaae9...`）。auth-service 签发，其他服务验证。

### 数据库

auth-service **使用 ADC 的 PostgreSQL 数据库**（共享 users 表）。不新建数据库。

- 优点: 用户数据一致，不需要同步
- 注意: auth-service 只读/写 users 表，不改表结构

### API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | Email/Password 登录 |
| POST | `/api/auth/token-login` | Agent Token 登录 |
| POST | `/api/auth/refresh` | 刷新 Token |
| GET  | `/api/auth/me` | 验证 Token，返回用户信息 |
| POST | `/api/auth/register` | 注册（需邀请码） |
| POST | `/api/auth/change-password` | 修改密码 |
| GET  | `/api/health` | 健康检查 |

### 技术栈

- Node.js 20 + Express + TypeScript
- Prisma（复用 ADC schema 的 User model）
- PostgreSQL（连接 ADC 的数据库）
- Docker 化部署

### 部署方案

```yaml
# /opt/services/auth-service/docker-compose.yml
services:
  auth-service:
    build: .
    container_name: auth-service
    restart: unless-stopped
    env_file: /opt/.sso-env
    environment:
      NODE_ENV: production
      PORT: 3001
      DATABASE_URL: postgresql://postgres:postgres@host.docker.internal:5432/agent_dev_center
      JWT_ISSUER: auth-service
      JWT_AUDIENCE: unified-platform
    ports:
      - "127.0.0.1:3001:3001"
```

### 改造清单

1. **新建 auth-service** — 独立项目
2. **ADC 改造** — auth 中间件增加 auth-service issuer 验证
3. **LLM Todo 改造** — sso-auth 中间件验证 auth-service 签发的 JWT
4. **login.sh 改造** — 改为直连 auth-service

---

## 验收标准

- [ ] auth-service 独立运行，不依赖 ADC
- [ ] LLM Todo 和 ADC 都验证 auth-service 签发的 JWT
- [ ] login.sh 改为调用 auth-service 获取 JWT
- [ ] ADC 重建后 LLM Todo 登录不受影响
