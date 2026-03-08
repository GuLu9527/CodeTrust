import { Issue } from '../../types/index.js';
import { Rule, RuleContext } from '../types.js';
import { t } from '../../i18n/index.js';

/**
 * Detects magic numbers — numeric literals used directly in logic
 * without being assigned to a named constant.
 * AI-generated code frequently hard-codes numbers like timeout values,
 * array indices, HTTP status codes, etc. without meaningful names.
 */

// Numbers that are commonly used and generally acceptable
const ALLOWED_NUMBERS = new Set([
  -1, 0, 1, 2, 10, 100,
]);

export const magicNumberRule: Rule = {
  id: 'logic/magic-number',
  category: 'logic',
  severity: 'low',
  title: 'Magic number',
  description:
    'AI-generated code often uses unexplained numeric literals instead of named constants.',

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

      // Skip comments
      if (trimmed.startsWith('//')) continue;

      // Skip const/let/var declarations with direct assignment (defining constants is fine)
      if (/^\s*(export\s+)?(const|let|var|readonly)\s+[A-Z_][A-Z0-9_]*\s*[=:]/.test(line)) continue;

      // Skip enum declarations
      if (/^\s*(export\s+)?enum\s/.test(line)) continue;

      // Skip array index access [0], [1], etc.
      // Skip import statements
      if (trimmed.startsWith('import ')) continue;

      // Skip lines that are purely return statements with simple numbers
      if (/^\s*return\s+[0-9]+\s*;?\s*$/.test(line)) continue;

      // Remove string contents and comments
      const cleaned = line
        .replace(/(['"`])(?:(?!\1|\\).|\\.)*\1/g, '""')
        .replace(/\/\/.*$/, '');

      // Find numeric literals (integers and floats, but not in simple assignments to UPPER_CASE)
      const numRegex = /(?<![.\w])(-?\d+\.?\d*(?:e[+-]?\d+)?)\b/gi;
      let match;

      while ((match = numRegex.exec(cleaned)) !== null) {
        const value = parseFloat(match[1]);

        // Skip commonly acceptable numbers
        if (ALLOWED_NUMBERS.has(value)) continue;

        // Skip if it's NaN (parsing failed)
        if (isNaN(value)) continue;

        // Skip array index patterns like [3] or .slice(0, 5)
        const beforeChar = cleaned[match.index - 1] || '';
        if (beforeChar === '[') continue;

        // Skip if part of a type annotation (e.g., tuple types)
        if (beforeChar === '<' || beforeChar === ',') continue;

        issues.push({
          ruleId: 'logic/magic-number',
          severity: 'low',
          category: 'logic',
          file: context.filePath,
          startLine: i + 1,
          endLine: i + 1,
          message: t(
            `Magic number ${match[1]} should be extracted to a named constant.`,
            `魔术数字 ${match[1]} 应提取为命名常量。`,
          ),
          suggestion: t(
            `Define a descriptive constant, e.g., const MAX_RETRIES = ${match[1]};`,
            `定义一个描述性常量，例如 const MAX_RETRIES = ${match[1]};`,
          ),
        });
      }
    }

    return issues;
  },
};
