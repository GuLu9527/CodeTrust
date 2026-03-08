import { Issue } from '../../types/index.js';
import { Rule, RuleContext } from '../types.js';
import { t } from '../../i18n/index.js';
import { parseCode, AST_NODE_TYPES } from '../../parsers/ast.js';
import type { TSESTree } from '../../parsers/ast.js';
import { walkAST } from '../../parsers/walk.js';

/**
 * Detects constructors that only call super() with the same parameters,
 * or empty constructors in classes that extend another class.
 * AI-generated code frequently produces these unnecessary constructors.
 */
export const noUselessConstructorRule: Rule = {
  id: 'logic/no-useless-constructor',
  category: 'logic',
  severity: 'low',
  title: 'Useless constructor',
  description:
    'AI-generated code often produces constructors that only call super() or are completely empty.',

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
      if (node.type !== AST_NODE_TYPES.ClassDeclaration && node.type !== AST_NODE_TYPES.ClassExpression) return;

      const classNode = node as TSESTree.ClassDeclaration | TSESTree.ClassExpression;
      const hasSuper = classNode.superClass !== null && classNode.superClass !== undefined;

      // Find constructor
      const constructor = classNode.body.body.find(
        (member) =>
          member.type === AST_NODE_TYPES.MethodDefinition &&
          member.kind === 'constructor',
      ) as TSESTree.MethodDefinition | undefined;

      if (!constructor) return;

      const ctorValue = constructor.value as TSESTree.FunctionExpression;
      if (!ctorValue.body) return;

      const bodyStatements = ctorValue.body.body;

      // Case 1: Empty constructor
      if (bodyStatements.length === 0) {
        const line = constructor.loc?.start.line ?? 0;
        if (line === 0) return;

        issues.push({
          ruleId: 'logic/no-useless-constructor',
          severity: 'low',
          category: 'logic',
          file: context.filePath,
          startLine: line,
          endLine: constructor.loc?.end.line ?? line,
          message: t(
            `Empty constructor is unnecessary.`,
            `空构造函数是不必要的。`,
          ),
          suggestion: t(
            `Remove the empty constructor — JavaScript provides a default one.`,
            `移除空构造函数 — JavaScript 会自动提供默认构造函数。`,
          ),
        });
        return;
      }

      // Case 2: Constructor with only super() call, passing same params
      if (hasSuper && bodyStatements.length === 1) {
        const stmt = bodyStatements[0];
        if (stmt.type !== AST_NODE_TYPES.ExpressionStatement) return;

        const expr = stmt.expression;
        if (expr.type !== AST_NODE_TYPES.CallExpression) return;
        if (expr.callee.type !== AST_NODE_TYPES.Super) return;

        // Check if super() args match constructor params
        const ctorParams = ctorValue.params;
        const superArgs = expr.arguments;

        if (ctorParams.length === superArgs.length) {
          let allMatch = true;
          for (let i = 0; i < ctorParams.length; i++) {
            const param = ctorParams[i];
            const arg = superArgs[i];

            // Simple identifier match
            if (
              param.type === AST_NODE_TYPES.Identifier &&
              arg.type === AST_NODE_TYPES.Identifier &&
              param.name === arg.name
            ) {
              continue;
            }

            // Handle TypeScript parameter properties (public x: number)
            if (
              param.type === AST_NODE_TYPES.TSParameterProperty &&
              (param as TSESTree.TSParameterProperty).parameter.type === AST_NODE_TYPES.Identifier
            ) {
              // Parameter properties DO something (create class fields), so this constructor is NOT useless
              allMatch = false;
              break;
            }

            allMatch = false;
            break;
          }

          if (allMatch) {
            const line = constructor.loc?.start.line ?? 0;
            if (line === 0) return;

            issues.push({
              ruleId: 'logic/no-useless-constructor',
              severity: 'low',
              category: 'logic',
              file: context.filePath,
              startLine: line,
              endLine: constructor.loc?.end.line ?? line,
              message: t(
                `Constructor only calls super() with the same arguments — it is unnecessary.`,
                `构造函数仅调用 super() 并传递相同参数 — 这是不必要的。`,
              ),
              suggestion: t(
                `Remove the constructor — JavaScript automatically calls super() with the same arguments.`,
                `移除构造函数 — JavaScript 会自动用相同参数调用 super()。`,
              ),
            });
          }
        }
      }
    });

    return issues;
  },
};
