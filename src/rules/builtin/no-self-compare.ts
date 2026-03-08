import { Issue } from '../../types/index.js';
import { Rule, RuleContext } from '../types.js';
import { t } from '../../i18n/index.js';
import { parseCode, AST_NODE_TYPES } from '../../parsers/ast.js';
import type { TSESTree } from '../../parsers/ast.js';
import { walkAST } from '../../parsers/walk.js';

/**
 * Detects self-comparison expressions like `x === x` or `x !== x`.
 * AI-generated code sometimes produces self-comparisons that are always
 * true (===) or always false (!==). The only valid use case is NaN checking,
 * which should use Number.isNaN() instead.
 */
export const noSelfCompareRule: Rule = {
  id: 'logic/no-self-compare',
  category: 'logic',
  severity: 'medium',
  title: 'Self-comparison',
  description:
    'Self-comparison (x === x) is always true (or always false for !==). Use Number.isNaN() for NaN checks.',

  check(context: RuleContext): Issue[] {
    const issues: Issue[] = [];

    let ast: TSESTree.Program;
    try {
      const parsed = parseCode(context.fileContent, context.filePath);
      ast = parsed.ast;
    } catch {
      return issues;
    }

    walkAST(ast, (node): void => {
      if (node.type !== AST_NODE_TYPES.BinaryExpression) return;

      const binExpr = node as TSESTree.BinaryExpression;
      const op = binExpr.operator;

      // Only check equality/inequality operators
      if (!['===', '!==', '==', '!='].includes(op)) return;

      // Compare the source text of left and right operands
      const left = serializeNode(binExpr.left);
      const right = serializeNode(binExpr.right);

      if (left === null || right === null || left !== right) return;

      const line = node.loc?.start.line ?? 0;
      if (line === 0) return;

      issues.push({
        ruleId: 'logic/no-self-compare',
        severity: 'medium',
        category: 'logic',
        file: context.filePath,
        startLine: line,
        endLine: line,
        message: t(
          `Self-comparison "${left} ${op} ${right}" is always ${op.includes('!') ? 'false' : 'true'}.`,
          `自比较 "${left} ${op} ${right}" 始终为 ${op.includes('!') ? 'false' : 'true'}。`,
        ),
        suggestion: t(
          `If checking for NaN, use Number.isNaN(${left}) instead.`,
          `如需检查 NaN，请使用 Number.isNaN(${left})。`,
        ),
      });
    });

    return issues;
  },
};

/**
 * Serialize a simple AST node to a string for comparison.
 * Returns null for complex expressions to avoid false positives.
 */
function serializeNode(node: TSESTree.Node): string | null {
  if (node.type === AST_NODE_TYPES.Identifier) {
    return node.name;
  }
  if (node.type === AST_NODE_TYPES.MemberExpression && !node.computed) {
    const obj = serializeNode(node.object);
    const prop = (node.property as TSESTree.Identifier).name;
    if (obj && prop) return `${obj}.${prop}`;
  }
  return null;
}
