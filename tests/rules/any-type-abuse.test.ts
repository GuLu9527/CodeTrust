import { describe, it, expect } from 'vitest';
import { anyTypeAbuseRule } from '../../src/rules/builtin/any-type-abuse.js';

const run = (code: string, filePath = 'test.ts') =>
  anyTypeAbuseRule.check({ filePath, fileContent: code, addedLines: [] });

describe('logic/any-type-abuse', () => {
  it('should detect any type annotation', () => {
    const code = `function foo(x: any) { return x; }`;
    const issues = run(code);
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues[0].ruleId).toBe('logic/any-type-abuse');
  });

  it('should detect any in variable declaration', () => {
    const code = `const data: any = fetchData();`;
    const issues = run(code);
    expect(issues.length).toBeGreaterThanOrEqual(1);
  });

  it('should NOT flag non-any types', () => {
    const code = `function foo(x: string): number { return 1; }`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });

  it('should NOT flag unknown type', () => {
    const code = `function foo(x: unknown) { return x; }`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });

  it('should skip non-TypeScript files', () => {
    const code = `function foo(x) { return x; }`;
    const issues = run(code, 'test.js');
    expect(issues.length).toBe(0);
  });
});
