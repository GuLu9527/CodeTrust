import { Issue } from '../../types/index.js';
import { Rule, RuleContext } from '../types.js';
import { parseCode, AST_NODE_TYPES } from '../../parsers/ast.js';
import { walkAST } from '../../parsers/walk.js';
import { t } from '../../i18n/index.js';

/**
 * Detects redundant else blocks after return/throw/continue/break.
 *
 * Pattern:
 *   if (condition) { return x; } else { doSomething(); }
 *   →
 *   if (condition) { return x; }
 *   doSomething();
 *
 * AI often generates this pattern instead of using early returns.
 */
export const redundantElseRule: Rule = {
  id: 'logic/redundant-else',
  category: 'logic',
  severity: 'low',
  title: 'Redundant else after return/throw',
  description:
    'AI-generated code often uses else blocks after if blocks that already return/throw. The else is unnecessary and adds nesting.',

  check(context: RuleContext): Issue[] {
    const issues: Issue[] = [];
    const parsed = parseCode(context.fileContent, context.filePath);
    if (!parsed) return issues;

    walkAST(parsed.ast, (node) => {
      if (
        node.type === AST_NODE_TYPES.IfStatement &&
        node.consequent &&
        node.alternate &&
        node.alternate.type !== AST_NODE_TYPES.IfStatement // Skip else-if
      ) {
        if (blockEndsWithExit(node.consequent)) {
          issues.push({
            ruleId: 'logic/redundant-else',
            severity: 'low',
            category: 'logic',
            file: context.filePath,
            startLine: node.loc?.start.line ?? 0,
            endLine: node.loc?.end.line ?? 0,
            message: t(
              'Unnecessary else — the if block already returns/throws. The else adds pointless nesting.',
              '不必要的 else — if 块已经 return/throw 了，else 增加了无意义的嵌套。',
            ),
            suggestion: t(
              'Remove the else wrapper and place its code after the if block (early return pattern).',
              '移除 else 包裹，将其代码放在 if 块之后（提前返回模式）。',
            ),
          });
        }
      }
      return;
    });

    return issues;
  },
};

function blockEndsWithExit(node: { type: string; body?: unknown }): boolean {
  // BlockStatement with last statement being return/throw
  if (node.type === AST_NODE_TYPES.BlockStatement) {
    if (!Array.isArray(node.body)) return false;
    const body = node.body as Array<{ type: string }>;
    if (body.length === 0) return false;
    const last = body[body.length - 1];
    return (
      last.type === AST_NODE_TYPES.ReturnStatement ||
      last.type === AST_NODE_TYPES.ThrowStatement
    );
  }
  // Single statement (no block)
  return (
    node.type === AST_NODE_TYPES.ReturnStatement ||
    node.type === AST_NODE_TYPES.ThrowStatement
  );
}
