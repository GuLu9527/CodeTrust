import { Issue } from '../../types/index.js';
import { Rule, RuleContext } from '../types.js';
import { t } from '../../i18n/index.js';

/**
 * Detects empty or useless catch blocks that silently swallow errors.
 *
 * Patterns:
 * - catch (e) {}                    — completely empty
 * - catch (e) { // ignored }        — only comments
 * - catch (e) { throw e; }          — re-throws without modification
 */
export const emptyCatchRule: Rule = {
  id: 'logic/empty-catch',
  category: 'logic',
  severity: 'medium',
  title: 'Empty or useless catch block',
  description:
    'AI-generated code often includes catch blocks that silently swallow errors (empty body) or pointlessly re-throw the same error without modification.',

  check(context: RuleContext): Issue[] {
    const issues: Issue[] = [];
    const lines = context.fileContent.split('\n');

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
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

      // Match catch block opening
      const catchMatch = trimmed.match(/\bcatch\s*\(\s*(\w+)?\s*\)\s*\{/);
      if (!catchMatch) continue;

      const catchVarName = catchMatch[1] || '';
      const blockContent = extractCatchBody(lines, i);
      if (!blockContent) continue;

      const { bodyLines, endLine } = blockContent;
      const meaningful = bodyLines.filter(
        (l) => l.trim().length > 0 && !l.trim().startsWith('//') && !l.trim().startsWith('*'),
      );

      // Pattern 1: Completely empty or only comments
      if (meaningful.length === 0) {
        issues.push({
          ruleId: 'logic/empty-catch',
          severity: 'medium',
          category: 'logic',
          file: context.filePath,
          startLine: i + 1,
          endLine: endLine + 1,
          message: t(
            'Empty catch block silently swallows errors. This is a common AI hallucination pattern.',
            '空的 catch 块静默吞掉了错误。这是常见的 AI 幻觉模式。',
          ),
          suggestion: t(
            'Add error handling logic, or remove the try-catch if the operation cannot fail.',
            '添加错误处理逻辑，或在操作不会抛错时移除 try-catch。',
          ),
        });
        continue;
      }

      // Pattern 2: Just re-throws the same error without modification
      if (catchVarName && meaningful.length === 1) {
        const onlyLine = meaningful[0].trim();
        if (
          onlyLine === `throw ${catchVarName};` ||
          onlyLine === `throw ${catchVarName}`
        ) {
          issues.push({
            ruleId: 'logic/empty-catch',
            severity: 'medium',
            category: 'logic',
            file: context.filePath,
            startLine: i + 1,
            endLine: endLine + 1,
            message: t(
              `Catch block only re-throws the original error "${catchVarName}" without modification. The try-catch is pointless.`,
              `catch 块仅原样重新抛出错误 "${catchVarName}"，没有任何修改。try-catch 毫无意义。`,
            ),
            suggestion: t(
              'Remove the try-catch block entirely, or wrap the error with additional context.',
              '完全移除 try-catch 块，或在重新抛出时添加额外的上下文信息。',
            ),
          });
        }
      }
    }

    return issues;
  },
};

interface CatchBody {
  bodyLines: string[];
  endLine: number;
}

function extractCatchBody(lines: string[], catchLineIndex: number): CatchBody | null {
  // Find the 'catch' keyword position to skip the preceding '}' from the try block
  const catchLine = lines[catchLineIndex];
  const catchIdx = catchLine.indexOf('catch');
  if (catchIdx === -1) return null;

  let braceCount = 0;
  let started = false;
  let bodyStart = -1;

  for (let i = catchLineIndex; i < lines.length; i++) {
    const line = lines[i];
    const startJ = i === catchLineIndex ? catchIdx : 0;

    for (let j = startJ; j < line.length; j++) {
      const ch = line[j];
      if (ch === '{') {
        braceCount++;
        if (!started) {
          started = true;
          bodyStart = i;
        }
      } else if (ch === '}') {
        braceCount--;
        if (started && braceCount === 0) {
          return {
            bodyLines: lines.slice(bodyStart + 1, i),
            endLine: i,
          };
        }
      }
    }
  }

  return null;
}
