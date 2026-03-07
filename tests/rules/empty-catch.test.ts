import { describe, it, expect } from 'vitest';
import { emptyCatchRule } from '../../src/rules/builtin/empty-catch.js';

function check(code: string) {
  return emptyCatchRule.check({
    filePath: 'test.ts',
    fileContent: code,
    addedLines: [],
  });
}

describe('logic/empty-catch', () => {
  it('should detect empty catch block', () => {
    const issues = check(`
try {
  doSomething();
} catch (e) {
}
    `);
    expect(issues.length).toBe(1);
    expect(issues[0].ruleId).toBe('logic/empty-catch');
  });

  it('should detect catch block with only comments', () => {
    const issues = check(`
try {
  doSomething();
} catch (e) {
  // ignore
}
    `);
    expect(issues.length).toBe(1);
  });

  it('should detect catch that just re-throws', () => {
    const issues = check(`
try {
  riskyOperation();
} catch (err) {
  throw err;
}
    `);
    expect(issues.length).toBe(1);
    expect(issues[0].message).toContain('re-throw');
  });

  it('should NOT flag catch with meaningful handling', () => {
    const issues = check(`
try {
  riskyOperation();
} catch (err) {
  logger.error('Operation failed', err);
  notifyAdmin(err);
}
    `);
    expect(issues.length).toBe(0);
  });

  it('should NOT flag catch that wraps error', () => {
    const issues = check(`
try {
  riskyOperation();
} catch (err) {
  throw new CustomError('Failed to process', err);
}
    `);
    expect(issues.length).toBe(0);
  });
});
