import { describe, it, expect } from 'vitest';
import { duplicateConditionRule } from '../../src/rules/builtin/duplicate-condition.js';

describe('logic/duplicate-condition', () => {
  const run = (code: string) =>
    duplicateConditionRule.check({
      filePath: 'test.ts',
      fileContent: code,
      addedLines: [],
    });

  it('should detect duplicate condition in if-else chain', () => {
    const code = `
if (x > 10) {
  doA();
} else if (x < 5) {
  doB();
} else if (x > 10) {
  doC();
}
`;
    const issues = run(code);
    expect(issues.length).toBe(1);
    expect(issues[0].message).toContain('x > 10');
  });

  it('should NOT flag unique conditions', () => {
    const code = `
if (x > 10) {
  doA();
} else if (x < 5) {
  doB();
} else if (x === 0) {
  doC();
}
`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });

  it('should detect multiple duplicates', () => {
    const code = `
if (a === 1) {
  doA();
} else if (b === 2) {
  doB();
} else if (a === 1) {
  doC();
} else if (b === 2) {
  doD();
}
`;
    const issues = run(code);
    expect(issues.length).toBe(2);
  });
});
