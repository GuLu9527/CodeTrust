import { describe, it, expect } from 'vitest';
import { nestedTernaryRule } from '../../src/rules/builtin/nested-ternary.js';

const run = (code: string) =>
  nestedTernaryRule.check({ filePath: 'test.ts', fileContent: code, addedLines: [] });

describe('logic/no-nested-ternary', () => {
  it('should detect nested ternary expressions', () => {
    const code = `const x = a ? b : c ? d : e;`;
    const issues = run(code);
    expect(issues.length).toBe(1);
    expect(issues[0].ruleId).toBe('logic/no-nested-ternary');
  });

  it('should detect deeply nested ternaries', () => {
    const code = `const x = a ? b : c ? d : e ? f : g;`;
    const issues = run(code);
    expect(issues.length).toBe(1);
  });

  it('should NOT flag simple ternary', () => {
    const code = `const x = a ? b : c;`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });

  it('should NOT flag separate ternaries on different lines', () => {
    const code = `const x = a ? b : c;\nconst y = d ? e : f;`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });
});
