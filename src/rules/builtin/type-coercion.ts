import { Issue } from '../../types/index.js';
import { Rule, RuleContext, Fix } from '../types.js';
import { t } from '../../i18n/index.js';
import { lineStartOffset } from '../fix-utils.js';

/**
 * Detects loose equality operators (== and !=) that cause implicit type coercion.
 * AI-generated code frequently uses == instead of ===, which can lead to
 * subtle bugs due to JavaScript's type coercion rules.
 */
export const typeCoercionRule: Rule = {
  id: 'logic/type-coercion',
  category: 'logic',
  severity: 'medium',
  title: 'Loose equality with type coercion',
  description:
    'AI-generated code often uses == instead of ===, leading to implicit type coercion bugs.',

  fixable: true,

  fix(context: RuleContext, issue: Issue): Fix | null {
    const lines = context.fileContent.split('\n');
    const lineIndex = issue.startLine - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) return null;

    const line = lines[lineIndex];
    const base = lineStartOffset(context.fileContent, issue.startLine);

    // Determine operator from issue message
    const isNotEqual = issue.message.includes('!=');
    const searchOp = isNotEqual ? '!=' : '==';
    const replaceOp = isNotEqual ? '!==' : '===';

    // Find the operator position on this line (skip ===, !==)
    let pos = -1;
    for (let j = 0; j < line.length - 1; j++) {
      if (line[j] === searchOp[0] && line[j + 1] === '=') {
        // Make sure it's not already === or !==
        if (line[j + 2] === '=') { j += 2; continue; }
        // For !=, also check it's not just a single =
        if (!isNotEqual && j > 0 && (line[j - 1] === '!' || line[j - 1] === '<' || line[j - 1] === '>')) { continue; }
        pos = j;
        break;
      }
    }

    if (pos === -1) return null;
    return { range: [base + pos, base + pos + searchOp.length], text: replaceOp };
  },

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

      // Remove string literals and comments from the line before checking
      const cleaned = line
        .replace(/(['"`])(?:(?!\1|\\).|\\.)*\1/g, '""')  // remove string contents
        .replace(/\/\/.*$/, '');                            // remove inline comments

      // Match == or != but not === or !==
      const looseEqRegex = /[^!=<>]==[^=]|[^!]==[^=]|!=[^=]/g;
      let match;

      while ((match = looseEqRegex.exec(cleaned)) !== null) {
        // Double-check: extract the actual operator
        const pos = match.index;
        const snippet = cleaned.substring(Math.max(0, pos), pos + match[0].length);

        // Skip if it's actually === or !==
        if (snippet.includes('===') || snippet.includes('!==')) continue;

        const isNotEqual = snippet.includes('!=');
        const operator = isNotEqual ? '!=' : '==';
        const strict = isNotEqual ? '!==' : '===';

        // Allow == null / != null pattern (common intentional pattern)
        const afterOp = cleaned.substring(pos + match[0].length - 1).trim();
        if (afterOp.startsWith('null') || afterOp.startsWith('undefined')) continue;
        const beforeOp = cleaned.substring(0, pos + 1).trim();
        if (beforeOp.endsWith('null') || beforeOp.endsWith('undefined')) continue;

        issues.push({
          ruleId: 'logic/type-coercion',
          severity: 'medium',
          category: 'logic',
          file: context.filePath,
          startLine: i + 1,
          endLine: i + 1,
          message: t(
            `Loose equality "${operator}" can cause implicit type coercion.`,
            `宽松等于 "${operator}" 会导致隐式类型转换。`,
          ),
          suggestion: t(
            `Use strict equality "${strict}" instead of "${operator}".`,
            `使用严格等于 "${strict}" 代替 "${operator}"。`,
          ),
        });
      }
    }

    return issues;
  },
};
