# CodeTrust — AI 代码信任验证工具

> "Between 'AI wrote it' and 'production-ready' — CodeTrust."
>
> AI 写了代码？跑一下 CodeTrust，看看它有多可信。

---

## 一、产品定位

### 一句话
开源、本地优先的 CLI 工具，专门验证 AI 生成代码的可信度，给出可重复、可解释的信任评分。

### 核心差异化
- **不用 LLM 审查 LLM** — 避免信任循环，用确定性算法
- **专门针对 AI 代码** — 检测幻觉逻辑、结构膨胀、虚假修复等 AI 特有问题
- **完全本地** — 代码不离开你的机器，零云依赖
- **轻量** — `npm install -g codetrust`，无 GPU/Docker 需求

### 市场数据
- 96% 开发者不完全信任 AI 生成代码（Sonar 2026 调查）
- 只有 48% 在提交前检查 AI 代码
- 61% 说 AI 代码"看起来对但实际不可靠"
- 38% 说审查 AI 代码比审查人写的代码更费力
- 40-62% AI 代码含安全漏洞或设计缺陷
- 1.75x 逻辑错误率（vs 人写代码）

### 竞品空白
| 现有工具 | 问题 |
|---|---|
| SonarQube / Semgrep / CodeQL | 传统静态分析，不懂 AI 代码特有问题 |
| CodeRabbit / PR-Agent | LLM 审查 LLM = 信任循环 |
| Augment Code / Qodo | 企业 SaaS，贵，代码上云 |
| **CodeTrust** | **✅ 专注 AI 代码 + 本地 + 确定性 + 开源** |

---

## 二、产品形态

### 2.1 CLI 工具（核心，最高优先级）

```bash
# 安装
npm install -g codetrust

# 基本用法
codetrust scan                      # 扫描工作目录的最近变更
codetrust scan --staged             # 只扫描 git 暂存区
codetrust scan --diff HEAD~1        # 扫描最近一次 commit
codetrust scan src/api/handler.ts   # 扫描指定文件

# 输出报告
codetrust report                    # 终端彩色报告
codetrust report --json             # JSON 格式（CI/CD 集成）
codetrust report --html             # HTML 报告

# 配置
codetrust init                      # 生成 .codetrust.yml 配置文件
codetrust rules list                # 列出所有规则
codetrust rules disable R001        # 禁用某条规则

# Git Hook
codetrust hook install              # 安装 pre-commit hook
```

### 2.2 MCP Server（生态红利，Phase 2）

```json
{
  "mcpServers": {
    "codetrust": {
      "command": "npx",
      "args": ["-y", "codetrust-mcp"]
    }
  }
}
```

暴露的 MCP Tools:
- `codetrust_scan` — 扫描代码变更
- `codetrust_score` — 获取信任评分
- `codetrust_explain` — 解释某条问题
- `codetrust_suggest_tests` — 建议需要的测试

### 2.3 VS Code 扩展（用户量，Phase 4）
- 编辑器内联显示信任评分
- 问题高亮
- 一键生成缺失测试

---

## 三、核心功能

### 3.1 信任评分（Trust Score）

终端输出示例：
```
📊 CodeTrust Report — commit abc1234
════════════════════════════════════════════

Overall Trust Score: 72/100 ⚠️ REVIEW RECOMMENDED

┌─────────────┬───────┬──────────────────────────────┐
│ Dimension   │ Score │ Details                      │
├─────────────┼───────┼──────────────────────────────┤
│ ✅ Security │ 85    │ No known vulnerability       │
│ ⚠️ Logic    │ 65    │ 2 potential hallucinations   │
│ ⚠️ Structure│ 68    │ 1 monolithic function (47ln) │
│ ✅ Style    │ 78    │ Mostly matches project style │
│ ❌ Coverage │ 40    │ 3 new functions, 0 tests     │
└─────────────┴───────┴──────────────────────────────┘

Issues (5):
  ❌ HIGH   src/api/handler.ts:42-67
            Possible hallucinated error handling — try-catch wraps
            a single assignment with generic console.log catch.
            
  ⚠️ MEDIUM src/api/handler.ts:12-58
            Function processOrder() is 47 lines with cyclomatic
            complexity 12. Project average is 15 lines / complexity 4.
            Consider decomposition.

  ⚠️ MEDIUM src/utils/validate.ts:8-23
            New function validateInput() has no test coverage.
            3 branches need testing.

  ⚠️ LOW    src/api/handler.ts:70-72
            Redundant null check: value is already typed as non-nullable.

  ℹ️ INFO   src/api/handler.ts:1-3
            Import style differs from project convention.

Suggestions:
  1. Review lines 42-67 — likely AI hallucination
  2. Add tests for processOrder(), validateInput(), formatResponse()
  3. Split processOrder() into smaller functions
```

### 3.2 五维评分体系

#### (1) Security — 安全维度
- 集成 Semgrep 社区规则（或自研轻量规则子集）
- OWASP Top 10 模式匹配
- 硬编码密钥/token 检测
- SQL 注入 / XSS / SSRF 模式

#### (2) Logic — 逻辑维度（AI 代码核心差异化）
- **幻觉检测**：
  - 无来源的 try-catch 包裹简单语句
  - 不必要的类型转换
  - 多余的 null/undefined 检查（类型已保证非空）
  - 与 commit message / PR 描述不匹配的行为
- **死逻辑检测**：
  - 永远为 true/false 的条件分支
  - 不可达的 catch 块
  - 无意义的变量赋值后立即覆盖

#### (3) Structure — 结构维度
- 圈复杂度（McCabe） > 项目平均值 2x 触发
- 认知复杂度
- 函数行数 > 项目平均值 2x 触发
- 嵌套深度
- 参数数量
- 代码重复率（与项目现有代码对比）

#### (4) Style — 风格一致性维度
- 命名风格对比（camelCase/snake_case/PascalCase）
- 注释密度对比
- import 顺序对比
- 缩进 / 格式对比
- 与项目 .eslintrc / .prettierrc 对比

#### (5) Coverage — 覆盖维度
- 新增函数是否有对应测试文件
- 新增分支的测试覆盖估算
- 关键路径（error handling, edge cases）是否有测试

### 3.3 AI 代码检测（可选）
基于启发式特征识别 AI 生成代码：
- 过度防御性编码模式（多余的 null check）
- 注释风格（"This function does X" 式的冗余注释）
- 命名模式（过于描述性的变量名）
- 结构模式（每个函数都有 try-catch）
- 不输出"是/否"二元结论，而是"AI 概率: 78%"

### 3.4 测试建议生成（Phase 3）
- 分析新增函数的签名和分支
- 生成测试用例骨架（不需要 LLM，基于模板）
- 标注哪些边界条件需要测试
- 可选：用本地 Ollama 生成完整测试代码

---

## 四、技术架构

### 4.1 目录结构

```
codetrust/
├── src/
│   ├── cli/                    # CLI 入口
│   │   ├── index.ts            # commander.js 主入口
│   │   ├── commands/
│   │   │   ├── scan.ts         # scan 命令
│   │   │   ├── report.ts       # report 命令
│   │   │   ├── init.ts         # init 命令
│   │   │   ├── hook.ts         # git hook 安装
│   │   │   └── rules.ts        # 规则管理
│   │   └── output/
│   │       ├── terminal.ts     # 终端彩色输出
│   │       ├── json.ts         # JSON 输出
│   │       └── html.ts         # HTML 报告
│   │
│   ├── core/                   # 核心引擎
│   │   ├── engine.ts           # 扫描引擎主逻辑
│   │   ├── scorer.ts           # 信任评分计算
│   │   └── config.ts           # 配置加载 (.codetrust.yml)
│   │
│   ├── analyzers/              # 各维度分析器
│   │   ├── security.ts         # 安全分析
│   │   ├── logic.ts            # 逻辑分析（幻觉检测）
│   │   ├── structure.ts        # 结构分析（复杂度）
│   │   ├── style.ts            # 风格一致性
│   │   ├── coverage.ts         # 覆盖分析
│   │   └── detection.ts        # AI 代码检测
│   │
│   ├── parsers/                # 代码解析
│   │   ├── ast.ts              # tree-sitter AST 解析
│   │   ├── diff.ts             # git diff 解析
│   │   └── project.ts          # 项目基线统计
│   │
│   ├── rules/                  # 规则引擎
│   │   ├── engine.ts           # 规则匹配引擎
│   │   ├── types.ts            # 规则类型定义
│   │   └── builtin/            # 内置规则
│   │       ├── hallucination.ts
│   │       ├── overdefensive.ts
│   │       ├── monolithic.ts
│   │       └── dead-logic.ts
│   │
│   ├── mcp/                    # MCP Server (Phase 2)
│   │   ├── server.ts
│   │   └── tools.ts
│   │
│   └── types/                  # TypeScript 类型
│       ├── index.ts
│       ├── analysis.ts
│       └── config.ts
│
├── rules/                      # 外部规则文件（YAML）
│   ├── security.yml
│   ├── hallucination.yml
│   └── style.yml
│
├── tests/                      # 测试
│   ├── analyzers/
│   ├── rules/
│   ├── fixtures/               # 测试用的代码样本
│   └── integration/
│
├── docs/                       # 文档
│   ├── rules.md                # 规则说明
│   ├── configuration.md        # 配置指南
│   └── mcp.md                  # MCP 集成指南
│
├── .codetrust.yml.example      # 配置文件示例
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── LICENSE                     # Apache 2.0
└── README.md
```

### 4.2 技术栈

| 组件 | 技术 | 原因 |
|---|---|---|
| **语言** | TypeScript 5.x | npm 生态最大，前端开发者友好 |
| **运行时** | Node.js 20+ | 最广泛部署 |
| **CLI 框架** | Commander.js | 轻量、成熟 |
| **AST 解析 (MVP)** | @typescript-eslint/typescript-estree | 纯 JS，零原生依赖，TS/JS AST 生态成熟 |
| **AST 解析 (Phase 3+)** | web-tree-sitter (WASM) | 多语言支持，无需编译原生模块 |
| **Git 操作** | simple-git | 读取 diff, blame, log |
| **终端 UI** | picocolors + cli-table3 | picocolors 体积小速度快，cli-table3 表格输出 |
| **配置** | cosmiconfig | 自动发现 .codetrust.yml |
| **MCP SDK** | @modelcontextprotocol/sdk | 官方 MCP 协议 |
| **测试** | Vitest | 快速、TypeScript 原生 |
| **构建** | tsup | 快速打包 CLI |
| **Lint** | ESLint + Prettier | 标准工具链 |

### 4.3 支持的语言（MVP）

| 优先级 | 语言 | tree-sitter grammar |
|---|---|---|
| P0 | TypeScript / JavaScript | tree-sitter-typescript |
| P0 | Python | tree-sitter-python |
| P1 | Java | tree-sitter-java |
| P1 | Go | tree-sitter-go |
| P2 | Rust | tree-sitter-rust |
| P2 | C / C++ | tree-sitter-c / cpp |

MVP 只做 TypeScript + Python，覆盖 AI 编程最高频两个语言。

### 4.4 核心算法

#### 信任评分计算

```
TrustScore = Σ (dimension_score × dimension_weight)

默认权重:
  Security:  0.30  (安全最重要)
  Logic:     0.25  (AI 特有问题)
  Structure: 0.20  (可维护性)
  Style:     0.10  (一致性)
  Coverage:  0.15  (测试覆盖)

每个维度:
  dimension_score = 100 - Σ (issue_severity × issue_count)
    HIGH:   -15 分/个
    MEDIUM: -8 分/个
    LOW:    -3 分/个
    INFO:   -0 分/个

最终评级:
  90-100: ✅ HIGH TRUST     — Safe to merge
  70-89:  ⚠️ REVIEW         — Review recommended
  50-69:  ⚠️ LOW TRUST      — Careful review needed
  0-49:   ❌ UNTRUSTED      — Do not merge without changes
```

#### 项目基线计算

```
首次运行时:
  1. 遍历项目所有源文件
  2. 计算统计基线:
     - 平均函数长度
     - 平均圈复杂度
     - 命名风格分布
     - 注释密度
     - 缩进风格
  3. 缓存到 .codetrust-cache/baseline.json
  4. 后续扫描与基线对比
```

### 4.5 多语言架构（Language Adapter 模式）

**设计理念**：通用分析逻辑写一次，每种语言只需一个 ~15 行的适配器配置。

> **分阶段策略**：MVP (Phase 0-1) 阶段仅支持 TS/JS，直接使用 `@typescript-eslint/typescript-estree` 做 AST 分析，不做 Adapter 抽象。Phase 3 引入第二种语言 (Python) 时，再引入 `web-tree-sitter` (WASM) 并提炼 LanguageAdapter 接口（符合 "Rule of Three" 原则）。

#### 架构图

```
代码文件 → 识别语言 (.ts/.py/.go/.rs/.java)
              ↓
        tree-sitter 解析 → AST
              ↓
        加载对应 LanguageAdapter
              ↓
    ┌─────────────────────────────────┐
    │  通用分析器（写一次，覆盖所有语言）    │
    │  - 圈复杂度 (McCabe)              │
    │  - 认知复杂度                      │
    │  - 函数长度 / 嵌套深度              │
    │  - 参数数量 / 代码重复              │
    │  - 基线偏离检测                    │
    └─────────────────────────────────┘
              +
    ┌─────────────────────────────────┐
    │  语言特定规则（每种语言少量）        │
    │  - Go: unchecked error return    │
    │  - Python: bare except           │
    │  - Rust: unwrap() abuse          │
    │  - Java: swallowed exception     │
    │  - TS: any type abuse            │
    └─────────────────────────────────┘
              ↓
        信任评分 + 报告
```

#### LanguageAdapter 接口

```typescript
interface LanguageAdapter {
  language: string;
  extensions: string[];            // ['.ts', '.tsx']
  treeSitterGrammar: string;       // 'tree-sitter-typescript'
  functionNodes: string[];         // AST节点类型: ['function_declaration', 'arrow_function', ...]
  branchNodes: string[];           // ['if_statement', 'switch_case', 'ternary_expression']
  tryCatchNodes: string[];         // ['try_statement']
  loopNodes: string[];             // ['for_statement', 'while_statement']
  classNodes: string[];            // ['class_declaration']
  importNodes: string[];           // ['import_statement']
  commentNodes: string[];          // ['comment', 'block_comment']
  namingConvention: NamingStyle;   // 'camelCase' | 'snake_case' | 'PascalCase'
  testFilePatterns: string[];      // ['**/*.test.ts', '**/*.spec.ts', 'tests/**']
  specificRules: LanguageRule[];   // 语言特定规则
}

type NamingStyle = 'camelCase' | 'snake_case' | 'PascalCase' | 'mixed';
```

#### 各语言适配器示例

```typescript
// TypeScript / JavaScript
const typescriptAdapter: LanguageAdapter = {
  language: 'typescript',
  extensions: ['.ts', '.tsx', '.js', '.jsx'],
  treeSitterGrammar: 'tree-sitter-typescript',
  functionNodes: ['function_declaration', 'arrow_function', 'method_definition', 'function_expression'],
  branchNodes: ['if_statement', 'switch_case', 'ternary_expression', 'conditional_expression'],
  tryCatchNodes: ['try_statement'],
  loopNodes: ['for_statement', 'while_statement', 'for_in_statement', 'do_statement'],
  classNodes: ['class_declaration'],
  importNodes: ['import_statement'],
  commentNodes: ['comment'],
  namingConvention: 'camelCase',
  testFilePatterns: ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**'],
  specificRules: [
    { id: 'ts/any-abuse', pattern: 'type_annotation with "any"', severity: 'medium',
      message: 'AI 倾向于用 any 绕过类型检查' },
    { id: 'ts/console-in-prod', pattern: 'console.log/warn/error in non-test', severity: 'low',
      message: 'AI 常在生产代码中留下 console.log' },
  ],
};

// Python
const pythonAdapter: LanguageAdapter = {
  language: 'python',
  extensions: ['.py'],
  treeSitterGrammar: 'tree-sitter-python',
  functionNodes: ['function_definition'],
  branchNodes: ['if_statement', 'match_statement', 'conditional_expression'],
  tryCatchNodes: ['try_statement'],
  loopNodes: ['for_statement', 'while_statement'],
  classNodes: ['class_definition'],
  importNodes: ['import_statement', 'import_from_statement'],
  commentNodes: ['comment', 'string'],  // docstrings
  namingConvention: 'snake_case',
  testFilePatterns: ['**/test_*.py', '**/*_test.py', 'tests/**'],
  specificRules: [
    { id: 'py/bare-except', pattern: 'except_clause without type', severity: 'high',
      message: 'bare except 会吞掉所有异常（包括 KeyboardInterrupt）' },
    { id: 'py/mutable-default', pattern: 'default_parameter with list/dict literal', severity: 'medium',
      message: 'AI 常用可变对象作默认参数（Python 陷阱）' },
  ],
};

// Go
const goAdapter: LanguageAdapter = {
  language: 'go',
  extensions: ['.go'],
  treeSitterGrammar: 'tree-sitter-go',
  functionNodes: ['function_declaration', 'method_declaration', 'func_literal'],
  branchNodes: ['if_statement', 'expression_switch_statement', 'type_switch_statement'],
  tryCatchNodes: [],  // Go 没有 try-catch
  loopNodes: ['for_statement'],
  classNodes: [],     // Go 没有 class
  importNodes: ['import_declaration'],
  commentNodes: ['comment'],
  namingConvention: 'mixed',  // exported PascalCase, unexported camelCase
  testFilePatterns: ['**/*_test.go'],
  specificRules: [
    { id: 'go/unchecked-error', severity: 'high',
      message: 'AI 经常忽略 Go 的 error return value' },
    { id: 'go/empty-if-body', severity: 'medium',
      message: 'AI 生成空的 if err != nil 块' },
  ],
};

// Rust
const rustAdapter: LanguageAdapter = {
  language: 'rust',
  extensions: ['.rs'],
  treeSitterGrammar: 'tree-sitter-rust',
  functionNodes: ['function_item', 'closure_expression'],
  branchNodes: ['if_expression', 'match_expression'],
  tryCatchNodes: [],  // Rust 用 Result/Option
  loopNodes: ['for_expression', 'while_expression', 'loop_expression'],
  classNodes: ['struct_item', 'impl_item'],
  importNodes: ['use_declaration'],
  commentNodes: ['line_comment', 'block_comment'],
  namingConvention: 'snake_case',
  testFilePatterns: ['**/tests/**', 'src/**/*test*'],
  specificRules: [
    { id: 'rust/unwrap-abuse', pattern: '.unwrap() calls', severity: 'high',
      message: 'AI 倾向于用 .unwrap() 而非 proper error handling' },
    { id: 'rust/clone-abuse', pattern: '.clone() on non-trivial types', severity: 'medium',
      message: 'AI 用 .clone() 绕过 borrow checker 而非正确设计所有权' },
  ],
};

// Java
const javaAdapter: LanguageAdapter = {
  language: 'java',
  extensions: ['.java'],
  treeSitterGrammar: 'tree-sitter-java',
  functionNodes: ['method_declaration', 'constructor_declaration'],
  branchNodes: ['if_statement', 'switch_expression', 'ternary_expression'],
  tryCatchNodes: ['try_statement'],
  loopNodes: ['for_statement', 'while_statement', 'enhanced_for_statement', 'do_statement'],
  classNodes: ['class_declaration', 'interface_declaration'],
  importNodes: ['import_declaration'],
  commentNodes: ['line_comment', 'block_comment'],
  namingConvention: 'camelCase',
  testFilePatterns: ['**/test/**', '**/*Test.java', '**/*Tests.java'],
  specificRules: [
    { id: 'java/swallowed-exception', pattern: 'catch block with empty body', severity: 'high',
      message: 'AI 常生成空的 catch 块，吞掉异常' },
    { id: 'java/raw-type', pattern: 'generic without type parameter', severity: 'medium',
      message: 'AI 使用 raw types 而非参数化泛型' },
  ],
};
```

#### 通用分析器代码示例

```typescript
// 这些分析函数对所有语言通用
// 通过 adapter 抽象掉语言差异

function calculateCyclomaticComplexity(ast: Tree, adapter: LanguageAdapter): number {
  let complexity = 1; // 基础路径
  walkAST(ast.rootNode, (node) => {
    if (adapter.branchNodes.includes(node.type)) complexity++;
    if (adapter.loopNodes.includes(node.type)) complexity++;
    if (node.type === 'binary_expression' && ['&&', '||'].includes(node.children[1]?.text)) complexity++;
  });
  return complexity;
}

function analyzeFunctions(ast: Tree, adapter: LanguageAdapter): FunctionInfo[] {
  const functions: FunctionInfo[] = [];
  walkAST(ast.rootNode, (node) => {
    if (adapter.functionNodes.includes(node.type)) {
      const lines = node.endPosition.row - node.startPosition.row + 1;
      const params = countParameters(node);
      const nesting = maxNestingDepth(node, adapter);
      const complexity = calculateCyclomaticComplexity(
        { rootNode: node } as Tree, adapter
      );
      functions.push({ name: getFunctionName(node), lines, params, nesting, complexity,
        startLine: node.startPosition.row + 1, endLine: node.endPosition.row + 1 });
    }
  });
  return functions;
}

function checkStyleConsistency(ast: Tree, adapter: LanguageAdapter, baseline: Baseline): StyleIssue[] {
  const issues: StyleIssue[] = [];
  const identifiers = extractIdentifiers(ast);
  for (const id of identifiers) {
    const detectedStyle = detectNamingStyle(id.name);
    if (detectedStyle !== adapter.namingConvention && detectedStyle !== 'unknown') {
      issues.push({
        type: 'naming-mismatch',
        line: id.line,
        message: `"${id.name}" uses ${detectedStyle}, project convention is ${adapter.namingConvention}`,
      });
    }
  }
  return issues;
}
```

#### 新增语言的工作量

| 语言 | Adapter配置 | 特定规则 | 测试 | 总工时 |
|---|---|---|---|---|
| TypeScript/JS | ~20行 | ~10条 | 1天 | **2天** |
| Python | ~20行 | ~8条 | 1天 | **2天** |
| Go | ~20行 | ~6条 | 0.5天 | **1.5天** |
| Rust | ~20行 | ~5条 | 0.5天 | **1.5天** |
| Java | ~20行 | ~8条 | 0.5天 | **1.5天** |
| **社区贡献新语言** | **~20行** | **~5条** | **PR review** | **~1天** |

MVP 做 TS + Python = 4天。之后每种语言 ~1.5天。社区可以通过提交 adapter 配置贡献新语言。

---

## 五、规则系统详细设计

### 5.1 规则类型

```typescript
interface Rule {
  id: string;                    // 'logic/unnecessary-try-catch'
  category: RuleCategory;        // 'security' | 'logic' | 'structure' | 'style' | 'coverage'
  severity: Severity;            // 'high' | 'medium' | 'low' | 'info'
  language: string | '*';        // '*' = 所有语言通用
  title: string;                 // 简短描述
  description: string;           // 详细说明
  rationale: string;             // 为什么这是 AI 代码的问题
  check: (context: RuleContext) => Issue[];  // 检查函数
  examples?: {                   // 好/坏代码示例
    bad: string;
    good: string;
  };
}

interface RuleContext {
  ast: Tree;                     // 当前文件 AST
  adapter: LanguageAdapter;      // 当前语言适配器
  diff: DiffChunk[];             // 变更内容
  baseline: ProjectBaseline;     // 项目基线
  config: CodeTrustConfig;       // 用户配置
  filePath: string;              // 文件路径
  fileContent: string;           // 文件完整内容
}

interface Issue {
  ruleId: string;
  severity: Severity;
  file: string;
  startLine: number;
  endLine: number;
  message: string;
  suggestion?: string;           // 修复建议
  codeSnippet?: string;          // 问题代码片段
}
```

### 5.2 内置规则清单（MVP）

#### Logic 类（AI 代码特有问题）

| ID | 严重度 | 检测方法 | 说明 |
|---|---|---|---|
| `logic/unnecessary-try-catch` | MEDIUM | AST: try 块只有 1 条语句 + catch 只有 console.log | AI 爱给简单语句包 try-catch |
| `logic/redundant-null-check` | LOW | AST: 类型系统已保证非空但仍检查 null | AI 过度防御 |
| `logic/dead-branch` | MEDIUM | AST: 条件永远为 true/false (字面量比较) | AI 生成不可达代码 |
| `logic/over-defensive` | LOW | AST: 连续 3+ 个 null/undefined/空字符串检查 | AI 典型的过度防御模式 |
| `logic/unused-variable` | LOW | AST: 变量声明后未引用 | AI 残留未清理的变量 |
| `logic/duplicate-condition` | MEDIUM | AST: if-else 链中重复相同条件 | AI 生成重复逻辑 |
| `logic/always-true-catch` | LOW | AST: catch 块立即 return/throw 与 try 块相同 | 无意义的错误处理 |

#### Structure 类（代码质量）

| ID | 严重度 | 检测方法 | 说明 |
|---|---|---|---|
| `structure/monolithic-function` | MEDIUM | AST: 函数行数 > baseline × 2 | AI 倾向写大函数 |
| `structure/high-complexity` | HIGH | AST: 圈复杂度 > baseline × 2 | 逻辑过于复杂 |
| `structure/deep-nesting` | MEDIUM | AST: 嵌套 > 4 层 | AI 生成多层嵌套 |
| `structure/too-many-params` | LOW | AST: 参数 > 5 | 函数接口过宽 |
| `structure/code-duplication` | MEDIUM | Token序列相似度 > 80% | AI 重复而非复用 |

#### Security 类

| ID | 严重度 | 检测方法 | 说明 |
|---|---|---|---|
| `security/hardcoded-secret` | HIGH | 正则: API_KEY, SECRET, TOKEN 赋值 | 硬编码密钥 |
| `security/eval-usage` | HIGH | AST: eval() / exec() 调用 | 代码注入风险 |
| `security/sql-concat` | HIGH | AST: SQL 字符串拼接而非参数化 | SQL 注入 |
| `security/insecure-random` | MEDIUM | AST: Math.random() 用于安全场景 | 不安全随机 |

#### Style 类

| ID | 严重度 | 检测方法 | 说明 |
|---|---|---|---|
| `style/naming-mismatch` | LOW | AST: 命名风格与项目约定不符 | 风格不一致 |
| `style/comment-density` | INFO | AST: 注释密度与基线偏差 > 2x | AI 注释风格不同 |
| `style/import-order` | INFO | AST: import 顺序与项目不一致 | 格式不一致 |

#### Coverage 类

| ID | 严重度 | 检测方法 | 说明 |
|---|---|---|---|
| `coverage/untested-function` | MEDIUM | 文件系统: 新函数无对应测试文件 | 新逻辑无测试 |
| `coverage/untested-branch` | LOW | AST: 新增分支未在测试中覆盖 | 分支无测试 |
| `coverage/no-error-test` | MEDIUM | AST+文件: 有 error path 但无 error test | 错误路径无测试 |

### 5.3 自定义规则（YAML 格式）

用户可以在 `.codetrust.yml` 或 `rules/` 目录中添加自定义规则：

```yaml
# rules/custom-team-rules.yml
rules:
  - id: "custom/no-any-in-api"
    category: "logic"
    severity: "high"
    language: "typescript"
    title: "API 层禁止使用 any"
    description: "在 src/api/ 目录下的文件中不允许使用 any 类型"
    pattern:
      type: "ast"
      match: "type_annotation"
      contains: "any"
      fileGlob: "src/api/**/*.ts"

  - id: "custom/require-jsdoc"
    category: "style"
    severity: "low"
    language: "typescript"
    title: "导出函数必须有 JSDoc"
    description: "所有 export 的函数必须有 JSDoc 注释"
    pattern:
      type: "ast"
      match: "export_statement > function_declaration"
      requirePrecedingComment: true
```

---

## 六、幻觉检测详细算法

### 6.1 什么是"代码幻觉"

AI 代码中的幻觉（Hallucinated Logic）指：**代码行为正确（通过编译、甚至通过测试），但包含了没有任何人要求、没有任何来源的逻辑。**

示例：
```typescript
// 用户要求: "写一个发送邮件的函数"
// AI 生成:
async function sendEmail(to: string, subject: string, body: string) {
  // ✅ 正常逻辑
  const transport = createTransport(config);
  
  // ❌ 幻觉: 没人要求重试逻辑，但 AI 自作主张加了
  let retries = 3;
  while (retries > 0) {
    try {
      await transport.sendMail({ to, subject, html: body });
      
      // ❌ 幻觉: 没人要求日志和审计
      await logToDatabase({ type: 'email', to, subject, timestamp: new Date() });
      await notifyAuditSystem('email_sent', { recipient: to });
      
      return { success: true };
    } catch (err) {
      retries--;
      // ❌ 幻觉: 指数退避？没人要求
      await sleep(Math.pow(2, 3 - retries) * 1000);
    }
  }
  throw new Error('Failed after 3 retries');
}
```

### 6.2 检测策略

#### 策略 A: 结构膨胀检测（确定性，MVP）

```
输入: git diff 中的新增函数
检查:
  1. 函数长度 vs 项目基线
     - 新函数 > 基线 × 2.5 → 疑似膨胀
  2. 逻辑层数
     - 一个函数做了多少"不同的事"
     - 计算方法: 统计不同类型的操作 (IO, 计算, 验证, 日志, 错误处理)
     - 操作类型 > 3 → 疑似幻觉（函数应只做一件事）
  3. 依赖扩散
     - 新函数引入了多少新的 import
     - 新 import > 3 → 可能引入了不必要的依赖
```

#### 策略 B: 模式匹配（确定性，MVP）

常见 AI 幻觉模式的 AST 规则：

```
1. 不必要的重试逻辑
   模式: while + try-catch + 递减计数器 + sleep/delay
   信号: 用户没有在 commit message 中提到"重试"/"retry"

2. 过度日志/审计
   模式: 函数内调用 log/audit/track/metrics > 2 次
   信号: 非日志模块的函数中出现大量日志调用

3. 不必要的缓存逻辑
   模式: Map/WeakMap 作为闭包变量 + has/get/set 调用
   信号: 用户没有要求缓存

4. 过度验证
   模式: 函数开头连续 > 3 个 if-throw/return 的参数检查
   信号: TypeScript 类型系统已保证类型安全

5. 不必要的事件/通知
   模式: emit/dispatch/notify/publish 调用
   信号: 简单 CRUD 函数中出现事件发布
```

#### 策略 C: Commit Message 语义对比（半确定性，Phase 3）

```
输入: commit message + diff
处理:
  1. 从 commit message 提取关键意图词
     - "add email sending" → 意图: [email, send]
  2. 从 diff 提取行为词
     - 函数调用: [createTransport, sendMail, logToDatabase, notifyAuditSystem, sleep]
  3. 对比: diff 中的行为是否超出 commit message 的意图范围
     - logToDatabase, notifyAuditSystem, sleep → 不在意图中 → 标记为疑似幻觉
  
  技术: TF-IDF 或简单关键词匹配（不需要 LLM）
```

### 6.3 幻觉评分

```
每个疑似幻觉:
  confidence: 0-100 (检测置信度)
  impact: 'high' | 'medium' | 'low'
  
规则:
  - 结构膨胀 > 2.5x → confidence 70, impact medium
  - 已知幻觉模式匹配 → confidence 85, impact medium  
  - 行为超出 commit message → confidence 60, impact low
  - 多个信号叠加 → confidence 提升
```

---

## 七、CI/CD 集成详细方案

### 7.1 GitHub Action

```yaml
# .github/workflows/codetrust.yml
name: CodeTrust Scan

on:
  pull_request:
    branches: [main, develop]

jobs:
  trust-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # 需要 git history 做基线对比
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      
      - name: Install CodeTrust
        run: npm install -g codetrust
      
      - name: Run Trust Scan
        run: codetrust scan --diff origin/main...HEAD --format json --output trust-report.json
      
      - name: Check Trust Score
        run: |
          SCORE=$(cat trust-report.json | jq '.overall.score')
          echo "Trust Score: $SCORE"
          if [ "$SCORE" -lt 70 ]; then
            echo "::error::Trust score $SCORE is below threshold 70"
            exit 1
          fi
      
      - name: Comment on PR
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(fs.readFileSync('trust-report.json', 'utf8'));
            const score = report.overall.score;
            const emoji = score >= 90 ? '✅' : score >= 70 ? '⚠️' : '❌';
            
            let body = `## ${emoji} CodeTrust Report: ${score}/100\n\n`;
            body += `| Dimension | Score |\n|---|---|\n`;
            for (const [dim, val] of Object.entries(report.dimensions)) {
              body += `| ${dim} | ${val}/100 |\n`;
            }
            if (report.issues.length > 0) {
              body += `\n### Issues (${report.issues.length})\n`;
              for (const issue of report.issues.slice(0, 10)) {
                body += `- **${issue.severity}** \`${issue.file}:${issue.startLine}\` ${issue.message}\n`;
              }
            }
            
            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: body,
            });
```

### 7.2 GitLab CI

```yaml
# .gitlab-ci.yml
codetrust:
  stage: test
  image: node:20
  before_script:
    - npm install -g codetrust
  script:
    - codetrust scan --diff origin/main...HEAD --min-score 70
  artifacts:
    reports:
      codequality: trust-report.json
    when: always
```

### 7.3 Pre-commit Hook

```bash
# 安装
codetrust hook install

# 生成的 .git/hooks/pre-commit:
#!/bin/sh
codetrust scan --staged --min-score 70 --format compact
if [ $? -ne 0 ]; then
  echo "CodeTrust: Trust score below threshold. Use --no-verify to bypass."
  exit 1
fi
```

### 7.4 JSON 输出格式（所有 CI/CD 工具通用）

```json
{
  "version": "1.0.0",
  "timestamp": "2026-03-07T22:00:00Z",
  "commit": "abc1234",
  "overall": {
    "score": 72,
    "grade": "REVIEW",
    "filesScanned": 5,
    "issuesFound": 8
  },
  "dimensions": {
    "security": 85,
    "logic": 65,
    "structure": 68,
    "style": 78,
    "coverage": 40
  },
  "issues": [
    {
      "ruleId": "logic/unnecessary-try-catch",
      "severity": "medium",
      "file": "src/api/handler.ts",
      "startLine": 42,
      "endLine": 67,
      "message": "Unnecessary try-catch wrapping a single assignment",
      "suggestion": "Remove try-catch or add meaningful error handling",
      "aiConfidence": 0.78
    }
  ],
  "baseline": {
    "avgFunctionLength": 15,
    "avgComplexity": 4,
    "filesAnalyzed": 142
  }
}
```

---

## 八、开源增长策略

### 8.1 发布前准备

1. **README 必须包含**：
   - 30秒 GIF 演示（终端扫描→报告输出）
   - 一键安装命令
   - 与 Sonar/CodeRabbit 的对比表
   - "96% 的开发者不信任 AI 代码"的 hook
   - 中英双语

2. **Launch Day 清单**：
   - Product Hunt 发布
   - Hacker News Show HN
   - Reddit: r/programming, r/typescript, r/Python
   - Twitter/X: 带 GIF 的推文
   - Dev.to / Medium 文章: "Why I Built a Trust Scanner for AI Code"

### 8.2 社区增长飞轮

```
开源 CLI → 开发者使用 → 贡献新语言 adapter → 支持更多语言
     ↓                                         ↓
  MCP Server → AI IDE 集成 → 更多用户 → 更多 star
     ↓
  GitHub Action → CI/CD 集成 → 团队采用 → Pro 版需求
```

### 8.3 内容营销

| 时间 | 内容 | 渠道 |
|---|---|---|
| 发布日 | "96% Don't Trust AI Code. Here's a Fix." | HN, PH, Reddit |
| 第1周 | "5 Patterns That Reveal AI-Generated Code" | Dev.to, Medium |
| 第2周 | "How to Add a Trust Gate to Your CI/CD" | Blog + Twitter |
| 第4周 | "CodeTrust vs SonarQube vs CodeRabbit" | Blog |
| 每月 | "Trust Score Trends: What We Learned from X Scans" | Blog + Newsletter |

### 8.4 合作机会

- **Context7** — 互补关系，联合推广
- **Ollama** — 本地 AI 生态
- **MCP 社区** — GitHub Copilot / VS Code 官方 MCP 项目列表
- **Awesome lists** — awesome-mcp-servers, awesome-ai-tools

---

## 九、配置文件

```yaml
# .codetrust.yml
version: 1

# 扫描范围
include:
  - "src/**/*.ts"
  - "src/**/*.py"
exclude:
  - "**/*.test.ts"
  - "**/*.spec.ts"
  - "**/node_modules/**"
  - "**/dist/**"

# 维度权重（可自定义）
weights:
  security: 0.30
  logic: 0.25
  structure: 0.20
  style: 0.10
  coverage: 0.15

# 阈值
thresholds:
  # 低于此分数则 exit code = 1（CI/CD 阻断）
  min-score: 70
  # 结构分析
  max-function-length: 40
  max-cyclomatic-complexity: 10
  max-nesting-depth: 4
  max-params: 5

# 规则配置
rules:
  # 禁用特定规则
  disabled:
    - "style/import-order"
  # 调整规则严重程度
  overrides:
    "logic/unnecessary-try-catch": "low"

# AI 代码检测
detection:
  enabled: true
  # 显示 AI 概率
  show-probability: true
```

---

## 十、开发路线图

### 2026-03 战略收敛更新

经过新一轮调研，当前阶段的最高优先级不再是继续扩张产品表面，而是先把 CodeTrust 做成一个**让团队敢放进 CI 的可信 trust gate**。

后续开发优先判断标准：

> **这个改动是否会让团队更愿意把 CodeTrust 放进 CI？**

当前优先顺序：

1. 问题指纹（finding fingerprint）
2. 问题生命周期（baseline / new / existing / fixed / suppressed）
3. 压制机制与策略控制（suppression / policy）
4. 工具健康度可见性（规则失败、跳过文件、扫描错误、执行元数据）
5. 面向 CI 的稳定输出（JSON schema、GitHub Action summary / annotations）

暂时后移的方向：

- 多语言支持
- MCP Server
- VS Code 扩展
- SaaS / Dashboard
- 模糊的 AI probability 功能

### Phase 0 — 可运行的 CLI 原型（1 周）✅ 已完成

- [x] 项目初始化（package.json, tsconfig, vitest, eslint, prettier）
- [x] CLI 骨架（commander.js: scan, report, init, hook, rules, --version）
- [x] Git diff 解析器（simple-git 读取变更文件列表和 diff 内容）
- [x] 配置文件加载（cosmiconfig + .codetrust.yml）
- [x] 3 条核心规则实现（unnecessary-try-catch, over-defensive, dead-logic）
- [x] 基础信任评分框架（5 维度骨架，真实分数计算）
- [x] 终端彩色输出（picocolors + cli-table3 格式化报告）
- [x] 基础测试套件（28 项测试全部通过）
- [x] 中英文双语支持（界面 + 规则消息 + 等级标签 + 严重程度，根据系统 LANG 自动切换）
- [x] JSON 输出格式（--format json）
- [ ] README（发布时再做）

### Phase 1 — 完整 AST 分析（2 周）✅ 已完成

- [x] TS/JS AST 分析集成（@typescript-eslint/typescript-estree，纯 JS 零原生依赖）
- [x] 结构分析器：
  - 圈复杂度计算
  - 认知复杂度
  - 函数长度
  - 嵌套深度
  - 参数数量
- [x] 项目基线计算（遍历项目文件建立统计基线，均值 + P90）
- [x] 完整幻觉检测规则集（5 条内置规则）：
  - 不必要的 try-catch
  - 冗余 null check / 过度防御性编码
  - 死逻辑分支
  - 未使用变量
  - 重复条件
- [x] 风格一致性分析（命名风格 camelCase/snake_case 混用检测、注释密度统计）
- [x] 覆盖分析（检测文件是否有对应测试文件）
- [x] 真实分数计算（全部 5 维度真实评分，无 mock）
- [x] 集成测试（45 项测试全部通过）

### Phase 2 — 发布就绪（1 周）✅ 已完成

- [x] 安全规则集成（4 条自研规则：硬编码密钥、eval、SQL 注入、XSS）
- [x] JSON 输出格式（CI/CD 集成）
- [x] GitHub Action 集成示例（.github/workflows/codetrust.yml + action.yml）
- [x] Git pre-commit hook 安装命令（codetrust hook install）
- [x] npm 发布准备（README.md、LICENSE、package.json、.npmignore、prepublishOnly）
- [x] 代码审查 + 自检修复（walkAST 重构、规则误报修复、AST 缓存）
- [ ] npm 首次发布（待执行 npm publish）
- [ ] Product Hunt / Hacker News 准备

### Phase 3 — 可信度地基（当前最高优先级）

目标：先解决”扫描结果是否可信、能否作为 CI 决策依据”的问题。

- [x] 问题指纹（finding fingerprint）
  - 每个 issue 已输出稳定 `fingerprint` 与 `fingerprintVersion`
  - 当前实现集中在 scan engine 生成，基于 `ruleId + normalizedFilePath + severity/category + normalized message + location + occurrenceIndex`
- [x] 工具健康度可见性
  - 已输出 `rulesExecuted`、`rulesFailed`、`filesConsidered`、`filesScanned`、`filesExcluded`、`filesSkipped`、`scanErrors`
  - 规则失败不再静默吞掉，而是进入 `toolHealth.ruleFailures` 与 `scanErrors`
- [x] 高噪音安全误报收敛（self-scan / CI trust gate）
  - `security/eval-usage` 已避免命中规则文件中的 regex / pattern-definition 文本，以及普通字符串中的 `eval(` 示例
  - `security/sql-injection` 已要求 query-like 上下文，避免把 fingerprint / metadata 模板字符串误判为 SQL 查询
- [x] include / exclude 真正生效
  - staged / diff / files / default 四种模式统一经过同一套过滤逻辑
  - 已明确区分 `filesExcluded` 与 `filesSkipped`
- [x] JSON schema v1 固化
  - 已引入 `schemaVersion`、`scanMode`、`toolHealth`
  - 保留 `overall`、`dimensions`、`issues` 作为稳定分析结果主体，作为后续 CI / artifact / SARIF 的基础
- [x] `scan` / `report` 职责收敛
  - `scan` 作为主即时扫描入口
  - `report` 当前已收敛为 diff-based 的过渡展示包装器，后续再逐步演进为 artifact / previous result 展示
- [x] 自检问题修复
  - 修复了 changed-mode 重复扫描同一文件的问题（`src/parsers/diff.ts`）
  - 修复了嵌套函数指标重复计算问题（`src/parsers/ast.ts`）
  - 修复了 duplicate-condition 假阳性（CallExpression 参数未包含）
  - 修复了 missing-await 假阳性（Promise.all(map()) 模式）
  - 修复了 dead-branch 假阳性（isRuleCategory 布尔表达式）
  - 修复了 promise-void 假阳性（同步方法白名单）
  - 修复了 XSS 误报（规则自检问题）
  - 修复了 magic-number / duplicate-string（提取常量）
  - 修复了 no-async-without-await（移除不必要的 async）
  - 修复了 parseBaselineIssue 高复杂度（提取辅助函数）
  - 新增 `tests/parsers/diff.test.ts` 覆盖重复文件去重场景
  - 新增嵌套函数结构指标回归测试
  - 新增 FixEngine 行为测试（dry-run/apply/conflict/iteration）

### Phase 3.5 — 假阳性修复（确保扫描结果可信）

目标：修复自检发现的假阳性问题，提升扫描结果可信度。

#### 第一梯队：必须修复（影响信任评分准确性）✅ 已完成

| 问题 | 规则 | 位置 | 修复方案 | 状态 |
|------|------|------|----------|------|
| 重复条件假阳性 | `duplicate-condition` | `engine.ts:230` | 检查不同条件（`'+'` vs `'-'`）不是重复 | ✅ 已修复 |
| 重复条件假阳性 | `duplicate-condition` | `diff.ts:115-128` | if-else-if 链中不同条件不是重复 | ✅ 已修复 |
| Missing-await 假阳性 | `missing-await` | `engine.ts:104` | `Promise.all(map())` 是正确的异步模式 | ✅ 已修复 |
| 不可达代码假阳性 | `dead-branch` | `engine.ts:542` | `isRuleCategory` 是正常的布尔表达式返回 | ✅ 已修复 |
| 浮动 Promise 假阳性 | `promise-void` | `ast.ts:31` | `_astCache.delete()` 是同步方法 | ✅ 已修复 |

#### 第二梯队：应该修复（影响代码可维护性）

| 问题 | 规则 | 位置 | 修复方案 | 状态 |
|------|------|------|----------|------|
| 嵌套三元表达式 | `no-nested-ternary` | `terminal.ts:93` | 重构为 if-else 或查找对象 | ⏳ 待处理 |
| 函数过长 | `long-function` | `engine.ts:scanFile` (112行) | 拆分为更小单元 | ⚠️ 部分完成 |
| 函数过长 | `long-function` | `terminal.ts:renderTerminalReport` (107行) | 拆分职责 | ⏳ 待处理 |
| 函数过长 | `long-function` | `duplicate-string.ts` (86行) | 拆分辅助函数 | ⏳ 待处理 |
| 函数过长 | `long-function` | `magic-number.ts` (84行) | 拆分辅助函数 | ⏳ 待处理 |

#### 第三梯队：可以修复 ✅ 已完成

| 问题 | 规则 | 位置 | 修复方案 | 状态 |
|------|------|------|----------|------|
| XSS 误报 | `dangerous-html` | `security.ts:209` | cleaned 变量添加正则模式替换 | ✅ 已修复 |
| Magic number | `magic-number` | `diff.ts` | 提取 `SHORT_HASH_LENGTH = 7` | ✅ 已修复 |
| 重复字符串 | `duplicate-string` | `diff.ts` | 提取 `GIT_DIFF_UNIFIED = '--unified=3'` | ✅ 已修复 |
| no-async-without-await | `no-async-without-await` | `engine.ts:310` | 移除不必要的 async 关键字 | ✅ 已修复 |
| parseBaselineIssue 复杂度 | `high-complexity` | `engine.ts:439` | 提取 `isValidBaselineIssue` 辅助函数 | ✅ 已修复 |

> **注意**：第二梯队（函数过长）问题部分属于自举问题，即规则文件本身包含检测模式的字符串。这是自举工具的固有现象，可接受或通过调整阈值处理。

### Phase 4 — 问题生命周期与策略（CI trust gate 核心）

目标：从“会扫描”升级为“会做可信决策”。

- [ ] baseline / lifecycle
  - [x] v1: `scan --baseline <path>` 支持 `new` / `existing` / `fixed`
  - [ ] 后续补 `suppressed`
  - v1 复用现有 JSON report artifact 作为 baseline 输入
  - 注意：当前 `baseline.ts` 是项目统计基线，不是 CI baseline 系统
- [ ] suppression 机制
  - 支持 inline / file / rule / config 级别压制
  - 建议支持 `reason`、`source`、可选 `expiresAt`
- [ ] policy 控制
  - 每类规则支持 `off` / `warn` / `block`
  - CI 决策不只依赖总分
- [ ] GitHub Action v2
  - job summary
  - changed-line annotations
  - JSON artifact
  - `fail-on-new-blocking`
  - `fail-on-score-below`

### Phase 5 — 生态输出与专业化

目标：补齐生态兼容与专业输出，但建立在前两阶段完成之后。

- [ ] SARIF 输出
  - 生成稳定 fingerprint / partialFingerprints
  - 默认不要输出 suppressed findings
  - 做 GitHub-safe 兼容模式
- [ ] explain 模式
  - `codetrust explain <rule-id>`
  - 解释为什么命中、为什么影响 trust、常见误报、最小修复建议
- [ ] presets
  - `recommended`
  - `strict`
  - `ci-gate`
  - `ai-suspicious`
- [ ] top risk files / top risk dimensions
- [ ] report / artifact 读取体验完善

### 延后方向（当前不优先）

这些方向仍然有价值，但在 CI trust gate 做稳之前整体后移：

- [ ] MCP Server 实现（@modelcontextprotocol/sdk）
- [ ] 暴露 4 个 tools: scan, score, explain, suggest_tests
- [ ] Python 支持（引入 web-tree-sitter WASM，提炼 LanguageAdapter 抽象层）
- [ ] 更多语言支持（Java, Go, Rust）
- [ ] VS Code 扩展（内联显示信任评分 + 问题高亮）
- [ ] 测试建议生成（基于模板，不需要 LLM）
- [ ] HTML 报告生成
- [ ] AI 代码检测增强（启发式特征分析）
- [ ] 性能优化（大项目增量扫描）
- [ ] 项目官网（简单 landing page）
- [ ] GitHub 发布 + 社区推广
- [ ] Product Hunt 发布

### 未来（v0.2+）

- 团队仪表盘（信任评分趋势图）
- 更多语言支持
- 自定义规则 SDK
- IDE 集成（JetBrains, Neovim）
- Pro 版本（团队功能 + CI/CD 仪表盘）
- `codetrust fix --auto` 扩展自动修复能力

---

## 十一、商业模式

### 开源核心 + Pro 版

| | 开源 (免费) | Pro ($9/dev/月) |
|---|---|---|
| CLI 扫描 | ✅ | ✅ |
| 5 维信任评分 | ✅ | ✅ |
| 内置规则 | ✅ | ✅ |
| MCP Server | ✅ | ✅ |
| Git Hook | ✅ | ✅ |
| VS Code 扩展 | ✅ | ✅ |
| JSON/HTML 报告 | ✅ | ✅ |
| 自定义规则 | ✅ (YAML) | ✅ (YAML + SDK) |
| 团队仪表盘 | ❌ | ✅ |
| 历史趋势图 | ❌ | ✅ |
| CI/CD 集成 | 基础 | 高级(阻断策略) |
| 优先支持 | ❌ | ✅ |

---

## 十二、取名确认

**CodeTrust** — 检查了 npm / GitHub：
- npm: `codetrust` 包名需要发布时确认是否可用
- GitHub: 无同名热门项目
- 备选名: `trustlint`, `aiprobe`, `codeguard`, `vericode`

---

## 十三、成功指标

### 6个月目标
- GitHub 1000+ stars
- npm 周下载 500+
- MCP Server 被 3+ AI IDE 文档提及
- Product Hunt #5 within Dev Tools

### 关键假设验证
- 开发者愿意在 workflow 中加一个验证步骤吗？
- 信任评分对决策有实际影响吗？
- 哪些规则最有用？（通过 telemetry 匿名统计规则触发频率）

---

## 十四、第一天要做的事

```bash
mkdir codetrust && cd codetrust
npm init -y
npm install typescript commander picocolors cli-table3 simple-git cosmiconfig
npm install -D vitest tsup @types/node eslint prettier @typescript-eslint/typescript-estree
npx tsc --init
```

然后按 Phase 0 清单逐项实现。
