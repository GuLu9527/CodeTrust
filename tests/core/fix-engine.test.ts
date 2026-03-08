import { describe, it, expect } from 'vitest';
import { noDebuggerRule } from '../../src/rules/builtin/no-debugger.js';
import { unusedImportRule } from '../../src/rules/builtin/unused-import.js';
import { typeCoercionRule } from '../../src/rules/builtin/type-coercion.js';
import { unusedVariablesRule } from '../../src/rules/builtin/unused-variables.js';
import { lineRange, lineStartOffset } from '../../src/rules/fix-utils.js';

describe('fix-utils', () => {
  it('lineStartOffset should return correct byte offset', () => {
    const content = 'line1\nline2\nline3';
    expect(lineStartOffset(content, 1)).toBe(0);
    expect(lineStartOffset(content, 2)).toBe(6);
    expect(lineStartOffset(content, 3)).toBe(12);
  });

  it('lineRange should return correct range including newline', () => {
    const content = 'aaa\nbbb\nccc';
    expect(lineRange(content, 1)).toEqual([0, 4]); // "aaa\n"
    expect(lineRange(content, 2)).toEqual([4, 8]); // "bbb\n"
    expect(lineRange(content, 3)).toEqual([8, 11]); // "ccc" (no trailing newline)
  });
});

describe('no-debugger fix', () => {
  it('should produce a fix that deletes the debugger line', () => {
    const code = 'const x = 1;\ndebugger;\nconst y = 2;';
    const ctx = { filePath: 'test.ts', fileContent: code, addedLines: [] };
    const issues = noDebuggerRule.check(ctx);
    expect(issues.length).toBe(1);

    const fix = noDebuggerRule.fix!(ctx, issues[0]);
    expect(fix).not.toBeNull();

    // Apply the fix
    const fixed = code.slice(0, fix!.range[0]) + fix!.text + code.slice(fix!.range[1]);
    expect(fixed).toBe('const x = 1;\nconst y = 2;');
  });
});

describe('unused-import fix', () => {
  it('should produce a fix that deletes a single-specifier import line', () => {
    const code = "import { foo } from './bar';\nconst x = 1;";
    const ctx = { filePath: 'test.ts', fileContent: code, addedLines: [] };
    const issues = unusedImportRule.check(ctx);
    expect(issues.length).toBe(1);

    const fix = unusedImportRule.fix!(ctx, issues[0]);
    expect(fix).not.toBeNull();

    const fixed = code.slice(0, fix!.range[0]) + fix!.text + code.slice(fix!.range[1]);
    expect(fixed).toBe('const x = 1;');
  });

  it('should return null for multi-specifier imports', () => {
    const code = "import { foo, bar } from './baz';\nconst x = foo();";
    const ctx = { filePath: 'test.ts', fileContent: code, addedLines: [] };
    const issues = unusedImportRule.check(ctx);
    // bar is unused
    const barIssue = issues.find(i => i.message.includes('bar'));
    if (barIssue) {
      const fix = unusedImportRule.fix!(ctx, barIssue);
      expect(fix).toBeNull(); // multi-specifier, should not auto-fix
    }
  });
});

describe('type-coercion fix', () => {
  it('should replace == with ===', () => {
    const code = 'if (x == 5) { return; }';
    const ctx = { filePath: 'test.ts', fileContent: code, addedLines: [] };
    const issues = typeCoercionRule.check(ctx);
    expect(issues.length).toBe(1);

    const fix = typeCoercionRule.fix!(ctx, issues[0]);
    expect(fix).not.toBeNull();

    const fixed = code.slice(0, fix!.range[0]) + fix!.text + code.slice(fix!.range[1]);
    expect(fixed).toBe('if (x === 5) { return; }');
  });

  it('should replace != with !==', () => {
    const code = 'if (a != b) { return; }';
    const ctx = { filePath: 'test.ts', fileContent: code, addedLines: [] };
    const issues = typeCoercionRule.check(ctx);
    expect(issues.length).toBe(1);

    const fix = typeCoercionRule.fix!(ctx, issues[0]);
    expect(fix).not.toBeNull();

    const fixed = code.slice(0, fix!.range[0]) + fix!.text + code.slice(fix!.range[1]);
    expect(fixed).toBe('if (a !== b) { return; }');
  });
});

describe('unused-variables fix', () => {
  it('should delete unused variable declaration line', () => {
    const code = "const unused = 42;\nconst used = 1;\nconsole.log(used);";
    const ctx = { filePath: 'test.ts', fileContent: code, addedLines: [] };
    const issues = unusedVariablesRule.check(ctx);
    const unusedIssue = issues.find(i => i.message.includes('unused'));
    expect(unusedIssue).toBeTruthy();

    const fix = unusedVariablesRule.fix!(ctx, unusedIssue!);
    expect(fix).not.toBeNull();

    const fixed = code.slice(0, fix!.range[0]) + fix!.text + code.slice(fix!.range[1]);
    expect(fixed).not.toContain('const unused');
    expect(fixed).toContain('const used');
  });
});
