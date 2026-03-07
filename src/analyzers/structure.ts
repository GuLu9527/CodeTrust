import { Issue } from '../types/index.js';
import { parseCode, extractFunctions, FunctionInfo } from '../parsers/ast.js';
import { t } from '../i18n/index.js';

export interface StructureThresholds {
  maxCyclomaticComplexity: number;
  maxCognitiveComplexity: number;
  maxFunctionLength: number;
  maxNestingDepth: number;
  maxParamCount: number;
}

const DEFAULT_THRESHOLDS: StructureThresholds = {
  maxCyclomaticComplexity: 10,
  maxCognitiveComplexity: 20,
  maxFunctionLength: 40,
  maxNestingDepth: 4,
  maxParamCount: 5,
};

export interface StructureAnalysisResult {
  functions: FunctionInfo[];
  issues: Issue[];
}

export function analyzeStructure(
  code: string,
  filePath: string,
  thresholds: Partial<StructureThresholds> = {},
): StructureAnalysisResult {
  const t_ = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const issues: Issue[] = [];

  let parsed;
  try {
    parsed = parseCode(code, filePath);
  } catch {
    return { functions: [], issues: [] };
  }

  const functions = extractFunctions(parsed);

  for (const fn of functions) {
    if (fn.cyclomaticComplexity > t_.maxCyclomaticComplexity) {
      issues.push({
        ruleId: 'structure/high-cyclomatic-complexity',
        severity: fn.cyclomaticComplexity > t_.maxCyclomaticComplexity * 2 ? 'high' : 'medium',
        category: 'structure',
        file: filePath,
        startLine: fn.startLine,
        endLine: fn.endLine,
        message: t(
          `Function "${fn.name}" has cyclomatic complexity of ${fn.cyclomaticComplexity} (threshold: ${t_.maxCyclomaticComplexity}).`,
          `函数 "${fn.name}" 的圈复杂度为 ${fn.cyclomaticComplexity}（阈值：${t_.maxCyclomaticComplexity}）。`,
        ),
        suggestion: t(
          'Break the function into smaller, simpler functions.',
          '将函数拆分为更小、更简单的函数。',
        ),
      });
    }

    if (fn.cognitiveComplexity > t_.maxCognitiveComplexity) {
      issues.push({
        ruleId: 'structure/high-cognitive-complexity',
        severity: fn.cognitiveComplexity > t_.maxCognitiveComplexity * 2 ? 'high' : 'medium',
        category: 'structure',
        file: filePath,
        startLine: fn.startLine,
        endLine: fn.endLine,
        message: t(
          `Function "${fn.name}" has cognitive complexity of ${fn.cognitiveComplexity} (threshold: ${t_.maxCognitiveComplexity}).`,
          `函数 "${fn.name}" 的认知复杂度为 ${fn.cognitiveComplexity}（阈值：${t_.maxCognitiveComplexity}）。`,
        ),
        suggestion: t(
          'Simplify the function by reducing nesting and breaking out helper functions.',
          '通过减少嵌套和提取辅助函数来简化该函数。',
        ),
      });
    }

    if (fn.lineCount > t_.maxFunctionLength) {
      issues.push({
        ruleId: 'structure/long-function',
        severity: fn.lineCount > t_.maxFunctionLength * 2 ? 'high' : 'medium',
        category: 'structure',
        file: filePath,
        startLine: fn.startLine,
        endLine: fn.endLine,
        message: t(
          `Function "${fn.name}" is ${fn.lineCount} lines long (threshold: ${t_.maxFunctionLength}).`,
          `函数 "${fn.name}" 长达 ${fn.lineCount} 行（阈值：${t_.maxFunctionLength}）。`,
        ),
        suggestion: t(
          'Break the function into smaller units with clear responsibilities.',
          '将函数拆分为职责清晰的更小单元。',
        ),
      });
    }

    if (fn.maxNestingDepth > t_.maxNestingDepth) {
      issues.push({
        ruleId: 'structure/deep-nesting',
        severity: fn.maxNestingDepth > t_.maxNestingDepth + 2 ? 'high' : 'medium',
        category: 'structure',
        file: filePath,
        startLine: fn.startLine,
        endLine: fn.endLine,
        message: t(
          `Function "${fn.name}" has nesting depth of ${fn.maxNestingDepth} (threshold: ${t_.maxNestingDepth}).`,
          `函数 "${fn.name}" 的嵌套深度为 ${fn.maxNestingDepth}（阈值：${t_.maxNestingDepth}）。`,
        ),
        suggestion: t(
          'Use early returns, guard clauses, or extract nested logic into separate functions.',
          '使用提前返回、守卫语句，或将嵌套逻辑提取到单独的函数中。',
        ),
      });
    }

    if (fn.paramCount > t_.maxParamCount) {
      issues.push({
        ruleId: 'structure/too-many-params',
        severity: 'low',
        category: 'structure',
        file: filePath,
        startLine: fn.startLine,
        endLine: fn.endLine,
        message: t(
          `Function "${fn.name}" has ${fn.paramCount} parameters (threshold: ${t_.maxParamCount}).`,
          `函数 "${fn.name}" 有 ${fn.paramCount} 个参数（阈值：${t_.maxParamCount}）。`,
        ),
        suggestion: t(
          'Consider using an options object to group related parameters.',
          '考虑使用选项对象来组合相关参数。',
        ),
      });
    }
  }

  return { functions, issues };
}
