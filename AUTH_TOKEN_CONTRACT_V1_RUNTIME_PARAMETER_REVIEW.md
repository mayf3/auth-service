# Minimal Auth V1 Runtime Parameter Narrow Review

## 1. Verdict

```text
REVIEW_DATE=2026-07-18
REVIEW_RESULT=PASS
RUNTIME_PARAMETER_GATE_CLOSED=true

CONTRACT_BUNDLE_FROZEN=false
EXACT_JWKS_URL_GATE_CLOSED=false
IMPLEMENTATION_AUTHORIZED=false
```

本报告只裁决 Draft Manifest 中可由安全边界、既有 V0 合同和明确公式决定的
运行参数。生产 Origin、消费者发布、产品 Scope 语义和独立审阅不在本报告权限
内，因此仍然保持开放。

## 2. 依据

- [RFC 9700 — OAuth 2.0 Security Best Current Practice](https://datatracker.ietf.org/doc/html/rfc9700)
- [RFC 7636 — Proof Key for Code Exchange](https://datatracker.ietf.org/doc/html/rfc7636)
- [RFC 6749 — OAuth 2.0 Authorization Framework](https://datatracker.ietf.org/doc/html/rfc6749)
- [RFC 8693 — OAuth 2.0 Token Exchange](https://datatracker.ietf.org/doc/html/rfc8693)
- [RFC 8725 — JWT Best Current Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- `docs/contracts/WORKFLOW_RS256_MACHINE_TOKEN_JWKS_V0.md`
- `docs/contracts/WORKFLOW_AGENT_OBO_TOKEN_EXCHANGE_V0.md`

RFC 9700 要求 Public Client 使用 PKCE，建议 Confidential Client 同样使用，且
S256 是当前不暴露 verifier 的方法；它还禁止 Resource Owner Password Grant，
并要求 Public Client 采用 sender constraint 或 refresh rotation 检测重放。RFC
6749 要求含 Token/Credential 的响应使用 `Cache-Control: no-store` 和
`Pragma: no-cache`。RFC 8725 要求不同 JWT Profile 使用互斥验证规则并验证
Audience。Bundle 采用固定 `aud`、`principal_type`、`token_use`、`act/azp`
形状区分 Profile，没有为了新 `typ` 制造 V0 Wire 迁移。

## 3. Access Token 与时钟

| 参数 | 值 | 裁决 |
|---|---:|---|
| Human Access TTL | 900s | PASS；合同上限 15 分钟 |
| Direct Machine TTL | 600s | PASS；保持 V0 默认值且不超过 V1 10 分钟上限 |
| OBO TTL | 300s | PASS；且仍受 `exp <= source exp` 限制 |
| Clock skew | 60s | PASS；短且明确，Issuer/Verifier 使用同一值 |

TTL 不是调用方参数。`iat/nbf/exp/jti` 均由 Issuer 生成，资源服务按 Profile
上限验证；因此禁用后的离线有效窗口有明确上界。

## 4. JWKS Cache 与 Key Retention

| 参数 | 值 | 裁决 |
|---|---:|---|
| JWKS HTTP timeout | 5s | PASS；沿用 V0 |
| Cache TTL | 300s | PASS；沿用 V0 |
| Maximum stale | 600s | PASS；沿用 V0，超过后失败关闭 |
| Unknown-kid refresh | 1 次 | PASS；刷新后仍未知即拒绝 |
| Minimum key retention | 1560s | PASS；由公式得出 |

Key retention 下界：

```text
max_access_ttl + clock_skew + jwks_max_stale
= 900 + 60 + 600
= 1560 seconds
```

该值是最低保留时间，不是要求运维恰好在 1560 秒删除旧 Key。生产可以延长，
不得缩短。精确 JWKS URL 仍未关闭，因为当前运行态只证明本机
`127.0.0.1:4001`，没有可审计的生产 HTTPS Origin。

## 5. Human Authorization、Session 与 Refresh

| 参数 | 值 | 裁决 |
|---|---:|---|
| Authorization Transaction TTL | 300s | PASS |
| Authorization Code TTL | 60s | PASS |
| PKCE | S256，所有 Client | PASS |
| Redirect URI | 注册值 exact match | PASS |
| Authorization/Refresh Secret | 256-bit random | PASS |
| Session absolute TTL | 30 days | PASS |
| Refresh credential TTL | 7 days | PASS |
| Verifier | scrypt-v1 | PASS |

Session 的 30 天是从认证时起算的绝对上限，不滑动。每次 Refresh 轮换的新
Credential 到期时间固定为：

```text
min(now + 7 days, session.absolute_expires_at)
```

因此刷新可以保持最多 7 天的不活跃窗口，但不能把 Session 延长超过 30 天。
Refresh Secret 本身有 256-bit 随机熵；数据库只保存独立 Salt 的 scrypt
verifier，完整 Wire Value 不落库。旧 Credential 重放撤销整个 Family 与
Session，符合 RFC 9700 的 rotation/replay-detection 模型。

`scrypt-v1` 参数固定为 `N=16384, r=8, p=1, keyLength=32,
saltLength=16`。这里验证的是高熵随机 Bearer Secret，不是低熵用户密码；参数
版本仍必须随记录保存，后续升级不得在失败时回退弱算法。

## 6. OAuth HTTP 与错误

固定：

```text
request content type = application/x-www-form-urlencoded
duplicate parameters = reject
success/error Cache-Control = no-store
success/error Pragma = no-cache
invalid_client = 401
invalid_grant/request/scope/target = 400
unsupported_grant_type/token_type = 400
temporarily_unavailable = 503
server_error = 500
```

Machine/OBO 响应不得出现 Refresh Credential；Human Authorization Code 和
Refresh 成功响应必须轮换返回新的 opaque Refresh Credential。错误描述不得
泄露 Client、Principal、Grant、Proxy、Credential ID 或 verifier 是否存在。

## 7. 残余门

```text
RUNTIME_PARAMETER_REVIEW_PASS=true
RUNTIME_PARAMETER_GATE_CLOSED=true

EXACT_JWKS_URL_REQUIRED=true
CONSUMER_REMOTE_SHA_REQUIRED=true
LLM_TODO_AUTHORIZATION_MATRIX_REQUIRED=true
ADC_V2_INGRESS_SCOPE_REVIEW_REQUIRED=true
INDEPENDENT_BUNDLE_REVIEW_REQUIRED=true
```

上述任一内容改变 Manifest、Registry、Schema 或 Fixture 后，都必须重新固定
远程完整 SHA 并重跑 Bundle Validator 和窄审。
