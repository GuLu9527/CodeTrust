import { describe, it, expect } from 'vitest';
import { noUselessConstructorRule } from '../../src/rules/builtin/no-useless-constructor.js';

const run = (code: string) =>
  noUselessConstructorRule.check({ filePath: 'test.ts', fileContent: code, addedLines: [] });

describe('logic/no-useless-constructor', () => {
  it('should detect empty constructor', () => {
    const code = `class Foo {\n  constructor() {}\n}`;
    const issues = run(code);
    expect(issues.length).toBe(1);
    expect(issues[0].ruleId).toBe('logic/no-useless-constructor');
  });

  it('should detect super-only constructor with same params', () => {
    const code = `class Bar extends Foo {\n  constructor(x: number) {\n    super(x);\n  }\n}`;
    const issues = run(code);
    expect(issues.length).toBe(1);
  });

  it('should NOT flag constructor with logic', () => {
    const code = `class Foo {\n  constructor(x: number) {\n    this.x = x;\n  }\n}`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });

  it('should NOT flag constructor with super + extra logic', () => {
    const code = `class Bar extends Foo {\n  constructor(x: number) {\n    super(x);\n    this.init();\n  }\n}`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });

  it('should NOT flag class without constructor', () => {
    const code = `class Foo {\n  method() { return 1; }\n}`;
    const issues = run(code);
    expect(issues.length).toBe(0);
  });
});
