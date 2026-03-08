import { describe, it, expect } from 'vitest';
import { typeCoercionRule } from '../../src/rules/builtin/type-coercion.js';

const run = (code: string) =>
  typeCoercionRule.check({ filePath: 'test.ts', fileContent: code, addedLines: [] });

describe('logic/type-coercion', () => {
  it('should detect loose equality ==', () => {
    const code = `if (x == 1) { doSomething(); }`;
    const issues = run(code);
    expect(issues.length).toBe(1);
    expect(issues[0].ruleId).toBe('logic/type-coercion');
  });

  it('should detect loose inequality !=', () => {
    const code = `if (x != 1) { doSomething(); }`;
    const issues = run(code);
    expect(issues.length).toBe(1);
  });

  it('should NOT flag strict equality ===', () => {
    const code = `if (x === 1) { doSomething(); }`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });

  it('should NOT flag strict inequality !==', () => {
    const code = `if (x !== 1) { doSomething(); }`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });

  it('should allow == null pattern', () => {
    const code = `if (x == null) { doSomething(); }`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });

  it('should skip comments', () => {
    const code = `// if (x == 1) { }`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });
});
