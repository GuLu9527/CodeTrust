import { Issue } from '../../types/index.js';
import { Rule, RuleContext, Fix } from '../types.js';
import { t } from '../../i18n/index.js';
import { lineRange } from '../fix-utils.js';
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

  fixable: true,

  fix(context: RuleContext, issue: Issue): Fix | null {
    // Only fix when the entire import line contains a single specifier.
    // For multi-specifier imports, return null (too risky to auto-fix).
    const lines = context.fileContent.split('\n');
    const lineIndex = issue.startLine - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) return null;

    const line = lines[lineIndex].trim();
    // Check if this is a simple single-specifier import line
    const isSingleDefault = /^import\s+\w+\s+from\s+/.test(line);
    const isSingleNamed = /^import\s*\{\s*\w+\s*\}\s*from\s+/.test(line);
    const isSingleTypeNamed = /^import\s+type\s*\{\s*\w+\s*\}\s*from\s+/.test(line);
    const isSingleTypeDefault = /^import\s+type\s+\w+\s+from\s+/.test(line);

    if (!isSingleDefault && !isSingleNamed && !isSingleTypeNamed && !isSingleTypeDefault) {
      return null;
    }

    const [start, end] = lineRange(context.fileContent, issue.startLine);
    if (start === end) return null;
    return { range: [start, end], text: '' };
  },

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

    // Check for type references in non-comment, non-string code lines.
    // The AST walker may miss some type-only references in annotations.
    const codeLines = context.fileContent.split('\n');
    let inBlock = false;
    for (const codeLine of codeLines) {
      const trimmedCode = codeLine.trim();
      if (inBlock) {
        if (trimmedCode.includes('*/')) inBlock = false;
        continue;
      }
      if (trimmedCode.startsWith('/*')) {
        if (!trimmedCode.includes('*/')) inBlock = true;
        continue;
      }
      if (trimmedCode.startsWith('//') || trimmedCode.startsWith('*')) continue;

      // Strip inline comments and string literals before matching
      const cleaned = codeLine
        .replace(/\/\/.*$/, '')
        .replace(/\/\*.*?\*\//g, '')
        .replace(/'(?:[^'\\]|\\.)*'/g, '')
        .replace(/"(?:[^"\\]|\\.)*"/g, '')
        .replace(/`(?:[^`\\]|\\.)*`/g, '');

      const typeRefPattern = /\b([A-Z][A-Za-z0-9]*)\b/g;
      let match;
      while ((match = typeRefPattern.exec(cleaned)) !== null) {
        references.add(match[1]);
      }
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
