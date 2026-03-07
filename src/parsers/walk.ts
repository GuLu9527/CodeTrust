import type { TSESTree } from '@typescript-eslint/typescript-estree';

/**
 * Generic AST walker — eliminates the repeated Object.keys + cast pattern
 * used across multiple files.
 *
 * @param node    The root AST node to walk
 * @param visitor Called for every node; return `false` to skip children
 */
export type ASTVisitor = (node: TSESTree.Node, parent: TSESTree.Node | null) => boolean | void;

export function walkAST(
  node: TSESTree.Node,
  visitor: ASTVisitor,
  parent: TSESTree.Node | null = null,
): void {
  const result = visitor(node, parent);
  if (result === false) return; // skip children

  for (const key of Object.keys(node)) {
    if (key === 'parent') continue;
    const child = (node as unknown as Record<string, unknown>)[key];
    if (child && typeof child === 'object') {
      if (Array.isArray(child)) {
        for (const item of child) {
          if (isASTNode(item)) {
            walkAST(item, visitor, node);
          }
        }
      } else if (isASTNode(child)) {
        walkAST(child as TSESTree.Node, visitor, node);
      }
    }
  }
}


function isASTNode(value: unknown): value is TSESTree.Node {
  return (
    value !== null &&
    typeof value === 'object' &&
    'type' in (value as Record<string, unknown>)
  );
}
