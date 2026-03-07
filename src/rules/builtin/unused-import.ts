import { Issue } from '../../types/index.js';
import { Rule, RuleContext } from '../types.js';
import { t } from '../../i18n/index.js';
import { parseCode, AST_NODE_TYPES } from '../../parsers/ast.js';
import type { TSESTree } from '../../parsers/ast.js';
import { walkAST } from '../../parsers/walk.js';

/**
 * Detects imported identifiers that are never referenced in the code.
 * AI frequently imports modules or functions it never actually uses,
 * indicating incomplete or hallucinated logic.
 */
export const unusedImportRule: Rule = {
  id: 'logic/unused-import',
  category: 'logic',
  severity: 'low',
  title: 'Unused import',
  description:
    'AI-generated code often imports modules or identifiers that are never used in the file.',

  check(context: RuleContext): Issue[] {
    const issues: Issue[] = [];

    let ast: TSESTree.Program;
    try {
      const parsed = parseCode(context.fileContent, context.filePath);
      ast = parsed.ast;
    } catch {
      return issues;
    }

    // Collect all import specifiers with their names and locations
    const imports: Array<{
      name: string;
      local: string;
      line: number;
      isTypeOnly: boolean;
      source: string;
    }> = [];

    // Collect namespace imports (import * as foo) — harder to track usage
    const namespaceImports = new Set<string>();

    for (const node of ast.body) {
      if (node.type !== AST_NODE_TYPES.ImportDeclaration) continue;

      const source = String(node.source.value);
      const isTypeOnlyImport = (node as { importKind?: string }).importKind === 'type';

      for (const spec of node.specifiers) {
        if (spec.type === AST_NODE_TYPES.ImportNamespaceSpecifier) {
          // import * as foo — skip, too complex to reliably check
          namespaceImports.add(spec.local.name);
          continue;
        }

        const isTypeOnlySpec =
          isTypeOnlyImport ||
          (spec.type === AST_NODE_TYPES.ImportSpecifier &&
            (spec as { importKind?: string }).importKind === 'type');

        imports.push({
          name: spec.type === AST_NODE_TYPES.ImportSpecifier
            ? (spec.imported as { name: string }).name
            : 'default',
          local: spec.local.name,
          line: spec.loc?.start.line ?? 0,
          isTypeOnly: isTypeOnlySpec,
          source,
        });
      }
    }

    if (imports.length === 0) return issues;

    // Collect all identifier references outside of import declarations
    const references = new Set<string>();
    const importNodes = new WeakSet<TSESTree.Node>();

    for (const node of ast.body) {
      if (node.type === AST_NODE_TYPES.ImportDeclaration) {
        importNodes.add(node);
      }
    }

    walkAST(ast, (node) => {
      // Skip import declaration subtrees
      if (importNodes.has(node)) return false;

      if (node.type === AST_NODE_TYPES.Identifier) {
        references.add(node.name);
      }

      // JSX element names: <MyComponent />
      if (node.type === AST_NODE_TYPES.JSXIdentifier) {
        references.add((node as { name: string }).name);
      }
      return;
    });

    // Also check for references in type annotations via string matching
    // This catches cases where type-only imports are used in type positions
    // that the AST walker might miss
    const typeRefPattern = /\b([A-Z][A-Za-z0-9]*)\b/g;
    let match;
    while ((match = typeRefPattern.exec(context.fileContent)) !== null) {
      references.add(match[1]);
    }

    // Report unused imports
    for (const imp of imports) {
      if (!references.has(imp.local)) {
        issues.push({
          ruleId: 'logic/unused-import',
          severity: 'low',
          category: 'logic',
          file: context.filePath,
          startLine: imp.line,
          endLine: imp.line,
          message: t(
            `Imported "${imp.local}" from "${imp.source}" is never used.`,
            `从 "${imp.source}" 导入的 "${imp.local}" 从未使用。`,
          ),
          suggestion: t(
            `Remove the unused import "${imp.local}".`,
            `移除未使用的导入 "${imp.local}"。`,
          ),
        });
      }
    }

    return issues;
  },
};
