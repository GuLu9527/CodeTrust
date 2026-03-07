import { Issue } from '../../types/index.js';
import { Rule, RuleContext } from '../types.js';
import { t } from '../../i18n/index.js';
import { parseCode, AST_NODE_TYPES } from '../../parsers/ast.js';
import type { TSESTree } from '../../parsers/ast.js';
import { walkAST } from '../../parsers/walk.js';

/**
 * Detects variables that are declared but never used.
 * AI-generated code often introduces variables that are assigned
 * but never referenced elsewhere.
 */
export const unusedVariablesRule: Rule = {
  id: 'logic/unused-variables',
  category: 'logic',
  severity: 'low',
  title: 'Unused variable detected',
  description:
    'AI-generated code sometimes declares variables that are never used, indicating incomplete or hallucinated logic.',

  check(context: RuleContext): Issue[] {
    const issues: Issue[] = [];

    let ast: TSESTree.Program;
    try {
      const parsed = parseCode(context.fileContent, context.filePath);
      ast = parsed.ast;
    } catch {
      return issues;
    }

    const declarations = new Map<string, { line: number; kind: string }>();
    const references = new Set<string>();

    collectDeclarationsAndReferences(ast, declarations, references);

    for (const [name, info] of declarations) {
      // 跳过以 _ 开头的变量（约定为有意忽略）
      if (name.startsWith('_')) continue;
      // 跳过导出的变量
      if (info.kind === 'export') continue;

      if (!references.has(name)) {
        issues.push({
          ruleId: 'logic/unused-variables',
          severity: 'low',
          category: 'logic',
          file: context.filePath,
          startLine: info.line,
          endLine: info.line,
          message: t(
            `Variable "${name}" is declared but never used.`,
            `变量 "${name}" 已声明但从未使用。`,
          ),
          suggestion: t(
            `Remove the unused variable "${name}" or prefix it with _ if intentionally unused.`,
            `移除未使用的变量 "${name}"，或用 _ 前缀标记为有意忽略。`,
          ),
        });
      }
    }

    return issues;
  },
};

function collectDeclarationsAndReferences(
  root: TSESTree.Node,
  declarations: Map<string, { line: number; kind: string }>,
  references: Set<string>,
): void {
  // 先收集所有 export 声明的变量名
  // AST 结构: ExportNamedDeclaration → VariableDeclaration → VariableDeclarator
  const exportedNames = new Set<string>();
  walkAST(root, (node) => {
    if (node.type === AST_NODE_TYPES.ExportNamedDeclaration) {
      walkAST(node, (inner) => {
        if (inner.type === AST_NODE_TYPES.VariableDeclarator && inner.id.type === AST_NODE_TYPES.Identifier) {
          exportedNames.add(inner.id.name);
        }
        if (inner.type === AST_NODE_TYPES.FunctionDeclaration && inner.id) {
          exportedNames.add(inner.id.name);
        }
      });
    }
  });

  walkAST(root, (node, parent) => {
    const parentType = parent?.type;

    if (node.type === AST_NODE_TYPES.VariableDeclarator) {
      if (node.id.type === AST_NODE_TYPES.Identifier) {
        declarations.set(node.id.name, {
          line: node.loc?.start.line ?? 0,
          kind: exportedNames.has(node.id.name) ? 'export' : 'local',
        });
      }
      // 遍历 init 中的引用（但不遍历 id）
      if (node.init) {
        walkAST(node.init, (n) => {
          if (n.type === AST_NODE_TYPES.Identifier) {
            references.add(n.name);
          }
        });
      }
      return false;
    }

    if (node.type === AST_NODE_TYPES.FunctionDeclaration && node.id) {
      declarations.set(node.id.name, {
        line: node.loc?.start.line ?? 0,
        kind: exportedNames.has(node.id.name) ? 'export' : 'local',
      });
    }

    // 收集引用（非声明位置的 Identifier）
    if (
      node.type === AST_NODE_TYPES.Identifier &&
      parentType !== 'VariableDeclarator' &&
      parentType !== 'FunctionDeclaration'
    ) {
      references.add(node.name);
    }
    return;
  });
}
