---
authority_id: MINIMAL_AUTH_FOUNDATION_V2
status: proposed
authority_kind: architecture
owning_repository: mayf3/auth-service
implementation_authority: contracts
scope:
  - mayf3/auth-service identity architecture
  - V0-to-V1 migration / hard-cut sequencing authority
governed_by: []
external_authorities: []
supersedes:
  - MINIMAL_AUTH_FOUNDATION_V1
superseded_by: null
owners:
  - mayf3
---

# MINIMAL_AUTH_FOUNDATION_V2

```text
AUTHORITY_ID = MINIMAL_AUTH_FOUNDATION_V2
AUTHORITY_KIND = architecture
AUTHORITY_STATUS = proposed
SUPERSEDES = MINIMAL_AUTH_FOUNDATION_V1 (whole authority)
SUPERSEDED_BY = null (until a future whole-authority successor)
PROPOSED_AT_BASE = 1da40d435f44b2a26b1d046e2f2fa234a6a8c9d9
DATE = 2026-08-20

AUTHORITY_DELTA_SCOPE =
  migration / hard-cut / sequencing authority only

UNTOUCHED_ARCHITECTURE_SEMANTICS = PRESERVED_AT_EXACT_IDENTITY
PRODUCTION_EFFECTIVE = false
MAINLINE_EFFECTIVENESS_GATES = PRESERVED_FROM_V1
IMPLEMENTATION_AUTHORITY = contracts
IMPLEMENTATION_AUTHORITY_SCOPE =
  incorporated frozen contract modules and bundle only;
  amended sequencing module authorizes no product change by itself
```

## 1. Goal

建立 `MINIMAL_AUTH_FOUNDATION_V1` 的 whole-authority successor：
完整保留全部未改变的 Minimal Auth V1 架构、claims、profiles、grants、
delegation、human session、conformance 与 Wire requirements，并在单一
docs-only authority change 中原子替换 migration / hard-cut / sequencing
authority，使 Owner 已接受的 Legacy 硬切方向获得合法的 authority 通路，
解除 `AUTH_SERVICE_LEGACY_SURFACE_SHUTDOWN_V1`（PR #2）acceptance 的
治理阻塞。

本 authority 不改变任何产品架构语义，不宣布 production effective，
不授权实现，不部署。

## 2. Scope and non-goals

### 2.1 Scope

- `MINIMAL_AUTH_FOUNDATION_V1` 的 whole-authority supersession；
- V0→V1 migration / hard-cut / sequencing authority 的原子替换；
- supersession 生效时的原子 backlink 义务。

### 2.2 Non-goals

- 不重新设计 Minimal Auth V1 架构（DEC-AUTH-SHUTDOWN-004 同向）；
- 不修改任何已接受 authority 的原有 normative meaning——V1 文件在 V2
  被接受并合入 main 前保持原样且仍是唯一活动 architecture authority；
- 不新增、删除或改写任何 wire claim、profile、grant、delegation、
  human session 或 conformance requirement；
- 不宣布 `MINIMAL_AUTH_MAINLINE_EFFECTIVE` 或任何 production-effective
  状态；
- 不接受、不修改、不实现 PR #2；PR #2 的 alignment 是其自己的后续
  amendment；
- 不实现、不部署、不 merge。

## 3. Authority and dependencies

### 3.1 Authority kind 与 precedence

```text
authority_kind = architecture
```

V2 位于本地 precedence 第 2 层（`.agents/local/README.md` §2）：
Product Direction（当前 NONE_DECLARED）→ 本 architecture authority →
`docs/specs/` accepted governing Specs → code/tests/runtime。

governing Specs 不得覆盖本 authority；本 authority 不得越权改写其他
仓库的 accepted authority。

`governed_by: []` 仅表达“本仓库内无更高本地 authority”；该 top-level
角色由 `SPEC_ACCEPTANCE_ACTORS` 接受本 authority 时显式确认。

### 3.2 Whole-authority supersession 机制

依据 `SPEC_FORMAT_V0` §2.7（whole-Spec ID only；fragment 禁止）与
`.agents/local/README.md` §5（修改既有 normative meaning 必须走
whole-authority `SUPERSEDE`）：

```text
V2 (proposed) ──accept + merge──▶ V1 (superseded)
```

- 在 V2 被独立 semantic review、Owner accept 并合入 main 之前：V1 保持
  唯一活动 architecture authority；本文件只是 proposed 候选；
- V2 接受并合入时，同一 docs-only change 原子完成（CTR-MAFV2-005）：
  - `.agents/local/README.md` §2 将 `MINIMAL_AUTH_FOUNDATION_V1` 标记为
    superseded、`superseded_by: MINIMAL_AUTH_FOUNDATION_V2`；
  - `docs/specs/README.md` authority 清单同步；
  - `docs/contracts/minimal-auth-v1/README.md` 状态块追加非 normative
    指针：`SUPERSEDED_BY=MINIMAL_AUTH_FOUNDATION_V2`（不改动其 normative
    内容任何字节之外的语义）；
- backlink 禁止提前出现在本 proposed 阶段。

### 3.3 对 governing Specs 的关系

`AUTH_SERVICE_LEGACY_SURFACE_SHUTDOWN_V1` 及其他 governing Specs 在 V2
接受后应将 `governed_by` 指向 `MINIMAL_AUTH_FOUNDATION_V2` 并删除任何
prose-only partial supersession 表述。该 alignment 属于各 Spec 自己的
amendment，不由本 authority 代替完成。

## 4. Current State

- `STATE-MAFV2-001` — `MINIMAL_AUTH_FOUNDATION_V1` 是活动 frozen
  architecture authority：normative modules 位于
  `docs/contracts/minimal-auth-v1/`，executable bundle 位于
  `contract-bundles/minimal-auth-v1/`（1.2.0，frozen，
  implementation_authorized=true）。观察基线 commit
  `1da40d435f44b2a26b1d046e2f2fa234a6a8c9d9`，observed 2026-08-20。
  Basis: `OBS-MAFV2-001`。
- `STATE-MAFV2-002` — 共享开发治理已在该基线 accepted 并合入 main
  （`AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1` status=accepted；
  lock adoption.status=accepted）。Basis: `OBS-MAFV2-004`。
- `STATE-MAFV2-003` — PR #2（head `fb8d55e785d6f99c9e57a602543609953e8f5410`）
  为 proposed governing program，声明
  `governed_by: [MINIMAL_AUTH_FOUNDATION_V1]` 且 `supersedes: []`，但其
  §12.2 以 prose 表格选择性 supersede 父级 migration sequencing 条款，
  其 §3.1 将自身 Owner 决策置于父级 authority 之上。独立 Review
  （REVISE，5 blockers，2026-08-19/20）已认定该形态为 Governance V0
  禁止的 prose-only partial supersession。Basis: `OBS-MAFV2-003`。
- `STATE-MAFV2-004` — Owner 已接受的硬切产品方向（无迁移窗口、无双协议
  artifact、无兼容开关）目前缺乏合法的 authority transition 机制承载，
  造成父级 sequencing 与 governing program 之间的治理冲突。Basis:
  `OBS-MAFV2-002`、`OBS-MAFV2-003`。

## 5. Observations

### OBS-MAFV2-001 — V1 authority 模块清单（exact identity）

- Subject: `MINIMAL_AUTH_FOUNDATION_V1` normative modules 与 bundle
- Source revision: `1da40d435f44b2a26b1d046e2f2fa234a6a8c9d9`
- Method: `git rev-parse <commit>:<path>`（blob identity）
- Observed at: 2026-08-20
- Result: 见 CTR-MAFV2-001 incorporation 表。

### OBS-MAFV2-002 — V1 migration 模块冻结的 sequencing 条款

- Subject: `docs/contracts/minimal-auth-v1/v0-to-v1-migration.md`
- Source revision: blob `954b661e84697a7b78566fadd09383dd5298b5d4`
- Observed at: 2026-08-20
- Result: §7 Phase 3 要求“不静默删除 Legacy”；§7 Phase 5 要求 Legacy
  流量为零并持续满足冻结窗口后受控删除；§8 允许迁移窗口内受控双协议
  （显式模式选择、独立遥测、固定截止日期）；§9 冻结九项 mainline
  生效门。

### OBS-MAFV2-003 — PR #2 的 prose-only partial supersession

- Subject: PR #2 head `fb8d55e785d6f99c9e57a602543609953e8f5410`
  `docs/specs/AUTH_SERVICE_LEGACY_SURFACE_SHUTDOWN_V1.md`
- Observed at: 2026-08-20（依据该 head 上的独立 review record）
- Result: frontmatter `supersedes: []` 与 §12.2 选择性 supersession 表、
  §3.1 precedence 排序互相矛盾；Governance V0 禁止该形态。

### OBS-MAFV2-004 — 治理已激活

- Subject: governance adoption 状态
- Source revision: `1da40d435f44b2a26b1d046e2f2fa234a6a8c9d9`
- Observed at: 2026-08-20
- Result: adoption spec 与 lock 均 accepted；enforcement level 为
  MANUAL_POLICY（不构成流程障碍，docs-only authority change 可执行）。

### OBS-MAFV2-005 — 未改变内容的可精确保持性

- Subject: V1 non-sequencing 模块
- Observed at: 2026-08-20
- Result: architecture/claims/profiles/grants/delegation/human-session/
  conformance/wire 内容与 migration sequencing 相互独立，可按 exact blob
  identity 原样并入 successor，无需重写任何字节。

## 6. Claims and assumptions

- `CLM-MAFV2-001` — Owner 硬切方向（DEC-AUTH-SHUTDOWN-001/005 等同向）
  与 V1 sequencing 的冲突只能通过 whole-authority supersession 合法解除；
  对齐回 V1 sequencing 等于否决已接受 Owner 决策。Assumption：Owner
  不推翻该方向。
- `CLM-MAFV2-002` — 全部 non-sequencing normative 内容可以且必须按
  exact identity 保留；任何字节级改写都会把 authority delta 扩大到
  migration/sequencing 之外。Assumption：V1 模块在 V2 接受前不被其他
  change 修改（CTR-MAFV2-008 保护）。
- `CLM-MAFV2-003` — PR #2 的 five blockers 中，Blocker 1（authority）
  是其余修正（rebase、governed_by、precedence、CTR-025、ACC 坐标、
  ALT→DEC、index）的前置条件；父级 successor 合入前对 PR #2 的任何
  acceptance 都是非法的。

## 7. Evidence relations

- `EVD-MAFV2-001` — `OBS-MAFV2-001`、`OBS-MAFV2-005` 支持
  `CLM-MAFV2-002`（模块可按 identity 保留）。
- `EVD-MAFV2-002` — `OBS-MAFV2-002`、`OBS-MAFV2-003` 支持
  `CLM-MAFV2-001`（冲突真实存在且不可由 governing spec 自行消除）。
- `EVD-MAFV2-003` — `OBS-MAFV2-003`（review record REVISE/5 blockers）
  支持 `CLM-MAFV2-003`（acceptance 被阻塞）。

## 8. Decisions

- `DEC-MAFV2-001` — 采用 whole-authority supersession：V2 whole 地取代
  V1；禁止 module-level 或 prose-level partial supersession。
- `DEC-MAFV2-002` — 全部 non-sequencing normative 内容按 CTR-MAFV2-001
  的 exact identity 表保留，不复制改写。
- `DEC-MAFV2-003` — authority delta 原子限定于 migration / hard-cut /
  sequencing（CTR-MAFV2-002）；除此之外 V2 与 V1 语义等价。
- `DEC-MAFV2-004` — 硬切取代受控双协议窗口：Cut Artifact 直接删除
  Legacy runtime，不存在迁移窗口、mode switch、per-request fallback 或
  遥测窗口期。
- `DEC-MAFV2-005` — 零 Legacy 依赖证据在 PRE_CUT 阶段、于旧
  legacy-carrying artifact 上采集；删除门不再要求在携带 Legacy 代码的
  新 artifact 中观察零流量。
- `DEC-MAFV2-006` — 消费者迁移范围与分类 authority = 当前 1.2.0
  Consumer Matrix 与 Production Activation fixed-SHA evidence；历史
  inventory 只是迁移证据。
- `DEC-MAFV2-007` — V1 §9 九项 mainline 生效门原义保留；生效声明仍需
  全部门禁为真。
- `DEC-MAFV2-008` — V0 frozen contracts 在生效门完成前继续治理当前
  生产路径（V1 §2 原义）。
- `DEC-MAFV2-009` — 回滚 = whole-release rollback 到上一个 immutable
  artifact（break-glass，须记录）；不存在模式切换式回滚。

## 9. Contracts

### CTR-MAFV2-001 — Unchanged modules incorporation（exact identity）

以下内容按 `1da40d435f44b2a26b1d046e2f2fa234a6a8c9d9` 的 blob identity
并入 V2，语义逐字节不变，构成 V2 的 normative 组成部分：

| Content | Blob SHA-1 @1da40d4 |
|---|---|
| `docs/contracts/minimal-auth-v1/README.md` | `fbaf7c8986aa367e0f8f43de1872e6d7e6c5ca5f` |
| `docs/contracts/minimal-auth-v1/claims-and-profiles.md` | `a51186adacc6b61131dcf7ad0227e372b67e8092` |
| `docs/contracts/minimal-auth-v1/conformance.md` | `d56c45c514d308e65e698f6b2e78799d079a65ea` |
| `docs/contracts/minimal-auth-v1/delegation.md` | `f64448ed860143f6e5d566e5dbd729aa4d68b20e` |
| `docs/contracts/minimal-auth-v1/grants-and-audiences.md` | `277ea7f9cdb26558e196ec9e382430b324ddee32` |
| `docs/contracts/minimal-auth-v1/human-session-refresh.md` | `f9949637b40e1023d917393148d692df26b624af` |
| `contract-bundles/minimal-auth-v1/`（tree） | `796a8b670f8617ab5f45c7b8734e124e07934f09` |
| `contract-bundles/minimal-auth-v1/contract-manifest.json` | `8557b36de241e39570f478e21a95ff375d11759a` |
| `contract-bundles/minimal-auth-v1/audience-registry.json` | `8ddf67afc2494dddc3c087d19f2f93c71db13d70` |

上述模块中涉及迁移 sequencing 的语句（仅存在于被替换模块）以
CTR-MAFV2-002 为准；其余语句的 normative meaning 不变。

### CTR-MAFV2-002 — Amended migration / hard-cut / sequencing module

本 Contract whole 地替换
`docs/contracts/minimal-auth-v1/v0-to-v1-migration.md`
（blob `954b661e84697a7b78566fadd09383dd5298b5d4`）的 normative
sequencing meaning；其余模块不受影响。

#### 9.2.1 保留部分（原义并入）

```text
V1 §1/§2 生效前后权威关系（V0 继续治理直至生效门完成）
V1 §3 不做的 Wire 变化（全部保留决定）
V1 §4 Wire 兼容矩阵（Direct/Service/OBO/Human）
V1 §5 CCR-V1-001..005
V1 §6 消费者盘点 per-consumer 必填字段
V1 §9 九项 mainline 生效门（NARROW_CONTRACT_REVIEW_PASS …
     MAINLINE_RECONFORMANCE_PASS，全部原义）
```

#### 9.2.2 替换部分一 — 阶段模型（替换 V1 §7）

```text
Phase 0  合同审阅            （原义）
Phase 1  实现与消费者盘点    （原义；固定 SHA 审计）
Phase 2  Contract Bundle Freeze（原义；已于 1.2.0 完成）
Phase 3  发行方实现 = V1-only runtime hard cut
         - 首个 accepted Runtime Child 产出的 Cut Artifact 直接删除
           Legacy 路由、HS256 签发/验签、Legacy refresh、flat-field
           backfill apply 与 Legacy 权限 authority；
         - “不静默删除 Legacy”条款废止：删除动作由 accepted governing
           Spec + Consumer Gate + Release Gate 显式授权；
         - 数据库 Legacy 结构可作 dead data 保留以维持 whole-release
           rollback（处置由 governing Spec 冻结）。
Phase 4  消费者迁移
         - 逐消费者对已部署的 V1 surface 迁移：获取 V1 token、本地
           offline JWKS 验签、固定 audience/profile/scope、删除 HS256
           secret、verify-token 与 live status lookup；
         - Cut Artifact 本身不携带 Legacy 面，因此不存在双协议部署期。
Phase 5  切换与生效
         - PRE_CUT：部署 Cut Artifact 之前，在旧的 legacy-carrying
           artifact 上以 telemetry、consumer inventory 与 fixed-SHA
           evidence 证明零 Legacy 依赖，并满足冻结证据窗口；
         - 部署 Cut Artifact（单一 V1-only runtime，无 mode switch）；
         - MAINLINE_RECONFORMANCE 通过后按 V1 §9 九门声明生效。
```

#### 9.2.3 替换部分二 — 双协议与回滚（替换 V1 §8）

```text
MIGRATION_WINDOW = NONE
DUAL_PROTOCOL_ARTIFACT = NONE
AUTH_CONTRACT_MODE = NONE
PER_REQUEST_FALLBACK = NONE
MODE_TELEMETRY_WINDOW = NONE
ROLLBACK = WHOLE_RELEASE_ONLY（break-glass，记录原因/时间/artifact
          digest/Operator/恢复计划；不得自动降级算法、Audience 或
          Claim 要求）
```

#### 9.2.4 替换部分三 — 消费者范围 authority（替换 V1 §6 首批清单条款）

```text
CONSUMER_SCOPE_AUTHORITY =
  contract-bundles/minimal-auth-v1 metadata Consumer Matrix
  + Production Activation fixed-SHA evidence
HISTORICAL_FIRST_WAVE_LIST = migration evidence only
```

### CTR-MAFV2-003 — Production-effective 状态不变

本 authority 不宣布、不隐含 `MINIMAL_AUTH_MAINLINE_EFFECTIVE`、
`auth_token_contract_v1_production_effective` 或任何 production
deployment readiness；九门语义与声明条件原义保留（CTR-MAFV2-002
§9.2.1）。

### CTR-MAFV2-004 — Implementation authority 精确范围

```text
implementation_authority = contracts
授权对象 = CTR-MAFV2-001 并入的 frozen contract modules 与 1.2.0
           executable bundle（与 V1 相同范围）
不授权对象 = CTR-MAFV2-002 sequencing module 本身
```

sequencing 变更的 product 实现仍需相应 accepted governing Spec
（如 shutdown program 及其 children）按治理规则授权；本 authority
接受不等于任何 child implementation 启动许可。

### CTR-MAFV2-005 — Supersession activation 与原子 backlink

V2 仅在以下条件同时成立时成为活动 authority：

```text
independent semantic review PASS（绑定本 exact revision）
Owner acceptance by SPEC_ACCEPTANCE_ACTORS
accepted exact content merged into main
```

接受合入的同一 docs-only change 必须原子完成 §3.2 所列 backlink 更新。
在激活前，V1 与 V2 并存期间以 V1 为准。

### CTR-MAFV2-006 — Governing spec alignment 义务（非本 authority 执行）

V2 激活后，声明 `governed_by: [MINIMAL_AUTH_FOUNDATION_V1]` 的
governing Specs 必须在各自 amendment 中：

```text
governed_by → MINIMAL_AUTH_FOUNDATION_V2
删除全部 prose-only partial supersession 表述
precedence 修正为：本 architecture authority > 该 Spec 自身决策
```

### CTR-MAFV2-007 — Precedence 边界

governing Specs 及其 children 不得覆盖本 authority；本 authority 不得
改写其他仓库 accepted authority；external reference 不授予本地
supersession 权限。

### CTR-MAFV2-008 — No silent divergence

若 V2 接受前，CTR-MAFV2-001 表中任一 blob 在 main 上发生变化，本
supersession 失效，必须基于新基线重新提出 whole-authority successor；
不得静默沿用过期 identity。

## 10. Acceptance

- `ACC-MAFV2-001` — incorporation identity 校验。
  - Method: 在 acceptance base commit 上运行
    `git rev-parse <base>:<path>` 并与 CTR-MAFV2-001 表逐项比对。
  - Environment: `mayf3/auth-service` repository @ acceptance base。
  - Expected: 全部 blob/tree SHA 一致。
  - Failure: 任一不一致 → 拒绝接受（CTR-MAFV2-008）。
  - Evidence: review record 于本 PR，含比对输出。
- `ACC-MAFV2-002` — delta 原子性校验。
  - Method: 对照 V1 权威内容审查 V2 全文，语义差异仅允许出现在
    migration/hard-cut/sequencing 范围（CTR-MAFV2-002 所列替换点）。
  - Environment: 独立 semantic review（reviewer 不得是 author）。
  - Expected: 无 architecture/claims/profiles/grants/delegation/
    human-session/conformance/wire 语义差异。
  - Failure: 任一范围外差异 → REVISE。
  - Evidence: review record 明确列出 diff 分类结论。
- `ACC-MAFV2-003` — 生产状态与门禁保留校验。
  - Method: 静态审查 CTR-MAFV2-002 §9.2.1 与 CTR-MAFV2-003。
  - Expected: 九门原义保留；无 production-effective 声明。
  - Evidence: review record。
- `ACC-MAFV2-004` — backlink 原子性计划校验。
  - Method: 审查 acceptance merge 内容与 §3.2/CTR-MAFV2-005 清单。
  - Expected: 同一 docs-only change 内完成全部 backlink。
  - Evidence: acceptance merge commit。
- `ACC-MAFV2-005` — 独立评审与 Owner 接受。
  - Reviewer: 独立 semantic reviewer（指定延续评审人：OpenAI GPT-5.6
    Pro，或 Owner 委任的等效独立 reviewer）。
  - Acceptance actor: `mayf3 | explicitly delegated auth-service
    maintainer`。
  - Expected: REVIEW PASS 后由 acceptance actor 接受并合入。
  - Evidence: PR review record + acceptance 记录。
  - observed_at: 以实际执行时间为准，逐项写入 evidence。

## 11. Alternatives and disposition

- `ALT-MAFV2-001` — 将 shutdown program 对齐回 V1 sequencing（受控双协
  议窗口 + 携带 Legacy 的 Phase 3/5）。
  Rejected：等于否决 Owner 已接受的硬切方向。Related decision:
  `DEC-MAFV2-004`。
- `ALT-MAFV2-002` — 原地 AMEND `v0-to-v1-migration.md` 模块。
  Rejected：对已接受 authority 的 module-level 改写即 partial
  supersession，Governance V0 禁止。Related decision: `DEC-MAFV2-001`。
- `ALT-MAFV2-003` — 等待治理自动化 gate（CI/branch protection）落地后
  处理。
  Rejected：docs-only authority change 不依赖自动化；MANUAL_POLICY 下
  流程完整可执行。Related decision: `DEC-MAFV2-001`。
- `ALT-MAFV2-004` — 不处理冲突，冻结 PR #2。
  Rejected：遗留 governance conflict 且阻塞已接受方向的落地。
  Related decision: `DEC-MAFV2-003`。

## 12. Migration, compatibility, and rollback

- 本 authority change 是 docs-only：新增本文件 + authority map/index
  的 proposed 状态记录；不触碰任何产品代码、schema、bundle bytes。
- 兼容性：V1 在 V2 激活前保持完全活动；并入内容按 identity 冻结，
  不产生双重 normative 来源。
- 回滚：V2 被拒绝 → 删除本 proposed 文件即可，V1 无损；V2 已接受后
  需回退 → 通过新的 whole-authority supersession 或 revert 接受
  merge（docs-only，break-glass 记录）。

## 13. Open questions

无。`OWNER_DECISION_REQUIRED = NONE`；Owner 决策全部已冻结于本文件
所引用的已接受方向，未被本 authority 重开。
