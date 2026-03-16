import { describe, it, expect } from 'vitest';
import { duplicateStringRule } from '../../src/rules/builtin/duplicate-string.js';

const run = (code: string) =>
  duplicateStringRule.check({ filePath: 'test.ts', fileContent: code, addedLines: [] });

describe('logic/duplicate-string', () => {
  it('should detect strings repeated 3+ times', () => {
    const code = [
      'const a = "application/json";',
      'const b = "application/json";',
      'const c = "application/json";',
    ].join('\n');
    const issues = run(code);
    expect(issues.length).toBe(1);
    expect(issues[0].ruleId).toBe('logic/duplicate-string');
  });

  it('should NOT flag strings appearing less than 3 times', () => {
    const code = [
      'const a = "application/json";',
      'const b = "application/json";',
    ].join('\n');
    const issues = run(code);
    expect(issues.length).toBe(0);
  });

  it('should NOT flag short strings', () => {
    const code = [
      'const a = "ok";',
      'const b = "ok";',
      'const c = "ok";',
    ].join('\n');
    const issues = run(code);
    expect(issues.length).toBe(0);
  });

  it('should skip import lines', () => {
    const code = [
      "import { foo } from 'some-module';",
      "import { bar } from 'some-module';",
      "import { baz } from 'some-module';",
    ].join('\n');
    const issues = run(code);
    expect(issues.length).toBe(0);
  });

  it('should ignore repeated severity and category literals', () => {
    const code = [
      'const a = "medium";',
      'const b = "medium";',
      'const c = "medium";',
      'const d = "logic";',
      'const e = "logic";',
      'const f = "logic";',
    ].join('\n');
    const issues = run(code);
    expect(issues.length).toBe(0);
  });
});
