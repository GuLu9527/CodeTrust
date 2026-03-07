import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { Issue } from '../../types/index.js';
import { Rule, RuleContext } from '../types.js';
import { t } from '../../i18n/index.js';
import { parseCode, AST_NODE_TYPES } from '../../parsers/ast.js';
import type { TSESTree } from '../../parsers/ast.js';
import { walkAST } from '../../parsers/walk.js';

/**
 * Detects imports that reference non-existent relative modules.
 * AI often hallucinates import paths — referencing files, functions,
 * or modules that don't actually exist in the project.
 */
export const phantomImportRule: Rule = {
  id: 'logic/phantom-import',
  category: 'logic',
  severity: 'high',
  title: 'Phantom import — module does not exist',
  description:
    'AI-generated code frequently imports from non-existent relative paths, indicating hallucinated modules or functions.',

  check(context: RuleContext): Issue[] {
    const issues: Issue[] = [];

    // Only check files with an actual file path on disk
    if (!context.filePath || context.filePath === '<unknown>') {
      return issues;
    }

    let ast: TSESTree.Program;
    try {
      const parsed = parseCode(context.fileContent, context.filePath);
      ast = parsed.ast;
    } catch {
      return issues;
    }

    const fileDir = dirname(resolve(context.filePath));

    walkAST(ast, (node) => {
      // ImportDeclaration: import { foo } from './bar'
      if (node.type === AST_NODE_TYPES.ImportDeclaration) {
        const source = node.source.value;
        if (typeof source === 'string' && isRelativePath(source)) {
          if (!resolveModulePath(fileDir, source)) {
            issues.push({
              ruleId: 'logic/phantom-import',
              severity: 'high',
              category: 'logic',
              file: context.filePath,
              startLine: node.loc?.start.line ?? 0,
              endLine: node.loc?.end.line ?? 0,
              message: t(
                `Import from "${source}" — module does not exist.`,
                `导入 "${source}" — 模块不存在。`,
              ),
              suggestion: t(
                'Verify the import path. The AI may have hallucinated this module.',
                '检查导入路径，AI 可能编造了这个模块。',
              ),
            });
          }
        }
      }

      // Dynamic import: import('./bar') or require('./bar')
      if (
        node.type === AST_NODE_TYPES.ImportExpression &&
        node.source.type === AST_NODE_TYPES.Literal &&
        typeof node.source.value === 'string'
      ) {
        const source = node.source.value;
        if (isRelativePath(source) && !resolveModulePath(fileDir, source)) {
          issues.push({
            ruleId: 'logic/phantom-import',
            severity: 'high',
            category: 'logic',
            file: context.filePath,
            startLine: node.loc?.start.line ?? 0,
            endLine: node.loc?.end.line ?? 0,
            message: t(
              `Dynamic import "${source}" — module does not exist.`,
              `动态导入 "${source}" — 模块不存在。`,
            ),
            suggestion: t(
              'Verify the import path. The AI may have hallucinated this module.',
              '检查导入路径，AI 可能编造了这个模块。',
            ),
          });
        }
      }

      // require('./bar')
      if (
        node.type === AST_NODE_TYPES.CallExpression &&
        node.callee.type === AST_NODE_TYPES.Identifier &&
        node.callee.name === 'require' &&
        node.arguments.length >= 1 &&
        node.arguments[0].type === AST_NODE_TYPES.Literal &&
        typeof node.arguments[0].value === 'string'
      ) {
        const source = node.arguments[0].value;
        if (isRelativePath(source) && !resolveModulePath(fileDir, source)) {
          issues.push({
            ruleId: 'logic/phantom-import',
            severity: 'high',
            category: 'logic',
            file: context.filePath,
            startLine: node.loc?.start.line ?? 0,
            endLine: node.loc?.end.line ?? 0,
            message: t(
              `Require "${source}" — module does not exist.`,
              `Require "${source}" — 模块不存在。`,
            ),
            suggestion: t(
              'Verify the require path. The AI may have hallucinated this module.',
              '检查 require 路径，AI 可能编造了这个模块。',
            ),
          });
        }
      }
    });

    return issues;
  },
};

function isRelativePath(source: string): boolean {
  return source.startsWith('./') || source.startsWith('../');
}

/**
 * Try to resolve a relative import to an actual file.
 * Checks common extensions: .ts, .tsx, .js, .jsx, .mts, .mjs, .json
 * Also checks for index files in directories.
 */
function resolveModulePath(dir: string, importPath: string): boolean {
  const resolved = resolve(dir, importPath);

  // Exact match (e.g., import './data.json')
  if (existsSync(resolved)) return true;

  // TypeScript ESM convention: import './foo.js' → actually ./foo.ts
  // Map .js → .ts/.tsx, .mjs → .mts, .cjs → .cts
  const extMap: Record<string, string[]> = {
    '.js': ['.ts', '.tsx'],
    '.jsx': ['.tsx'],
    '.mjs': ['.mts'],
    '.cjs': ['.cts'],
  };
  for (const [fromExt, toExts] of Object.entries(extMap)) {
    if (importPath.endsWith(fromExt)) {
      const base = resolved.slice(0, -fromExt.length);
      for (const toExt of toExts) {
        if (existsSync(base + toExt)) return true;
      }
    }
  }

  // Try common extensions (for extensionless imports)
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '.cts', '.cjs', '.json'];
  for (const ext of extensions) {
    if (existsSync(resolved + ext)) return true;
  }

  // Directory with index file
  for (const ext of extensions) {
    if (existsSync(resolve(resolved, `index${ext}`))) return true;
  }

  return false;
}
