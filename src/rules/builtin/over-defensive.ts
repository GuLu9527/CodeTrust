import { Issue } from '../../types/index.js';
import { Rule, RuleContext } from '../types.js';
import { t } from '../../i18n/index.js';

/**
 * Detects over-defensive coding patterns typical of AI-generated code.
 *
 * Pattern: 3+ consecutive null/undefined/empty-string checks at function start,
 * or excessive type guards that the type system already guarantees.
 */
export const overDefensiveRule: Rule = {
  id: 'logic/over-defensive',
  category: 'logic',
  severity: 'low',
  title: 'Over-defensive coding pattern',
  description:
    'AI-generated code often includes excessive null/undefined checks, redundant type guards, and unnecessary validations that the type system already handles.',

  check(context: RuleContext): Issue[] {
    const issues: Issue[] = [];
    const lines = context.fileContent.split('\n');

    let consecutiveChecks = 0;
    let checkStartLine = -1;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();

      if (isDefensiveCheck(trimmed)) {
        if (consecutiveChecks === 0) {
          checkStartLine = i;
        }
        consecutiveChecks++;
      } else if (trimmed.length > 0) {
        if (consecutiveChecks >= 3) {
          issues.push({
            ruleId: 'logic/over-defensive',
            severity: 'low',
            category: 'logic',
            file: context.filePath,
            startLine: checkStartLine + 1,
            endLine: i,
            message: t(
              `${consecutiveChecks} consecutive defensive checks detected. AI tends to add excessive null/undefined guards.`,
              `检测到 ${consecutiveChecks} 个连续的防御性检查。AI 倾向于添加过多的 null/undefined 守卫。`,
            ),
            suggestion: t(
              'Consider if these checks are necessary — TypeScript types may already prevent these cases. Remove redundant guards.',
              '考虑这些检查是否必要 — TypeScript 类型可能已经防止了这些情况。移除冗余的守卫。',
            ),
          });
        }
        consecutiveChecks = 0;
      }
    }

    if (consecutiveChecks >= 3) {
      issues.push({
        ruleId: 'logic/over-defensive',
        severity: 'low',
        category: 'logic',
        file: context.filePath,
        startLine: checkStartLine + 1,
        endLine: lines.length,
        message: t(
          `${consecutiveChecks} consecutive defensive checks detected at end of block.`,
          `在代码块末尾检测到 ${consecutiveChecks} 个连续的防御性检查。`,
        ),
        suggestion: t(
          'Review if these defensive checks are truly necessary.',
          '检查这些防御性检查是否真正必要。',
        ),
      });
    }

    detectRedundantTypeofChecks(context, lines, issues);

    return issues;
  },
};

function isDefensiveCheck(line: string): boolean {
  const patterns = [
    /^if\s*\(\s*!?\w+(\.\w+)*\s*(===?|!==?)\s*(null|undefined|''|"")\s*\)/,
    /^if\s*\(\s*!?\w+(\.\w+)*\s*\)\s*\{?\s*(return|throw)/,
    /^if\s*\(\s*typeof\s+\w+\s*(===?|!==?)\s*['"]undefined['"]\s*\)/,
    /^if\s*\(\s*\w+(\.\w+)*\s*==\s*null\s*\)/,
    /^if\s*\(\s*!\w+(\.\w+)*\s*\)\s*\{?\s*$/,
    /^\w+(\.\w+)*\s*\?\?=/,
    /^if\s*\(\s*Array\.isArray\(\w+\)\s*&&\s*\w+\.length\s*(>|>=|===?)\s*0\s*\)/,
  ];

  return patterns.some((p) => p.test(line));
}

function detectRedundantTypeofChecks(
  context: RuleContext,
  lines: string[],
  issues: Issue[],
): void {
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const typeofMatch = trimmed.match(
      /if\s*\(\s*typeof\s+(\w+)\s*(!==?|===?)\s*['"]undefined['"]\s*\)/,
    );
    if (typeofMatch) {
      const varName = typeofMatch[1];
      const prevLines = lines.slice(Math.max(0, i - 5), i);
      const hasDeclaration = prevLines.some((l) =>
        new RegExp(`(const|let|var)\\s+${varName}\\s*[:=]`).test(l),
      );

      if (hasDeclaration) {
        issues.push({
          ruleId: 'logic/over-defensive',
          severity: 'low',
          category: 'logic',
          file: context.filePath,
          startLine: i + 1,
          endLine: i + 1,
          message: t(
            `Redundant typeof check for "${varName}" — variable is declared within ${prevLines.length} line(s) above and cannot be undefined.`,
            `对 "${varName}" 的 typeof 检查是冗余的 — 变量已在上方 ${prevLines.length} 行内声明，不可能为 undefined。`,
          ),
          suggestion: t(
            `Remove the typeof check for "${varName}".`,
            `移除对 "${varName}" 的 typeof 检查。`,
          ),
        });
      }
    }
  }
}
