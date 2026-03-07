import { describe, it, expect } from 'vitest';
import { unusedVariablesRule } from '../../src/rules/builtin/unused-variables.js';

describe('logic/unused-variables', () => {
  const run = (code: string) =>
    unusedVariablesRule.check({
      filePath: 'test.ts',
      fileContent: code,
      addedLines: [],
    });

  it('should detect unused variable', () => {
    const code = `
const unused = 42;
console.log('hello');
`;
    const issues = run(code);
    const match = issues.find((i) => i.message.includes('unused'));
    expect(match).toBeDefined();
  });

  it('should NOT flag used variables', () => {
    const code = `
const x = 42;
console.log(x);
`;
    const issues = run(code);
    const match = issues.find((i) => i.message.includes('"x"'));
    expect(match).toBeUndefined();
  });

  it('should NOT flag variables prefixed with _', () => {
    const code = `
const _unused = 42;
`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });

  it('should detect multiple unused variables', () => {
    const code = `
const a = 1;
const b = 2;
const c = 3;
console.log(c);
`;
    const issues = run(code);
    const names = issues.map((i) => i.message);
    expect(names.some((m) => m.includes('"a"'))).toBe(true);
    expect(names.some((m) => m.includes('"b"'))).toBe(true);
    expect(names.some((m) => m.includes('"c"'))).toBe(false);
  });
});
