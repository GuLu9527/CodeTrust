import { Issue } from '../../types/index.js';
import { Rule, RuleContext } from '../types.js';
import { t } from '../../i18n/index.js';
import { parseCode, AST_NODE_TYPES } from '../../parsers/ast.js';
import type { TSESTree } from '../../parsers/ast.js';
import { walkAST } from '../../parsers/walk.js';

/**
 * Detects async functions that never use `await` inside their body.
 * AI-generated code frequently marks functions as `async` without
 * actually needing asynchronous behavior, adding unnecessary Promise
 * wrapping overhead and confusion.
 */
export const noAsyncWithoutAwaitRule: Rule = {
  id: 'logic/no-async-without-await',
  category: 'logic',
  severity: 'low',
  title: 'Async function without await',
  description:
    'AI-generated code often marks functions as async without using await, adding unnecessary Promise wrapping.',

  check(context: RuleContext): Issue[] {
    const issues: Issue[] = [];

    let ast: TSESTree.Program;
    try {
      const parsed = parseCode(context.fileContent, context.filePath);
      ast = parsed.ast;
    } catch {
      return issues;
    }

    walkAST(ast, (node): boolean | void => {
      const isAsyncFn =
        (node.type === AST_NODE_TYPES.FunctionDeclaration ||
          node.type === AST_NODE_TYPES.FunctionExpression ||
          node.type === AST_NODE_TYPES.ArrowFunctionExpression) &&
        (node as TSESTree.FunctionDeclaration).async;

      if (!isAsyncFn) return;

      // Check if the function body contains any await expression
      const fnNode = node as TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression;
      const body = fnNode.body;
      if (!body) return;

      let hasAwait = false;

      walkAST(body as TSESTree.Node, (innerNode): boolean | void => {
        // Stop searching into nested async functions — their awaits don't count
        if (
          innerNode !== body &&
          (innerNode.type === AST_NODE_TYPES.FunctionDeclaration ||
            innerNode.type === AST_NODE_TYPES.FunctionExpression ||
            innerNode.type === AST_NODE_TYPES.ArrowFunctionExpression) &&
          (innerNode as TSESTree.FunctionDeclaration).async
        ) {
          return false; // skip children
        }

        if (innerNode.type === AST_NODE_TYPES.AwaitExpression) {
          hasAwait = true;
          return false; // stop searching
        }

        // Also check for `for await` loops
        if (
          innerNode.type === AST_NODE_TYPES.ForOfStatement &&
          (innerNode as TSESTree.ForOfStatement).await
        ) {
          hasAwait = true;
          return false;
        }

        return;
      });

      if (hasAwait) return false; // skip children of this function

      const line = node.loc?.start.line ?? 0;
      if (line === 0) return;

      // Get function name for better error message
      let fnName = '<anonymous>';
      if (fnNode.type === AST_NODE_TYPES.FunctionDeclaration && fnNode.id) {
        fnName = fnNode.id.name;
      }

      issues.push({
        ruleId: 'logic/no-async-without-await',
        severity: 'low',
        category: 'logic',
        file: context.filePath,
        startLine: line,
        endLine: node.loc?.end.line ?? line,
        message: t(
          `Async function "${fnName}" does not use await.`,
          `异步函数 "${fnName}" 内部没有使用 await。`,
        ),
        suggestion: t(
          `Remove the async keyword if this function doesn't need to be asynchronous.`,
          `如果此函数不需要异步行为，请移除 async 关键字。`,
        ),
      });

      return false; // skip children
    });

    return issues;
  },
};
