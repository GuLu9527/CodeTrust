import { readFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Issue, TrustReport, DimensionScore, RuleCategory, ScanOptions } from '../types/index.js';
import { CodeTrustConfig } from '../types/config.js';
import { DiffParser } from '../parsers/diff.js';
import { RuleEngine } from '../rules/engine.js';
import { calculateDimensionScore, calculateOverallScore, getGrade } from './scorer.js';
import { analyzeStructure } from '../analyzers/structure.js';
import { analyzeStyle } from '../analyzers/style.js';
import { analyzeCoverage } from '../analyzers/coverage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PKG_VERSION: string = (() => {
  try {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'));
    return pkg.version;
  } catch {
    return '0.1.0';
  }
})();

export class ScanEngine {
  private config: CodeTrustConfig;
  private diffParser: DiffParser;
  private ruleEngine: RuleEngine;

  constructor(config: CodeTrustConfig, workDir?: string) {
    this.config = config;
    this.diffParser = new DiffParser(workDir);
    this.ruleEngine = new RuleEngine(config);
  }

  async scan(options: ScanOptions): Promise<TrustReport> {
    const diffFiles = await this.getDiffFiles(options);
    const allIssues: Issue[] = [];

    for (const diffFile of diffFiles) {
      if (diffFile.status === 'deleted') continue;

      const filePath = resolve(diffFile.filePath);
      let fileContent: string;

      try {
        if (existsSync(filePath)) {
          fileContent = await readFile(filePath, 'utf-8');
        } else {
          const content = await this.diffParser.getFileContent(diffFile.filePath);
          if (!content) continue;
          fileContent = content;
        }
      } catch {
        // Intentionally skip unreadable files
        continue;
      }

      const addedLines = diffFile.hunks.flatMap((hunk) => {
        const lines = hunk.content.split('\n');
        const result: Array<{ lineNumber: number; content: string }> = [];
        let currentLine = hunk.newStart;

        for (const line of lines) {
          if (line.startsWith('+')) {
            result.push({ lineNumber: currentLine, content: line.slice(1) });
            currentLine++;
          } else if (line.startsWith('-')) {
            // deleted line, don't increment
          } else {
            currentLine++;
          }
        }

        return result;
      });

      const issues = this.ruleEngine.run({
        filePath: diffFile.filePath,
        fileContent,
        addedLines,
      });

      allIssues.push(...issues);

      // AST-based analyzers (structure, style, coverage)
      if (this.isTsJsFile(diffFile.filePath)) {
        const structureResult = analyzeStructure(fileContent, diffFile.filePath, {
          maxCyclomaticComplexity: this.config.thresholds['max-cyclomatic-complexity'],
          maxCognitiveComplexity: this.config.thresholds['max-cognitive-complexity'],
          maxFunctionLength: this.config.thresholds['max-function-length'],
          maxNestingDepth: this.config.thresholds['max-nesting-depth'],
          maxParamCount: this.config.thresholds['max-params'],
        });
        allIssues.push(...structureResult.issues);

        const styleResult = analyzeStyle(fileContent, diffFile.filePath);
        allIssues.push(...styleResult.issues);

        const coverageResult = analyzeCoverage(fileContent, diffFile.filePath);
        allIssues.push(...coverageResult.issues);
      }
    }

    const dimensions = this.groupByDimension(allIssues);
    const overallScore = calculateOverallScore(dimensions, this.config.weights);
    const grade = getGrade(overallScore);
    const commitHash = await this.diffParser.getCurrentCommitHash();

    return {
      version: PKG_VERSION,
      timestamp: new Date().toISOString(),
      commit: commitHash,
      overall: {
        score: overallScore,
        grade,
        filesScanned: diffFiles.filter((f) => f.status !== 'deleted').length,
        issuesFound: allIssues.length,
      },
      dimensions,
      issues: allIssues.sort((a, b) => {
        const severityOrder = { high: 0, medium: 1, low: 2, info: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }),
    };
  }

  private async getDiffFiles(options: ScanOptions) {
    if (options.staged) {
      return this.diffParser.getStagedFiles();
    }

    if (options.diff) {
      return this.diffParser.getDiffFromRef(options.diff);
    }

    if (options.files && options.files.length > 0) {
      // For specific files, create synthetic diff entries
      return Promise.all(
        options.files.map(async (filePath) => {
          let content = '';
          try {
            content = await readFile(resolve(filePath), 'utf-8');
          } catch {
            // file not readable
          }
          return {
            filePath,
            status: 'modified' as const,
            additions: content.split('\n').length,
            deletions: 0,
            content,
            hunks: [
              {
                oldStart: 1,
                oldLines: 0,
                newStart: 1,
                newLines: content.split('\n').length,
                content: content
                  .split('\n')
                  .map((l) => '+' + l)
                  .join('\n'),
              },
            ],
          };
        }),
      );
    }

    // Default: get all uncommitted changes
    return this.diffParser.getChangedFiles();
  }

  private isTsJsFile(filePath: string): boolean {
    return /\.(ts|tsx|js|jsx|mts|mjs|cts|cjs)$/.test(filePath);
  }

  private groupByDimension(
    issues: Issue[],
  ): Record<RuleCategory, DimensionScore> {
    const categories: RuleCategory[] = [
      'security',
      'logic',
      'structure',
      'style',
      'coverage',
    ];

    const grouped: Record<RuleCategory, DimensionScore> = {} as Record<
      RuleCategory,
      DimensionScore
    >;

    for (const cat of categories) {
      const catIssues = issues.filter((i) => i.category === cat);
      grouped[cat] = calculateDimensionScore(catIssues);
    }

    return grouped;
  }
}
