import { Issue } from '../../types/index.js';
import { Rule, RuleContext } from '../types.js';
import { t } from '../../i18n/index.js';
import { parseCode, AST_NODE_TYPES } from '../../parsers/ast.js';
import type { TSESTree } from '../../parsers/ast.js';
import { walkAST } from '../../parsers/walk.js';

/**
 * Detects excessive use of TypeScript `any` type.
 * AI-generated code tends to use `any` to bypass type checking,
 * which defeats the purpose of using TypeScript.
 */
export const anyTypeAbuseRule: Rule = {
  id: 'logic/any-type-abuse',
  category: 'logic',
  severity: 'medium',
  title: 'Excessive any type usage',
  description:
    'AI-generated code often uses `any` type to bypass TypeScript type checking, reducing type safety.',

  check(context: RuleContext): Issue[] {
    const issues: Issue[] = [];

    // Only check TypeScript files
    if (!context.filePath.match(/\.tsx?$/)) return issues;

    let ast: TSESTree.Program;
    try {
      const parsed = parseCode(context.fileContent, context.filePath);
      ast = parsed.ast;
    } catch {
      return issues;
    }

    const lines = context.fileContent.split('\n');

    walkAST(ast, (node): void => {
      if (node.type !== AST_NODE_TYPES.TSAnyKeyword) return;

      const line = node.loc?.start.line ?? 0;
      if (line === 0) return;

      // Skip if inside a comment
      const lineContent = lines[line - 1] ?? '';
      const trimmed = lineContent.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

      // Skip type assertion expressions like `as any` in catch clauses
      // e.g., catch (e) { (e as any).message } — sometimes necessary
      const parent = (node as TSESTree.Node & { parent?: TSESTree.Node }).parent;
      if (parent?.type === AST_NODE_TYPES.TSTypeAssertion || parent?.type === AST_NODE_TYPES.TSAsExpression) {
        // Check if it's in a catch clause — allow `as any` in catch
        let ancestor: TSESTree.Node | undefined = parent;
        while (ancestor) {
          if ((ancestor as TSESTree.Node).type === AST_NODE_TYPES.CatchClause) return;
          ancestor = (ancestor as TSESTree.Node & { parent?: TSESTree.Node }).parent;
        }
      }

      issues.push({
        ruleId: 'logic/any-type-abuse',
        severity: 'medium',
        category: 'logic',
        file: context.filePath,
        startLine: line,
        endLine: line,
        message: t(
          `Usage of "any" type reduces type safety.`,
          `使用 "any" 类型降低了类型安全性。`,
        ),
        suggestion: t(
          `Replace "any" with a specific type or "unknown" for safer type narrowing.`,
          `将 "any" 替换为具体类型或使用 "unknown" 进行更安全的类型收窄。`,
        ),
      });
    });

    return issues;
  },
};
