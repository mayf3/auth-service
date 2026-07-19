# Minimal Auth Foundation V1 — JWKS 部署证据

> 调查日期：2026-07-18（Asia/Shanghai）
> 调查对象：`8.163.44.127` 当前 Nginx 与 auth-service live container
> 结论：`GATE-EXACT-JWKS-URL=open`

## 1. 结论

当前部署不存在可冻结的、通过标准证书验证且实际发布 auth-service JWKS 的精确 HTTPS URL。

```text
TRUSTED_HTTPS_ORIGIN_DISCOVERED=false
JWKS_ROUTE_LIVE=false
EXACT_JWKS_URL_FREEZE_READY=false
```

这不是路径命名问题。现状同时缺少：

1. CA 信任且名称匹配的 HTTPS origin；
2. live auth-service 的 `/.well-known/jwks.json` 路由；
3. Nginx 到该路由的精确公开映射。

因此不能把 IP、自签名证书或 `curl -k` 才可访问的地址写入冻结 Manifest。

## 2. Nginx 只暴露默认 IP 站点

从服务器当前 `nginx -T` 读取到：

```text
listen 443 ssl default_server
listen [::]:443 ssl default_server
server_name _ 8.163.44.127
ssl_certificate /etc/nginx/ssl/server.crt
ssl_certificate_key /etc/nginx/ssl/server.key
```

仓库和 Nginx 配置均未发现 auth-service 专用的可信域名。`/auth/` 当前反向代理到 loopback auth-service，但这本身不能建立外部 TLS 信任。

## 3. 证书不能作为冻结信任根

对公开 443 返回证书的只读检查：

```text
subject = CN=8.163.44.127, O=Agent Dev Center, C=CN
issuer  = CN=8.163.44.127, O=Agent Dev Center, C=CN
subjectAltName = absent
notBefore = 2026-05-21T01:16:23Z
notAfter  = 2027-05-21T01:16:23Z
sha256 = 9C:01:E3:C6:3B:4A:C3:4E:36:2D:AD:27:7E:18:A4:23:
         2F:1C:B4:42:1B:00:FF:3C:B3:49:D8:8A:2D:64:BB:02
```

标准 `curl https://8.163.44.127/...` 证书验证结果：

```text
curl: (60) SSL certificate problem: self signed certificate
```

`-k` 只适合诊断，不能作为生产消费者的验证策略，也不能据此关闭 Gate。

## 4. JWKS 路由当前未上线

只读取 HTTP 状态，不下载或记录 key 内容：

| 请求 | 状态 | 观察 |
|---|---:|---|
| `https://8.163.44.127/.well-known/jwks.json`（跳过 TLS 验证） | 200 | `text/html`，命中默认前端，不是 JWKS |
| `https://8.163.44.127/auth/.well-known/jwks.json`（跳过 TLS 验证） | 404 | Nginx/auth 路径未发布 JWKS |
| `http://127.0.0.1:4001/.well-known/jwks.json`（服务器本机） | 404 | 当前 live auth-service image 未提供该路由 |

仓库候选代码已有 JWKS route，但当前 live image 与合同分支不是同一已审计部署对象；不能用源码存在替代 live route 证据。

## 5. 关闭 Gate 的最小证据

部署 Owner 需要提供或批准：

```text
exact_origin=<部署 Agent 提交的真实 CA-trusted HTTPS origin>
exact_jwks_url=<由真实 origin 与冻结 jwks_path 形成的精确 URL>
certificate_chain_validation=PASS
hostname_validation=PASS
content_type=application/json
jwks_schema_validation=PASS
public_route_to_auth_service=proven
```

上述两项在部署完成前必须保持未赋值；尖括号只描述证据字段，不是候选域名、
URL 或部署证据。

关闭前必须从至少一个真实消费者网络位置执行不带 `-k`、不注入私有 CA 的 GET，并验证返回 JSON 满足冻结 JWKS fixture/schema、只含 public key material。

若组织选择私有 CA，则必须先独立冻结其 trust distribution 合同和消费者安装证据；不能把“服务器上能 curl”视为消费者已信任。

## 6. 授权边界

本调查没有修改 Nginx、证书、DNS、容器或生产进程。申请/安装证书、创建 DNS、修改公开路由和部署新 image 都是外部/生产状态变更，必须由部署 Owner 明确授权后执行。
