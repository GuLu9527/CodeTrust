import { describe, it, expect } from 'vitest';
import { noReturnAssignRule } from '../../src/rules/builtin/no-return-assign.js';

const run = (code: string) =>
  noReturnAssignRule.check({ filePath: 'test.ts', fileContent: code, addedLines: [] });

describe('logic/no-return-assign', () => {
  it('should detect assignment in return', () => {
    const code = `function foo() { return x = 5; }`;
    const issues = run(code);
    expect(issues.length).toBe(1);
    expect(issues[0].ruleId).toBe('logic/no-return-assign');
  });

  it('should NOT flag return with comparison', () => {
    const code = `function foo() { return x === 5; }`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });

  it('should NOT flag return with value', () => {
    const code = `function foo() { return 5; }`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });

  it('should NOT flag compound assignment operators', () => {
    const code = `function foo() { return x += 5; }`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });

  it('should NOT flag arrow function implicit return', () => {
    const code = `const fn = () => x === 5;`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });
});
