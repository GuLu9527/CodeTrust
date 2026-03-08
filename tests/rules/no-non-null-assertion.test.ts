import { describe, it, expect } from 'vitest';
import { noNonNullAssertionRule } from '../../src/rules/builtin/no-non-null-assertion.js';

const run = (code: string, filePath = 'test.ts') =>
  noNonNullAssertionRule.check({ filePath, fileContent: code, addedLines: [] });

describe('logic/no-non-null-assertion', () => {
  it('should detect non-null assertion on property access', () => {
    const code = `const el = document.getElementById('foo')!;`;
    const issues = run(code);
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues[0].ruleId).toBe('logic/no-non-null-assertion');
  });

  it('should detect non-null assertion on method call result', () => {
    const code = `const name = user.getName()!.toUpperCase();`;
    const issues = run(code);
    expect(issues.length).toBeGreaterThanOrEqual(1);
  });

  it('should NOT flag code without non-null assertions', () => {
    const code = `const el = document.getElementById('foo') ?? null;`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });

  it('should NOT flag optional chaining', () => {
    const code = `const name = user?.getName()?.toUpperCase();`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });

  it('should skip non-TypeScript files', () => {
    const code = `const x = getValue();`;
    const issues = run(code, 'test.js');
    expect(issues.length).toBe(0);
  });
});
