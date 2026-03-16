import { describe, it, expect } from 'vitest';
import { securityRules } from '../../src/rules/builtin/security.js';

const findRule = (id: string) => securityRules.find((r) => r.id === id)!;

const run = (ruleId: string, code: string) =>
  findRule(ruleId).check({
    filePath: 'test.ts',
    fileContent: code,
    addedLines: [],
  });

describe('security/hardcoded-secret', () => {
  it('should detect hardcoded API key', () => {
    const code = `const apiKey = "sk_test_FAKE0KEY0FOR0UNIT0TESTS00";`;
    const issues = run('security/hardcoded-secret', code);
    expect(issues.length).toBe(1);
    expect(issues[0].severity).toBe('high');
  });

  it('should detect hardcoded password', () => {
    const code = `const password = "mySecretPassword123";`;
    const issues = run('security/hardcoded-secret', code);
    expect(issues.length).toBe(1);
  });

  it('should detect AWS access key', () => {
    const code = `const awsKey = "AKIAIOSFODNN7EXAMPLE";`;
    const issues = run('security/hardcoded-secret', code);
    expect(issues.length).toBe(1);
  });

  it('should NOT flag process.env usage', () => {
    const code = `const apiKey = process.env.API_KEY;`;
    const issues = run('security/hardcoded-secret', code);
    expect(issues.length).toBe(0);
  });

  it('should NOT flag comments', () => {
    const code = `// const apiKey = "sk_test_FAKE0KEY0FOR0UNIT0TESTS00";`;
    const issues = run('security/hardcoded-secret', code);
    expect(issues.length).toBe(0);
  });
});

describe('security/eval-usage', () => {
  it('should detect eval()', () => {
    const code = `const result = eval(userInput);`;
    const issues = run('security/eval-usage', code);
    expect(issues.length).toBe(1);
    expect(issues[0].severity).toBe('high');
  });

  it('should detect new Function()', () => {
    const code = `const fn = new Function("return " + expr);`;
    const issues = run('security/eval-usage', code);
    expect(issues.length).toBe(1);
  });

  it('should detect setTimeout with string', () => {
    const code = `setTimeout("alert('hi')", 1000);`;
    const issues = run('security/eval-usage', code);
    expect(issues.length).toBe(1);
  });

  it('should NOT flag regex pattern-definition text containing eval()', () => {
    const code = `const detector = { pattern: /\\beval\\s*\\(/, label: 'eval()' };`;
    const issues = run('security/eval-usage', code);
    expect(issues.length).toBe(0);
  });

  it('should NOT flag plain string literals mentioning eval()', () => {
    const code = `const message = "Avoid eval(userInput) in production";`;
    const issues = run('security/eval-usage', code);
    expect(issues.length).toBe(0);
  });

  it('should NOT flag setTimeout with function', () => {
    const code = `setTimeout(() => console.log('hi'), 1000);`;
    const issues = run('security/eval-usage', code);
    expect(issues.length).toBe(0);
  });
});

describe('security/sql-injection', () => {
  it('should detect SQL with template literal', () => {
    const code = 'const query = `SELECT * FROM users WHERE id = ${userId}`;';
    const issues = run('security/sql-injection', code);
    expect(issues.length).toBe(1);
  });

  it('should detect SQL with string concatenation', () => {
    const code = `const query = "SELECT * FROM users WHERE name = '" + name + "'";`;
    const issues = run('security/sql-injection', code);
    expect(issues.length).toBe(1);
  });

  it('should detect query execution with template literal', () => {
    const code = 'db.query(`SELECT * FROM users WHERE id = ${userId}`);';
    const issues = run('security/sql-injection', code);
    expect(issues.length).toBe(1);
  });

  it('should NOT flag parameterized query', () => {
    const code = `db.query("SELECT * FROM users WHERE id = ?", [userId]);`;
    const issues = run('security/sql-injection', code);
    expect(issues.length).toBe(0);
  });

  it('should NOT flag non-query fingerprint metadata assembly', () => {
    const code = 'const fingerprintSeed = `SELECT|${ruleId}|${file}|${startLine}`;';
    const issues = run('security/sql-injection', code);
    expect(issues.length).toBe(0);
  });

  it('should NOT flag prose strings with SQL keywords and interpolation', () => {
    const code = 'const message = `Use SELECT with ${tableName} carefully in docs`;';
    const issues = run('security/sql-injection', code);
    expect(issues.length).toBe(0);
  });
});

describe('security/dangerous-html', () => {
  it('should detect innerHTML assignment', () => {
    const code = `element.innerHTML = userContent;`;
    const issues = run('security/dangerous-html', code);
    expect(issues.length).toBe(1);
  });

  it('should detect dangerouslySetInnerHTML', () => {
    const code = `<div dangerouslySetInnerHTML={{ __html: content }} />`;
    const issues = run('security/dangerous-html', code);
    expect(issues.length).toBe(1);
  });

  it('should NOT flag textContent', () => {
    const code = `element.textContent = userContent;`;
    const issues = run('security/dangerous-html', code);
    expect(issues.length).toBe(0);
  });

  it('should NOT flag detector definition strings mentioning dangerous HTML APIs', () => {
    const code = `const detector = { pattern: /\\.(innerHTML|outerHTML)\\s*=/, label: 'dangerouslySetInnerHTML' };`;
    const issues = run('security/dangerous-html', code);
    expect(issues.length).toBe(0);
  });
});
