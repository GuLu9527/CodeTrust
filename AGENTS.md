# AGENTS.md

This file is the canonical AI agent guide for this repository.
It is tool-agnostic and should be read by any AI coding assistant
(Claude Code, Cursor, Windsurf, Copilot, OpenCode, Cline, etc.).

## Repository-specific workflow

- Run self-tests after meaningful changes. Prefer targeted Vitest runs while iterating, then run the relevant broader suite before finishing.
- `CodeTrust-Plan.md` is the repository TODO / roadmap document. When implementation changes affect roadmap status, completed phases, or planned scope, update `CodeTrust-Plan.md` in the same change.
- Treat `CodeTrust-Plan.md` as roadmap context, not proof that a feature already exists. Verify actual behavior from `src/` before assuming planned items are implemented.

## Current strategic focus

When choosing between roadmap branches, prefer work that strengthens CodeTrust as a CI trust gate rather than adding new surface area.

Current priority order:

1. Stable finding identity / fingerprinting
2. Baseline comparison and lifecycle (`new` / `existing` / `fixed` / `suppressed`)
3. Suppression semantics and policy control
4. Tool health visibility (rule failures, skipped files, scan errors, execution metadata)
5. CI-ready delivery (clear JSON output, GitHub Action summary/annotations)

Deprioritize new surface area until the above is solid, especially:

- multi-language support
- MCP server work
- VS Code extension
- SaaS/dashboard work
- fuzzy AI-probability features

A good default question is: does this change make teams more willing to put CodeTrust into CI?

## Common commands

### Install and build

```bash
npm install
npm run build
npm run dev
```

### Lint and test

```bash
npm run lint
npm test
npm run test:watch
```

### Run a single test

```bash
npx vitest run tests/integration/scan.test.ts
npx vitest run tests/core/fix-engine.test.ts
npx vitest run tests/rules/unused-import.test.ts
npx vitest run tests/integration/scan.test.ts -t "should scan a clean file with no issues"
```

### Run the CLI locally

Build first, then run the compiled CLI:

```bash
npm run build
node dist/cli/index.js scan --staged
node dist/cli/index.js scan tests/fixtures/test-ai-code.ts --format json
node dist/cli/index.js rules list
node dist/cli/index.js fix src --dry-run
```

You can also use the npm start script after building:

```bash
npm run start -- scan --staged
```

## High-frequency file index

When starting work, these are the fastest files to read first:

- `src/cli/index.ts` — top-level command registration and CLI surface
- `src/cli/commands/scan.ts` — main scan command entry and CLI options
- `src/cli/commands/report.ts` — current report behavior (live diff scan, not artifact reading)
- `src/cli/commands/fix.ts` — file collection and fix command behavior
- `src/core/engine.ts` — primary scan orchestration
- `src/core/scorer.ts` — trust score math and grade thresholds
- `src/core/config.ts` — config loading and default config generation
- `src/core/fix-engine.ts` — autofix execution and conflict handling
- `src/parsers/diff.ts` — git diff collection and hunk parsing
- `src/parsers/ast.ts` — TS/JS parsing, AST cache, and function metrics
- `src/rules/engine.ts` — builtin rule registration and rule execution loop
- `src/rules/builtin/` — individual builtin rule implementations
- `src/rules/brace-utils.ts` — string/comment-aware brace counting utilities
- `src/analyzers/structure.ts` / `style.ts` / `coverage.ts` — non-rule dimension analyzers
- `src/analyzers/baseline.ts` — project statistics baseline calculation
- `src/cli/output/terminal.ts` / `json.ts` — rendered report output shapes
- `tests/integration/scan.test.ts` — best entry for end-to-end scan expectations
- `tests/core/fix-engine.test.ts` — best entry for fix behavior expectations
- `tests/rules/*.test.ts` — rule-by-rule expected behavior
- `vitest.config.ts` — test environment and language forcing
- `eslint.config.js` — lint rules and ignore set
- `action.yml` — reusable GitHub Action behavior
- `CodeTrust-Plan.md` — roadmap / TODO source of truth that should be kept in sync with implementation progress

## High-level architecture

## CLI surface

- `src/cli/index.ts` is the single Commander entrypoint. It wires up `scan`, `report`, `init`, `rules`, `hook`, and `fix`.
- `scan` is the main execution path for analysis.
- `report` is currently **not** an artifact reader; it is another live scan wrapper that calls `ScanEngine.scan({ diff })` with a default diff ref of `HEAD~1`.
- Terminal and JSON formatting live under `src/cli/output/`.

## Scan pipeline

The main scan flow is:

1. CLI command loads config with `loadConfig()` from `src/core/config.ts`
2. `ScanEngine` in `src/core/engine.ts` determines target files from `DiffParser`
3. For each file, it reads the current content (or falls back to git content for missing files)
4. It derives `addedLines` from diff hunks
5. `RuleEngine` runs builtin rules against the file context
6. For TS/JS files, additional analyzers run:
   - `src/analyzers/structure.ts`
   - `src/analyzers/style.ts`
   - `src/analyzers/coverage.ts`
7. `src/core/scorer.ts` computes per-dimension scores and the overall trust score
8. The CLI renders terminal or JSON output

Important current behavior:

- `ScanEngine` supports four scan modes via `ScanOptions`: staged, diff-against-ref, explicit file list, or default uncommitted changes.
- Diff collection is centralized in `src/parsers/diff.ts` using `simple-git`.
- `src/core/config.ts` supports `include` / `exclude` in config, but the current `ScanEngine` path selection is driven by diff/files input and does not centrally apply those globs during scan execution.

## Rules, analyzers, and scoring

- Builtin rules are registered in `src/rules/engine.ts` from `src/rules/builtin/*`.
- Rule disabling is config-driven through `config.rules.disabled`.
- Rule execution errors are currently swallowed inside `RuleEngine.run()`; if you are debugging missing findings, check there first.
- Security rules are grouped in `src/rules/builtin/security.ts`; most other rules are one file per rule.
- Scoring uses diminishing penalties in `src/core/scorer.ts`:
  - base penalties: high = 15, medium = 8, low = 3, info = 0
  - diminishing factor: 0.7 (each subsequent same-severity issue has 70% of the previous penalty)
  - per-severity tracking: penalty decay is tracked independently for each severity level
- Overall score is a weighted sum of the five dimensions: security, logic, structure, style, and coverage.

## AST and baseline internals

- TS/JS parsing is implemented with `@typescript-eslint/typescript-estree` in `src/parsers/ast.ts`.
- `src/parsers/ast.ts` also computes function-level metrics such as cyclomatic complexity, cognitive complexity, line count, nesting depth, and param count.
- Arrow functions derive their name from the parent `VariableDeclarator` node when available.
- There is a small in-memory AST cache in `src/parsers/ast.ts`; if parse-sensitive tests behave oddly, remember results may be cached by file path + content hash.
- `src/analyzers/baseline.ts` computes a **project statistics baseline** (averages and P90 values across project files). This is not a CI-style "new vs existing findings" baseline system.

## Fix pipeline

- The `fix` command is separate from scan/report and goes through `src/core/fix-engine.ts`.
- `src/cli/commands/fix.ts` resolves file/directory inputs, recursively collects TS/JS files, then calls `FixEngine`.
- `FixEngine` reruns rules on file contents, gathers rule-provided text replacements, sorts them from the end of the file backward, and skips overlapping edits as conflicts.
- Fixes are dry-run by default; `--apply` is required to write changes.
- `src/rules/fix-utils.ts` provides `buildLineOffsets()` for pre-computed line offset tables.

## Config and repository behavior

- Config is loaded through `cosmiconfig` in `src/core/config.ts`.
- Supported config files are `.codetrust.yml`, `.codetrust.yaml`, `.codetrust.json`, `.codetrustrc`, `codetrust.config.js`, and `codetrust.config.ts`.
- `generateDefaultConfig()` in `src/core/config.ts` is the source for what `codetrust init` writes.
- The reusable GitHub Action is defined in `action.yml`; it installs the published package globally and runs `codetrust scan --diff <ref> --format <format> --min-score <threshold>`.
- GitHub Action uses `env:` variables (not inline interpolation) to prevent command injection.

## Tests and conventions that matter

- Tests are organized by concern:
  - `tests/rules/` for individual rule behavior
  - `tests/analyzers/` for analyzer behavior
  - `tests/core/` for scorer and fix engine behavior
  - `tests/integration/` for end-to-end scan flow
- `tests/integration/scan.test.ts` is the best quick read for the expected report shape from the full scan pipeline.
- Vitest is configured in `vitest.config.ts` to force `CODETRUST_LANG=en`, so tests expect English output/messages.
- ESLint config is in `eslint.config.js`; notable rules include `@typescript-eslint/no-unused-vars` as error and `no-explicit-any` as warn.

## If you change X, also check Y

### If you change scan behavior

Also read and usually update together:

- `src/cli/commands/scan.ts` — CLI flags and command behavior
- `src/core/engine.ts` — scan orchestration and report assembly
- `src/parsers/diff.ts` — staged/diff/default file selection behavior
- `src/core/config.ts` and `src/types/config.ts` — config shape and defaults
- `src/cli/output/terminal.ts` / `src/cli/output/json.ts` — output shape changes
- `tests/integration/scan.test.ts` — end-to-end scan expectations
- `README.md` and `CodeTrust-Plan.md` if command semantics or roadmap status changed

### If you change report behavior

Also check:

- `src/cli/commands/report.ts` — current live-scan wrapper behavior
- `src/core/engine.ts` — if report output or source changes
- `src/cli/output/terminal.ts` / `src/cli/output/json.ts`
- `README.md` and `CodeTrust-Plan.md` if `report` semantics change

### If you add or modify a rule

Also check:

- `src/rules/engine.ts` — builtin rule registration
- `src/rules/types.ts` — rule contract
- the specific file under `src/rules/builtin/`
- the matching test under `tests/rules/`
- `README.md` if builtin rule counts or public rule list changed
- `CodeTrust-Plan.md` if the roadmap / completed-rule status changed

### If you add or modify an auto-fix

Also check:

- `src/rules/types.ts` — `fixable` / `fix()` contract
- `src/rules/fix-utils.ts` — line/range helpers for safe text replacement
- `src/core/fix-engine.ts` — conflict handling and fix application flow
- `src/cli/commands/fix.ts` — CLI input resolution and defaults
- `tests/core/fix-engine.test.ts` — fix behavior expectations
- the corresponding rule test if the rule's findings changed too
- `README.md` and `CodeTrust-Plan.md` if fixable rules or feature status changed

### If you change config fields or defaults

Also check:

- `src/types/config.ts` — source of truth for config types and defaults
- `src/core/config.ts` — config loading, merging, and generated default config content
- `src/cli/commands/init.ts` — writes `.codetrust.yml` from `generateDefaultConfig()`
- `README.md` configuration examples
- `CodeTrust-Plan.md` if roadmap/config capabilities changed

### If you change scoring or grading

Also check:

- `src/core/scorer.ts` — penalties, weighted score, grade thresholds
- `src/core/engine.ts` — report fields that expose score/grade
- `tests/core/scorer.test.ts`
- `README.md` trust score tables and descriptions
- `CodeTrust-Plan.md` if scoring model milestones changed

### If you change analyzers (structure/style/coverage/baseline)

Also check:

- the analyzer file under `src/analyzers/`
- `src/core/engine.ts` — where analyzers are invoked and merged into the report
- `src/parsers/ast.ts` if metric extraction changes affect analyzer inputs
- `tests/analyzers/` and `tests/integration/scan.test.ts`
- `README.md` / `CodeTrust-Plan.md` if public behavior or roadmap status changed

### If you change GitHub Action or CI-facing output

Also check:

- `action.yml`
- `src/cli/commands/scan.ts`
- `src/cli/output/json.ts`
- `README.md` CI examples
- `CodeTrust-Plan.md` if CI integration status changed

## Known implementation gaps and easy-to-miss gotchas

- `report` is currently just another live scan command (`src/cli/commands/report.ts`); it does not read saved artifacts or historical reports.
- Config supports `include` / `exclude` fields (`src/types/config.ts`, `src/core/config.ts`), but current scan execution in `src/core/engine.ts` is still driven by diff/files selection and does not centrally enforce those globs across scan modes.
- `RuleEngine.run()` in `src/rules/engine.ts` currently swallows rule exceptions silently. Missing findings may be caused by rule failures with no visible diagnostics.
- `detection.enabled` / `detection.show-probability` exist in config types and defaults, but there is no implemented AI-probability analysis pipeline yet; treat these as reserved/roadmap fields.
- `src/analyzers/baseline.ts` is a project statistics baseline helper, not a persisted baseline/new-findings comparison system for CI.
- JSON output is currently just `JSON.stringify(report, null, 2)` in `src/cli/output/json.ts`; there is no separate schema adapter layer.
- Terminal output and tests assume the current `TrustReport` shape; changing report fields often requires touching both output renderers and integration tests.
- The fix pipeline only works for rules that expose `fixable` + `fix()` and uses text ranges, not AST rewrites. Multi-specifier imports and overlapping edits are intentionally skipped in some cases.
- Issue fingerprints use content-hash (SHA256 of rule ID + file path + code snippet), not line numbers — they are stable across unrelated edits.

## Current implementation vs roadmap

When updating architecture notes or planning work, keep these distinctions in mind:

- Current implementation is TS/JS-focused and uses `@typescript-eslint/typescript-estree`; multi-language adapter architecture in `CodeTrust-Plan.md` is roadmap, not current code.
- Current outputs are terminal and JSON. Do not assume HTML output exists unless you add it.
- Current rules are builtin TypeScript modules. Do not assume external YAML rule loading exists unless you implement it.
- Current `report` is a live scan wrapper, not a persisted-report reader.
