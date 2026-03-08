import { describe, it, expect } from 'vitest';
import { magicNumberRule } from '../../src/rules/builtin/magic-number.js';

const run = (code: string) =>
  magicNumberRule.check({ filePath: 'test.ts', fileContent: code, addedLines: [] });

describe('logic/magic-number', () => {
  it('should detect magic numbers in expressions', () => {
    const code = `const timeout = delay * 3600;`;
    const issues = run(code);
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues[0].ruleId).toBe('logic/magic-number');
  });

  it('should allow common numbers like 0 and 1', () => {
    const code = `const x = arr.length - 1;`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });

  it('should allow UPPER_CASE constant declarations', () => {
    const code = `const MAX_RETRIES = 5;`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });

  it('should detect HTTP status codes used directly', () => {
    const code = `if (response.status === 404) { handleNotFound(); }`;
    const issues = run(code);
    expect(issues.length).toBeGreaterThanOrEqual(1);
  });

  it('should skip comments', () => {
    const code = `// timeout is 3600 seconds`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });
});
