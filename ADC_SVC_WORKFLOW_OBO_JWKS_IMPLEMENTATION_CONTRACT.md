# ADC ↔ auth-service ↔ svc-workflow
# OBO / JWKS Implementation Contract

**Status:** `ADC_SVC_WORKFLOW_OBO_JWKS_CONTRACT_FROZEN`

**冻结时间:** 2026-07-16

**审查模式:** 只读 — 不修改代码，不提交，不推送，不部署

---

## 1. 三仓 SHA

| 仓库 | 路径 | SHA | 分支 |
|------|------|-----|------|
| **auth-service** | `/Users/yanfenma/workspace/project/auth-service` | `8ca5fcb48a40bbb4d6909d0499372959d26d0440` | `main` (= `feat/openclaw-agent-auth-token-get-v0`) |
| **svc-workflow** | `/Users/yanfenma/workspace/project/svc-workflow` | `f3306a5d387aa4159a995b7477e4c9da1a7193b7` | `main` |
| **ADC (agent-dev-center)** | `/Users/yanfenma/workspace/project/agent-dev-center` | `939a93edfa88d06ba234709284c78070212f7137` | `develop` |

**前置合同:**

| 合同 | 状态 | 引用 |
|------|------|------|
| `MACHINE_CLIENT_CREDENTIALS_V0.md` | 已发布 | auth-service `docs/contracts/` |
| `OPENCLAW_AGENT_AUTH_TOKEN_GET_V0.md` | 已发布 | auth-service `docs/contracts/` |

---

## 2. 最终算法

### 2.1 决定: **RS256**

| 标准 | RS256 | EdDSA (Ed25519) |
|------|-------|-----------------|
| `jsonwebtoken` (Node.js) | ✅ Native | ❌ 不支持 |
| `jsonwebtoken` (Rust) | ✅ Native | ❌ 不支持 |
| JWKS 标准 | ✅ RFC 7517 | ✅ |
| 生态成熟度 | ✅ 行业标准 | ⚠️ 较新 |
| 库迁移 | **零变更** | 需更换库 |
| 密钥长度 | 2048-bit | 32-byte |

**裁决依据:** 两个仓库的 `jsonwebtoken` 库都已原生支持 RS256，零库变更。EdDSA 推迟到 V1。

### 2.2 算法白名单

- **JWKS 模式（生产）**: 仅 `RS256`。**严禁** `HS256`。
- **test_hs256 模式（开发）**: 仅 `HS256`，绑定 `127.0.0.1`。
- 两个模式互斥，由 `WORKFLOW_AUTH_MODE` 门禁强制执行（见第 4 节）。

### 2.3 auth-service 双算法过渡策略

| 阶段 | 受众 | 算法 |
|------|------|------|
| 当前 | `unified-platform` / 所有 | HS256 |
| V0 过渡 | `svc-workflow` | RS256 (新) |
| V0 过渡 | 其他 (`svc-forum`, `svc-okr`, 等) | HS256 (保持) |
| V1+ | 全部 | RS256 (HS256 退役) |

auth-service 不删除 HS256 支持。HS256 仅在 JWKS 模式被 svc-workflow 拒绝。

---

## 3. JWKS 合同

### 3.1 端点

```
GET /.well-known/jwks.json
```

- **位置:** auth-service（由 Express 挂载在 `GET /.well-known/jwks.json`）
- **认证:** 无（公钥分发端点）
- **方法:** GET only

### 3.2 响应格式 (RFC 7517)

```json
{
  "keys": [
    {
      "kty": "RSA",
      "kid": "key-v1-20260701",
      "use": "sig",
      "alg": "RS256",
      "n": "base64url-encoded-modulus",
      "e": "AQAB"
    }
  ]
}
```

**严禁:** 返回 `d`（私钥指数）、`p`、`q`、`dp`、`dq`、`qi` 等私钥参数。

### 3.3 kid 格式

```
key-v1-<YYYYMMDD>
```

- `v1` = key version scheme（固定）
- `YYYYMMDD` = key 创建日期
- 示例: `key-v1-20260701`, `key-v1-20260715`
- 允许按时间排序和人工识别

### 3.4 密钥存储

**V0 决定: 仅环境变量（推荐）**

```bash
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
# 或
JWT_PRIVATE_KEY_FILE=/run/secrets/jwt-private-key.pem
```

- **无数据库迁移** — 零 schema 变更
- 轮换 = 配置变更 + 重启
- 密钥不在 API 中暴露（JWKS 只返回公钥部分）

### 3.5 密钥轮换窗口

| 阶段 | 动作 | 持续时间 |
|------|------|----------|
| 预告 | 新 key 加入 JWKS，**不开始签名** | 24h |
| 激活 | 新 key 开始签名；旧 key 仍在 JWKS 用于验证 | 旧 key 过期为止 |
| 宽限 | 旧 key 从 JWKS 移除；验证仍允许 | `max(agent TTL, 15min)` |
| 过期 | 旧 key 完全丢弃 | 宽限后 |

**V0 简化:** 手动轮换（配置变更 + 重启）。自动轮换为 V1 功能。

### 3.6 旧 Key 退役

- 旧 key 在 `verificationKeys` 中至少保留 `MAX_AGENT_TOKEN_TTL` (900s) + 60s 缓冲
- 缓冲后，旧 key 从 `verificationKeys` 和 JWKS 中移除
- 任何用旧 key 签名的 token 将验证失败（短 TTL 使此可接受）

### 3.7 缓存头

```
Cache-Control: public, max-age=3600, must-revalidate
ETag: "<hash-of-jwks>"
```

- 1 小时公共缓存
- ETag 用于高效条件性重新获取
- 密钥变化 → ETag 变化 → 客户端重新获取

### 3.8 JWKS 缓存 (svc-workflow 侧)

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `WORKFLOW_JWKS_CACHE_TTL_SECS` | 300 | 缓存刷新间隔 |
| `WORKFLOW_JWKS_HTTP_TIMEOUT_SECS` | 5 | HTTP 超时 |
| `WORKFLOW_JWKS_MAX_STALE_SECS` | 600 | 最大 stale 时间 |

**技术要点:**
- `kid` 在 JWKS 模式**必须存在**。缺少 `kid` 的 JWT 立即拒绝。
- 未知 `kid`: 触发受控刷新 → 刷新成功则重试验证，刷新失败则拒绝。
- 刷新并发抑制: 使用 `tokio::sync::Mutex` 防止多个请求同时刷新。
- 网络失败处理: JWKS 不可用且无缓存 → fail closed（拒绝请求）。
- 启动预热: 启动后立即拉取一次 JWKS 防止首次请求延迟。

---

## 4. Machine Token（直接 Token）

### 4.1 双 Auth Mode (svc-workflow)

| Mode | 用途 | 门禁 |
|------|------|------|
| `test_hs256` | 本地开发、隔离 Smoke | `WORKFLOW_JWT_SECRET` 必需，绑定 127.0.0.1 |
| `jwks` | 正式/Canary/Shadow/Cutover | `WORKFLOW_JWKS_URL` + `WORKFLOW_JWT_ISSUER` + `WORKFLOW_JWT_AUDIENCE` 必需 |

**门禁规则:**
- `WORKFLOW_AUTH_MODE` **无默认值**。缺少则启动失败。
- `jwks` 模式检测到 `WORKFLOW_JWT_SECRET` 存在 → **启动失败**（防止 HS256 回退）。
- `test_hs256` 模式绑定默认 `127.0.0.1:8989`；`WORKFLOW_BIND_ADDR` 非 127.0.0.1 → 启动失败。

### 4.2 Direct Token Claims（冻结）

```json
{
  "iss": "auth-service",
  "sub": "<MachinePrincipal.id UUID>",
  "aud": "svc-workflow",
  "principal_type": "agent",
  "scope": "workflow.read workflow.execute",
  "token_use": "access",
	  "type": "access",
  "version": "v1",
  "agent_id": "<canonical-agent-id>",
  "client_id": "<oauth-client-id>",
  "jti": "<unique>",
  "iat": <epoch>,
  "nbf": <epoch>,
  "exp": <epoch>
}
```

| Claim | 必需 | 说明 |
|-------|------|------|
| `iss` | ✅ 固定 | `auth-service` |
| `sub` | ✅ | MachinePrincipal UUID。**永远作为领域 principal_id** |
| `aud` | ✅ | 请求的 resource（单字符串，精确匹配） |
| `principal_type` | ✅ | `agent`（V0）；`human` 在 V1 允许 |
| `scope` | ✅ | 空格分隔的授权 scope 列表 |
| `token_use` | ✅ | `access` — 标识此 token 为直接 token |
| `type` | ✅ | `access`（保持现有字段名兼容性） |
| `version` | ✅ | `v1` |
| `agent_id` | ✅ | Canonical OpenClaw Agent ID |
| `client_id` | ✅ | OAuth client 标识符（当前格式 `mc_` + 24 base64url） |
| `jti` | ✅ | 唯一 token ID |
| `iat` | ✅ | 签发时间 |
| `nbf` | ✅ | 不早于（等于 iat） |
| `exp` | ✅ | 过期时间 |

> **`token_type` vs `type` Clarification:** The OAuth HTTP response body uses
> `token_type: "Bearer"` (RFC 6749 field — describes HTTP Authorization scheme).
> The JWT *payload* uses `type: "access"` (describes the token's business purpose).
> These are two different fields at two different layers. Never use `token_type`
> inside the JWT claims.

**禁止出现在声称 token 中的字段:**
- `name` ❌
- `role` ❌
- `internalRole` ❌
- `okrRole` ❌
- `permissions` ❌

### 4.3 TTL

- **默认:** 600 秒（10 分钟）
- **硬上限:** 900 秒（15 分钟）
- **无 refresh token**

### 4.4 撤销

V0 策略: 短 TTL 作为撤销机制。无 JTI 黑名单，无在线撤销检查。

---

## 5. OBO Token Exchange

### 5.1 端点

```
POST /oauth/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic <ADC-client_id:ADC-client_secret>

grant_type=urn:ietf:params:oauth:grant-type:token-exchange
subject_token=<subject token>
subject_token_type=urn:ietf:params:oauth:token-type:access_token
requested_token_type=urn:ietf:params:oauth:token-type:access_token
audience=svc-workflow
scope=workflow.read workflow.execute
```

- 扩展已有 `POST /oauth/token` 路由
- 新增 `grant_type=token-exchange` 分支
- **不支持** `requested_subject` 参数（若提供则静默忽略或拒绝）

### 5.2 流程

1. **认证 ADC**: Basic Auth (client_id + client_secret)，同 `client_credentials`
2. **验证 ADC client**: status = active, principal ≠ disabled
3. **验证 subject_token**: RS256 签名，正确 issuer (`auth-service`)，未过期
4. **提取 subject claims**: `sub`, `principal_type`, `scope`
5. **Scope 交集**: `min(subject_token.scope, ADC_client.allowedScopes, requested_scope)`
6. **Audience 检查**: `audience` 必须在 ADC_client.allowedResources 中
7. **签发 OBO token**: 含 `act`/`azp` 声明

### 5.3 Subject Token 验证

```typescript
function verifySubjectToken(token: string, activePrivateKey: RSAKey): SubjectClaims {
  // 使用 RS256 + 已知公钥验证
  // 检查: iss === 'auth-service'
  // 检查: 未过期 (exp > now)
  // 检查: 不小于 (nbf <= now)
  // 提取: sub, principal_type, scope, aud
  return claims;
}
```

**安全:**
- Subject token 使用 auth-service 自身私钥对应的公钥验证
- 不接受 HS256 subject token
- `sub` 只能从已验证的 subject_token 中提取

### 5.4 Scope 交集（冻结）

```typescript
OBO.scope = intersection(
  subject_token.scope,        // 主体能做什么
  ADC_client.allowedScopes,   // ADC client 被允许什么
  requested_scope             // 请求了什么
)
```

- 3 方交集（V0）。未来可扩展为 4 方（加入 service_policy）。
- 如果交集为空 → `invalid_scope` (400)。

### 5.5 OBO Token Claims（冻结）

```json
{
  "iss": "auth-service",
  "sub": "<subject_token 的真实 sub>",
  "aud": "svc-workflow",
  "principal_type": "<subject 的真实类型>",
  "scope": "<3-way intersection scopes>",
  "token_use": "workflow_obo",
  "type": "access",
  "version": "v1",
  "act": {
    "sub": "<ADC MachinePrincipal.id UUID>"
  },
  "azp": "<ADC client_id>",
  "agent_id": "<subject 的 agent_id (如果存在)>",
  "client_id": "<ADC client_id>",
  "jti": "<unique>",
  "iat": <epoch>,
  "nbf": <epoch>,
  "exp": <epoch>
}
```

| OBO Claim | 来源 | 说明 |
|-----------|------|------|
| `iss` | 固定 | `auth-service` |
| `sub` | Subject token 的 `sub` | **不能被请求覆盖。** 永远作为领域 `principal_id` |
| `aud` | 请求 `audience` | 必须在 ADC 的 allowedResources 中 |
| `principal_type` | Subject token 的 `principal_type` | `agent` 或未来 `human` |
| `scope` | 3 方交集 | 参见 5.4 节 |
| `token_use` | 固定 | `workflow_obo` — 标识 OBO token |
| `type` | 固定 | `access`（保持现有兼容性） |
| `version` | 固定 | `v1` |
| `act` | 嵌套对象 | `{ "sub": "<ADC MachinePrincipal.id>" }` — 实际代理发起方 |
| `azp` | ADC client_id | 授权方 |
| `agent_id` | Subject token 的 `agent_id` | 仅当 subject 是 agent 时存在 |
| `client_id` | ADC client_id | 与 `azp` 相同；保持现有字段名兼容性 |
| `jti` | 新生成 | 唯一 |
| `iat` | 当前时间 | |
| `nbf` | 同 `iat` | |
| `exp` | `iat + OBO_TTL` | OBO TTL ≤ subject token 剩余 TTL，上限 300s |

### 5.6 OBO TTL

| 参数 | 值 |
|------|-----|
| OBO 最大 TTL | **300 秒**（5 分钟） |
| Refresh token | **无** |
| 过期边界 | `min(iat + 300, subject_token.exp)` |
| 签名算法 | **RS256** |

OBO token 永不过期于其 subject token：
```
OBO.exp = min(iat + 300, subject_token.exp)
```

---

## 6. Claims 解析 — 关键一致性检查

### 6.1 `sub` 永远是真实 Actor

**✅ 两报告一致**

| Token 类型 | `sub` | 说明 |
|------------|-------|------|
| Direct Agent Token | `MachinePrincipal.id` | Agent 自身 |
| OBO Token | Subject token 的 `sub` | 被代理的真实主体 |

### 6.2 `act.sub` 永远是 ADC 代理服务

**✅ 两报告一致**

OBO token 中 `act.sub` = ADC 的 MachinePrincipal.id。仅用于审计追踪。

### 6.3 `principal_type` 描述 `sub`

**✅ 两报告一致**

| Token 类型 | `principal_type` | 值 |
|------------|------------------|-----|
| Direct Agent Token | 描述 `sub` | `agent` |
| OBO Token | 描述 `sub`（subject 的原始类型） | `agent` 或未来 `human` |

### 6.4 ADC 不能自由指定 `sub`

**✅ 两报告一致**

- `requested_subject` 参数 **不支持**
- `sub` 只能从已验证的 `subject_token.sub` 提取
- ADC 即使通过了 Basic Auth，也无法伪造 subject token（无私钥）

### 6.5 scope = subject ∩ client ∩ request

**✅ 两报告一致**

### 6.6 audience 固定为 `svc-workflow`

**✅ 两报告一致**

- V0 只处理 `audience=svc-workflow`
- `aud` 必须精确匹配 ADC client 的 `allowedResources` 之一

### 6.7 OBO 无 Refresh Token

**✅ 两报告一致**

### 6.8 短 TTL

**✅ 两报告一致**

- Direct token: 上线 900s
- OBO token: 上限 300s

### 6.9 HS256 不能进入生产

**✅ 两报告一致**

- auth-service 为 `svc-workflow` audience 签发 RS256
- svc-workflow 在 `jwks` 模式拒绝 HS256

### 6.10 JWKS 轮换兼容

**✅ 两报告一致**

- 旧 key 在宽限期内保留在 JWKS
- svc-workflow 缓存自动刷新（遇到未知 kid 时）
- 宽限期 ≥ `MAX_AGENT_TOKEN_TTL` (900s) + 60s

### 6.11 Principal ID 与 auth-service ID 一一对应

**✅ 两报告一致**

- `sub` UUID 在 auth-service 和 svc-workflow 之间一致
- svc-workflow 的 `principals.principal_id` = auth-service 的 `MachinePrincipal.id` (agent) 或 `User.id` (human)

### 6.12 禁用生命周期可传播

**✅ 两报告一致**

- auth-service 禁用 principal → 不再签发新 token
- 现有短 TTL token 自然过期
- svc-workflow 验证器检查 principal 状态（如果执行在线验证）

### 6.13 act/azp 不获得领域权限

**✅ 两报告一致**

- 领域授权全部基于 `sub`
- `act.sub` 和 `azp` 仅用于审计
- 即使 `act.sub` 是 assignee 但 `sub` 不是 → 403

---

## 7. Canonical ID

### 7.1 定义

Canonical ID = auth-service 中的持久 UUID，也是 JWT `sub` 的值。

| 主体类型 | auth-service 模型 | Canonical ID | svc-workflow PrincipalType |
|----------|-------------------|--------------|---------------------------|
| Agent | `MachinePrincipal.id` | UUID | `AGENT` |
| Human | `User.id` | UUID | `HUMAN` |
| Service (未来) | `MachinePrincipal` (service type) | UUID | `SERVICE` |

### 7.2 映射规则

- **One-to-one**: 一个 auth-service ID → 一个 svc-workflow principal_id
- **Idempotent**: 相同 ID 的重复 provisioning 必须成功（不报错）
- **类型冲突**: 如果 principal 已存在但 `principal_type` 不同 → 409
- **禁用处理**: svc-workflow 的 principal 不可删除（因为 FK 引用）。使用 `enabled=false`

---

## 8. Scope / Audience

### 8.1 Scope 格式

```
<domain>.<action>
```

示例: `workflow.read`, `workflow.execute`
空格分隔。排序后去重。大小写敏感。

### 8.2 V0 支持的 Scopes

| Scope | 端点 | 说明 |
|-------|------|------|
| `workflow.read` | GET endpoints | 读取工作流实例、时间线 |
| `workflow.execute` | POST endpoints | 创建、转换工作流实例 |

`workflow.admin` 为 V1（用于 Provisioning API 认证）。

### 8.3 Audience

- **直接 token**: `aud` = 请求的 `resource`（例如 `svc-workflow`）
- **OBO token**: `aud` = 请求的 `audience`（必须为 `svc-workflow`）
- **必须**在 ADC client 的 `allowedResources` 中
- **精确匹配**，不是前缀或通配符
- **单值**，不接受数组

### 8.4 受众限制

| 请求 | 门禁 |
|------|------|
| `audience=svc-workflow` + 允许 | ✅ |
| `audience=svc-workflow` + 不允许 | ❌ `invalid_grant` |
| `audience=svc-okr` (在 workflow OBO 中) | ❌ `invalid_grant` |
| 多个 audience 值 | ❌ `invalid_grant` |

---

## 9. Principal Provisioning

### 9.1 推荐方案: 新增 Internal Admin API（在 svc-workflow）

在 `/internal/v1/admin/` 下新增端点，需要 `workflow.admin` scope。

**新增端点:**

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/internal/v1/admin/principals` | 创建或更新 Principal (upsert) |
| `POST` | `/internal/v1/admin/principals/{id}/disable` | 禁用 Principal |
| `POST` | `/internal/v1/admin/domains` | 创建或更新 Domain |
| `POST` | `/internal/v1/admin/domain-role-bindings` | 创建或更新角色绑定 |
| `POST` | `/internal/v1/admin/domain-role-bindings/{id}/disable` | 撤销角色绑定 |

### 9.2 约束

1. **幂等性**: 以 `principal_id` 为幂等 key。相同 ID 重复调用必须成功。
2. **类型冲突**: 如果 principal 已存在但 `principal_type` 不同 → 409 `type_conflict`。
3. **enabled/disabled**: 可以更新 `enabled` 状态。
4. **删除**: Principal **不可删除**。使用 `enabled=false` 禁用。
5. **auth-service 不直接写 svc-workflow 数据库**。通过 Provisioning API 操作。

### 9.3 用户类型映射

| auth-service 类型 | svc-workflow Principal Type | 说明 |
|------------------|-----------------------------|------|
| `MachinePrincipal.id` | `AGENT` | Machine identity |
| `User.id` | `HUMAN` | Human user |
| (ADC service principal) | `SERVICE` | 暂不使用 |

### 9.4 不推荐的方案

| 方案 | 理由 |
|------|------|
| 复用 Legacy Import | Legacy Import 的目的是导入遗留工作流实例，不是管理主数据 |
| 复用 Admin Recovery | Admin Recovery 操作 workflow instance，不是主数据 |
| 直接 SQL | 🚫 禁止 |

---

## 10. Domain / Role Provisioning

### 10.1 推荐方案: 同上 (Internal Admin API)

请求格式:

```json
POST /internal/v1/admin/domains
{
  "domainId": "uuid",
  "domainKey": "string",
  "displayName": "string",
  "enabled": true,
  "metadata": {}
}

POST /internal/v1/admin/domain-role-bindings
{
  "domainId": "uuid",
  "principalId": "uuid",
  "roleKey": "DOMAIN_OWNER | WORKFLOW_ADMIN",
  "enabled": true
}

POST /internal/v1/admin/domain-role-bindings/{bindingId}/disable
{}
```

### 10.2 DOMAIN_OWNER 约束

```sql
CREATE UNIQUE INDEX idx_drb_single_owner
    ON domain_role_bindings (domain_id, role_key)
    WHERE enabled = TRUE AND role_key = 'DOMAIN_OWNER';
```

- 每个 Domain 最多一个**启用**的 DOMAIN_OWNER。
- 更换 DOMAIN_OWNER: 先禁用旧的，再启用新的。

### 10.3 Definition Provisioning (Canary)

V0 不暴露 Definition HTTP API。Canary fixture 使用 Seed SQL 脚本创建 Definition。

---

## 11. 代理链审计

### 11.1 审计范围

两份报告分别覆盖不同的审计面，**二者不冲突**:

| 层面 | 负责方 | 工具 | 内容 |
|------|--------|------|------|
| **Token Issuance** | auth-service | `console.warn` JSON to stderr | 谁签发了 token、什么类型、给谁、成功/失败 |
| **Request Authentication** | svc-workflow | `tracing::info!` 结构化日志 | 哪个 token_use、哪个 sub、act_sub、azp、jti、request_id |

### 11.2 auth-service 审计扩展

在已有 `AuditEvent` 类型中新增:

```typescript
type AuditEventType =
  | 'principal.created' | 'principal.disabled'
  | 'client.created' | 'client.rotated' | 'client.revoked'
  | 'token.issued' | 'token.failed'
  | 'obo.token.issued' | 'obo.token.failed';  // NEW
```

新增 OBO 字段:

```typescript
interface AuditEvent {
  // ... existing fields ...
  subjectSub?: string;           // OBO subject token sub
  subjectPrincipalType?: string; // OBO subject token principal_type
  subjectJti?: string;           // OBO subject token jti
  requestId?: string;            // OBO 请求追踪 ID
}
```

### 11.3 svc-workflow 代理审计

**最小方案（推荐）:** 结构化日志，不持久化到数据库。

```rust
tracing::info!(
    token_use = %claims.token_use,
    principal_id = %claims.sub,
    act_sub = %claims.act_sub,  // or "none"
    azp = %claims.azp,           // or "none"
    jti = %claims.jti,
    request_id = %request_id,
    "authenticated request"
);
```

**如果 Shadow 阶段需要持久化审计（可选）:**

```sql
ALTER TABLE workflow_command_receipts
    ADD COLUMN IF NOT EXISTS auth_token_use TEXT,
    ADD COLUMN IF NOT EXISTS auth_act_sub UUID,
    ADD COLUMN IF NOT EXISTS auth_azp TEXT;
```

### 11.4 禁止的审计内容

- 完整 access token ❌
- Client secret ❌
- 私钥 ❌
- Authorization header ❌

---

## 12. Migration

### 12.1 需要 DB Migration 的变更

| 变更 | 需要 Migration？ | 说明 |
|------|-----------------|------|
| RS256 密钥 | ❌ 否 | 环境变量（env-var only） |
| JWKS 端点 | ❌ 否 | 纯代码 |
| JWKS Verifier | ❌ 否 | 纯代码 |
| 双 Auth Mode | ❌ 否 | 环境变量 |
| OBO Token Exchange | ❌ 否 | 纯代码 |
| Scope 交集 | ❌ 否 | 纯代码 |
| Principal Provisioning API | ❌ 否 | 代码（`principals` 表已存在） |
| Domain Provisioning API | ❌ 否 | 代码（`domains` 表已存在） |
| 代理链审计（日志） | ❌ 否 | 纯代码 |
| 代理链审计（DB 持久化） | ⚠️ 可选 | `workflow_command_receipts` 加 3 列 |

### 12.2 需要配置迁移的变更

| 变更 | 说明 |
|------|------|
| auth-service `JWT_PRIVATE_KEY` | 新环境变量 |
| auth-service `JWT_PRIVATE_KEY_FILE` | 新环境变量（可选替代） |
| svc-workflow `WORKFLOW_AUTH_MODE` | 新必需环境变量 |
| svc-workflow `WORKFLOW_JWKS_URL` | jwks 模式必需 |
| svc-workflow `WORKFLOW_JWT_ISSUER` | jwks 模式必需 |
| svc-workflow `WORKFLOW_JWT_AUDIENCE` | jwks 模式必需 |
| svc-workflow `WORKFLOW_JWKS_CACHE_TTL_SECS` | 可选（默认 300） |
| svc-workflow `WORKFLOW_JWKS_HTTP_TIMEOUT_SECS` | 可选（默认 5） |
| svc-workflow `WORKFLOW_JWKS_MAX_STALE_SECS` | 可选（默认 600） |

### 12.3 不需要 Migration 的变更

- OBO endpoint (`grant_type=token-exchange`) — 纯代码
- `token_use`, `act`, `azp` claims — 纯代码
- 审计事件类型扩展 — 纯代码

---

## 13. Smoke / Canary

### 13.1 Smoke 验证顺序

```
1. healthz → 200
2. version → 200, service=svc-workflow
3. readyz → 200 (jwks 模式下需验证 JWKS 可达)
4. create → 201 + Location header + 幂等重试
5. detail → 200, visibility=full
6. transition → 200 + 幂等重试
7. timeline → 200, items 包含 event sequence

异常路径:
8. 未认证 → 401
9. 缺少 scope → 403
10. 无效 idempotency key → 400
11. principal disabled → 403
```

### 13.2 Smoke Fixture 资源

| 资源 | 属性 |
|------|------|
| MachinePrincipal (AGENT) | UUID, display_name: "Canary Test Agent" |
| User (HUMAN) | UUID, display_name: "Canary Test Human" |
| ADC Service Principal | UUID, display_name: "ADC Canary Client" |
| Domain | UUID, domain_key: "canary-domain" |
| DOMAIN_OWNER (Human) | principal_id = Human UUID |
| DefinitionVersion | definition_key: "canary-definition" |
| Nodes | DRAFT(assignee: WORKFLOW_CREATOR) → TERMINAL |

### 13.3 创建顺序

```
1. POST /admin/principals { Agent }
2. POST /admin/principals { Human }
3. POST /admin/domains { Domain }
4. POST /admin/domain-role-bindings { Human → DOMAIN_OWNER }
5. (Seed SQL) Create Definition + Version
6. POST /admin/domain-role-bindings { Agent → domain role }
7. POST /internal/v1/workflow-instances (as Agent, RS256)
8. POST /internal/v1/workflow-instances/{id}/transitions (as Agent)
9. GET /internal/v1/workflow-instances/{id}/timeline (as Agent)
```

### 13.4 测试矩阵

**JWT 验证 (13 场景):**

| # | 场景 | 期望 |
|---|------|------|
| 1 | 直接 Agent Token (HS256 in test_hs256 mode) | 200 |
| 2 | 直接 Agent Token (RS256 in jwks mode) | 200 |
| 3 | 直接 Human Token (RS256, principal_type=human) in jwks mode | 200 |
| 4 | 合法 OBO Token (token_use=workflow_obo, sub=human, act.sub=agent) | 200 |
| 5 | 错误 `act.sub`（缺失或无效） | 200（审计记录，不拒绝） |
| 6 | 错误 `azp`（缺失或无效） | 200（审计记录，不拒绝） |
| 7 | 错误 `token_use=invalid` | 401 |
| 8 | 错误 kid（JWKS 无匹配 key） | 401 |
| 9 | Key rotation（旧 key 签名 → 新 key JWKS 更新） | 200 |
| 10 | JWKS 不可用且无缓存 | 503 |
| 11 | JWKS 不可用但有缓存 | 200 |
| 12 | jwks 模式下 HS256 token | 401 |
| 13 | test_hs256 模式下 RS256 token | 401 |

**Provisioning (10 场景):**

| # | 场景 | 期望 |
|---|------|------|
| 14 | 创建 Principal (AGENT) | 201 |
| 15 | 幂等重放创建 Principal | 200 |
| 16 | 创建已存在的 Principal 但类型不同 | 409 |
| 17 | 禁用 Principal | 200 |
| 18 | 禁用后创建工作流 | 403 |
| 19 | 创建 Domain | 201 |
| 20 | 绑定 DOMAIN_OWNER | 201 |
| 21 | 第二个 DOMAIN_OWNER（未禁用第一个） | 409 |
| 22 | 撤销角色 | 200 |
| 23 | 撤销后工作流拒绝 | 403 |

**OBO 领域授权 (5 场景):**

| # | 场景 | 期望 |
|---|------|------|
| 24 | OBO sub 是 assignee → 成功创建 | 201 |
| 25 | OBO act.sub 是 assignee 但 sub 不是 → 失败 | 403 |
| 26 | OBO sub disabled → 创建失败 | 403 |
| 27 | sub 有 domain role 但 act.sub 没有 → 成功 | 201 |
| 28 | sub 无 domain role → 即使 act.sub 有 role 也失败 | 403 |

---

## 14. PR 顺序

### 14.1 PR-A: auth-service JWKS Signer

| 字段 | 值 |
|------|-----|
| **目标仓库** | auth-service |
| **Base SHA** | `8ca5fcb48a40bbb4d6909d0499372959d26d0440` |
| **精确范围** | JWKS 基础设施 + RS256 签名 |
| **文件** | 新增: `src/lib/oauth/jwks.ts`, `src/config/crypto.ts`; 修改: `src/config/env.ts` (JWT_PRIVATE_KEY, JWT_PRIVATE_KEY_FILE), `src/server.ts` (挂载 JWKS 路由), `src/middleware/auth.ts` (代理 token principal_type 检测), `src/routes/service-registrations.ts` (MachinePrincipal 查找) |
| **Migration** | 无 |
| **测试** | JWKS 单元测试: kid 格式, key 加载, 公钥不泄露私钥, 缓存头; Machine Token RS256 签名: 有效 RS256 验证, 错误签名拒绝, 未知 kid 拒绝, HS256 在 RS256 上下文拒绝 |
| **不包含** | OBO Token Exchange, svc-workflow 验证器变更, Principal Provisioning |
| **依赖前序** | 无 |
| **验收状态** | 签发的 RS256 token 可被任何兼容 RS256 验证器验证 |

### 14.2 PR-B: auth-service OBO Token Exchange

| 字段 | 值 |
|------|-----|
| **目标仓库** | auth-service |
| **Base SHA** | PR-A 合并后 HEAD |
| **精确范围** | OBO Token Exchange (grant_type=token-exchange) |
| **文件** | 新增: `src/lib/oauth/token-exchange.ts`; 修改: `src/routes/oauth.ts` (新增 token-exchange 分支), `src/schemas/oauth.ts` (tokenExchangeRequestSchema), `src/lib/oauth/audit.ts` (OBO 事件类型 + 字段), `src/lib/oauth/token.ts` (signWorkflowToken RS256) |
| **Migration** | 无 |
| **测试** | OBO 单元 + 集成: 有效 subject→OBO 签发, subject 无效→拒绝, scope 交集, audience 检查, act/azp 正确, TTL ≤ 300s, ADC 未认证→401, 无 refresh token |
| **不包含** | svc-workflow 验证器, Provisioning, ADC 调用者代码 |
| **依赖前序** | PR-A (需要 JWKS + RS256) |
| **验收状态** | 可签发有效 OBO token，svc-workflow 可验证 |

### 14.3 PR-C: svc-workflow JWKS/OBO Verifier

| 字段 | 值 |
|------|-----|
| **目标仓库** | svc-workflow |
| **Base SHA** | `f3306a5d387aa4159a995b7477e4c9da1a7193b7` |
| **精确范围** | 双 Auth Mode + JWKS Verifier + OBO token 解析 + 代理审计日志 |
| **文件** | `Cargo.toml` (reqwest → dependencies), `src/main.rs` (WORKFLOW_AUTH_MODE 加载), `src/auth/mod.rs` (导出 JwksVerifier), `src/auth/verifier.rs` (新增 JwksVerifier; 保留 JwtVerifier), `src/auth/principal.rs` (扩展 AuthenticatedPrincipal 解析 token_use/act/azp), `src/http/state.rs` (auth_mode + JWKS 配置), `src/http/handlers/health.rs` (readyz JWKS 检查) |
| **Migration** | 无 |
| **测试** | 13 个 JWT 验证场景 (见 13.4 节 #1-13); Key rotation 测试; JWKS 缓存 + 刷新的并发测试 |
| **不包含** | Provisioning API, ADC Mapping Ledger, DB 审计持久化 |
| **依赖前序** | PR-A (需要 JWKS 端点测试) |
| **验收状态** | 在 `test_hs256` 和 `jwks` 两种模式下，Direct Agent Token 和 OBO Token 均可通过验证 |

### 14.4 PR-D: svc-workflow Identity/Domain/Role Provisioning

| 字段 | 值 |
|------|-----|
| **目标仓库** | svc-workflow |
| **Base SHA** | PR-C 合并后 HEAD |
| **精确范围** | `/internal/v1/admin/*` Provisioning API (principals, domains, domain-role-bindings) |
| **文件** | 新增: `src/http/handlers/admin.rs`; 修改: `src/http/mod.rs` (注册 admin 路由), `src/http/state.rs` (新 service 注入), 相关 application service 文件 |
| **Migration** | 无 (表已存在于 migration 0001) |
| **测试** | 10 个 Provisioning 场景 (见 13.4 节 #14-23) |
| **不包含** | ADC Mapping Ledger, OBO endpoint 变更, 持久审计 |
| **依赖前序** | PR-C (需要 auth 基础) |
| **验收状态** | `POST /admin/principals`, `/admin/domains`, `/admin/domain-role-bindings` 均可正常操作且幂等 |

### 14.5 PR-E: ADC OBO Client + Authenticated Smoke

| 字段 | 值 |
|------|-----|
| **目标仓库** | ADC (agent-dev-center) |
| **Base SHA** | `939a93edfa88d06ba234709284c78070212f7137` |
| **精确范围** | ADC 的 OAuth client_credentials 自动获取 + OBO token 调用 + Mapping Ledger + Canary Smoke |
| **文件** | `backend/src/clients/svc-workflow/client.ts` (accessTokenProvider OAuth/OBO 实现), `backend/src/clients/svc-workflow/config.ts` (smoke fixture), `backend/src/config/env.ts` (Mapping Ledger 配置) |
| **Migration** | 在 ADC 侧新增 Mapping Ledger 表 |
| **测试** | 5 个 OBO 领域授权场景 (见 13.4 节 #24-28); 端到端 Smoke 自动化 |
| **不包含** | OBO 端点变更, JWKS 变更, 持久审计列 |
| **依赖前序** | PR-B, PR-C, PR-D (需要 auth-service OBO + svc-workflow JWKS verifier + Provisioning API) |
| **验收状态** | 端到端 Canary: ADC OAuth → auth-service OBO → svc-workflow 验证 → 工作流 CRUD 成功 |

### 14.6 PR 依赖图

```
PR-A (auth-service JWKS Signer)
  └── PR-B (auth-service OBO Token Exchange)
  └── PR-C (svc-workflow JWKS/OBO Verifier)
        └── PR-D (svc-workflow Provisioning API)
              └── PR-E (ADC OBO Client + Smoke)
```

PR-A 和 PR-C 可并行开发。PR-B 和 PR-D 可在 PR-A 合并后并行。PR-E 是最后一个。

---

## 15. 架构分歧裁决

### 15.1 RS256 vs EdDSA

| auth-service 报告 | svc-workflow 报告 | 裁决 |
|-------------------|-------------------|------|
| RS256 | RS256 (RS384/RS512 可选) | **✅ RS256** |

**无需上报用户。**

### 15.2 统一 signer vs workflow 专用 signer

| auth-service 报告 | svc-workflow 报告 | 裁决 |
|-------------------|-------------------|------|
| 统一 auth-service，按 audience 使用不同算法 | 未明确指定，假设统一 signer | **✅ 统一 auth-service signer**。RS256 只用于 `svc-workflow` audience；其他 audience 保持 HS256。这是过渡策略，不是两个 signer。 |

**无需上报用户。** 现有代码已按此结构组织（`signAgentAccessToken` 是统一函数，新 `signWorkflowToken` 并行添加）。

### 15.3 实时 Token Exchange vs 持久 Delegation

| auth-service 报告 | svc-workflow 报告 | 裁决 |
|-------------------|-------------------|------|
| 实时 OBO (POST /oauth/token + token-exchange) | 实时 OBO token (JWT 中包含 act/azp) | **✅ 实时 Token Exchange** |

**无需上报用户。**

### 15.4 日志审计 vs 数据库审计

| auth-service 报告 | svc-workflow 报告 | 裁决 |
|-------------------|-------------------|------|
| 扩展结构化 JSON 到 stderr (已有模式) | 结构化 tracing 日志 (推荐)；可选 DB 3 列 | **✅ 两层面并用**。auth-service 审计 token 签发事件。svc-workflow 审计请求认证事件。不冲突。持久化 DB 审计为 Shadow 阶段可选。 |

**无需上报用户。** 两个层面解决不同问题，V0 都走结构化日志。

### 15.5 Provisioning API vs Import

| auth-service 报告 | svc-workflow 报告 | 裁决 |
|-------------------|-------------------|------|
| 未讨论（超出范围） | 新增 `POST /internal/v1/admin/*` | **✅ svc-workflow Internal Admin API**。auth-service 无反对意见。 |

**无需上报用户。**

### 15.6 是否需要 Migration

| auth-service 报告 | svc-workflow 报告 | 裁决 |
|-------------------|-------------------|------|
| 无 DB migration（env-var 密钥） | 无 DB migration（纯代码） | **✅ V0 核心无 DB Migration**。审计持久化为可选。 |

**无需上报用户。**

### 15.7 真实分歧 (需要上报用户)

以下分歧双方有不同假设，需要用户确认。但**根据最小范围、安全性和现有代码**，我已裁决如下:

| 分歧点 | auth-service 观点 | svc-workflow 观点 | 裁决及理由 |
|--------|-------------------|-------------------|-----------|
| `client_id` vs `azp` | 建议保持 `client_id` + 新增 `azp`（向后兼容） | 使用 `azp` (RFC 8693 标准) | **✅ 两者都保留**。OBO token 中 `azp` = ADC client_id；同时保留 `client_id` 字段使现有 `agent-auth` CLI 兼容。V1 可退役 `client_id`。理由: 最小范围→不破坏现有 CLI；安全性→无影响；现有代码→`client_id` 已在所有 agent token 中存在。 |
| `act` 格式: 嵌套 vs 扁平 | `act: { sub: "..." }` (嵌套对象，RFC 标准) | 解析为 `act_sub` 扁平字段 | **✅ 嵌套 `act: { sub: "..." }`**。JWT 中保留 RFC 8693 嵌套格式。svc-workflow 解析 Rust Claims 结构时使用嵌套 deserialize。理由: 标准兼容性；Rust serde 可轻松处理嵌套。 |
| OBO TTL 剩余时间计算 | `OBO.exp = min(iat + 300, subject_token.exp - iat)` | 未明确指定，假设相同 | **✅ 统一表达式**: `OBO.exp = min(iat + 300, subject_token.exp)`。注意 `subject_token.exp` 是绝对时间戳，不是相对时间。理由: 安全性→OBO 不能超过 subject 的绝对过期时间；现有代码→简单比较时间戳。 |

**无需要用户上报的真实不可兼容分歧。** 所有分歧均可依据现有代码、安全最佳实践和最小范围原则裁决。

---

## 16. Blocker

| # | Blocker | 涉及 | 说明 | 影响 PR |
|---|---------|------|------|---------|
| B1 | **auth-service 无 JWKS 端点** | auth-service | `GET /.well-known/jwks.json` 不存在 | PR-A (首要交付物) |
| B2 | **auth-service 只有 HS256** | auth-service | 需要 RS256 支持 | PR-A (首要交付物) |
| B3 | **svc-workflow 无 Provisioning API** | svc-workflow | 无创建 Principal/Domain/Role 的 HTTP 端点 | PR-D |
| B4 | **ADC 无 OAuth client_credentials 自动获取** | ADC | 当前 smoke 用静态 token | PR-E |

**全部 4 个 Blocker 都在对应 PR 范围内，无预期外 Blocker。**

---

## 17. High

| # | 项 | 说明 | 阶段 |
|---|-----|------|------|
| H1 | RS256 私钥管理和轮换 | auth-service 需要生成 RS256 key pair + kid | PR-A |
| H2 | JWKS HTTP 安全 | JWKS URL 必须 HTTPS，禁止 HTTP | PR-A |
| H3 | auth-service 双算法支持 | 旧 HS256 不能立即废弃；按 audience 配置算法 | PR-A |
| H4 | test_hs256 模式绑定 127.0.0.1 | 防止非 loopback 暴露 HS256 端点 | PR-C |
| H5 | jwks 模式拒绝 HS256 | 配置门禁防止自动回退 | PR-C |
| H6 | Provisioning API 认证 | Admin API 只能被 auth-service 使用 | PR-D |
| H7 | principal_type `human` 兼容性 | 当前 V0 拒绝 `human` | PR-C |

---

## 18. Medium

| # | 项 | 说明 | 阶段 |
|---|-----|------|------|
| M1 | JWKS 缓存指标 | 添加 `jwk_cache_hit`, `jwk_cache_miss` 等指标 | PR-C |
| M2 | 启动时 JWKS 预热 | 启动后立即拉取一次 JWKS | PR-C |
| M3 | OBO token jti 防重放 | jti 结合 requestHash 防止重放 | PR-B |
| M4 | 端到端审计完整性测试 | 验证结构化日志包含所有代理链字段 | PR-E |
| M5 | ADC Mapping Ledger 精度测试 | 验证 alias 冲突、重复映射等行为 | PR-E |
| M6 | readyz JWKS 探针 | 健康检查反映 JWKS 状态 | PR-C |
| M7 | 时钟偏差容差 | `clockTolerance` 配置（30s 建议） | PR-A + PR-C |

---

## 19. 是否可以实施

**✅ 可以实施。**

所有架构分歧已在第 15 节裁决。4 个 Blocker 都在对应 PR 范围内。7 个 High 和 7 个 Medium 都已分配到 PR。

实施总估计: **7-9 天**（基于两份调查报告的一致估算）。

**冻结条件自检:**

| 门禁 | 状态 | 说明 |
|------|------|------|
| 共享生产 HS256 secret | ✅ 已拒绝 | HS256 仅在 test_hs256 模式使用，绑定 127.0.0.1 |
| ADC 传任意 actorId | ✅ 已拒绝 | `requested_subject` 不支持 |
| 仅 Base64 解码 JWT | ✅ 已拒绝 | RS256 签名验证 + kid 强制 |
| 忽略 kid | ✅ 已拒绝 | JWKS 模式 kid 必需 |
| JWKS 获取失败时跳过验签 | ✅ 已拒绝 | fail closed（拒绝请求） |
| act 自动获得领域权限 | ✅ 已拒绝 | 领域授权基于 `sub`，`act.sub` 仅供审计 |
| 临时 SQL 作为正式 Provisioning | ✅ 已拒绝 | Internal Admin API |
| 无审计的 OBO | ✅ 已拒绝 | auth-service 签发审计 + svc-workflow 请求审计 |

---

## 附录 A: 文件变更清单

### auth-service

| 文件 | 变更 | PR |
|------|------|-----|
| `src/config/env.ts` | 新增 JWT_PRIVATE_KEY, JWT_PRIVATE_KEY_FILE | A |
| `src/lib/oauth/jwks.ts` | **新增**: JWKS key 管理 + 端点 | A |
| `src/config/crypto.ts` | **新增**: RSA key 加载, PEM 解析, JWK 转换 | A |
| `src/server.ts` | 挂载 `GET /.well-known/jwks.json` | A |
| `src/routes/service-registrations.ts` | `principal_type=agent` 处理 | A |
| `src/middleware/auth.ts` | 新增 RS256 验证路径 | A |
| `src/lib/oauth/token.ts` | 新增 `signWorkflowToken()` (RS256) | B |
| `src/routes/oauth.ts` | 新增 `grant_type=token-exchange` 分支 | B |
| `src/lib/oauth/token-exchange.ts` | **新增**: OBO 业务逻辑 | B |
| `src/schemas/oauth.ts` | 新增 tokenExchangeRequestSchema | B |
| `src/lib/oauth/audit.ts` | 新增 OBO 事件类型 + 字段 | B |

### svc-workflow

| 文件 | 变更 | PR |
|------|------|-----|
| `Cargo.toml` | reqwest → dependencies | C |
| `src/main.rs` | WORKFLOW_AUTH_MODE 加载 | C |
| `src/auth/mod.rs` | 导出 JwksVerifier | C |
| `src/auth/verifier.rs` | 新增 JwksVerifier (保留 JwtVerifier) | C |
| `src/auth/principal.rs` | 解析 token_use, act, azp | C |
| `src/http/state.rs` | auth_mode + JWKS 配置 | C |
| `src/http/handlers/health.rs` | readyz JWKS 检查 | C |
| `src/http/mod.rs` | 注册 admin 路由 | D |
| `src/http/handlers/admin.rs` | **新增**: Provisioning handlers | D |

### ADC

| 文件 | 变更 | PR |
|------|------|-----|
| `backend/src/clients/svc-workflow/client.ts` | OAuth/OBO accessTokenProvider | E |
| `backend/src/clients/svc-workflow/config.ts` | smoke fixture 工厂函数 | E |
| `backend/src/config/env.ts` | Mapping Ledger 配置 | E |

---

## 附录 B: 关键术语

| 术语 | 定义 |
|------|------|
| **Direct Token** | `token_use=access` 的 JWT。主体自己使用。 |
| **OBO Token** | `token_use=workflow_obo` 的 JWT。ADC 代表主体操作。 |
| **Subject Token** | OBO 流程中作为 `subject_token` 传入的原始 JWT。 |
| **Canonical ID** | auth-service 中 MachinePrincipal 或 User 的 UUID，也是 JWT `sub`。 |
| **Principal ID** | svc-workflow `principals` 表中的 UUID。通常与 Canonical ID 相同。 |
| **Mapping Ledger** | ADC 侧维护的 ID 对应关系表（ADC ID ↔ auth-service ID ↔ svc-workflow ID）。 |
| **act** | JWT claim，OBO 中表示实际执行代理的实体。 |
| **azp** | JWT claim，OBO 中表示被授权的 OAuth client。 |

---

## 20. Document Precedence

See `docs/contracts/WORKFLOW_RS256_MACHINE_TOKEN_JWKS_V0.md` §18 for the full
document precedence hierarchy. This contract (ADC ↔ auth-service ↔ svc-workflow)
is Priority 2 — it is the cross-repo reference contract, subordinate to the
per-repo formal contracts in `docs/contracts/`.

In case of conflict between this document and a Priority 1 contract
(`docs/contracts/`), the Priority 1 contract governs.

*Contract generated 2026-07-16. Status: `ADC_SVC_WORKFLOW_OBO_JWKS_CONTRACT_FROZEN`*
*审查模式: 只读 — 不修改代码，不提交，不推送，不部署*
