import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseCode, extractFunctions, FunctionInfo } from '../parsers/ast.js';

export interface ProjectBaseline {
  totalFiles: number;
  totalFunctions: number;
  avgCyclomaticComplexity: number;
  avgCognitiveComplexity: number;
  avgFunctionLength: number;
  avgNestingDepth: number;
  avgParamCount: number;
  p90CyclomaticComplexity: number;
  p90FunctionLength: number;
  p90NestingDepth: number;
}

const DEFAULT_EXCLUDES = [
  'node_modules',
  'dist',
  'build',
  '.git',
  'coverage',
  '.next',
  '.nuxt',
  '__pycache__',
  'vendor',
];

const TS_JS_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '.cts', '.cjs']);

export function calculateBaseline(projectDir: string): ProjectBaseline {
  const files = collectFiles(projectDir);
  const allFunctions: FunctionInfo[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const parsed = parseCode(content, file);
      const functions = extractFunctions(parsed);
      allFunctions.push(...functions);
    } catch {
      // skip unparseable files
    }
  }

  if (allFunctions.length === 0) {
    return {
      totalFiles: files.length,
      totalFunctions: 0,
      avgCyclomaticComplexity: 1,
      avgCognitiveComplexity: 0,
      avgFunctionLength: 10,
      avgNestingDepth: 1,
      avgParamCount: 1,
      p90CyclomaticComplexity: 5,
      p90FunctionLength: 30,
      p90NestingDepth: 3,
    };
  }

  const cc = allFunctions.map((f) => f.cyclomaticComplexity);
  const cog = allFunctions.map((f) => f.cognitiveComplexity);
  const len = allFunctions.map((f) => f.lineCount);
  const nest = allFunctions.map((f) => f.maxNestingDepth);
  const params = allFunctions.map((f) => f.paramCount);

  return {
    totalFiles: files.length,
    totalFunctions: allFunctions.length,
    avgCyclomaticComplexity: avg(cc),
    avgCognitiveComplexity: avg(cog),
    avgFunctionLength: avg(len),
    avgNestingDepth: avg(nest),
    avgParamCount: avg(params),
    p90CyclomaticComplexity: percentile(cc, 90),
    p90FunctionLength: percentile(len, 90),
    p90NestingDepth: percentile(nest, 90),
  };
}

function collectFiles(dir: string, result: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return result;
  }

  for (const entry of entries) {
    if (DEFAULT_EXCLUDES.includes(entry.name)) continue;
    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      collectFiles(fullPath, result);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (TS_JS_EXTENSIONS.has(ext)) {
        result.push(fullPath);
      }
    }
  }

  return result;
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100;
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}
