import * as fs from 'node:fs';
import * as path from 'node:path';
import { Issue } from '../types/index.js';
import { parseCode, extractFunctions } from '../parsers/ast.js';
import { t } from '../i18n/index.js';

export interface CoverageAnalysisResult {
  issues: Issue[];
  exportedFunctions: string[];
  hasTestFile: boolean;
}

export function analyzeCoverage(
  code: string,
  filePath: string,
): CoverageAnalysisResult {
  const issues: Issue[] = [];
  const exportedFunctions: string[] = [];

  // 检查是否有对应的测试文件
  const testFile = findTestFile(filePath);
  const hasTestFile = testFile !== null;

  try {
    const parsed = parseCode(code, filePath);
    const functions = extractFunctions(parsed);

    // 收集 exported 函数名
    for (const fn of functions) {
      if (fn.name !== '<anonymous>' && fn.name !== '<arrow>') {
        exportedFunctions.push(fn.name);
      }
    }

    // 如果文件有超过 2 个导出函数且没有测试文件，报告
    if (exportedFunctions.length >= 2 && !hasTestFile) {
      // 跳过测试文件本身
      const basename = path.basename(filePath);
      if (!basename.includes('.test.') && !basename.includes('.spec.') && !basename.startsWith('test')) {
        issues.push({
          ruleId: 'coverage/missing-test-file',
          severity: 'low',
          category: 'coverage',
          file: filePath,
          startLine: 1,
          endLine: 1,
          message: t(
            `File has ${exportedFunctions.length} functions but no corresponding test file found.`,
            `文件有 ${exportedFunctions.length} 个函数，但未找到对应的测试文件。`,
          ),
          suggestion: t(
            `Create a test file (e.g., ${suggestTestFileName(filePath)}).`,
            `创建测试文件（如：${suggestTestFileName(filePath)}）。`,
          ),
        });
      }
    }
  } catch {
    // AST parse failed
  }

  return { issues, exportedFunctions, hasTestFile };
}

function findTestFile(filePath: string): string | null {
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);

  const candidates = [
    // 同目录
    path.join(dir, `${base}.test${ext}`),
    path.join(dir, `${base}.spec${ext}`),
    // tests/ 目录（复数）
    path.join(dir, '..', 'tests', `${base}.test${ext}`),
    path.join(dir, '..', 'tests', `${base}.spec${ext}`),
    path.join(dir, '..', '..', 'tests', `${base}.test${ext}`),
    path.join(dir, '..', '..', 'tests', `${base}.spec${ext}`),
    // test/ 目录（单数）
    path.join(dir, '..', 'test', `${base}.test${ext}`),
    path.join(dir, '..', 'test', `${base}.spec${ext}`),
    // __tests__/ 目录
    path.join(dir, '__tests__', `${base}.test${ext}`),
    path.join(dir, '__tests__', `${base}.spec${ext}`),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function suggestTestFileName(filePath: string): string {
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  return `${base}.test${ext}`;
}
