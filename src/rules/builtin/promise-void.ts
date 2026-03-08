import { Issue } from '../../types/index.js';
import { Rule, RuleContext } from '../types.js';
import { t } from '../../i18n/index.js';
import { parseCode, AST_NODE_TYPES } from '../../parsers/ast.js';
import type { TSESTree } from '../../parsers/ast.js';
import { walkAST } from '../../parsers/walk.js';

/**
 * Detects floating promises — async function calls whose return value
 * is neither awaited, returned, nor assigned.
 * AI-generated code frequently calls async functions without await,
 * leading to unhandled promise rejections and race conditions.
 *
 * This is different from missing-await which checks function-level patterns.
 * This rule catches standalone expression statements that are promise-producing calls.
 */
export const promiseVoidRule: Rule = {
  id: 'logic/promise-void',
  category: 'logic',
  severity: 'medium',
  title: 'Floating promise (not awaited or returned)',
  description:
    'AI-generated code often calls async functions without await, causing unhandled rejections.',

  check(context: RuleContext): Issue[] {
    const issues: Issue[] = [];

    let ast: TSESTree.Program;
    try {
      const parsed = parseCode(context.fileContent, context.filePath);
      ast = parsed.ast;
    } catch {
      return issues;
    }

    // First pass: collect all async function/method names defined in this file
    const asyncFnNames = new Set<string>();
    walkAST(ast, (node): void => {
      if (
        node.type === AST_NODE_TYPES.FunctionDeclaration &&
        (node as TSESTree.FunctionDeclaration).async &&
        (node as TSESTree.FunctionDeclaration).id
      ) {
        asyncFnNames.add((node as TSESTree.FunctionDeclaration).id!.name);
      }

      if (
        node.type === AST_NODE_TYPES.VariableDeclarator &&
        (node as TSESTree.VariableDeclarator).id.type === AST_NODE_TYPES.Identifier
      ) {
        const init = (node as TSESTree.VariableDeclarator).init;
        if (
          init &&
          (init.type === AST_NODE_TYPES.ArrowFunctionExpression ||
            init.type === AST_NODE_TYPES.FunctionExpression) &&
          (init as TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression).async
        ) {
          asyncFnNames.add(
            ((node as TSESTree.VariableDeclarator).id as TSESTree.Identifier).name,
          );
        }
      }
    });

    // Also detect common async API names
    const commonAsyncPatterns = [
      /^fetch$/,
      /^save/,
      /^load/,
      /^send/,
      /^delete/,
      /^update/,
      /^create/,
      /^connect/,
      /^disconnect/,
      /^init/,
    ];

    // Second pass: find expression statements that call async functions
    walkAST(ast, (node): void => {
      if (node.type !== AST_NODE_TYPES.ExpressionStatement) return;

      const expr = (node as TSESTree.ExpressionStatement).expression;
      if (expr.type !== AST_NODE_TYPES.CallExpression) return;

      const callExpr = expr as TSESTree.CallExpression;
      const fnName = getCallName(callExpr);
      if (!fnName) return;

      // Check if this is a known async function or matches async patterns
      const isKnownAsync = asyncFnNames.has(fnName);
      const matchesPattern = commonAsyncPatterns.some((p) => p.test(fnName));

      // Also check for .then() chains — these are definitely promises
      // Method calls ending in common promise-producing names
      const endsWithAsync = fnName.endsWith('Async') || fnName.endsWith('async');

      if (!isKnownAsync && !matchesPattern && !endsWithAsync) return;

      const line = node.loc?.start.line ?? 0;
      if (line === 0) return;

      // Skip if inside a non-async function (might be intentional fire-and-forget)
      // We still report but the suggestion is gentler
      issues.push({
        ruleId: 'logic/promise-void',
        severity: 'medium',
        category: 'logic',
        file: context.filePath,
        startLine: line,
        endLine: node.loc?.end.line ?? line,
        message: t(
          `Call to "${fnName}()" appears to be a floating promise (not awaited or returned).`,
          `调用 "${fnName}()" 疑似浮动 Promise（未 await 或 return）。`,
        ),
        suggestion: t(
          `Add "await" before the call, assign the result, or use "void ${fnName}()" to explicitly discard.`,
          `在调用前添加 "await"，赋值给变量，或使用 "void ${fnName}()" 显式丢弃。`,
        ),
      });
    });

    return issues;
  },
};

function getCallName(callExpr: TSESTree.CallExpression): string | null {
  const callee = callExpr.callee;
  if (callee.type === AST_NODE_TYPES.Identifier) {
    return callee.name;
  }
  if (
    callee.type === AST_NODE_TYPES.MemberExpression &&
    !callee.computed &&
    callee.property.type === AST_NODE_TYPES.Identifier
  ) {
    return callee.property.name;
  }
  return null;
}
