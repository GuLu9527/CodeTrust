import { describe, it, expect } from 'vitest';
import { missingAwaitRule } from '../../src/rules/builtin/missing-await.js';

function check(code: string) {
  return missingAwaitRule.check({
    filePath: 'test.ts',
    fileContent: code,
    addedLines: [],
  });
}

describe('logic/missing-await', () => {
  it('should detect missing await on known async function call', () => {
    const issues = check(`
async function fetchData() {
  return 42;
}

async function main() {
  fetchData();
}
    `);
    expect(issues.length).toBe(1);
    expect(issues[0].ruleId).toBe('logic/missing-await');
    expect(issues[0].message).toContain('fetchData');
  });

  it('should NOT flag awaited async calls', () => {
    const issues = check(`
async function fetchData() {
  return 42;
}

async function main() {
  await fetchData();
}
    `);
    expect(issues.length).toBe(0);
  });

  it('should NOT flag returned async calls', () => {
    const issues = check(`
async function fetchData() {
  return 42;
}

async function main() {
  return fetchData();
}
    `);
    expect(issues.length).toBe(0);
  });

  it('should NOT flag async calls assigned to variables', () => {
    const issues = check(`
async function fetchData() {
  return 42;
}

async function main() {
  const result = fetchData();
  await result;
}
    `);
    expect(issues.length).toBe(0);
  });

  it('should NOT flag calls to non-async functions', () => {
    const issues = check(`
function syncWork() {
  return 42;
}

async function main() {
  syncWork();
}
    `);
    expect(issues.length).toBe(0);
  });
});
