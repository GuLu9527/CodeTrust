import { Issue } from '../../types/index.js';
import { Rule, RuleContext } from '../types.js';
import { t } from '../../i18n/index.js';
import { extractBraceBlock } from '../brace-utils.js';

/**
 * Detects unnecessary try-catch blocks that wrap simple statements
 * with generic error handling — a common AI hallucination pattern.
 *
 * Pattern: try { single statement } catch (e) { console.log/error }
 */
export const unnecessaryTryCatchRule: Rule = {
  id: 'logic/unnecessary-try-catch',
  category: 'logic',
  severity: 'medium',
  title: 'Unnecessary try-catch wrapping simple statement',
  description:
    'AI often wraps simple, non-throwing statements in try-catch blocks with generic console.log/error in the catch. This is hallucinated error handling.',

  check(context: RuleContext): Issue[] {
    const issues: Issue[] = [];
    const lines = context.fileContent.split('\n');

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith('try') && trimmed.includes('{')) {
        const tryCol = line.indexOf('try');
        const tryBlock = extractBraceBlock(lines, i, tryCol);

        if (tryBlock) {
          const { bodyLines: tryBodyLines, endLine: tryEndLine } = tryBlock;

          // Look for the catch block after the try block closes
          let catchLineIdx = -1;
          for (let k = tryEndLine; k < Math.min(tryEndLine + 2, lines.length); k++) {
            if (lines[k].includes('catch')) {
              catchLineIdx = k;
              break;
            }
          }

          if (catchLineIdx !== -1) {
            const catchCol = lines[catchLineIdx].indexOf('catch');
            const catchBlock = extractBraceBlock(lines, catchLineIdx, catchCol);

            if (catchBlock) {
              const { bodyLines: catchBodyLines, endLine: catchEndLine } = catchBlock;

              const nonEmptyBody = tryBodyLines.filter((l) => l.trim().length > 0);
              const nonEmptyCatch = catchBodyLines.filter((l) => l.trim().length > 0);

              const isSimpleBody = nonEmptyBody.length <= 2;
              const isGenericCatch =
                nonEmptyCatch.length <= 2 &&
                nonEmptyCatch.some(
                  (l) =>
                    /console\.(log|error|warn)/.test(l) ||
                    /throw\s+(new\s+)?Error/.test(l) ||
                    l.trim() === '',
                );

              const bodyHasOnlyAssignments = nonEmptyBody.every(
                (l) =>
                  /^\s*(const|let|var)\s+/.test(l) ||
                  /^\s*\w+(\.\w+)*\s*=\s*/.test(l) ||
                  /^\s*return\s+/.test(l),
              );

              if (isSimpleBody && isGenericCatch && bodyHasOnlyAssignments) {
                issues.push({
                  ruleId: 'logic/unnecessary-try-catch',
                  severity: 'medium',
                  category: 'logic',
                  file: context.filePath,
                  startLine: i + 1,
                  endLine: catchEndLine + 1,
                  message: t(
                    'Unnecessary try-catch wrapping a simple statement with generic error handling. This is likely AI-hallucinated error handling.',
                    '不必要的 try-catch 包裹了简单语句，catch 中只有通用的错误日志。这很可能是 AI 幻觉生成的错误处理。',
                  ),
                  suggestion: t(
                    'Remove the try-catch block or add meaningful error recovery logic.',
                    '移除 try-catch 块，或添加有意义的错误恢复逻辑。',
                  ),
                });
              }

              i = catchEndLine + 1;
              continue;
            }
          }
        }
      }

      i++;
    }

    return issues;
  },
};
