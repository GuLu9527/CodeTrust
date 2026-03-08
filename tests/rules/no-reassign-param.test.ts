import { describe, it, expect } from 'vitest';
import { noReassignParamRule } from '../../src/rules/builtin/no-reassign-param.js';

const run = (code: string) =>
  noReassignParamRule.check({ filePath: 'test.ts', fileContent: code, addedLines: [] });

describe('logic/no-reassign-param', () => {
  it('should detect parameter reassignment', () => {
    const code = `function foo(x: number) {\n  x = 10;\n  return x;\n}`;
    const issues = run(code);
    expect(issues.length).toBe(1);
    expect(issues[0].ruleId).toBe('logic/no-reassign-param');
  });

  it('should detect arrow function parameter reassignment', () => {
    const code = `const foo = (name: string) => {\n  name = name.trim();\n  return name;\n};`;
    const issues = run(code);
    expect(issues.length).toBe(1);
  });

  it('should NOT flag local variable assignment', () => {
    const code = `function foo(x: number) {\n  const y = x + 1;\n  return y;\n}`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });

  it('should NOT flag when no parameters', () => {
    const code = `function foo() {\n  let x = 10;\n  x = 20;\n  return x;\n}`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });

  it('should report each param only once', () => {
    const code = `function foo(x: number) {\n  x = 1;\n  x = 2;\n  return x;\n}`;
    const issues = run(code);
    expect(issues.length).toBe(1);
  });
});
