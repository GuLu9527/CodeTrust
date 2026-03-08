import { describe, it, expect } from 'vitest';
import { noDebuggerRule } from '../../src/rules/builtin/no-debugger.js';

const run = (code: string) =>
  noDebuggerRule.check({ filePath: 'test.ts', fileContent: code, addedLines: [] });

describe('security/no-debugger', () => {
  it('should detect debugger statement', () => {
    const code = `function foo() {\n  debugger;\n  return 1;\n}`;
    const issues = run(code);
    expect(issues.length).toBe(1);
    expect(issues[0].ruleId).toBe('security/no-debugger');
    expect(issues[0].severity).toBe('high');
  });

  it('should detect standalone debugger', () => {
    const code = `debugger`;
    const issues = run(code);
    expect(issues.length).toBe(1);
  });

  it('should NOT flag debugger in comments', () => {
    const code = `// debugger`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });

  it('should NOT flag debugger in strings', () => {
    const code = `const msg = "use debugger to debug";`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });

  it('should NOT flag debugger in block comments', () => {
    const code = `/* debugger */`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });
});
