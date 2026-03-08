import { describe, it, expect } from 'vitest';
import { promiseVoidRule } from '../../src/rules/builtin/promise-void.js';

const run = (code: string) =>
  promiseVoidRule.check({ filePath: 'test.ts', fileContent: code, addedLines: [] });

describe('logic/promise-void', () => {
  it('should detect floating call to locally defined async function', () => {
    const code = `
async function saveData() { return true; }
function main() {
  saveData();
}`;
    const issues = run(code);
    expect(issues.length).toBe(1);
    expect(issues[0].ruleId).toBe('logic/promise-void');
  });

  it('should detect floating fetch call', () => {
    const code = `function handler() {\n  fetch('/api/data');\n}`;
    const issues = run(code);
    expect(issues.length).toBe(1);
  });

  it('should NOT flag awaited calls', () => {
    const code = `async function main() {\n  await fetch('/api/data');\n}`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });

  it('should NOT flag assigned calls', () => {
    const code = `async function main() {\n  const data = fetch('/api/data');\n}`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });

  it('should NOT flag non-async function calls', () => {
    const code = `function main() {\n  console.log('hello');\n}`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });
});
