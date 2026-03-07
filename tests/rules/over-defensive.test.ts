import { describe, it, expect } from 'vitest';
import { overDefensiveRule } from '../../src/rules/builtin/over-defensive.js';

describe('logic/over-defensive', () => {
  it('should detect 3+ consecutive null checks', () => {
    const code = `
function process(a, b, c, d) {
  if (!a) return;
  if (!b) return;
  if (!c) return;
  doSomething(a, b, c);
}
`;
    const issues = overDefensiveRule.check({
      filePath: 'test.ts',
      fileContent: code,
      addedLines: [],
    });

    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues[0].ruleId).toBe('logic/over-defensive');
  });

  it('should NOT flag fewer than 3 consecutive checks', () => {
    const code = `
function process(a, b) {
  if (!a) return;
  if (!b) return;
  doSomething(a, b);
}
`;
    const issues = overDefensiveRule.check({
      filePath: 'test.ts',
      fileContent: code,
      addedLines: [],
    });

    const consecutiveIssues = issues.filter(
      (i) => i.message.includes('consecutive'),
    );
    expect(consecutiveIssues.length).toBe(0);
  });

  it('should detect redundant typeof check for declared variable', () => {
    const code = `
function test() {
  const value = getValue();
  if (typeof value === 'undefined') {
    return null;
  }
  return value;
}
`;
    const issues = overDefensiveRule.check({
      filePath: 'test.ts',
      fileContent: code,
      addedLines: [],
    });

    const typeofIssues = issues.filter((i) => i.message.includes('typeof'));
    expect(typeofIssues.length).toBe(1);
  });
});
