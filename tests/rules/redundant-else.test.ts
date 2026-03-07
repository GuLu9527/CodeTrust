import { describe, it, expect } from 'vitest';
import { redundantElseRule } from '../../src/rules/builtin/redundant-else.js';

function check(code: string) {
  return redundantElseRule.check({
    filePath: 'test.ts',
    fileContent: code,
    addedLines: [],
  });
}

describe('logic/redundant-else', () => {
  it('should detect else after return', () => {
    const issues = check(`
function test(x: number) {
  if (x > 0) {
    return 'positive';
  } else {
    return 'non-positive';
  }
}
    `);
    expect(issues.length).toBe(1);
    expect(issues[0].ruleId).toBe('logic/redundant-else');
  });

  it('should detect else after throw', () => {
    const issues = check(`
function test(x: number) {
  if (!x) {
    throw new Error('invalid');
  } else {
    process(x);
  }
}
    `);
    expect(issues.length).toBe(1);
  });

  it('should NOT flag if without else', () => {
    const issues = check(`
function test(x: number) {
  if (x > 0) {
    return 'positive';
  }
  return 'non-positive';
}
    `);
    expect(issues.length).toBe(0);
  });

  it('should NOT flag if block that does not return', () => {
    const issues = check(`
function test(x: number) {
  if (x > 0) {
    console.log('positive');
  } else {
    console.log('non-positive');
  }
}
    `);
    expect(issues.length).toBe(0);
  });

  it('should NOT flag else-if chains', () => {
    const issues = check(`
function test(x: number) {
  if (x > 0) {
    return 'positive';
  } else if (x < 0) {
    return 'negative';
  }
}
    `);
    expect(issues.length).toBe(0);
  });
});
