import { describe, it, expect } from 'vitest';
import { noSelfCompareRule } from '../../src/rules/builtin/no-self-compare.js';

const run = (code: string) =>
  noSelfCompareRule.check({ filePath: 'test.ts', fileContent: code, addedLines: [] });

describe('logic/no-self-compare', () => {
  it('should detect x === x', () => {
    const code = `if (x === x) { doSomething(); }`;
    const issues = run(code);
    expect(issues.length).toBe(1);
    expect(issues[0].ruleId).toBe('logic/no-self-compare');
  });

  it('should detect x !== x', () => {
    const code = `const isNaN = x !== x;`;
    const issues = run(code);
    expect(issues.length).toBe(1);
  });

  it('should detect member expression self-compare', () => {
    const code = `if (obj.value === obj.value) { return; }`;
    const issues = run(code);
    expect(issues.length).toBe(1);
  });

  it('should NOT flag different variables', () => {
    const code = `if (x === y) { doSomething(); }`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });

  it('should NOT flag different member expressions', () => {
    const code = `if (a.x === b.x) { doSomething(); }`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });
});
