# Agent entrypoint — auth-service

在开始任何非机械性工作前：

1. 读取 `.agents/README.md`（vendored shared grammar）；
2. 读取 `.agents/local/README.md`（auth-service 的本地 authority 与约束）；
3. 读取 `docs/specs/README.md` 以及相关 accepted governing Specs；
4. 读取相关既有 Architecture / Contract authority，尤其是 `docs/contracts/minimal-auth-v1/` 与 `contract-bundles/minimal-auth-v1/`；
5. 读取 `.agents/skills/spec-governance/SKILL.md`，并且只选择一个主模式：`PREFLIGHT`、`AUTHOR`、`REVIEW` 或 `COMPLIANCE`。

除非变更被独立确认是机械性的，或 implementation PR 的 base branch 已经包含一份 `status: accepted`、`implementation_authority: contracts` 且覆盖该变更的 Spec，否则不得开始非机械性实现。

不要把代码、测试、运行时、最新文档或聊天记录当作高于 accepted local authority 的依据。发现 authority 冲突、缺失 Contract 或 Spec 不在 base branch 时，应停止语义实现并进入 Spec 流程。

本仓库采用后的 governing Spec 固定放在 `docs/specs/`。`.agents/specs/` 不是 governing Spec 目录；采用前已存在但尚未合并的候选必须在接受或实现前迁移并重新绑定精确评审坐标。

`.agents/governance.lock.json` 是治理分发身份的事实来源。`adoption.status: proposed` 不代表治理已经生效；只有经独立评审、由本仓库授权接受者完成 `accepted` 转换，并合入 `main` 后才成为活动治理。
