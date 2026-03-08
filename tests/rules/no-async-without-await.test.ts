import { describe, it, expect } from 'vitest';
import { noAsyncWithoutAwaitRule } from '../../src/rules/builtin/no-async-without-await.js';

const run = (code: string) =>
  noAsyncWithoutAwaitRule.check({ filePath: 'test.ts', fileContent: code, addedLines: [] });

describe('logic/no-async-without-await', () => {
  it('should detect async function without await', () => {
    const code = `async function foo() { return 1; }`;
    const issues = run(code);
    expect(issues.length).toBe(1);
    expect(issues[0].ruleId).toBe('logic/no-async-without-await');
  });

  it('should detect async arrow function without await', () => {
    const code = `const foo = async () => { return 1; };`;
    const issues = run(code);
    expect(issues.length).toBe(1);
  });

  it('should NOT flag async function with await', () => {
    const code = `async function foo() { const data = await fetch('/api'); return data; }`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });

  it('should NOT flag non-async function', () => {
    const code = `function foo() { return 1; }`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });

  it('should NOT count await in nested async function', () => {
    const code = `async function outer() {
  const inner = async () => { await fetch('/api'); };
  return inner;
}`;
    const issues = run(code);
    // outer should be flagged (its only "await" is inside a nested async fn)
    expect(issues.length).toBe(1);
  });

  it('should NOT flag async function with for-await', () => {
    const code = `async function foo(stream: any) { for await (const chunk of stream) { process(chunk); } }`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });
});
