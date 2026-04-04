import { parse, AST_NODE_TYPES } from '@typescript-eslint/typescript-estree';
import type { TSESTree } from '@typescript-eslint/typescript-estree';
import { walkAST } from './walk.js';

export interface ParsedAST {
  ast: TSESTree.Program;
  filePath: string;
}

const _astCache = new Map<string, ParsedAST>();

export function parseCode(code: string, filePath: string): ParsedAST {
  const cacheKey = `${filePath}:${code.length}:${simpleHash(code)}`;
  const cached = _astCache.get(cacheKey);
  if (cached) return cached;

  const ast = parse(code, {
    loc: true,
    range: true,
    comment: true,
    jsx: filePath.endsWith('.tsx') || filePath.endsWith('.jsx'),
    filePath,
  });

  const result = { ast, filePath };
  _astCache.set(cacheKey, result);

  // 限制缓存大小
  if (_astCache.size > 50) {
    const firstKey = _astCache.keys().next().value;
    if (firstKey) _astCache.delete(firstKey);
  }

  return result;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

export interface FunctionInfo {
  name: string;
  startLine: number;
  endLine: number;
  lineCount: number;
  paramCount: number;
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  maxNestingDepth: number;
}

export function extractFunctions(parsed: ParsedAST): FunctionInfo[] {
  const functions: FunctionInfo[] = [];
  visitNode(parsed.ast, functions);
  return functions;
}

function visitNode(root: TSESTree.Node, functions: FunctionInfo[]): void {
  const methodBodies = new WeakSet<TSESTree.Node>();

  walkAST(root, (node, parent) => {
    // 跳过 MethodDefinition 内部的 FunctionExpression（避免双重计数）
    if (node.type === AST_NODE_TYPES.FunctionExpression && methodBodies.has(node)) {
      return false;
    }

    if (
      node.type === AST_NODE_TYPES.FunctionDeclaration ||
      node.type === AST_NODE_TYPES.FunctionExpression ||
      node.type === AST_NODE_TYPES.ArrowFunctionExpression ||
      node.type === AST_NODE_TYPES.MethodDefinition
    ) {
      const info = analyzeFunctionNode(node, parent);
      if (info) functions.push(info);
      if (node.type === AST_NODE_TYPES.MethodDefinition) {
        methodBodies.add(node.value);
      }
    }
    return;
  });
}

function analyzeFunctionNode(node: TSESTree.Node, parent?: TSESTree.Node): FunctionInfo | null {
  let name = '<anonymous>';
  let params: TSESTree.Parameter[] = [];
  let body: TSESTree.Node | null = null;

  if (node.type === AST_NODE_TYPES.FunctionDeclaration) {
    name = node.id?.name ?? '<anonymous>';
    params = node.params;
    body = node.body;
  } else if (node.type === AST_NODE_TYPES.FunctionExpression) {
    name = node.id?.name ?? '<anonymous>';
    params = node.params;
    body = node.body;
  } else if (node.type === AST_NODE_TYPES.ArrowFunctionExpression) {
    // Infer name from parent: const myFunc = () => {}
    if (
      parent?.type === AST_NODE_TYPES.VariableDeclarator &&
      parent.id.type === AST_NODE_TYPES.Identifier
    ) {
      name = parent.id.name;
    } else {
      name = '<arrow>';
    }
    params = node.params;
    body = node.body;
  } else if (node.type === AST_NODE_TYPES.MethodDefinition) {
    if (node.key.type === AST_NODE_TYPES.Identifier) {
      name = node.key.name;
    }
    const value = node.value;
    params = value.params;
    body = value.body;
  }

  if (!body || !node.loc) return null;

  const startLine = node.loc.start.line;
  const endLine = node.loc.end.line;

  return {
    name,
    startLine,
    endLine,
    lineCount: endLine - startLine + 1,
    paramCount: params.length,
    cyclomaticComplexity: body ? calculateCyclomaticComplexity(body) : 1,
    cognitiveComplexity: body ? calculateCognitiveComplexity(body) : 0,
    maxNestingDepth: body ? calculateMaxNestingDepth(body) : 0,
  };
}

// 圈复杂度：每个分支点 +1
function calculateCyclomaticComplexity(root: TSESTree.Node): number {
  let complexity = 1;

  walkAST(root, (n) => {
    // Skip nested function bodies - they have their own metrics
    if (
      n.type === AST_NODE_TYPES.FunctionDeclaration ||
      n.type === AST_NODE_TYPES.FunctionExpression ||
      n.type === AST_NODE_TYPES.ArrowFunctionExpression ||
      n.type === AST_NODE_TYPES.MethodDefinition
    ) {
      return false; // Don't traverse into nested functions
    }

    switch (n.type) {
      case AST_NODE_TYPES.IfStatement:
      case AST_NODE_TYPES.ConditionalExpression:
      case AST_NODE_TYPES.ForStatement:
      case AST_NODE_TYPES.ForInStatement:
      case AST_NODE_TYPES.ForOfStatement:
      case AST_NODE_TYPES.WhileStatement:
      case AST_NODE_TYPES.DoWhileStatement:
      case AST_NODE_TYPES.CatchClause:
        complexity++;
        break;
      case AST_NODE_TYPES.SwitchCase:
        if (n.test) complexity++;
        break;
      case AST_NODE_TYPES.LogicalExpression:
        if (n.operator === '&&' || n.operator === '||' || n.operator === '??') {
          complexity++;
        }
        break;
    }
  });

  return complexity;
}

// 认知复杂度：嵌套越深越难理解
function calculateCognitiveComplexity(root: TSESTree.Node): number {
  let complexity = 0;
  const depthMap = new WeakMap<TSESTree.Node, number>();
  depthMap.set(root, 0);

  walkAST(root, (n, parent) => {
    // Skip nested function bodies - they have their own metrics
    if (
      n.type === AST_NODE_TYPES.FunctionDeclaration ||
      n.type === AST_NODE_TYPES.FunctionExpression ||
      n.type === AST_NODE_TYPES.ArrowFunctionExpression ||
      n.type === AST_NODE_TYPES.MethodDefinition
    ) {
      return false; // Don't traverse into nested functions
    }

    const parentDepth = parent ? (depthMap.get(parent) ?? 0) : 0;
    const isNesting = isNestingNode(n);
    const depth = isNesting ? parentDepth + 1 : parentDepth;
    depthMap.set(n, depth);

    if (isNesting) {
      complexity += 1 + parentDepth;
    }

    if (
      n.type === AST_NODE_TYPES.LogicalExpression &&
      (n.operator === '&&' || n.operator === '||' || n.operator === '??')
    ) {
      complexity += 1;
    }
  });

  return complexity;
}

// 最大嵌套深度
function calculateMaxNestingDepth(root: TSESTree.Node): number {
  let maxDepth = 0;
  const depthMap = new WeakMap<TSESTree.Node, number>();
  depthMap.set(root, 0);

  walkAST(root, (n, parent) => {
    // Skip nested function bodies - they have their own metrics
    if (
      n.type === AST_NODE_TYPES.FunctionDeclaration ||
      n.type === AST_NODE_TYPES.FunctionExpression ||
      n.type === AST_NODE_TYPES.ArrowFunctionExpression ||
      n.type === AST_NODE_TYPES.MethodDefinition
    ) {
      return false; // Don't traverse into nested functions
    }

    const parentDepth = parent ? (depthMap.get(parent) ?? 0) : 0;
    const isNesting =
      n.type === AST_NODE_TYPES.IfStatement ||
      n.type === AST_NODE_TYPES.ForStatement ||
      n.type === AST_NODE_TYPES.ForInStatement ||
      n.type === AST_NODE_TYPES.ForOfStatement ||
      n.type === AST_NODE_TYPES.WhileStatement ||
      n.type === AST_NODE_TYPES.DoWhileStatement ||
      n.type === AST_NODE_TYPES.SwitchStatement ||
      n.type === AST_NODE_TYPES.TryStatement;

    const currentDepth = isNesting ? parentDepth + 1 : parentDepth;
    depthMap.set(n, currentDepth);
    if (currentDepth > maxDepth) maxDepth = currentDepth;
  });

  return maxDepth;
}

function isNestingNode(n: TSESTree.Node): boolean {
  return (
    n.type === AST_NODE_TYPES.IfStatement ||
    n.type === AST_NODE_TYPES.ForStatement ||
    n.type === AST_NODE_TYPES.ForInStatement ||
    n.type === AST_NODE_TYPES.ForOfStatement ||
    n.type === AST_NODE_TYPES.WhileStatement ||
    n.type === AST_NODE_TYPES.DoWhileStatement ||
    n.type === AST_NODE_TYPES.SwitchStatement ||
    n.type === AST_NODE_TYPES.CatchClause ||
    n.type === AST_NODE_TYPES.ConditionalExpression
  );
}

export { AST_NODE_TYPES };
export type { TSESTree };
