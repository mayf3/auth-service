---
spec_id: AUTH_SERVICE_MOBILE_PUBLIC_HOSTING_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
scope:
  - mayf3/auth-service 公共托管拓扑（auth.mayf3.com 边缘、回环端点、专用隧道、部署与回滚）
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
external_authorities:
  - repository: mayf3/agent-core-remote-gateway
    authority_id: MOBILE_PUBLIC_REMOTE_GATEWAY_V1
    revision: 62ce8ee2091b230fca5f04b661a3dd605fefbf64
    relation: interoperates_with
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AUTH_SERVICE_MOBILE_PUBLIC_HOSTING_V1

## 1. Goal

为 `https://auth.mayf3.com` 冻结唯一合法的公共托管拓扑：Internet 命中 Aliyun
Nginx 的**专用 SNI server block**，经**仅回环可达**的专用隧道端点，走**专用反向
SSH 隧道**，到达 Mac 上既有的 auth-service 生产实例 `127.0.0.1:4001`。auth-service
本体保持私有；公共主机上不运行第二个 auth-service、不运行任何 Agent 运行时。

```text
GOAL = 浏览器与 Mobile 公共客户端能经公共 HTTPS 到达 auth-service 的既定
       OAuth 端点与 well-known 资源，同时 auth-service 的进程、数据库与
       凭据全部留在私有 Mac 上，且回滚路径明确。
SUCCESS_OUTCOME = auth.mayf3.com 成为 auth-service 唯一公共入口；
       每个失败诚实返回；日志零凭据；回滚 = 关闭 SNI block + 停隧道，
       现有 Tailscale 产品路径与本服务私有运行时零改动。
```

## 2. Owner 裁决与硬边界

Owner ruling = `ACCEPT_AUTH_PUBLIC_HOSTING_CANDIDATE_A`（2026-09-09，
MOBILE_REMOTE_DOMAIN_ACCESS_V1 Round 3）。以下边界为冻结值：

```text
AUTH_TRAFFIC_THROUGH_MOBILE_PRODUCT_GATEWAY = NO
DIRECT_PUBLIC_AUTH_SERVICE                  = NO
FULL_AUTH_SERVICE_ON_ALIYUN                 = NO
SECOND_AUTH_SERVICE                         = NO
SHARED_PRODUCT_GATEWAY_AUTH_SEMANTICS       = NO
```

B2 权威搜索结论（2026-09-09，read-only）：本仓库既有关乎（含 accepted
`AUTH_SERVICE_MOBILE_PUBLIC_OAUTH_V1` 与 `MINIMAL_AUTH_FOUNDATION_V2`）均不
拥有公共托管拓扑；`MINIMAL_AUTH_FOUNDATION_V2` 将精确生产 HTTPS origin 显式
留给 `PRODUCTION_DEPLOYMENT` attestation —— 本 Spec 即为该空位的最小权威。

## 3. 职责边界（owns / MUST NOT own）

本 Spec **只拥有**：`auth.mayf3.com` 的公共托管拓扑 —— Aliyun Nginx SNI 边界、
仅回环的远端端点、专用反向隧道、Mac 回环 auth-service 上游、TLS/Host/代理头
边界、日志禁令、health/readiness 传输面、超时/失败行为、部署与回滚。

本 Spec **不得重定义**（这些归 accepted `AUTH_SERVICE_MOBILE_PUBLIC_OAUTH_V1`
@ `795f86e6ae4b0445d050242c8259ee7a378f803e` 以及 `MINIMAL_AUTH_FOUNDATION_V2`
所有）：OAuth 协议语义、PKCE、浏览器 Cookie/CSRF 安全、Human token claims、
Client/Audience/Redirect/Grant 注册语义、refresh 轮换与 logout/撤销语义。
传输层的任何改动若改变上述语义，均属越界，须回到其所属权威处理。

与移动产品网关（`MOBILE_PUBLIC_REMOTE_GATEWAY_V1`，external authority 钉板）
的关系是**同一台 Nginx 上的共存**：各自独立 SNI block、互不 touching 对方配置、
`default_server` block 双方都不得修改。auth 流量永不经过 18080/18793。

## 4. 拓扑冻结

```text
PUBLIC_AUTH_ORIGIN      = https://auth.mayf3.com
PUBLIC_AUTH_PORTS       = 443 only（专用 SNI server block）
AUTH_TUNNEL_LISTENER    = 127.0.0.1:18794（sshd remote-forward 创建，仅回环）
AUTH_TUNNEL_PRINCIPAL   = agentcore-auth-tunnel（与产品隧道 principal 分离）
MAC_UPSTREAM            = 127.0.0.1:4001（既有生产 auth-service，唯一实例）
DEPLOYMENT_MODE         = 配置 + 既有进程监督；公共主机上无新增常驻业务进程
DOCKER_DEPLOYMENT       = FORBIDDEN
```

```text
PRODUCT FLOW (auth):
Browser / Android
→ HTTPS 443 auth.mayf3.com（Aliyun Nginx 专用 SNI server block）
→ Nginx proxy → 127.0.0.1:18794（sshd remote-forward，仅回环）
→ 专用反向 SSH 隧道
→ Mac auth-service 127.0.0.1:4001
```

## 5. Contracts

### CTR-AH-TOPO-001 — 拓扑与端口所有权

部署 MUST 且只能实现 §4 拓扑。端口所有权为 scoped 而非 host-wide：

```text
AUTH_HOSTING_OWNED_PUBLIC_PORTS = 443（仅本 SNI block）
AUTH_HOSTING_INTERNAL_PORTS     = 127.0.0.1:18794
```

- Nginx config 改动仅限**新增**本 SNI block；MUST NOT 修改既有
  `default_server` block、移动产品网关的 `mobile-api.mayf3.com` block，或任何
  其他既有站点（变更前后 diff 为证）。
- 18794 由 sshd remote-forward 创建，MUST 仅绑定回环（`GatewayPorts no`）。
- 本 Spec MUST NOT 声明、关闭或枚举共享主机上的其他端口。

### CTR-AH-TLS-001 — 证书与 TLS

- `auth.mayf3.com` MUST 使用公开受信证书；生产路径 MUST NOT 使用自签证书。
- 证书签发与续期路径须在部署时确定并记录（含续期自动化与失败告警）。
- TLS 之外不引入任何前置 L7 代理/WAF/CDN（`TRUSTED_UPSTREAM_PROXY_HOPS = 0`，
  与网关权威同纪律）。

### CTR-AH-EDGE-001 — 反向代理与请求头边界

Nginx SNI block MUST：

- 删除客户端供给的 `Forwarded` / `X-Forwarded-For` / `X-Real-IP`；
- 以 `proxy_set_header Host auth.mayf3.com` 固定上游所见 Host（auth-service
  的 Origin/redirect 校验依赖精确 origin，见相邻 OAuth 权威）；
- 注入 `X-Forwarded-Proto https`；
- 不注入、不透传任何 `X-AgentCore-*` 头（该命名空间属产品网关权威；两套边界
  不共享任何 edge secret）；
- 仅转发到 `127.0.0.1:18794`。

### CTR-AH-LOG-001 — 日志禁令

Nginx access/error 日志与本链路任何组件 MUST NOT 记录：

```text
authorization code
state / PKCE verifier / PKCE challenge
access token / refresh token / 任何凭据
Cookie（含 __Host- session 与 CSRF cookie 的值）
密码或任何用户输入体
/oauth/* 与 /mobile/callback 的 query string（code/state 在此到达）
响应体
```

实施下限：`/oauth/*`、`/mobile/callback`、`/.well-known/*` location 的 access
logging MUST 去除 query string（或对上述路径完全关闭 access log），error log
MUST NOT 含请求体。

### CTR-AH-TUNNEL-001 — 专用隧道

- Aliyun sshd 新增受限 principal `agentcore-auth-tunnel`：
  `PermitListen 127.0.0.1:18794`、`PermitOpen none`、`GatewayPorts no`、
  无 TTY/agent/X11 转发、authorized_keys 以
  `restrict,port-forwarding,permitlisten="127.0.0.1:18794"` 双重锁定。
- Mac 侧 SSH 客户端由 launchd 监督（独立于产品隧道的 plist）：
  `ssh -N -R 127.0.0.1:18794:127.0.0.1:4001`，`ExitOnForwardFailure=yes`、
  KeepAlive + 退避重连、host-key 预钉（`StrictHostKeyChecking=yes`，
  `UpdateHostKeys=no`）。
- 失败语义 fail-loud：隧道不在时 Nginx 对浏览器诚实返回 502/504；MUST NOT
  存在任何 fallback、mock、或第二个 auth-service 实例。

### CTR-AH-WELLKNOWN-001 — well-known 与 App Link 传输面

公共 origin MUST 交付：

```text
GET /.well-known/jwks.json      → 代理至 Mac auth-service（现有端点）
GET /.well-known/assetlinks.json → 静态交付；内容由 mayf3/agent-core-mobile
                                   的 Android 签名凭据决定，部署时以该仓库
                                   提供的字节 + sha256 钉住；本 Spec 只拥有
                                   交付，不定义 App Link 语义
```

`/mobile/callback`、`/oauth/authorize/ui`、`/oauth/token`、`/oauth/logout` 的
**传输路径**由本 SNI block 交付至 auth-service；其**端点语义**（redirect 精确
匹配、state 单次消费、CSRF、错误页等）归 `AUTH_SERVICE_MOBILE_PUBLIC_OAUTH_V1`，
本 Spec 不得重定义。

### CTR-AH-TIMEOUT-001 — 超时与失败

```text
UPSTREAM_CONNECT_TIMEOUT = 5s
PROXY_READ_TIMEOUT       = 60s   （浏览器 OAuth 流：无长轮询 turn）
MAX_BODY                 = 1 MiB
```

- 浏览器流无长后端 turn；MUST NOT 复用产品网关的 300/330s 阶梯。
- `POST /oauth/token`、`POST /oauth/logout`、`POST /oauth/authorize/authenticate`
  等非幂等请求 MUST NOT 被 Nginx 自动重试；失败诚实返回（502/504）。

### CTR-AH-DEPLOY-001 — 部署与回滚

部署物 = 新增 Nginx SNI block + sshd principal 配置 + Mac 侧 launchd plist +
静态 assetlinks 交付文件；零新增常驻业务进程。

```text
ROLLBACK = 关闭 auth SNI block → 停 auth 隧道（Mac 侧 + sshd principal 可保留
           为惰性配置）→ 公共 auth 面归零。MUST NOT 修改 auth-service 进程、
           数据库、既有产品网关路径或 Tailscale artifact 的任何状态。
EMERGENCY_CONTAINMENT = 同 ROLLBACK（disable SNI block 即可达）。
```

## 6. Acceptance

以下全部为**未来验收定义**；均未执行、均未声称 PASS。

### ACC-AH-TLS-001 — TLS 与 SNI 隔离

- Contracts: `CTR-AH-TLS-001`, `CTR-AH-TOPO-001`
- Method: 公开探针验证 auth.mayf3.com 证书链受信；exact-SNI 命中；
  default_server 与 mobile-api block 变更前后 diff 为零改动
- Failure: 自签证书入生产路径；既有 block 被修改

### ACC-AH-TUNNEL-001 — 隧道行为

- Contracts: `CTR-AH-TUNNEL-001`, `CTR-AH-TOPO-001`
- Method: 正向转发验证；隧道中断故障注入（浏览器诚实 502，无 mock）；
  两端仅回环绑定证明；kill Mac 侧客户端观察 launchd 自动恢复；
  principal 权限矩阵（PermitListen 之外全拒绝）
- Failure: 非回环绑定、mock/fallback、无自动恢复、越权转发

### ACC-AH-LOG-001 — 日志负扫描

- Contracts: `CTR-AH-LOG-001`
- Method: 全链路（Nginx access/error、隧道、Mac auth-service 之外的公共面）
  负扫描 `CTR-AH-LOG-001` 全部禁项；特别构造含 code/state/cookie 的请求后
  检查日志零残留
- Failure: 任何禁项出现在任何日志

### ACC-AH-WELLKNOWN-001 — well-known 交付

- Contracts: `CTR-AH-WELLKNOWN-001`
- Method: `/.well-known/jwks.json` 代理正确性（与 127.0.0.1:4001 直连字节
  一致）；`/.well-known/assetlinks.json` 与钉住的 sha256 字节一致；
  `/mobile/callback` 传输可达且语义行为归 OAuth 权威验证
- Failure: 字节不一致、404、或本 Spec 越权定义了端点语义

### ACC-AH-ROLLBACK-001 — 回滚演练

- Contracts: `CTR-AH-DEPLOY-001`
- Method: 真实执行回滚演练（disable SNI → 停隧道）后验证：公共 auth 面归零；
  auth-service 私有运行时（127.0.0.1:4001）、数据库、产品网关路径、Tailscale
  artifact 全部零改动；再按部署序恢复
- Failure: 任何后端状态被回滚波及

### Contract coverage（bidirectional）

| Contract | Acceptance | Covered |
|---|---|---|
| `CTR-AH-TOPO-001` | `ACC-AH-TLS-001`, `ACC-AH-TUNNEL-001` | YES |
| `CTR-AH-TLS-001` | `ACC-AH-TLS-001` | YES |
| `CTR-AH-EDGE-001` | `ACC-AH-TLS-001`, `ACC-AH-LOG-001` | YES |
| `CTR-AH-LOG-001` | `ACC-AH-LOG-001` | YES |
| `CTR-AH-TUNNEL-001` | `ACC-AH-TUNNEL-001` | YES |
| `CTR-AH-WELLKNOWN-001` | `ACC-AH-WELLKNOWN-001` | YES |
| `CTR-AH-TIMEOUT-001` | `ACC-AH-TUNNEL-001`, `ACC-AH-LOG-001` | YES |
| `CTR-AH-DEPLOY-001` | `ACC-AH-ROLLBACK-001` | YES |

反向：每个 Acceptance 至少映射一个 Contract，无孤儿。

```text
BIDIRECTIONAL_COVERAGE = PASS
```

## 7. 部署门（production gates）

以下全部为 owner-gated 生产变更，尚未执行；串行约束
`PRODUCTION_MUTATION_CONCURRENCY = 1`（与网关 V2 的 Nginx 变更互斥排队）：

```text
[ ] DNS auth.mayf3.com A 记录创建（owner，Aliyun DNS）
[ ] 公开受信证书签发（含续期路径）
[ ] Nginx 配置备份（变更前）
[ ] sshd principal + Mac launchd 隧道端建立
[ ] assetlinks.json 内容钉板（mobile 仓库供给 + sha256）
[ ] ACC-AH-* 全部执行通过
[ ] 公共激活（最后，单次，可回滚）
```

排除项：Client/Audience/Redirect/Grant 的生产注册**不在本 Spec 范围**（归
`AUTH_SERVICE_MOBILE_PUBLIC_OAUTH_V1` 的执行轮：先授权直查 DB，按
ABSENT / EXACT_EXISTING / MISMATCH 幂等处理）。

## 8. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
READY_TO_MARK_ACCEPTED = YES（独立 REVIEW 通过后，等待 owner exact-head acceptance）
```
