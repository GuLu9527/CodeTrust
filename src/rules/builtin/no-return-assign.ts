import { Issue } from '../../types/index.js';
import { Rule, RuleContext } from '../types.js';
import { t } from '../../i18n/index.js';
import { parseCode, AST_NODE_TYPES } from '../../parsers/ast.js';
import type { TSESTree } from '../../parsers/ast.js';
import { walkAST } from '../../parsers/walk.js';

/**
 * Detects assignment expressions inside return statements.
 * AI-generated code sometimes confuses `=` with `===` in return statements,
 * e.g., `return x = 5` instead of `return x === 5`.
 */
export const noReturnAssignRule: Rule = {
  id: 'logic/no-return-assign',
  category: 'logic',
  severity: 'medium',
  title: 'Assignment in return statement',
  description:
    'AI-generated code sometimes uses assignment (=) instead of comparison (===) in return statements.',

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
      if (node.type !== AST_NODE_TYPES.ReturnStatement) return;

      const returnStmt = node as TSESTree.ReturnStatement;
      if (!returnStmt.argument) return;

      // Check if the return argument is an assignment expression
      if (returnStmt.argument.type === AST_NODE_TYPES.AssignmentExpression) {
        const assignExpr = returnStmt.argument as TSESTree.AssignmentExpression;
        // Only flag simple = assignments, not +=, -=, etc.
        if (assignExpr.operator !== '=') return;

        const line = node.loc?.start.line ?? 0;
        if (line === 0) return;

        issues.push({
          ruleId: 'logic/no-return-assign',
          severity: 'medium',
          category: 'logic',
          file: context.filePath,
          startLine: line,
          endLine: line,
          message: t(
            `Assignment in return statement — did you mean to use === instead of =?`,
            `return 语句中使用了赋值 — 是否应该使用 === 而非 =？`,
          ),
          suggestion: t(
            `If comparison was intended, use === instead of =. If assignment is intentional, extract it to a separate line.`,
            `如果意图是比较，请使用 === 代替 =。如果确实需要赋值，请提取到单独的行。`,
          ),
        });
      }
    });

    return issues;
  },
};
