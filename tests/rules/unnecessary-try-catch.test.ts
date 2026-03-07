import { describe, it, expect } from 'vitest';
import { unnecessaryTryCatchRule } from '../../src/rules/builtin/unnecessary-try-catch.js';

describe('logic/unnecessary-try-catch', () => {
  it('should detect simple try-catch with console.log in catch', () => {
    const code = `
function doSomething() {
  try {
    const result = getValue();
  } catch (err) {
    console.log(err);
  }
}
`;
    const issues = unnecessaryTryCatchRule.check({
      filePath: 'test.ts',
      fileContent: code,
      addedLines: [],
    });

    expect(issues.length).toBe(1);
    expect(issues[0].ruleId).toBe('logic/unnecessary-try-catch');
    expect(issues[0].severity).toBe('medium');
  });

  it('should detect try-catch with console.error in catch', () => {
    const code = `
function doSomething() {
  try {
    const x = 42;
  } catch (e) {
    console.error(e);
  }
}
`;
    const issues = unnecessaryTryCatchRule.check({
      filePath: 'test.ts',
      fileContent: code,
      addedLines: [],
    });

    expect(issues.length).toBe(1);
  });

  it('should NOT flag try-catch with complex body', () => {
    const code = `
function doSomething() {
  try {
    const a = getValue();
    const b = processValue(a);
    const c = transformValue(b);
    await saveToDatabase(c);
  } catch (err) {
    console.error(err);
  }
}
`;
    const issues = unnecessaryTryCatchRule.check({
      filePath: 'test.ts',
      fileContent: code,
      addedLines: [],
    });

    expect(issues.length).toBe(0);
  });

  it('should NOT flag try-catch with meaningful error handling', () => {
    const code = `
function doSomething() {
  try {
    const result = getValue();
  } catch (err) {
    notifyUser(err.message);
    rollbackTransaction();
    logToSentry(err);
  }
}
`;
    const issues = unnecessaryTryCatchRule.check({
      filePath: 'test.ts',
      fileContent: code,
      addedLines: [],
    });

    expect(issues.length).toBe(0);
  });

  it('should detect multiple unnecessary try-catches in one file', () => {
    const code = `
function a() {
  try {
    const x = 1;
  } catch (e) {
    console.log(e);
  }
}

function b() {
  try {
    const y = 2;
  } catch (e) {
    console.error(e);
  }
}
`;
    const issues = unnecessaryTryCatchRule.check({
      filePath: 'test.ts',
      fileContent: code,
      addedLines: [],
    });

    expect(issues.length).toBe(2);
  });
});
