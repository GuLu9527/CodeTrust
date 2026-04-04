import { Issue } from '../../types/index.js';
import { Rule, RuleContext } from '../types.js';
import { t } from '../../i18n/index.js';
import { parseCode, AST_NODE_TYPES } from '../../parsers/ast.js';
import type { TSESTree } from '../../parsers/ast.js';
import { walkAST } from '../../parsers/walk.js';

/**
 * Detects duplicate conditions in if-else chains.
 * AI often generates if-else chains where the same condition
 * appears multiple times, making some branches unreachable.
 */
export const duplicateConditionRule: Rule = {
  id: 'logic/duplicate-condition',
  category: 'logic',
  severity: 'medium',
  title: 'Duplicate condition in if-else chain',
  description:
    'AI-generated code sometimes contains duplicate conditions in if-else chains, making later branches unreachable.',

  check(context: RuleContext): Issue[] {
    const issues: Issue[] = [];

    let ast: TSESTree.Program;
    try {
      const parsed = parseCode(context.fileContent, context.filePath);
      ast = parsed.ast;
    } catch {
      return issues;
    }

    const visited = new WeakSet<TSESTree.Node>();

    walkAST(ast, (node) => {
      if (node.type === AST_NODE_TYPES.IfStatement && !visited.has(node)) {
        const conditions: Array<{ text: string; line: number }> = [];
        collectIfElseChainConditions(node, conditions, visited);

        if (conditions.length >= 2) {
          const seen = new Map<string, number>();
          for (const cond of conditions) {
            if (seen.has(cond.text)) {
              const firstLine = seen.get(cond.text)!;
              issues.push({
                ruleId: 'logic/duplicate-condition',
                severity: 'medium',
                category: 'logic',
                file: context.filePath,
                startLine: cond.line,
                endLine: cond.line,
                message: t(
                  `Duplicate condition "${truncate(cond.text, 40)}" — same condition already checked at line ${firstLine}.`,
                  `重复条件 "${truncate(cond.text, 40)}" — 相同条件已在第 ${firstLine} 行检查过。`,
                ),
                suggestion: t(
                  'Remove the duplicate branch or change the condition.',
                  '移除重复的分支或修改条件。',
                ),
              });
            } else {
              seen.set(cond.text, cond.line);
            }
          }
        }
      }
    });

    return issues;
  },
};

function collectIfElseChainConditions(
  node: TSESTree.IfStatement,
  conditions: Array<{ text: string; line: number }>,
  visited: WeakSet<TSESTree.Node>,
): void {
  visited.add(node);
  const condText = stringifyCondition(node.test);
  conditions.push({ text: condText, line: node.loc?.start.line ?? 0 });

  if (node.alternate?.type === AST_NODE_TYPES.IfStatement) {
    collectIfElseChainConditions(node.alternate, conditions, visited);
  }
}

function stringifyCondition(node: TSESTree.Node): string {
  switch (node.type) {
    case AST_NODE_TYPES.Identifier:
      return node.name;
    case AST_NODE_TYPES.Literal:
      return String(node.value);
    case AST_NODE_TYPES.BinaryExpression:
      return `${stringifyCondition(node.left)} ${node.operator} ${stringifyCondition(node.right)}`;
    case AST_NODE_TYPES.LogicalExpression:
      return `${stringifyCondition(node.left)} ${node.operator} ${stringifyCondition(node.right)}`;
    case AST_NODE_TYPES.UnaryExpression:
      return `${node.operator}${stringifyCondition(node.argument)}`;
    case AST_NODE_TYPES.MemberExpression:
      return `${stringifyCondition(node.object)}.${stringifyCondition(node.property)}`;
    case AST_NODE_TYPES.CallExpression: {
      // Include arguments to distinguish between different calls like startsWith('+') vs startsWith('-')
      const args = node.arguments.map(arg => stringifyCondition(arg)).join(', ');
      return `${stringifyCondition(node.callee)}(${args})`;
    }
    case AST_NODE_TYPES.ConditionalExpression:
      return `${stringifyCondition(node.test)} ? ${stringifyCondition(node.consequent)} : ${stringifyCondition(node.alternate)}`;
    case AST_NODE_TYPES.TemplateLiteral:
      return `\`template@${node.loc?.start.line}:${node.loc?.start.column}\``;
    case AST_NODE_TYPES.ArrayExpression:
      return `[${(node as TSESTree.ArrayExpression).elements.map(e => e ? stringifyCondition(e) : 'empty').join(', ')}]`;
    case AST_NODE_TYPES.ObjectExpression:
      return `{obj@${node.loc?.start.line}:${node.loc?.start.column}}`;
    case AST_NODE_TYPES.AssignmentExpression:
      return `${stringifyCondition((node as TSESTree.AssignmentExpression).left)} ${(node as TSESTree.AssignmentExpression).operator} ${stringifyCondition((node as TSESTree.AssignmentExpression).right)}`;
    case AST_NODE_TYPES.NewExpression:
      return `new ${stringifyCondition((node as TSESTree.NewExpression).callee)}(${(node as TSESTree.NewExpression).arguments.map(a => stringifyCondition(a)).join(', ')})`;
    case AST_NODE_TYPES.TSAsExpression:
    case AST_NODE_TYPES.TSNonNullExpression:
      return stringifyCondition((node as { expression: TSESTree.Node }).expression);
    case AST_NODE_TYPES.AwaitExpression:
      return `await ${stringifyCondition((node as TSESTree.AwaitExpression).argument)}`;
    case AST_NODE_TYPES.ChainExpression:
      return stringifyCondition((node as TSESTree.ChainExpression).expression);
    default:
      // Include location to prevent false collisions between different unknown nodes
      return `[${node.type}@${node.loc?.start.line}:${node.loc?.start.column}]`;
  }
}

function truncate(s: string, maxLen: number): string {
  return s.length > maxLen ? s.slice(0, maxLen) + '...' : s;
}
