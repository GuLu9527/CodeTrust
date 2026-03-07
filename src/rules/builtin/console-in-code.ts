import { Issue } from '../../types/index.js';
import { Rule, RuleContext } from '../types.js';
import { t } from '../../i18n/index.js';

/**
 * Detects console.log/warn/error statements left in code.
 *
 * AI-generated code frequently includes console.log for debugging
 * that should be removed before production.
 * Severity is 'info' since some projects legitimately use console.
 */
export const consoleInCodeRule: Rule = {
  id: 'logic/console-in-code',
  category: 'logic',
  severity: 'info',
  title: 'Console statement left in code',
  description:
    'AI-generated code often includes console.log/warn/error statements intended for debugging that should be removed or replaced with a proper logger.',

  check(context: RuleContext): Issue[] {
    const issues: Issue[] = [];
    const lines = context.fileContent.split('\n');

    // Skip files that are likely CLI/logger utilities
    const lowerPath = context.filePath.toLowerCase();
    if (
      lowerPath.includes('/cli/') ||
      lowerPath.includes('logger') ||
      lowerPath.includes('log.') ||
      lowerPath.endsWith('.test.ts') ||
      lowerPath.endsWith('.test.js') ||
      lowerPath.endsWith('.spec.ts') ||
      lowerPath.endsWith('.spec.js')
    ) {
      return issues;
    }

    let count = 0;
    const locations: number[] = [];
    let inBlockComment = false;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();

      // Track block comments
      if (inBlockComment) {
        if (trimmed.includes('*/')) inBlockComment = false;
        continue;
      }
      if (trimmed.startsWith('/*')) {
        if (!trimmed.includes('*/')) inBlockComment = true;
        continue;
      }
      if (trimmed.startsWith('//')) continue;

      if (/\bconsole\.(log|warn|error|info|debug|trace)\s*\(/.test(trimmed)) {
        count++;
        locations.push(i + 1);
      }
    }

    // Only report if there are 3+ console statements (to reduce noise)
    if (count >= 3) {
      issues.push({
        ruleId: 'logic/console-in-code',
        severity: 'info',
        category: 'logic',
        file: context.filePath,
        startLine: locations[0],
        endLine: locations[locations.length - 1],
        message: t(
          `${count} console statements found. AI-generated code often leaves debug logging that should be removed or replaced with a proper logger.`,
          `发现 ${count} 个 console 语句。AI 生成的代码经常留下调试日志，应该移除或替换为正式的日志工具。`,
        ),
        suggestion: t(
          'Remove console statements or replace with a structured logger (e.g. winston, pino).',
          '移除 console 语句或替换为结构化日志工具（如 winston、pino）。',
        ),
      });
    }

    return issues;
  },
};
