import { describe, it, expect } from 'vitest';
import { deadLogicRule } from '../../src/rules/builtin/dead-logic.js';

describe('logic/dead-branch', () => {
  it('should detect if(true) condition', () => {
    const code = `
function test() {
  if (true) {
    doSomething();
  }
}
`;
    const issues = deadLogicRule.check({
      filePath: 'test.ts',
      fileContent: code,
      addedLines: [],
    });

    expect(issues.length).toBe(1);
    expect(issues[0].message).toContain('always true');
  });

  it('should detect if(false) condition', () => {
    const code = `
function test() {
  if (false) {
    doSomething();
  }
}
`;
    const issues = deadLogicRule.check({
      filePath: 'test.ts',
      fileContent: code,
      addedLines: [],
    });

    expect(issues.length).toBe(1);
    expect(issues[0].message).toContain('always false');
  });

  it('should detect if(null) condition', () => {
    const code = `
function test() {
  if (null) {
    doSomething();
  }
}
`;
    const issues = deadLogicRule.check({
      filePath: 'test.ts',
      fileContent: code,
      addedLines: [],
    });

    expect(issues.length).toBe(1);
    expect(issues[0].message).toContain('always false');
  });

  it('should detect immediate variable reassignment', () => {
    const code = `
function test() {
  let value = getDefault();
  value = computeActual();
  return value;
}
`;
    const issues = deadLogicRule.check({
      filePath: 'test.ts',
      fileContent: code,
      addedLines: [],
    });

    const reassignIssues = issues.filter((i) =>
      i.message.includes('immediately reassigned'),
    );
    expect(reassignIssues.length).toBe(1);
  });

  it('should NOT flag normal variable usage', () => {
    const code = `
function test() {
  let value = getDefault();
  if (condition) {
    value = computeActual();
  }
  return value;
}
`;
    const issues = deadLogicRule.check({
      filePath: 'test.ts',
      fileContent: code,
      addedLines: [],
    });

    const reassignIssues = issues.filter((i) =>
      i.message.includes('immediately reassigned'),
    );
    expect(reassignIssues.length).toBe(0);
  });

  it('should NOT flag const declarations', () => {
    const code = `
function test() {
  const a = 1;
  const b = 2;
  return a + b;
}
`;
    const issues = deadLogicRule.check({
      filePath: 'test.ts',
      fileContent: code,
      addedLines: [],
    });

    expect(issues.length).toBe(0);
  });
});
