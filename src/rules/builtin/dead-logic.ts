import { Issue } from '../../types/index.js';
import { Rule, RuleContext } from '../types.js';
import { t } from '../../i18n/index.js';

/**
 * Detects dead logic patterns — code that can never execute or
 * conditions that are always true/false.
 */
export const deadLogicRule: Rule = {
  id: 'logic/dead-branch',
  category: 'logic',
  severity: 'medium',
  title: 'Dead logic branch detected',
  description:
    'AI-generated code sometimes contains conditions that are always true or false, unreachable code after return/throw, or assign-then-immediately-reassign patterns.',

  check(context: RuleContext): Issue[] {
    const issues: Issue[] = [];
    const lines = context.fileContent.split('\n');

    detectAlwaysTrueFalse(context, lines, issues);
    detectCodeAfterReturn(context, lines, issues);
    detectImmediateReassign(context, lines, issues);

    return issues;
  },
};

function detectAlwaysTrueFalse(
  context: RuleContext,
  lines: string[],
  issues: Issue[],
): void {
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    const alwaysTruePatterns = [
      /if\s*\(\s*true\s*\)/,
      /if\s*\(\s*1\s*\)/,
      /if\s*\(\s*['"].+['"]\s*\)/,
    ];

    const alwaysFalsePatterns = [
      /if\s*\(\s*false\s*\)/,
      /if\s*\(\s*0\s*\)/,
      /if\s*\(\s*null\s*\)/,
      /if\s*\(\s*undefined\s*\)/,
      /if\s*\(\s*''\s*\)/,
      /if\s*\(\s*""\s*\)/,
    ];

    for (const pattern of alwaysTruePatterns) {
      if (pattern.test(trimmed)) {
        issues.push({
          ruleId: 'logic/dead-branch',
          severity: 'medium',
          category: 'logic',
          file: context.filePath,
          startLine: i + 1,
          endLine: i + 1,
          message: t(
            'Condition is always true — this branch always executes.',
            '条件始终为 true — 此分支始终会执行。',
          ),
          suggestion: t(
            'Remove the condition and keep only the body, or fix the logic.',
            '移除条件判断只保留主体，或修复逻辑。',
          ),
        });
      }
    }

    for (const pattern of alwaysFalsePatterns) {
      if (pattern.test(trimmed)) {
        issues.push({
          ruleId: 'logic/dead-branch',
          severity: 'medium',
          category: 'logic',
          file: context.filePath,
          startLine: i + 1,
          endLine: i + 1,
          message: t(
            'Condition is always false — this branch never executes.',
            '条件始终为 false — 此分支永远不会执行。',
          ),
          suggestion: t(
            'Remove the dead branch entirely.',
            '完全移除该死代码分支。',
          ),
        });
      }
    }
  }
}

function detectCodeAfterReturn(
  context: RuleContext,
  lines: string[],
  issues: Issue[],
): void {
  let braceDepth = 0;
  let lastReturnDepth = -1;
  let lastReturnLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    for (const ch of trimmed) {
      if (ch === '{') braceDepth++;
      if (ch === '}') {
        if (braceDepth === lastReturnDepth) {
          lastReturnDepth = -1;
          lastReturnLine = -1;
        }
        braceDepth--;
      }
    }

    if (/^(return|throw)\b/.test(trimmed) && !trimmed.includes('=>')) {
      // 如果 return/throw 行以开括号结尾（多行返回值），跳过
      const endsOpen = /[{(\[,]$/.test(trimmed) || /^(return|throw)\s*$/.test(trimmed);
      if (endsOpen) continue;
      lastReturnDepth = braceDepth;
      lastReturnLine = i;
    } else if (
      lastReturnLine !== -1 &&
      braceDepth === lastReturnDepth &&
      trimmed.length > 0 &&
      trimmed !== '}' &&
      trimmed !== '};' &&
      !trimmed.startsWith('//') &&
      !trimmed.startsWith('case ') &&
      !trimmed.startsWith('default:') &&
      !trimmed.startsWith('default :')
    ) {
      issues.push({
        ruleId: 'logic/dead-branch',
        severity: 'medium',
        category: 'logic',
        file: context.filePath,
        startLine: i + 1,
        endLine: i + 1,
        message: t(
          `Unreachable code after return/throw at line ${lastReturnLine + 1}.`,
          `第 ${lastReturnLine + 1} 行的 return/throw 之后存在不可达代码。`,
        ),
        suggestion: t(
          'Remove unreachable code or restructure the logic.',
          '移除不可达代码或重构逻辑。',
        ),
      });
      lastReturnDepth = -1;
      lastReturnLine = -1;
    }
  }
}

function detectImmediateReassign(
  context: RuleContext,
  lines: string[],
  issues: Issue[],
): void {
  for (let i = 0; i < lines.length - 1; i++) {
    const current = lines[i].trim();
    const next = lines[i + 1].trim();

    const assignMatch = current.match(/^(let|var)\s+(\w+)\s*=\s*.+;?\s*$/);
    if (assignMatch) {
      const varName = assignMatch[2];
      const reassignPattern = new RegExp(`^${varName}\\s*=\\s*.+;?\\s*$`);
      if (reassignPattern.test(next)) {
        issues.push({
          ruleId: 'logic/dead-branch',
          severity: 'low',
          category: 'logic',
          file: context.filePath,
          startLine: i + 1,
          endLine: i + 2,
          message: t(
            `Variable "${varName}" is assigned and immediately reassigned on the next line.`,
            `变量 "${varName}" 赋值后立即在下一行被重新赋值。`,
          ),
          suggestion: t(
            `Remove the first assignment or combine into a single declaration.`,
            `移除第一次赋值，或合并为一次声明。`,
          ),
        });
      }
    }
  }
}
