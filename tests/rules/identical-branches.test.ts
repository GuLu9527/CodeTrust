import { describe, it, expect } from 'vitest';
import { identicalBranchesRule } from '../../src/rules/builtin/identical-branches.js';

function check(code: string) {
  return identicalBranchesRule.check({
    filePath: 'test.ts',
    fileContent: code,
    addedLines: [],
  });
}

describe('logic/identical-branches', () => {
  it('should detect identical if/else branches', () => {
    const issues = check(`
function test(x: number) {
  if (x > 0) {
    console.log('hello');
  } else {
    console.log('hello');
  }
}
    `);
    expect(issues.length).toBe(1);
    expect(issues[0].ruleId).toBe('logic/identical-branches');
  });

  it('should NOT flag different branches', () => {
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
    console.log('hello');
  } else if (x < 0) {
    console.log('hello');
  }
}
    `);
    expect(issues.length).toBe(0);
  });
});
