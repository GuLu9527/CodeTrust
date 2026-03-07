import { Issue } from '../../types/index.js';
import { Rule, RuleContext } from '../types.js';
import { t } from '../../i18n/index.js';
import { parseCode, AST_NODE_TYPES } from '../../parsers/ast.js';
import type { TSESTree } from '../../parsers/ast.js';
import { walkAST } from '../../parsers/walk.js';

/**
 * Detects calls to async functions or Promise-returning functions
 * inside async functions where the `await` keyword is missing.
 * AI often forgets to add `await`, leading to unhandled promises
 * and subtle race-condition bugs.
 */
export const missingAwaitRule: Rule = {
  id: 'logic/missing-await',
  category: 'logic',
  severity: 'medium',
  title: 'Missing await on async call',
  description:
    'AI-generated code often omits `await` when calling async functions, leading to unhandled promises and race conditions.',

  check(context: RuleContext): Issue[] {
    const issues: Issue[] = [];

    let ast: TSESTree.Program;
    try {
      const parsed = parseCode(context.fileContent, context.filePath);
      ast = parsed.ast;
    } catch {
      return issues;
    }

    // Step 1: Collect names of async functions declared in this file
    const asyncFuncNames = new Set<string>();
    collectAsyncFunctionNames(ast, asyncFuncNames);

    // Step 2: Walk async functions and find un-awaited calls to known async functions
    walkAST(ast, (node) => {
      if (!isAsyncFunction(node)) return;

      const body = getFunctionBody(node);
      if (!body) return;

      walkAST(body, (inner, parent) => {
        // Skip nested async functions — they have their own scope
        if (inner !== body && isAsyncFunction(inner)) return false;

        // Look for call expressions that are NOT awaited
        if (inner.type !== AST_NODE_TYPES.CallExpression) return;

        // If the parent is an AwaitExpression, it's already awaited
        if (parent?.type === AST_NODE_TYPES.AwaitExpression) return;

        // If it's part of a return statement, it's okay (returning a promise)
        if (parent?.type === AST_NODE_TYPES.ReturnStatement) return;

        // If it's inside .then()/.catch(), skip
        if (isInsidePromiseChain(inner, parent ?? null)) return;

        // If assigned to a variable, skip (might be awaited later)
        if (parent?.type === AST_NODE_TYPES.VariableDeclarator) return;
        if (parent?.type === AST_NODE_TYPES.AssignmentExpression) return;

        // If passed as argument, skip (e.g., Promise.all([...]))
        if (parent?.type === AST_NODE_TYPES.ArrayExpression) return;
        if (parent?.type === AST_NODE_TYPES.CallExpression && parent !== inner) return;

        const callName = getCallName(inner);
        if (!callName) return;

        // Only report if we know the function is async
        if (!asyncFuncNames.has(callName)) return;

        issues.push({
          ruleId: 'logic/missing-await',
          severity: 'medium',
          category: 'logic',
          file: context.filePath,
          startLine: inner.loc?.start.line ?? 0,
          endLine: inner.loc?.end.line ?? 0,
          message: t(
            `Call to async function "${callName}" is missing "await".`,
            `调用异步函数 "${callName}" 时缺少 "await"。`,
          ),
          suggestion: t(
            `Add "await" before the call: await ${callName}(...)`,
            `在调用前添加 "await"：await ${callName}(...)`,
          ),
        });
      });
    });

    return issues;
  },
};

function collectAsyncFunctionNames(
  ast: TSESTree.Program,
  names: Set<string>,
): void {
  walkAST(ast, (node) => {
    if (
      node.type === AST_NODE_TYPES.FunctionDeclaration &&
      node.async &&
      node.id
    ) {
      names.add(node.id.name);
    }

    // const foo = async () => { ... }
    // const foo = async function() { ... }
    if (
      node.type === AST_NODE_TYPES.VariableDeclarator &&
      node.id.type === AST_NODE_TYPES.Identifier &&
      node.init &&
      (node.init.type === AST_NODE_TYPES.ArrowFunctionExpression ||
        node.init.type === AST_NODE_TYPES.FunctionExpression) &&
      node.init.async
    ) {
      names.add(node.id.name);
    }

    // Method definitions: async foo() { ... }
    if (
      node.type === AST_NODE_TYPES.MethodDefinition &&
      node.key.type === AST_NODE_TYPES.Identifier &&
      node.value.async
    ) {
      names.add(node.key.name);
    }
  });
}

function isAsyncFunction(node: TSESTree.Node): boolean {
  return (
    (node.type === AST_NODE_TYPES.FunctionDeclaration && node.async) ||
    (node.type === AST_NODE_TYPES.FunctionExpression && node.async) ||
    (node.type === AST_NODE_TYPES.ArrowFunctionExpression && node.async) ||
    (node.type === AST_NODE_TYPES.MethodDefinition && node.value.async)
  );
}

function getFunctionBody(node: TSESTree.Node): TSESTree.Node | null {
  if (
    node.type === AST_NODE_TYPES.FunctionDeclaration ||
    node.type === AST_NODE_TYPES.FunctionExpression ||
    node.type === AST_NODE_TYPES.ArrowFunctionExpression
  ) {
    return node.body;
  }
  if (node.type === AST_NODE_TYPES.MethodDefinition) {
    return node.value.body;
  }
  return null;
}

function getCallName(node: TSESTree.CallExpression): string | null {
  const callee = node.callee;
  if (callee.type === AST_NODE_TYPES.Identifier) {
    return callee.name;
  }
  // this.foo() or obj.foo()
  if (
    callee.type === AST_NODE_TYPES.MemberExpression &&
    callee.property.type === AST_NODE_TYPES.Identifier
  ) {
    return callee.property.name;
  }
  return null;
}

function isInsidePromiseChain(
  _node: TSESTree.Node,
  parent: TSESTree.Node | null,
): boolean {
  if (!parent) return false;
  if (
    parent.type === AST_NODE_TYPES.MemberExpression &&
    parent.property.type === AST_NODE_TYPES.Identifier &&
    (parent.property.name === 'then' ||
      parent.property.name === 'catch' ||
      parent.property.name === 'finally')
  ) {
    return true;
  }
  return false;
}
