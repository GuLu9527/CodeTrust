import { Issue } from '../../types/index.js';
import { Rule, RuleContext } from '../types.js';
import { t } from '../../i18n/index.js';

/**
 * Detects `debugger` statements left in code.
 * AI-generated code or debugging sessions may leave debugger statements
 * that should never reach production.
 */
export const noDebuggerRule: Rule = {
  id: 'security/no-debugger',
  category: 'security',
  severity: 'high',
  title: 'Debugger statement',
  description:
    'Debugger statements should never be committed to production code.',

  check(context: RuleContext): Issue[] {
    const issues: Issue[] = [];
    const lines = context.fileContent.split('\n');
    let inBlockComment = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Track block comments
      if (inBlockComment) {
        if (trimmed.includes('*/')) inBlockComment = false;
        continue;
      }
      if (trimmed.startsWith('/*')) {
        if (!trimmed.includes('*/')) inBlockComment = true;
        continue;
      }

      // Skip single-line comments
      if (trimmed.startsWith('//')) continue;

      // Remove string contents and inline comments
      const cleaned = line
        .replace(/(['"`])(?:(?!\1|\\).|\\.)*\1/g, '""')
        .replace(/\/\/.*$/, '');

      // Match standalone `debugger` keyword
      if (/\bdebugger\b/.test(cleaned)) {
        issues.push({
          ruleId: 'security/no-debugger',
          severity: 'high',
          category: 'security',
          file: context.filePath,
          startLine: i + 1,
          endLine: i + 1,
          message: t(
            `Debugger statement found. Remove before committing.`,
            `发现 debugger 语句。提交前请移除。`,
          ),
          suggestion: t(
            `Remove the debugger statement.`,
            `移除 debugger 语句。`,
          ),
        });
      }
    }

    return issues;
  },
};
