import { Issue } from '../../types/index.js';
import { Rule, RuleContext } from '../types.js';
import { t } from '../../i18n/index.js';

/**
 * Detects string literals that appear multiple times in the same file.
 * AI-generated code often repeats the same string literal instead of
 * extracting it into a named constant.
 */

const MIN_STRING_LENGTH = 6;
const MIN_OCCURRENCES = 3;
const IGNORED_LITERALS = new Set([
  'high',
  'medium',
  'low',
  'info',
  'logic',
  'security',
  'structure',
  'style',
  'coverage',
]);

export const duplicateStringRule: Rule = {
  id: 'logic/duplicate-string',
  category: 'logic',
  severity: 'low',
  title: 'Duplicate string literal',
  description:
    'AI-generated code often repeats the same string literal instead of extracting it into a constant.',

  check(context: RuleContext): Issue[] {
    const issues: Issue[] = [];
    const lines = context.fileContent.split('\n');

    // Collect all string literals with their locations
    const stringMap = new Map<string, number[]>();
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

      // Skip comments and import lines
      if (trimmed.startsWith('//')) continue;
      if (trimmed.startsWith('import ')) continue;

      // Remove inline comments
      const cleaned = line.replace(/\/\/.*$/, '');

      // Match string literals (single and double quotes)
      const stringRegex = /(['"])([^'"\\](?:(?!\1|\\).|\\.)*)\1/g;
      let match;

      while ((match = stringRegex.exec(cleaned)) !== null) {
        const value = match[2];

        // Skip short strings
        if (value.length < MIN_STRING_LENGTH) continue;

        // Skip low-information enum-like literals common in rule definitions.
        if (IGNORED_LITERALS.has(value)) continue;

        // Skip template-like strings with interpolation markers
        if (value.includes('${')) continue;

        // Skip URL-like strings and paths
        if (value.startsWith('http') || value.startsWith('/')) continue;

        // Skip common test strings
        if (value.startsWith('test') || value.startsWith('mock')) continue;

        if (!stringMap.has(value)) {
          stringMap.set(value, []);
        }
        stringMap.get(value)!.push(i + 1);
      }
    }

    // Report strings that appear too many times
    for (const [value, locations] of stringMap) {
      if (locations.length < MIN_OCCURRENCES) continue;

      // Report only on the first occurrence
      const firstLine = locations[0];
      const displayValue = value.length > 30 ? value.substring(0, 30) + '...' : value;

      issues.push({
        ruleId: 'logic/duplicate-string',
        severity: 'low',
        category: 'logic',
        file: context.filePath,
        startLine: firstLine,
        endLine: firstLine,
        message: t(
          `String "${displayValue}" is repeated ${locations.length} times.`,
          `字符串 "${displayValue}" 重复出现了 ${locations.length} 次。`,
        ),
        suggestion: t(
          `Extract to a named constant to improve maintainability.`,
          `提取为命名常量以提高可维护性。`,
        ),
      });
    }

    return issues;
  },
};
