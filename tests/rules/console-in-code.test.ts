import { describe, it, expect } from 'vitest';
import { consoleInCodeRule } from '../../src/rules/builtin/console-in-code.js';

function check(code: string, filePath = 'src/service.ts') {
  return consoleInCodeRule.check({
    filePath,
    fileContent: code,
    addedLines: [],
  });
}

describe('logic/console-in-code', () => {
  it('should detect 3+ console statements', () => {
    const issues = check(`
function process() {
  console.log('start');
  console.log('middle');
  console.log('end');
}
    `);
    expect(issues.length).toBe(1);
    expect(issues[0].ruleId).toBe('logic/console-in-code');
    expect(issues[0].message).toContain('3');
  });

  it('should NOT flag fewer than 3 console statements', () => {
    const issues = check(`
function process() {
  console.log('start');
  console.log('end');
}
    `);
    expect(issues.length).toBe(0);
  });

  it('should skip CLI files', () => {
    const issues = check(`
function run() {
  console.log('start');
  console.log('running');
  console.log('done');
}
    `, 'src/cli/index.ts');
    expect(issues.length).toBe(0);
  });

  it('should skip test files', () => {
    const issues = check(`
function run() {
  console.log('start');
  console.log('running');
  console.log('done');
}
    `, 'tests/foo.test.ts');
    expect(issues.length).toBe(0);
  });

  it('should skip console in comments', () => {
    const issues = check(`
function process() {
  // console.log('debug1');
  // console.log('debug2');
  // console.log('debug3');
  doWork();
}
    `);
    expect(issues.length).toBe(0);
  });
});
