# CodeTrust 深度调研报告 / CodeTrust Deep Research Report

> 版本 / Version: v1
> 日期 / Date: 2026-03-11
> 形式 / Format: 中文主文 + 英文译文
> 研究范围 / Scope: CodeTrust 产品方向、CI 接入策略、baseline/suppression/SARIF/PR summary 最佳实践

---

## 1. 执行摘要 / Executive Summary

### 中文

CodeTrust 已经不再是“想法验证”阶段，而是进入了“第一轮收敛”阶段。当前仓库已经具备一套可运行的产品骨架：CLI 入口、核心扫描引擎、规则引擎、评分逻辑、自动修复骨架、规则测试，以及 GitHub Action 初版。这说明产品方向已经成立，下一阶段的关键不再是继续增加规则数量，而是把工具从“会扫描、会打分”升级为“可以稳定进入 CI 的 trust gate”。

这轮调研后的核心判断是：**CodeTrust 下一阶段最关键的升级，不是 score model 更复杂，而是建立完整的 finding lifecycle。**

也就是说，CodeTrust 需要从下面这个旧模型：

- scanner + score

升级为这个新模型：

- finding identity
- finding lifecycle
- policy engine
- delivery channels

只有这四层建立起来，CodeTrust 才能真正支撑以下场景：

- 只拦截新增问题，而不是历史遗留问题
- 正确区分“文件未扫描”和“问题被压制”
- 在 PR、CLI、SARIF 中保持一致的结果语义
- 让 CI 决策有解释性，而不是只靠一个分数

本报告的最终建议是：**把 P0 重心从“继续扩规则/优化分数”转移到“稳定 finding 指纹、baseline 比对、suppression 语义、tool health 可见性”。**

### English Translation

CodeTrust is no longer in the “idea validation” stage. It has entered its first consolidation phase. The repository already contains a runnable product skeleton: CLI entrypoints, a core scan engine, a rule engine, scoring logic, an autofix foundation, rule-level tests, and an initial GitHub Action. This means the direction is already validated. The next step is not to keep adding more rules, but to turn the tool from “something that scans and scores” into “a trust gate that can reliably live inside CI.”

The central conclusion from this research is: **the most important upgrade for CodeTrust is not a smarter scoring model, but a complete finding lifecycle.**

In other words, CodeTrust needs to evolve from this old model:

- scanner + score

into this new model:

- finding identity
- finding lifecycle
- policy engine
- delivery channels

Only when these four layers exist can CodeTrust truly support the following workflows:

- block only newly introduced issues instead of legacy debt
- correctly distinguish “not scanned” from “suppressed”
- keep result semantics consistent across CLI, PR, and SARIF
- make CI decisions explainable instead of relying on a single score

The final recommendation of this report is: **move P0 focus away from “more rules / better scores” and toward stable finding fingerprints, baseline comparison, suppression semantics, and tool-health visibility.**

---

## 2. 调研方法 / Research Method

### 中文

本报告结合了两类输入：

1. **仓库现状判断**
   - 结合当前 CodeTrust 代码结构与命令面，评估其所处阶段与短板。
2. **Exa 定向调研**
   - 调研对象主要包括：
     - Semgrep：diff-aware scan、finding lifecycle、ignore/suppression、blocking 行为
     - GitHub Code Scanning：SARIF 支持子集、上传限制、结果去重、身份字段
     - Snyk：ignore / policy file 模型
     - reviewdog：PR annotations、changed-only 工作流

本次调研关注的不是“谁功能更多”，而是“成熟工具在 CI 接入、误报控制、问题生命周期管理上是怎么设计的”。

### English Translation

This report combines two inputs:

1. **Repository assessment**
   - Reviewing the current CodeTrust structure and command surface to understand its maturity and its main gaps.
2. **Directed Exa research**
   - The main systems examined were:
     - Semgrep: diff-aware scan, finding lifecycle, ignore/suppression, blocking behavior
     - GitHub Code Scanning: SARIF subset support, upload limits, deduplication, identity fields
     - Snyk: ignore / policy file model
     - reviewdog: PR annotations and changed-only workflows

The goal of this research was not to compare feature counts, but to understand how mature tools design CI integration, false-positive control, and finding lifecycle management.

---

## 3. 当前阶段判断 / Current Stage Assessment

### 中文

CodeTrust 的现状可以概括为：**产品骨架已经成立，可信度体系开始工程化，但 finding lifecycle / suppression / delivery layer 仍未完成。**

目前已经具备：

- CLI 入口与多命令表面
- 核心扫描引擎
- builtin rules 管理机制
- severity + dimension weight 的评分模型
- 自动修复骨架
- 规则单测
- 初版 GitHub Action
- 稳定 issue fingerprint 输出
- `toolHealth` 可见性字段
- 一轮面向 self-scan / CI trust gate 的安全规则误报收敛

但下一阶段最大的缺口不在“还缺几条规则”，而在于以下三件事：

1. **finding lifecycle 尚未落地**：虽然已有稳定指纹，但还没有 baseline/new/existing/fixed/suppressed 生命周期模型。
2. **suppression 语义缺失**：没有正式的 suppression 模型，就很难管理误报和可接受风险。
3. **delivery layer 不完整**：CLI、PR summary、annotation、SARIF 的职责还没有清晰分层。

### English Translation

CodeTrust’s current state can be summarized as: **the product skeleton exists, and parts of the trust system are now engineered, but finding lifecycle, suppression, and delivery are still incomplete.**

It already has:

- a CLI surface with multiple commands
- a core scan engine
- builtin rule management
- a severity + dimension-weight scoring model
- an autofix foundation
- rule-level tests
- an initial GitHub Action
- stable issue fingerprint output
- visible `toolHealth` metadata
- an initial round of false-positive reduction for self-scan / CI trust-gate scenarios

But the biggest gap is not “a few missing rules.” It is the absence of three key capabilities:

1. **Finding lifecycle is not implemented yet**: stable fingerprints now exist, but there is still no baseline/new/existing/fixed/suppressed lifecycle.
2. **Missing suppression semantics**: without a formal suppression model, false positives and acceptable risk cannot be managed well.
3. **Incomplete delivery layer**: CLI, PR summary, annotations, and SARIF do not yet have clearly separated responsibilities.

---

## 4. 核心研究发现 / Core Research Findings

### 4.1 Baseline 不是附加功能，而是核心数据模型 / Baseline Is a Core Data Model, Not an Optional Feature

#### 中文

Semgrep 的 diff-aware scan 不是简单“只看改动文件”，而是通过 finding identity 跟踪问题生命周期。它关注的不是某条告警的行号，而是更稳定的识别元素，例如规则 ID、文件路径、语义上下文和重复索引。

这对 CodeTrust 的直接启发是：

- baseline 不能只是“本次 JSON 与上次 JSON 做字符串对比”
- 必须先定义稳定 fingerprint
- baseline 设计应该早于 score model v2

否则会出现：

- 行号变化导致老问题变成新问题
- 重排代码引发误报回潮
- CI gate 噪音过高

#### English Translation

Semgrep’s diff-aware scan is not simply “check changed files only.” It tracks the lifecycle of a finding through finding identity. The goal is not to match alerts by line number, but by more stable elements such as rule ID, file path, semantic context, and occurrence index.

The direct implication for CodeTrust is:

- baseline cannot be implemented as “compare this JSON to the previous JSON as raw output”
- a stable fingerprint must come first
- baseline should be prioritized before score model v2

Without this, you will get:

- old findings being treated as new because line numbers moved
- noisy regressions caused by code reordering
- an overly noisy CI gate

### 4.2 exclude、disable、suppress 必须拆开 / Exclude, Disable, and Suppress Must Be Separate Concepts

#### 中文

成熟工具通常把这三件事分开：

1. **exclude / ignore path**：根本不扫描该目标
2. **disable rule / policy off**：扫描目标，但不启用某条规则
3. **suppress finding**：发现问题后，显式标记为 false positive 或 acceptable risk

CodeTrust 不能把它们都合并成一个“ignore”。

推荐最少暴露三类计数：

- `filesExcluded`
- `rulesDisabled`
- `findingsSuppressed`

如果把它们混为一谈，用户会无法判断：

- 是工具没扫到
- 是规则没开
- 还是问题被人为接受了

#### English Translation

Mature tools usually separate these three concepts:

1. **exclude / ignore path**: do not scan the target at all
2. **disable rule / policy off**: scan the target, but do not run a given rule
3. **suppress finding**: detect the issue, then explicitly mark it as a false positive or acceptable risk

CodeTrust should not collapse all of these into a single “ignore” concept.

At minimum, it should expose three counters:

- `filesExcluded`
- `rulesDisabled`
- `findingsSuppressed`

If these are blended together, users cannot tell whether:

- the tool never scanned the file
- the rule was disabled
- or the finding was explicitly accepted

### 4.3 SARIF 是目标平台协议，不是简单导出格式 / SARIF Is a Platform Protocol, Not Just Another Export Format

#### 中文

GitHub 对 SARIF 的支持是受限子集，而不是无条件兼容全部字段。调研中最值得注意的点包括：

- 文件大小限制
- 结果数、规则数、位置数等限制
- 结果去重与稳定身份字段的重要性
- `partialFingerprints` 对结果稳定性的重要价值
- `automationDetails.id` / category 对不同自动化流程的区分作用

因此，CodeTrust 后续做 SARIF 时，不能把现有 JSON 直接映射一层就结束，而应该单独设计 GitHub 兼容模式。

#### English Translation

GitHub supports a restricted subset of SARIF rather than the full model. The most important findings from the research were:

- file size limits
- limits on results, rules, and locations
- the importance of stable identity for deduplication
- the value of `partialFingerprints` for result stability
- the role of `automationDetails.id` / category in distinguishing automation streams

Therefore, when CodeTrust adds SARIF, it should not simply map the current JSON format into SARIF. It should design a GitHub-compatible SARIF mode deliberately.

### 4.4 suppressed finding 进入 SARIF 可能产生错误体验 / Suppressed Findings in SARIF Can Produce Bad UX

#### 中文

Semgrep 的历史讨论说明：即便把 suppressed findings 放进 SARIF 的 `suppressions` 字段，也不代表 GitHub 一定会按用户期待进行展示。现实中，这可能导致“本来已抑制的问题在 GitHub 里仍像开放告警一样出现”。

因此，CodeTrust 的默认策略应当是：

- CLI / JSON：可以保留 suppressed findings，并明确状态
- SARIF：默认不输出 suppressed findings
- 如有需要，再通过显式开关启用

推荐未来参数：

- `--sarif-include-suppressed`

默认值建议为 `false`。

#### English Translation

Semgrep’s history shows that even when suppressed findings are exported through SARIF `suppressions`, GitHub may not present them the way users expect. In practice, this can make previously suppressed issues appear as if they are still open alerts.

Therefore, CodeTrust’s default strategy should be:

- CLI / JSON: keep suppressed findings, but mark them clearly
- SARIF: do not export suppressed findings by default
- offer an explicit opt-in flag if needed

A future option could be:

- `--sarif-include-suppressed`

and the default should likely be `false`.

### 4.5 PR 集成应该分层，不应该只输出一种结果 / PR Integration Should Be Layered, Not Monolithic

#### 中文

PR 集成至少应该分成三层：

1. **Job Summary**：给人看的决策摘要
2. **Annotations / changed-line comments**：给开发者的精准修复提示
3. **SARIF upload**：给 GitHub Security / 历史跟踪的平台视图

它们的职责分别是：

- Summary 负责解释“为什么这次通过/失败”
- Annotation 负责指出“改哪一行、修什么”
- SARIF 负责“沉淀与平台化消费”

如果只做其中一种，体验会失衡。

#### English Translation

PR integration should have at least three layers:

1. **Job Summary**: a human-readable decision summary
2. **Annotations / changed-line comments**: precise developer-facing remediation hints
3. **SARIF upload**: the platform-facing security and historical view

Their responsibilities are different:

- Summary explains why the run passed or failed
- Annotations explain exactly what to fix and where
- SARIF supports persistence and platform-level consumption

If you build only one of these, the experience becomes unbalanced.

### 4.6 score model 的优先级低于 lifecycle 与 policy / Score Model Is Lower Priority Than Lifecycle and Policy

#### 中文

调研后最明确的结论之一是：成熟工具真正支撑 adoption 的，通常不是分数公式本身，而是：

- baseline 稳不稳定
- 新旧问题分得清不清楚
- suppression 是否合理
- CI 输出是否可解释
- 误报管理是否可持续

所以 CodeTrust 应该把 gate 设计成“双轨制”：

1. **blocking findings / blocking policy**
2. **score threshold**

也就是说：

- 某些问题 regardless of score 直接 fail
- 其余问题再用 score 评估整体可信度

#### English Translation

One of the clearest conclusions from the research is that adoption is rarely driven by the scoring formula alone. Mature tools succeed because of:

- stable baseline behavior
- clear new-vs-existing distinction
- practical suppression handling
- explainable CI output
- sustainable false-positive control

So CodeTrust should design its gate as a dual-track system:

1. **blocking findings / blocking policy**
2. **score threshold**

In other words:

- some issues should fail regardless of score
- the remaining issues can then contribute to the overall trust score

---

## 5. 设计原则 / Design Principles

### 中文

基于这轮调研，建议 CodeTrust 采用以下产品与工程原则：

1. **先定义 finding identity，再做 baseline 与 SARIF。**
2. **先区分 tool health 和 code risk，再谈评分可信度。**
3. **在 CI 中优先支持 only-new-findings，而不是全量历史问题阻塞。**
4. **suppressions 必须显式、有理由、最好可过期。**
5. **SARIF 默认走 GitHub-safe 策略。**
6. **PR 集成必须同时服务“决策者”和“修复者”。**

### English Translation

Based on this research, CodeTrust should adopt the following product and engineering principles:

1. **Define finding identity before baseline and SARIF.**
2. **Separate tool health from code risk before investing in score credibility.**
3. **In CI, prioritize only-new-findings over blocking on the entire historical backlog.**
4. **Suppressions must be explicit, justified, and ideally expirable.**
5. **Use GitHub-safe defaults for SARIF.**
6. **PR integration must serve both decision-makers and fixers.**

---

## 6. 推荐路线图 / Recommended Roadmap

### 6.1 P0：信任地基 / P0: Trust Foundations

#### 中文

**目标：先解决“工具是否真的可信”这个问题。**

推荐任务：

1. **实现稳定 finding fingerprint**
   - 输入建议：`ruleId + normalizedFilePath + contextHash + occurrenceIndex`
2. **让 include/exclude 真正生效**
   - 严格定义为 pre-scan filtering
3. **让规则失败与扫描异常可见**
   - 输出 `rulesExecuted`、`rulesFailed`、`filesSkipped`、`scanErrors`
4. **固化 JSON schema v1**
   - 明确 `toolHealth` 与 `analysisResult` 分层
5. **收敛 `scan` 与 `report` 的职责边界**
   - `scan` 做即时扫描
   - `report` 做 artifact / baseline / previous result 展示

#### English Translation

**Goal: solve the question of whether the tool itself is trustworthy.**

Recommended tasks:

1. **Implement stable finding fingerprints**
   - Suggested input: `ruleId + normalizedFilePath + contextHash + occurrenceIndex`
2. **Make include/exclude truly effective**
   - Define it strictly as pre-scan filtering
3. **Make rule failures and scan errors visible**
   - Output `rulesExecuted`, `rulesFailed`, `filesSkipped`, `scanErrors`
4. **Freeze JSON schema v1**
   - Separate `toolHealth` and `analysisResult`
5. **Clarify the boundary between `scan` and `report`**
   - `scan` performs live analysis
   - `report` renders artifacts, baseline comparison, or previous results

### 6.2 P1：把工具变成可进 CI 的 trust gate / P1: Turn the Tool into a CI-Ready Trust Gate

#### 中文

**目标：把“可扫描”升级为“可决策”。**

推荐任务：

1. **baseline / lifecycle 比对**
   - 支持 `new / existing / fixed / suppressed`
2. **suppression 模型**
   - 支持 inline、file、rule、config 级 suppression
   - 建议带 `reason`、`source`、`expiresAt`
3. **policy engine**
   - 支持 `off / warn / block`
4. **GitHub Action v2**
   - job summary
   - changed-line annotation
   - json artifact
   - baseline ref 输入
   - fail-on-new-blocking
   - fail-on-score-below

#### English Translation

**Goal: move from “scan-capable” to “decision-capable.”**

Recommended tasks:

1. **baseline / lifecycle comparison**
   - Support `new / existing / fixed / suppressed`
2. **suppression model**
   - Support inline, file-level, rule-level, and config-level suppression
   - Ideally include `reason`, `source`, and `expiresAt`
3. **policy engine**
   - Support `off / warn / block`
4. **GitHub Action v2**
   - job summary
   - changed-line annotations
   - JSON artifact output
   - baseline ref input
   - fail-on-new-blocking
   - fail-on-score-below

### 6.3 P2：专业化与生态桥接 / P2: Professionalization and Ecosystem Bridge

#### 中文

**目标：提高专业感与外部系统兼容性。**

推荐任务：

1. **GitHub-compatible SARIF exporter**
   - 稳定 `partialFingerprints`
   - 设定 `automationDetails.id`
   - 默认排除 suppressed findings
2. **explain 模式**
   - `codetrust explain <rule-id>`
3. **presets**
   - `recommended`
   - `strict`
   - `ci-gate`
   - `ai-suspicious`
4. **top risk file / top risk dimension / top risk module**

#### English Translation

**Goal: improve professionalism and external system compatibility.**

Recommended tasks:

1. **GitHub-compatible SARIF exporter**
   - stable `partialFingerprints`
   - explicit `automationDetails.id`
   - exclude suppressed findings by default
2. **Explain mode**
   - `codetrust explain <rule-id>`
3. **Presets**
   - `recommended`
   - `strict`
   - `ci-gate`
   - `ai-suspicious`
4. **top risk file / top risk dimension / top risk module**

---

## 7. 建议的输出模型 / Suggested Output Model

### 中文

建议 CodeTrust 的 JSON 输出模型从一开始就分为两部分：

### 7.1 toolHealth

用于说明工具这次“执行得怎么样”：

- `scanMode`
- `rulesExecuted`
- `rulesFailed`
- `filesConsidered`
- `filesExcluded`
- `filesSkipped`
- `scanErrors`
- `durationMs`

### 7.2 analysisResult

用于说明代码“风险长什么样”：

- `overall`
- `dimensions`
- `issues`
- `topRiskFiles`
- `thresholdResult`
- `lifecycleSummary`

这样做的价值在于：

- 用户可以区分“分数低是因为代码差，还是工具没跑完整”
- 后续 PR summary 和 SARIF exporter 也更容易消费

### English Translation

CodeTrust’s JSON output should be separated into two parts from the start:

### 7.1 toolHealth

This explains how well the tool executed:

- `scanMode`
- `rulesExecuted`
- `rulesFailed`
- `filesConsidered`
- `filesExcluded`
- `filesSkipped`
- `scanErrors`
- `durationMs`

### 7.2 analysisResult

This explains what the code risk looks like:

- `overall`
- `dimensions`
- `issues`
- `topRiskFiles`
- `thresholdResult`
- `lifecycleSummary`

The value of this split is:

- users can tell whether a low score comes from bad code or an incomplete scan
- PR summaries and SARIF exporters become much easier to build cleanly

---

## 8. 可直接创建的 GitHub Issues Backlog / GitHub-Issue-Ready Backlog

### 中文

#### P0

1. **feat: add stable finding fingerprint generation**
2. **fix: apply include/exclude filtering before scan execution**
3. **feat: surface rule execution failures in scan metadata**
4. **feat: add strict engine mode for CI**
5. **feat: freeze JSON output schema v1**
6. **refactor: make report artifact-based instead of live scan**

#### P1

7. **feat: implement baseline comparison and finding lifecycle states**
8. **feat: add suppression model with reason and optional expiry**
9. **feat: add policy modes (off/warn/block) per rule/category**
10. **feat: add GitHub Action job summary and changed-line annotations**

#### P2

11. **feat: export GitHub-compatible SARIF with stable fingerprints**
12. **feat: add explain command for rules and findings**
13. **feat: add recommended/strict/ci-gate presets**
14. **feat: report top-risk files and top-risk dimensions**

### English Translation

#### P0

1. **feat: add stable finding fingerprint generation**
2. **fix: apply include/exclude filtering before scan execution**
3. **feat: surface rule execution failures in scan metadata**
4. **feat: add strict engine mode for CI**
5. **feat: freeze JSON output schema v1**
6. **refactor: make report artifact-based instead of live scan**

#### P1

7. **feat: implement baseline comparison and finding lifecycle states**
8. **feat: add suppression model with reason and optional expiry**
9. **feat: add policy modes (off/warn/block) per rule/category**
10. **feat: add GitHub Action job summary and changed-line annotations**

#### P2

11. **feat: export GitHub-compatible SARIF with stable fingerprints**
12. **feat: add explain command for rules and findings**
13. **feat: add recommended/strict/ci-gate presets**
14. **feat: report top-risk files and top-risk dimensions**

---

## 9. 建议的成功指标 / Suggested Success Metrics

### 中文

为了避免路线图只停留在“功能完成”，建议给下一阶段补上结果指标：

1. **规则执行可靠性**
   - `rulesFailed / rulesExecuted` 持续下降
2. **baseline 稳定性**
   - 同一问题在小范围重构后，不应被大量重新识别为 new
3. **CI 可接受性**
   - 团队实际愿意开启 blocking mode
4. **误报管理成本**
   - suppression 的创建与追踪成本可控
5. **PR 可读性**
   - summary 与 annotations 能帮助开发者在一次 review 中完成修复

### English Translation

To avoid a roadmap that only measures “features shipped,” the next phase should also include outcome metrics:

1. **Rule execution reliability**
   - `rulesFailed / rulesExecuted` should trend downward
2. **Baseline stability**
   - the same issue should not frequently reappear as new after small refactors
3. **CI acceptability**
   - teams should actually be willing to enable blocking mode
4. **False-positive management cost**
   - creating and tracking suppressions should remain manageable
5. **PR readability**
   - summaries and annotations should help developers fix issues in a single review cycle

---

## 10. 当前不建议优先投入的方向 / Areas Not Worth Prioritizing Yet

### 中文

在 finding lifecycle 与 CI trust gate 建好之前，不建议把主精力投入到以下方向：

- 多语言支持
- VS Code 插件
- MCP server
- SaaS dashboard
- “AI probability” 或模糊型 AI 检测能力

原因不是这些方向没价值，而是它们都建立在“核心工作流足够可信”之上。

### English Translation

Before finding lifecycle and the CI trust gate are solid, the main effort should not go into:

- multi-language support
- a VS Code extension
- an MCP server
- a SaaS dashboard
- fuzzy “AI probability” style detectors

The reason is not that these are worthless, but that they all depend on a trustworthy core workflow.

---

## 11. 最终结论 / Final Conclusion

### 中文

CodeTrust 当前最重要的升级方向，不是让自己成为“更强的 scanner”，而是让自己成为“更可靠的 decision system”。

一句话总结：

**CodeTrust 的下一阶段，不应再以“规则数量”来定义进度，而应以“finding lifecycle、policy、delivery 是否成立”来定义成熟度。**

如果只能保留一个优先级判断，那就是：

**先把 CodeTrust 做成一个让团队敢放进 CI 的工具，再考虑把它做成一个让人兴奋的工具。**

### English Translation

The most important upgrade for CodeTrust is not to become “a stronger scanner,” but to become “a more reliable decision system.”

In one sentence:

**The next stage of CodeTrust should not be measured by rule count, but by whether finding lifecycle, policy, and delivery are truly in place.**

If there is only one priority judgment to keep, it is this:

**First make CodeTrust something teams are willing to put into CI. Then make it something that excites them.**

---

## 12. 参考资料 / References

### 中文

以下资料为本次 Exa 定向调研中的核心参考：

- Semgrep Findings in CI
  https://semgrep.dev/docs/semgrep-ci/findings-ci
- Semgrep Configure blocking findings
  https://semgrep.dev/docs/semgrep-ci/configuring-blocking-and-errors-in-ci
- Semgrep Ignore files, folders, and code
  https://semgrep.dev/docs/ignoring-files-folders-code
- Semgrep Semgrepignore v2 reference
  https://semgrep.dev/docs/semgrepignore-v2-reference
- GitHub Uploading a SARIF file to GitHub
  https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github
- GitHub SARIF support for code scanning
  https://docs.github.com/en/code-security/reference/code-scanning/sarif-files/sarif-support-for-code-scanning
- GitHub SARIF results exceed one or more limits
  https://docs.github.com/en/code-security/code-scanning/troubleshooting-sarif-uploads/results-exceed-limit
- GitHub SARIF file is too large
  https://docs.github.com/en/code-security/reference/code-scanning/sarif-files/troubleshoot-sarif-uploads/file-too-large
- Snyk Ignore issues
  https://docs.snyk.io/manage-risk/prioritize-issues-for-fixing/ignore-issues
- Snyk The .snyk file
  https://docs.snyk.io/manage-risk/policies/the-.snyk-file
- reviewdog repository
  https://github.com/reviewdog/reviewdog
- Reviewdog filter settings with GitHub Actions
  https://lornajane.net/posts/2024/reviewdog-filter-settings-with-github-actions
- Semgrep PR discussion: suppressed findings in SARIF
  https://github.com/returntocorp/semgrep/pull/3616
- Semgrep issue: SARIF and suppressed findings caveat
  https://github.com/returntocorp/semgrep/issues/7121

### English Translation

The following references were the most important sources used in this directed Exa research:

- Semgrep Findings in CI
  https://semgrep.dev/docs/semgrep-ci/findings-ci
- Semgrep Configure blocking findings
  https://semgrep.dev/docs/semgrep-ci/configuring-blocking-and-errors-in-ci
- Semgrep Ignore files, folders, and code
  https://semgrep.dev/docs/ignoring-files-folders-code
- Semgrep Semgrepignore v2 reference
  https://semgrep.dev/docs/semgrepignore-v2-reference
- GitHub Uploading a SARIF file to GitHub
  https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github
- GitHub SARIF support for code scanning
  https://docs.github.com/en/code-security/reference/code-scanning/sarif-files/sarif-support-for-code-scanning
- GitHub SARIF results exceed one or more limits
  https://docs.github.com/en/code-security/code-scanning/troubleshooting-sarif-uploads/results-exceed-limit
- GitHub SARIF file is too large
  https://docs.github.com/en/code-security/reference/code-scanning/sarif-files/troubleshoot-sarif-uploads/file-too-large
- Snyk Ignore issues
  https://docs.snyk.io/manage-risk/prioritize-issues-for-fixing/ignore-issues
- Snyk The .snyk file
  https://docs.snyk.io/manage-risk/policies/the-.snyk-file
- reviewdog repository
  https://github.com/reviewdog/reviewdog
- Reviewdog filter settings with GitHub Actions
  https://lornajane.net/posts/2024/reviewdog-filter-settings-with-github-actions
- Semgrep PR discussion: suppressed findings in SARIF
  https://github.com/returntocorp/semgrep/pull/3616
- Semgrep issue: SARIF and suppressed findings caveat
  https://github.com/returntocorp/semgrep/issues/7121
