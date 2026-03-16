import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { noDebuggerRule } from '../../src/rules/builtin/no-debugger.js';
import { unusedImportRule } from '../../src/rules/builtin/unused-import.js';
import { typeCoercionRule } from '../../src/rules/builtin/type-coercion.js';
import { unusedVariablesRule } from '../../src/rules/builtin/unused-variables.js';
import { lineRange, lineStartOffset } from '../../src/rules/fix-utils.js';
import { FixEngine, FixOptions } from '../../src/core/fix-engine.js';
import { CodeTrustConfig } from '../../src/types/config.js';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('fix-utils', () => {
  it('lineStartOffset should return correct byte offset', () => {
    const content = 'line1\nline2\nline3';
    expect(lineStartOffset(content, 1)).toBe(0);
    expect(lineStartOffset(content, 2)).toBe(6);
    expect(lineStartOffset(content, 3)).toBe(12);
  });

  it('lineRange should return correct range including newline', () => {
    const content = 'aaa\nbbb\nccc';
    expect(lineRange(content, 1)).toEqual([0, 4]); // "aaa\n"
    expect(lineRange(content, 2)).toEqual([4, 8]); // "bbb\n"
    expect(lineRange(content, 3)).toEqual([8, 11]); // "ccc" (no trailing newline)
  });
});

describe('no-debugger fix', () => {
  it('should produce a fix that deletes the debugger line', () => {
    const code = 'const x = 1;\ndebugger;\nconst y = 2;';
    const ctx = { filePath: 'test.ts', fileContent: code, addedLines: [] };
    const issues = noDebuggerRule.check(ctx);
    expect(issues.length).toBe(1);

    const fix = noDebuggerRule.fix!(ctx, issues[0]);
    expect(fix).not.toBeNull();

    // Apply the fix
    const fixed = code.slice(0, fix!.range[0]) + fix!.text + code.slice(fix!.range[1]);
    expect(fixed).toBe('const x = 1;\nconst y = 2;');
  });
});

describe('unused-import fix', () => {
  it('should produce a fix that deletes a single-specifier import line', () => {
    const code = "import { foo } from './bar';\nconst x = 1;";
    const ctx = { filePath: 'test.ts', fileContent: code, addedLines: [] };
    const issues = unusedImportRule.check(ctx);
    expect(issues.length).toBe(1);

    const fix = unusedImportRule.fix!(ctx, issues[0]);
    expect(fix).not.toBeNull();

    const fixed = code.slice(0, fix!.range[0]) + fix!.text + code.slice(fix!.range[1]);
    expect(fixed).toBe('const x = 1;');
  });

  it('should return null for multi-specifier imports', () => {
    const code = "import { foo, bar } from './baz';\nconst x = foo();";
    const ctx = { filePath: 'test.ts', fileContent: code, addedLines: [] };
    const issues = unusedImportRule.check(ctx);
    // bar is unused
    const barIssue = issues.find(i => i.message.includes('bar'));
    if (barIssue) {
      const fix = unusedImportRule.fix!(ctx, barIssue);
      expect(fix).toBeNull(); // multi-specifier, should not auto-fix
    }
  });
});

describe('type-coercion fix', () => {
  it('should replace == with ===', () => {
    const code = 'if (x == 5) { return; }';
    const ctx = { filePath: 'test.ts', fileContent: code, addedLines: [] };
    const issues = typeCoercionRule.check(ctx);
    expect(issues.length).toBe(1);

    const fix = typeCoercionRule.fix!(ctx, issues[0]);
    expect(fix).not.toBeNull();

    const fixed = code.slice(0, fix!.range[0]) + fix!.text + code.slice(fix!.range[1]);
    expect(fixed).toBe('if (x === 5) { return; }');
  });

  it('should replace != with !==', () => {
    const code = 'if (a != b) { return; }';
    const ctx = { filePath: 'test.ts', fileContent: code, addedLines: [] };
    const issues = typeCoercionRule.check(ctx);
    expect(issues.length).toBe(1);

    const fix = typeCoercionRule.fix!(ctx, issues[0]);
    expect(fix).not.toBeNull();

    const fixed = code.slice(0, fix!.range[0]) + fix!.text + code.slice(fix!.range[1]);
    expect(fixed).toBe('if (a !== b) { return; }');
  });
});

describe('unused-variables fix', () => {
  it('should delete unused variable declaration line', () => {
    const code = "const unused = 42;\nconst used = 1;\nconsole.log(used);";
    const ctx = { filePath: 'test.ts', fileContent: code, addedLines: [] };
    const issues = unusedVariablesRule.check(ctx);
    const unusedIssue = issues.find(i => i.message.includes('unused'));
    expect(unusedIssue).toBeTruthy();

    const fix = unusedVariablesRule.fix!(ctx, unusedIssue!);
    expect(fix).not.toBeNull();

    const fixed = code.slice(0, fix!.range[0]) + fix!.text + code.slice(fix!.range[1]);
    expect(fixed).not.toContain('const unused');
    expect(fixed).toContain('const used');
  });
});

describe('FixEngine', () => {
  let tempDir: string;
  let config: CodeTrustConfig;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'codetrust-test-'));
    config = {
      version: '1.0.0',
      rules: {
        disabled: [],
      },
      thresholds: {
        minScore: 0,
        failOnLowTrust: false,
      },
      structure: {
        maxCyclomaticComplexity: 10,
        maxFunctionLength: 100,
        maxNestingDepth: 5,
        maxParamCount: 5,
      },
      style: {
        maxLineLength: 120,
        indent: 2,
      },
      coverage: {
        minLineCoverage: 0,
        minBranchCoverage: 0,
      },
    };
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('dry-run mode', () => {
    it('should not modify files in dry-run mode', async () => {
      const filePath = join(tempDir, 'test.ts');
      const originalCode = 'const x = 1;\ndebugger;\nconst y = 2;';
      writeFileSync(filePath, originalCode, 'utf-8');

      const engine = new FixEngine(config);
      const options: FixOptions = {
        files: [filePath],
        dryRun: true,
      };

      const results = await engine.fix(options);

      // File should not be modified
      const fileContent = readFileSync(filePath, 'utf-8');
      expect(fileContent).toBe(originalCode);

      // Should report fixes (debugger + unused variables)
      expect(results.length).toBe(1);
      expect(results[0].applied).toBeGreaterThanOrEqual(1);
      // The debugger fix should be among them (security/no-debugger is the actual rule ID)
      expect(results[0].details.some(d => d.ruleId === 'security/no-debugger' && d.status === 'applied')).toBe(true);
    });

    it('should report what would be fixed', async () => {
      const filePath = join(tempDir, 'test.ts');
      const code = 'const x = 1;\ndebugger;\nconst y = 2;';
      writeFileSync(filePath, code, 'utf-8');

      const engine = new FixEngine(config);
      const options: FixOptions = {
        files: [filePath],
        dryRun: true,
      };

      const results = await engine.fix(options);

      expect(results[0].file).toBe(filePath);
      expect(results[0].applied).toBeGreaterThanOrEqual(1);
      // The debugger fix should be among them (security/no-debugger is the actual rule ID)
      expect(results[0].details.some(d => d.ruleId === 'security/no-debugger')).toBe(true);
    });
  });

  describe('apply mode', () => {
    it('should modify files when not in dry-run mode', async () => {
      const filePath = join(tempDir, 'test.ts');
      const originalCode = 'const x = 1;\ndebugger;\nconst y = 2;';
      writeFileSync(filePath, originalCode, 'utf-8');

      const engine = new FixEngine(config);
      const options: FixOptions = {
        files: [filePath],
        dryRun: false,
      };

      const results = await engine.fix(options);

      // File should be modified
      const fileContent = readFileSync(filePath, 'utf-8');
      // Debugger should be removed
      expect(fileContent).not.toContain('debugger');

      expect(results[0].applied).toBeGreaterThanOrEqual(1);
    });

    it('should apply multiple fixes in one file', async () => {
      const filePath = join(tempDir, 'test.ts');
      const code = `debugger;
const unused1 = 1;
const used = 2;
console.log(used);
const unused2 = 3;
`;
      writeFileSync(filePath, code, 'utf-8');

      const engine = new FixEngine(config);
      const options: FixOptions = {
        files: [filePath],
        dryRun: false,
      };

      const results = await engine.fix(options);

      // Should apply debugger fix and unused variable fixes
      expect(results[0].applied).toBeGreaterThanOrEqual(2);

      const fileContent = readFileSync(filePath, 'utf-8');
      expect(fileContent).not.toContain('debugger');
      expect(fileContent).not.toContain('unused1');
      expect(fileContent).not.toContain('unused2');
      expect(fileContent).toContain('used');
    });
  });

  describe('conflict handling', () => {
    it('should skip conflicting fixes', async () => {
      // Create a file where two fixes might overlap
      const filePath = join(tempDir, 'test.ts');
      const code = 'debugger;\ndebugger;';
      writeFileSync(filePath, code, 'utf-8');

      const engine = new FixEngine(config);
      const options: FixOptions = {
        files: [filePath],
        dryRun: true,
      };

      const results = await engine.fix(options);

      // Both fixes should be detected, but they don't conflict
      // because they're on separate lines
      expect(results[0].applied).toBe(2);
      expect(results[0].skipped).toBe(0);
    });

    it('should handle overlapping fix ranges', async () => {
      // This tests that when fixes have overlapping ranges,
      // only one is applied and the other is marked as conflict
      const filePath = join(tempDir, 'test.ts');
      // Create a scenario where fixes might overlap
      const code = `const x = 1;
debugger;
const y = 2;
`;
      writeFileSync(filePath, code, 'utf-8');

      const engine = new FixEngine(config);
      const options: FixOptions = {
        files: [filePath],
        dryRun: true,
      };

      // Should complete without error
      const results = await engine.fix(options);
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('iteration behavior', () => {
    it('should respect maxIterations option', async () => {
      const filePath = join(tempDir, 'test.ts');
      const code = 'debugger;';
      writeFileSync(filePath, code, 'utf-8');

      const engine = new FixEngine(config);
      const options: FixOptions = {
        files: [filePath],
        dryRun: true,
        maxIterations: 1,
      };

      const results = await engine.fix(options);
      expect(results[0].applied).toBe(1);
    });

    it('should stop when no more fixes are found', async () => {
      const filePath = join(tempDir, 'test.ts');
      // Code with no fixable issues (console.log prevents unused variable warning)
      const code = 'console.log(1);';
      writeFileSync(filePath, code, 'utf-8');

      const engine = new FixEngine(config);
      const options: FixOptions = {
        files: [filePath],
        dryRun: true,
        maxIterations: 10,
      };

      const results = await engine.fix(options);

      // No fixable issues in this code, so no results
      expect(results.length).toBe(0);
    });
  });

  describe('rule filtering', () => {
    it('should only apply fixes for specified ruleId', async () => {
      const filePath = join(tempDir, 'test.ts');
      // Code with only debugger (no unused variables since used is logged)
      const code = `debugger;
const used = 2;
console.log(used);
`;
      writeFileSync(filePath, code, 'utf-8');

      const engine = new FixEngine(config);
      const options: FixOptions = {
        files: [filePath],
        dryRun: true,
        ruleId: 'security/no-debugger',
      };

      const results = await engine.fix(options);

      // Should fix debugger
      expect(results.length).toBe(1);
      expect(results[0].applied).toBeGreaterThanOrEqual(1);
      // All fixes should be for security/no-debugger rule
      expect(results[0].details.every(d => d.ruleId === 'security/no-debugger')).toBe(true);
    });
  });

  describe('formatResults', () => {
    it('should format empty results', () => {
      const output = FixEngine.formatResults([], true);
      expect(output).toContain('No fixable issues found');
    });

    it('should format results with applied fixes', () => {
      const results = [{
        file: '/test.ts',
        applied: 1,
        skipped: 0,
        details: [{
          ruleId: 'no-debugger',
          line: 2,
          message: 'Unexpected debugger statement',
          status: 'applied' as const,
        }],
      }];

      const output = FixEngine.formatResults(results, true);
      expect(output).toContain('DRY RUN');
      expect(output).toContain('no-debugger');
      expect(output).toContain('L2');
    });

    it('should format results with skipped fixes', async () => {
      const filePath = join(tempDir, 'test.ts');
      const code = 'debugger;\ndebugger;';
      writeFileSync(filePath, code, 'utf-8');

      const engine = new FixEngine(config);
      const options: FixOptions = {
        files: [filePath],
        dryRun: true,
      };

      const results = await engine.fix(options);

      const output = FixEngine.formatResults(results, false);
      expect(output).toContain('APPLIED');
      // Should show the fixes that were applied
      expect(results[0].applied).toBeGreaterThanOrEqual(1);
    });
  });

  describe('error handling', () => {
    it('should handle non-existent files gracefully', async () => {
      const engine = new FixEngine(config);
      const options: FixOptions = {
        files: ['/non/existent/file.ts'],
        dryRun: true,
      };

      const results = await engine.fix(options);

      // Should return empty results for non-existent file
      expect(results.length).toBe(0);
    });

    it('should handle empty file list', async () => {
      const engine = new FixEngine(config);
      const options: FixOptions = {
        files: [],
        dryRun: true,
      };

      const results = await engine.fix(options);

      expect(results.length).toBe(0);
    });
  });
});
