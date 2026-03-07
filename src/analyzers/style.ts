import { Issue } from '../types/index.js';
import { parseCode, AST_NODE_TYPES } from '../parsers/ast.js';
import type { TSESTree } from '../parsers/ast.js';
import { walkAST } from '../parsers/walk.js';
import { t } from '../i18n/index.js';

export interface StyleAnalysisResult {
  issues: Issue[];
  stats: {
    camelCaseCount: number;
    snakeCaseCount: number;
    pascalCaseCount: number;
    totalIdentifiers: number;
    commentLineCount: number;
    codeLineCount: number;
    commentDensity: number;
  };
}

export function analyzeStyle(code: string, filePath: string): StyleAnalysisResult {
  const issues: Issue[] = [];
  const lines = code.split('\n');

  // 注释密度
  let commentLines = 0;
  let codeLines = 0;
  let inBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    if (inBlockComment) {
      commentLines++;
      if (trimmed.includes('*/')) inBlockComment = false;
      continue;
    }

    if (trimmed.startsWith('/*')) {
      commentLines++;
      if (!trimmed.includes('*/')) inBlockComment = true;
      continue;
    }

    if (trimmed.startsWith('//')) {
      commentLines++;
      continue;
    }

    codeLines++;
  }

  const commentDensity = codeLines > 0 ? commentLines / codeLines : 0;

  // 命名风格分析
  let camelCase = 0;
  let snakeCase = 0;
  let pascalCase = 0;
  let totalIdents = 0;

  try {
    const parsed = parseCode(code, filePath);
    collectNamingStyles(parsed.ast, (style) => {
      totalIdents++;
      if (style === 'camel') camelCase++;
      else if (style === 'snake') snakeCase++;
      else if (style === 'pascal') pascalCase++;
    });
  } catch {
    // AST parse failed, skip naming analysis
  }

  // 命名风格不一致检测
  const styles = [
    { name: 'camelCase', count: camelCase },
    { name: 'snake_case', count: snakeCase },
  ].filter((s) => s.count > 0);

  if (styles.length > 1 && totalIdents >= 5) {
    const dominant = styles.reduce((a, b) => (a.count > b.count ? a : b));
    const minority = styles.reduce((a, b) => (a.count < b.count ? a : b));
    const ratio = minority.count / totalIdents;

    if (ratio > 0.15) {
      issues.push({
        ruleId: 'style/inconsistent-naming',
        severity: 'low',
        category: 'style',
        file: filePath,
        startLine: 1,
        endLine: lines.length,
        message: t(
          `Mixed naming styles: ${dominant.count} ${dominant.name} vs ${minority.count} ${minority.name} identifiers.`,
          `命名风格混用：${dominant.count} 个 ${dominant.name} 与 ${minority.count} 个 ${minority.name} 标识符。`,
        ),
        suggestion: t(
          `Standardize on ${dominant.name} for consistency.`,
          `统一使用 ${dominant.name} 以保持一致性。`,
        ),
      });
    }
  }

  return {
    issues,
    stats: {
      camelCaseCount: camelCase,
      snakeCaseCount: snakeCase,
      pascalCaseCount: pascalCase,
      totalIdentifiers: totalIdents,
      commentLineCount: commentLines,
      codeLineCount: codeLines,
      commentDensity,
    },
  };
}

type NamingStyle = 'camel' | 'snake' | 'pascal' | 'other';

function detectNamingStyle(name: string): NamingStyle {
  if (name.length <= 1) return 'other';
  if (name.startsWith('_') || name === name.toUpperCase()) return 'other';
  if (name.includes('_')) return 'snake';
  if (/^[A-Z]/.test(name)) return 'pascal';
  if (/^[a-z]/.test(name)) return 'camel';
  return 'other';
}

function collectNamingStyles(
  root: TSESTree.Node,
  callback: (style: NamingStyle) => void,
): void {
  walkAST(root, (node) => {
    if (node.type === AST_NODE_TYPES.VariableDeclarator && node.id.type === AST_NODE_TYPES.Identifier) {
      const style = detectNamingStyle(node.id.name);
      if (style !== 'other') callback(style);
    }

    if (node.type === AST_NODE_TYPES.FunctionDeclaration && node.id) {
      const style = detectNamingStyle(node.id.name);
      if (style !== 'other') callback(style);
    }
  });
}
