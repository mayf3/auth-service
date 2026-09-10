# AUTH_SERVICE_PORT_4001_LOOPBACK_BINDING_V1 — Deployment Packet

> status: READY_FOR_PRODUCTION_PACKET · PRODUCTION_APPLY = **HOLD** ·
> **PRODUCTION_APPLY_AUTHORIZED = NO**（等 Owner union exact-head acceptance）
> scope: 仅收窄 auth-service 业务 listener 绑定以闭合 dsh-agent-core
> AMENDMENT_8 C1（CONTROLLED_LOOPBACK_HTTP_PROVISIONING_EXCEPTION）。
> 不改 token semantics / audience / grant / server 结构；不建 TLS；
> 不上线 public hosting；不影响非目标 listener；不用 firewall 替代应用层绑定。

## 1. AUTH_SERVICE_BINDING_CURRENT（live 实证，2026-09-09）

```text
listener   = *.4001（tcp46 wildcard），进程 authsvc（PID 63442 树，launchd
             com.auth-service.plist），src/server.ts app.listen(env.PORT)——
             无 host 参数 ⇒ Node 绑全部接口
plist env  = 无任何 HOST/BIND 变量（grep 计数 0）
成因       = app.listen(port) 单参形态
```

## 2. NON_LOOPBACK_CONSUMER_CENSUS = NONE（mutation 前机械普查）

| 消费者 | 证据 | rebind 后 |
|---|---|---|
| dsh-agent-core Broker | plist `BROKER_AUTH_ORIGIN=http://127.0.0.1:4001`（唯一 4001 plist 引用） | ✅ loopback |
| svc-forum 容器 JWKS | `AUTH_JWKS_URL=http://host.docker.internal:4001/...`；**race 实证**：容器经 host.docker.internal 发起时，host 侧捕获 `127.0.0.1.4001 ← 127.0.0.1.56222 ESTABLISHED`（Docker Desktop backend 代拨 host 环回） | ✅ 仍走 127.0.0.1 |
| svc-workflow（host 进程） | Rust JWKS-only：`WORKFLOW_JWKS_URL=http://127.0.0.1:4001/.well-known/jwks.json`（.env:7；评审更正——其为 :4001 的 loopback 消费者） | ✅ loopback |
| mobile public hosting | PR #66/#67/#68 全部 MERGED 但显式 **non-production/shadow-only**；影子栈已拆除（无容器）、auth.mayf3.com = NXDOMAIN、上游为 stub 捕获器（仅 1 条探针记录） | 非消费者（如未来激活=新依赖、新生产包） |
| 反向代理/隧道 | 无 nginx/caddy/cloudflared/frp 指向 4001；Tailscale 虽在跑（utun0 100.103.205.36）但零消费者证据 | ✅ |
| 活动连接采样 | 3× netstat 采样：4001 非环回 established = **0**；唯一 TIME_WAIT 来自 127.0.0.1 | ✅ |
| 诚实限制 | auth 无 per-request IP 日志，历史访问不可由日志证明；wildcard 期间 Tailscale/LAN 面理论可达（无消费者证据）；`com.openclaw.*` 4 个 plist 对本 uid 不可读（评审记录在案） | 记录在案 |

**判定：NON_LOOPBACK_DIRECT_CONSUMER = NONE ⇒ SAFE_TO_REBIND_LOOPBACK = YES。**

## 3. AUTH_SERVICE_CHANGESET（exact）

```text
src/config/env.ts  + AUTH_HTTP_BIND_HOST（可选；unset = 现状 wildcard，默认行为零变更）
src/server.ts      listen 分派：set ⇒ app.listen(env.PORT, env.AUTH_HTTP_BIND_HOST, onHttpListening)
                     unset ⇒ app.listen(env.PORT, onHttpListening)（现行为逐字节保持）
（tsc --noEmit 干净；npm ci 后验证）
```

**生产部署步（届时 owner/受权执行，本包不执行）**：
1. 生产树合入本 delta 并 `npm run build`（dist 重建）；
2. `/Library/LaunchDaemons/com.auth-service.plist` EnvironmentVariables 增
   `AUTH_HTTP_BIND_HOST=127.0.0.1`；
3. `launchctl kickstart -k system/com.auth-service` → 机械验证
   `lsof -nP -iTCP:4001 -sTCP:LISTEN` 全部 LISTEN 行 = `127.0.0.1:4001`
   （此时 dsh-agent-core AMENDMENT_8 C1 gate 转 PASS）。

## 4. ROLLBACK（generation-safe 等价：配置级，零数据面）

plist 摘除 `AUTH_HTTP_BIND_HOST` → kickstart → 绑定恢复 wildcard。无数据/
状态迁移（纯 listener 绑定），回滚无 generation 语义。

## 5. POST_APPLY_EXPECTED_BINDING

`127.0.0.1:4001`（::1 不授权、不绑定——AMENDMENT_8 pinned origin 为字面
127.0.0.1，无需要求 IPv6 环回）。

## 6. 评审记录

独立 bounded review：PASS / SHIP_BLOCKERS = NONE（census 完整性、最小
delta、unset 行为逐字节保持、部署步与回滚、C1 联动判定）。
