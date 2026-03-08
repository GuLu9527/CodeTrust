import { Issue } from '../../types/index.js';
import { Rule, RuleContext } from '../types.js';
import { t } from '../../i18n/index.js';
import { parseCode, AST_NODE_TYPES } from '../../parsers/ast.js';
import type { TSESTree } from '../../parsers/ast.js';
import { walkAST } from '../../parsers/walk.js';

/**
 * Detects nested ternary expressions.
 * AI-generated code frequently produces deeply nested ternary operators
 * that are very hard to read and maintain.
 */
export const nestedTernaryRule: Rule = {
  id: 'logic/no-nested-ternary',
  category: 'logic',
  severity: 'medium',
  title: 'Nested ternary expression',
  description:
    'AI-generated code often produces nested ternary expressions that are hard to read.',

  check(context: RuleContext): Issue[] {
    const issues: Issue[] = [];

    let ast: TSESTree.Program;
    try {
      const parsed = parseCode(context.fileContent, context.filePath);
      ast = parsed.ast;
    } catch {
      return issues;
    }

    // Track reported lines to avoid duplicate reports
    const reportedLines = new Set<number>();

    walkAST(ast, (node): void => {
      if (node.type !== AST_NODE_TYPES.ConditionalExpression) return;

      // Check if any child (consequent or alternate) is also a ternary
      const conditional = node as TSESTree.ConditionalExpression;
      const hasNestedTernary =
        conditional.consequent.type === AST_NODE_TYPES.ConditionalExpression ||
        conditional.alternate.type === AST_NODE_TYPES.ConditionalExpression;

      if (!hasNestedTernary) return;

      const line = node.loc?.start.line ?? 0;
      if (line === 0 || reportedLines.has(line)) return;
      reportedLines.add(line);

      // Count nesting depth
      let depth = 1;
      let current: TSESTree.Node = node;
      while (current.type === AST_NODE_TYPES.ConditionalExpression) {
        const cond = current as TSESTree.ConditionalExpression;
        if (cond.consequent.type === AST_NODE_TYPES.ConditionalExpression) {
          depth++;
          current = cond.consequent;
        } else if (cond.alternate.type === AST_NODE_TYPES.ConditionalExpression) {
          depth++;
          current = cond.alternate;
        } else {
          break;
        }
      }

      const endLine = node.loc?.end.line ?? line;

      issues.push({
        ruleId: 'logic/no-nested-ternary',
        severity: 'medium',
        category: 'logic',
        file: context.filePath,
        startLine: line,
        endLine,
        message: t(
          `Nested ternary expression (depth: ${depth}) reduces readability.`,
          `嵌套三元表达式（深度: ${depth}）降低了可读性。`,
        ),
        suggestion: t(
          `Refactor into if-else statements or use a lookup object/map.`,
          `重构为 if-else 语句或使用查找对象/映射。`,
        ),
      });
    });

    return issues;
  },
};
