# CodeTrust

> Verify AI-generated code with deterministic algorithms — No LLM reviewing LLM.

[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)
[![npm](https://img.shields.io/npm/v/@gulu9527/code-trust)](https://www.npmjs.com/package/@gulu9527/code-trust)

**English | [中文](./README-CN.md)**

![CodeTrust Scan Example](./docs/screenshot.png)

CodeTrust is a **fully local** CLI tool designed to verify the quality of AI-generated code (Cursor, Copilot, ChatGPT, etc.). Instead of using an LLM to review LLM output, it applies **deterministic static analysis** to detect common hallucination patterns and quality issues.

## Features

- **Hallucination Detection** — Phantom imports, unused imports, missing `await`, unnecessary try-catch, over-defensive coding, dead logic branches
- **Security Scanning** — Hardcoded secrets, eval usage, SQL injection, XSS vulnerabilities
- **Structure Analysis** — Cyclomatic/cognitive complexity, function length, nesting depth, parameter count
- **Style Consistency** — Mixed naming convention detection (camelCase / snake_case)
- **Coverage Analysis** — Detect files missing corresponding test files
- **Five-Dimension Scoring** — Security, Logic, Structure, Style, Coverage, weighted into a trust score (0-100)
- **Fully Local** — No cloud uploads, zero external requests
- **Bilingual** — Automatic Chinese/English output based on system locale

## Install

```bash
npm install -g @gulu9527/code-trust
```

Both `code-trust` and `codetrust` commands are available after installation.

## Quick Start

```bash
# Initialize config file
codetrust init

# Scan git staged files
codetrust scan --staged

# Scan diff against main branch
codetrust scan --diff origin/main

# Scan specific files
codetrust scan src/foo.ts src/bar.ts

# JSON output (for CI/CD)
codetrust scan --staged --format json

# Set minimum score threshold (exit code 1 if below)
codetrust scan --staged --min-score 70

# List all rules
codetrust rules list

# Install pre-commit hook
codetrust hook install
```

## Trust Score

CodeTrust evaluates code across five dimensions, weighted into a total score (0-100):

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Security | 30% | Hardcoded secrets, eval, SQL injection, XSS |
| Logic | 25% | Hallucination detection: dead logic, unused variables, duplicate conditions |
| Structure | 20% | Complexity, function length, nesting depth |
| Coverage | 15% | Test file coverage |
| Style | 10% | Naming consistency |

### Grades

| Score | Grade | Meaning |
|-------|-------|---------|
| >= 90 | HIGH TRUST | Safe to merge |
| >= 70 | REVIEW | Recommended for review |
| >= 50 | LOW TRUST | Needs careful review |
| < 50 | UNTRUSTED | Should not be merged |

## Built-in Rules (21)

### Hallucination Detection (Logic)
| Rule ID | Severity | Description |
|---------|----------|-------------|
| `logic/phantom-import` | high | Import from non-existent relative path (AI hallucination) |
| `logic/missing-await` | medium | Missing `await` on async function call |
| `logic/unused-import` | low | Imported module never used |
| `logic/unnecessary-try-catch` | medium | Try-catch wrapping simple statements |
| `logic/over-defensive` | low | Excessive null/undefined guards |
| `logic/dead-branch` | medium | Always true/false conditions, unreachable code |
| `logic/unused-variables` | low | Declared but never used variables |
| `logic/duplicate-condition` | medium | Duplicate conditions in if-else chains |
| `logic/empty-catch` | medium | Empty catch block or rethrow-only catch |
| `logic/identical-branches` | medium | If/else branches with identical code |
| `logic/redundant-else` | low | Unnecessary else after return/throw |
| `logic/console-in-code` | info | Leftover console.log debug statements |

### Security Rules
| Rule ID | Severity | Description |
|---------|----------|-------------|
| `security/hardcoded-secret` | high | Hardcoded API keys, passwords, tokens |
| `security/eval-usage` | high | eval(), new Function() and similar |
| `security/sql-injection` | high | String concatenation in SQL queries |
| `security/dangerous-html` | medium | innerHTML / dangerouslySetInnerHTML |

## Configuration

Run `codetrust init` to generate `.codetrust.yml`:

```yaml
version: 1

include:
  - "src/**/*.ts"
  - "src/**/*.js"
exclude:
  - "**/*.test.ts"
  - "**/node_modules/**"

weights:
  security: 0.30
  logic: 0.25
  structure: 0.20
  style: 0.10
  coverage: 0.15

thresholds:
  min-score: 70
  max-function-length: 40
  max-cyclomatic-complexity: 10
  max-cognitive-complexity: 20
  max-nesting-depth: 4
  max-params: 5

rules:
  disabled: []
  overrides: {}
```

## CI/CD Integration

### GitHub Action

```yaml
name: CodeTrust
on:
  pull_request:
    branches: [main]

jobs:
  trust-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install -g @gulu9527/code-trust
      - run: codetrust scan --diff origin/main --min-score 70
```

### Git Pre-commit Hook

```bash
codetrust hook install
```

Automatically runs CodeTrust scan on every `git commit`. Use `git commit --no-verify` to skip.

## Language

CodeTrust auto-detects system locale. To override:

```bash
# Force Chinese
CODETRUST_LANG=zh codetrust scan --staged

# Force English
CODETRUST_LANG=en codetrust scan --staged
```

## Tech Stack

- **Language**: TypeScript 5.x
- **Runtime**: Node.js 20+
- **AST Parsing**: @typescript-eslint/typescript-estree
- **CLI**: Commander.js
- **Git**: simple-git
- **Terminal UI**: picocolors + cli-table3
- **Config**: cosmiconfig
- **Testing**: Vitest
- **Build**: tsup

## License

[Apache-2.0](LICENSE)
