import { Issue } from '../../types/index.js';
import { Rule, RuleContext } from '../types.js';
import { t } from '../../i18n/index.js';

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
        const tryBlock = extractBlock(lines, i);
        if (tryBlock) {
          const { bodyLines, catchBodyLines, endLine } = tryBlock;

          const nonEmptyBody = bodyLines.filter((l) => l.trim().length > 0);
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
              endLine: endLine + 1,
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

          i = endLine + 1;
          continue;
        }
      }

      i++;
    }

    return issues;
  },
};

interface TryCatchBlock {
  bodyLines: string[];
  catchStart: number;
  catchBodyLines: string[];
  endLine: number;
}

function extractBlock(lines: string[], tryLineIndex: number): TryCatchBlock | null {
  let braceCount = 0;
  let foundTryOpen = false;
  let tryBodyStart = -1;
  let tryBodyEnd = -1;
  let catchStart = -1;
  let catchBodyStart = -1;
  let catchBodyEnd = -1;

  for (let i = tryLineIndex; i < lines.length; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === '{') {
        braceCount++;
        if (!foundTryOpen) {
          foundTryOpen = true;
          tryBodyStart = i;
        }
      } else if (ch === '}') {
        braceCount--;
        if (braceCount === 0 && tryBodyEnd === -1) {
          tryBodyEnd = i;
        } else if (braceCount === 0 && catchBodyEnd === -1 && catchBodyStart !== -1) {
          catchBodyEnd = i;
          break;
        }
      }
    }

    if (tryBodyEnd !== -1 && catchStart === -1) {
      if (line.includes('catch')) {
        catchStart = i;
      }
    }

    if (catchStart !== -1 && catchBodyStart === -1 && line.includes('{')) {
      catchBodyStart = i;
    }

    if (catchBodyEnd !== -1) break;
  }

  if (tryBodyStart === -1 || tryBodyEnd === -1 || catchBodyStart === -1 || catchBodyEnd === -1) {
    return null;
  }

  const bodyLines = lines.slice(tryBodyStart + 1, tryBodyEnd);
  const catchBodyLines = lines.slice(catchBodyStart + 1, catchBodyEnd);

  return {
    bodyLines,
    catchStart,
    catchBodyLines,
    endLine: catchBodyEnd,
  };
}
