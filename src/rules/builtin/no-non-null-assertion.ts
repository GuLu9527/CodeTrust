import { Issue } from '../../types/index.js';
import { Rule, RuleContext } from '../types.js';
import { t } from '../../i18n/index.js';
import { parseCode, AST_NODE_TYPES } from '../../parsers/ast.js';
import type { TSESTree } from '../../parsers/ast.js';
import { walkAST } from '../../parsers/walk.js';

/**
 * Detects non-null assertion operator (!) usage.
 * AI-generated code frequently uses the ! operator to silence TypeScript
 * null-check errors instead of properly handling nullable values.
 * This can lead to runtime crashes when the value is actually null/undefined.
 */
export const noNonNullAssertionRule: Rule = {
  id: 'logic/no-non-null-assertion',
  category: 'logic',
  severity: 'medium',
  title: 'Non-null assertion operator',
  description:
    'AI-generated code often uses the ! operator to bypass TypeScript null checks, risking runtime crashes.',

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

    walkAST(ast, (node): void => {
      if (node.type !== AST_NODE_TYPES.TSNonNullExpression) return;

      const line = node.loc?.start.line ?? 0;
      if (line === 0) return;

      issues.push({
        ruleId: 'logic/no-non-null-assertion',
        severity: 'medium',
        category: 'logic',
        file: context.filePath,
        startLine: line,
        endLine: line,
        message: t(
          `Non-null assertion (!) used — value could be null/undefined at runtime.`,
          `使用了非空断言 (!) — 值在运行时可能为 null/undefined。`,
        ),
        suggestion: t(
          `Use optional chaining (?.), nullish coalescing (??), or add a proper null check.`,
          `使用可选链 (?.)、空值合并 (??) 或添加适当的空值检查。`,
        ),
      });
    });

    return issues;
  },
};
