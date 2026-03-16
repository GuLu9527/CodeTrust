import { Issue } from '../../types/index.js';
import { Rule, RuleContext } from '../types.js';
import { t } from '../../i18n/index.js';
import { parseCode, AST_NODE_TYPES } from '../../parsers/ast.js';
import type { TSESTree } from '../../parsers/ast.js';
import { walkAST } from '../../parsers/walk.js';

/**
 * Detects reassignment of function parameters.
 * AI-generated code often reassigns parameters directly instead of
 * using local variables, which creates confusing side-effect patterns
 * and makes the original argument value unrecoverable.
 */
export const noReassignParamRule: Rule = {
  id: 'logic/no-reassign-param',
  category: 'logic',
  severity: 'low',
  title: 'Parameter reassignment',
  description:
    'AI-generated code often reassigns function parameters, creating confusing side-effect patterns.',

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
      // Find function-like nodes
      const isFn =
        node.type === AST_NODE_TYPES.FunctionDeclaration ||
        node.type === AST_NODE_TYPES.FunctionExpression ||
        node.type === AST_NODE_TYPES.ArrowFunctionExpression ||
        node.type === AST_NODE_TYPES.MethodDefinition;

      if (!isFn) return;

      // Get parameters
      let params: TSESTree.Parameter[] = [];
      if (node.type === AST_NODE_TYPES.MethodDefinition) {
        const method = node as TSESTree.MethodDefinition;
        if (method.value && 'params' in method.value) {
          params = (method.value as TSESTree.FunctionExpression).params;
        }
      } else {
        params = (node as TSESTree.FunctionDeclaration).params;
      }

      // Collect parameter names (only simple identifiers)
      const paramNames = new Set<string>();
      for (const param of params) {
        if (param.type === AST_NODE_TYPES.Identifier) {
          paramNames.add(param.name);
        }
        // Handle destructured params with defaults: (x = 5)
        if (param.type === AST_NODE_TYPES.AssignmentPattern) {
          const left = param.left;
          if (left.type === AST_NODE_TYPES.Identifier) {
            paramNames.add(left.name);
          }
        }
      }

      if (paramNames.size === 0) return;

      // Get function body
      const body: TSESTree.Node | null =
        node.type === AST_NODE_TYPES.MethodDefinition
          ? (node as TSESTree.MethodDefinition).value
          : node;
      if (!body || !('body' in body)) return;

      // Walk the function body to find assignments to parameters
      const fnBody = (body as { body: TSESTree.Node }).body;
      if (!fnBody) return;

      const reportedParams = new Set<string>();

      walkAST(fnBody as TSESTree.Node, (innerNode): void => {
        if (innerNode.type !== AST_NODE_TYPES.AssignmentExpression) return;

        const assignExpr = innerNode as TSESTree.AssignmentExpression;
        if (assignExpr.left.type !== AST_NODE_TYPES.Identifier) return;

        const name = assignExpr.left.name;
        if (!paramNames.has(name) || reportedParams.has(name)) return;

        reportedParams.add(name);
        const line = innerNode.loc?.start.line ?? 0;
        if (line === 0) return;

        issues.push({
          ruleId: 'logic/no-reassign-param',
          severity: 'low',
          category: 'logic',
          file: context.filePath,
          startLine: line,
          endLine: line,
          message: t(
            `Parameter "${name}" is reassigned. This can cause confusion and lose the original value.`,
            `参数 "${name}" 被重新赋值。这可能造成混淆并丢失原始值。`,
          ),
          suggestion: t(
            `Use a local variable instead: const local${name.charAt(0).toUpperCase() + name.slice(1)} = ...`,
            `使用局部变量代替：const local${name.charAt(0).toUpperCase() + name.slice(1)} = ...`,
          ),
        });
      });
    });

    return issues;
  },
};
