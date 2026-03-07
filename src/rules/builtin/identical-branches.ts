import { Issue } from '../../types/index.js';
import { Rule, RuleContext } from '../types.js';
import { parseCode, AST_NODE_TYPES } from '../../parsers/ast.js';
import { walkAST } from '../../parsers/walk.js';
import { t } from '../../i18n/index.js';

/**
 * Detects if-else blocks where both branches contain identical code.
 *
 * AI often generates if/else with the same logic in both branches,
 * making the condition meaningless.
 */
export const identicalBranchesRule: Rule = {
  id: 'logic/identical-branches',
  category: 'logic',
  severity: 'medium',
  title: 'Identical if/else branches',
  description:
    'AI-generated code sometimes contains if/else blocks where both branches have identical code, making the condition meaningless.',

  check(context: RuleContext): Issue[] {
    const issues: Issue[] = [];
    const parsed = parseCode(context.fileContent, context.filePath);
    if (!parsed) return issues;

    const source = context.fileContent;

    walkAST(parsed.ast, (node) => {
      if (
        node.type === AST_NODE_TYPES.IfStatement &&
        node.consequent &&
        node.alternate
      ) {
        // Skip else-if chains — only check simple if/else
        if (node.alternate.type === AST_NODE_TYPES.IfStatement) return;

        const thenCode = extractBlockText(source, node.consequent);
        const elseCode = extractBlockText(source, node.alternate);

        if (thenCode && elseCode && thenCode === elseCode && thenCode.length > 0) {
          issues.push({
            ruleId: 'logic/identical-branches',
            severity: 'medium',
            category: 'logic',
            file: context.filePath,
            startLine: node.loc?.start.line ?? 0,
            endLine: node.loc?.end.line ?? 0,
            message: t(
              'The if and else branches contain identical code. The condition is meaningless.',
              'if 和 else 分支包含完全相同的代码，条件判断毫无意义。',
            ),
            suggestion: t(
              'Remove the if/else and keep only one copy of the code, or fix the branching logic.',
              '移除 if/else，只保留一份代码；或修复分支逻辑。',
            ),
          });
        }
      }
    });

    return issues;
  },
};

function extractBlockText(
  source: string,
  node: { type: string; range?: [number, number] },
): string {
  if (!node.range) return '';

  let text = source.slice(node.range[0], node.range[1]);

  // If it's a block statement, strip the outer { }
  if (text.startsWith('{')) text = text.slice(1);
  if (text.endsWith('}')) text = text.slice(0, -1);

  // Normalize whitespace for comparison
  return text.trim().replace(/\s+/g, ' ');
}
