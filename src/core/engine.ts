import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Issue,
  ReportIssue,
  TrustReport,
  DimensionScore,
  RuleCategory,
  ScanOptions,
  DiffFile,
  RuleFailure,
  ScanError,
  ScanMode,
  FixedIssue,
  LifecycleSummary,
} from '../types/index.js';
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

const REPORT_SCHEMA_VERSION = '1.0.0';
const FINGERPRINT_VERSION = '1';

interface CandidateSelection {
  scanMode: ScanMode;
  candidates: DiffFile[];
  filesConsidered: number;
  filesExcluded: number;
}

interface FileScanResult {
  issues: Issue[];
  ruleFailures: RuleFailure[];
  rulesExecuted: number;
  rulesFailed: number;
  scanErrors: ScanError[];
  scanned: boolean;
}

interface BaselineIssueInput {
  ruleId?: unknown;
  severity?: unknown;
  category?: unknown;
  file?: unknown;
  startLine?: unknown;
  endLine?: unknown;
  message?: unknown;
  fingerprint?: unknown;
  fingerprintVersion?: unknown;
}

interface BaselineReportInput {
  commit?: unknown;
  timestamp?: unknown;
  issues?: unknown;
}

interface LoadedBaseline {
  issues: FixedIssue[];
  fingerprintSet: Set<string>;
  commit?: string;
  timestamp?: string;
}

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
    const selection = await this.getScanCandidates(options);
    const allIssues: Issue[] = [];
    const scanErrors: ScanError[] = [];
    const ruleFailures: RuleFailure[] = [];
    let rulesExecuted = 0;
    let rulesFailed = 0;
    let filesScanned = 0;

    const results = await Promise.all(
      selection.candidates.map((diffFile) => this.scanFile(diffFile)),
    );

    for (const result of results) {
      allIssues.push(...result.issues);
      ruleFailures.push(...result.ruleFailures);
      scanErrors.push(...result.scanErrors);
      rulesExecuted += result.rulesExecuted;
      rulesFailed += result.rulesFailed;
      if (result.scanned) {
        filesScanned++;
      }
    }

    const issuesWithFingerprints = this.attachFingerprints(allIssues);
    const baseline = await this.loadBaseline(options.baseline);
    const issuesWithLifecycle = this.attachLifecycle(issuesWithFingerprints, baseline);
    const fixedIssues = this.getFixedIssues(issuesWithLifecycle, baseline);
    const lifecycle = this.buildLifecycleSummary(issuesWithLifecycle, fixedIssues, baseline);
    const dimensions = this.groupByDimension(issuesWithLifecycle);
    const overallScore = calculateOverallScore(dimensions, this.config.weights);
    const grade = getGrade(overallScore);
    const commitHash = await this.diffParser.getCurrentCommitHash();

    return {
      schemaVersion: REPORT_SCHEMA_VERSION,
      version: PKG_VERSION,
      timestamp: new Date().toISOString(),
      commit: commitHash,
      scanMode: selection.scanMode,
      overall: {
        score: overallScore,
        grade,
        filesScanned,
        issuesFound: issuesWithLifecycle.length,
      },
      toolHealth: {
        rulesExecuted,
        rulesFailed,
        filesConsidered: selection.filesConsidered,
        filesScanned,
        filesExcluded: selection.filesExcluded,
        filesSkipped: scanErrors.length,
        scanErrors,
        ruleFailures,
      },
      dimensions,
      issues: issuesWithLifecycle.sort((a, b) => {
        const severityOrder = { high: 0, medium: 1, low: 2, info: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }),
      lifecycle,
      fixedIssues,
    };
  }

  private async scanFile(diffFile: DiffFile): Promise<FileScanResult> {
    // Handle deleted files
    if (diffFile.status === 'deleted') {
      return this.createSkippedResult(diffFile, 'deleted-file', `Skipped deleted file: ${diffFile.filePath}`);
    }

    // Handle unsupported file types
    if (!this.isTsJsFile(diffFile.filePath)) {
      return this.createSkippedResult(diffFile, 'unsupported-file-type', `Skipped unsupported file type: ${diffFile.filePath}`);
    }

    // Read file content
    const fileContent = await this.readFileContent(diffFile);
    if (!fileContent) {
      return this.createErrorResult(diffFile, 'missing-file-content', `Unable to read file content for ${diffFile.filePath}`);
    }

    // Run analysis
    const addedLines = this.extractAddedLines(diffFile);
    const ruleResult = this.ruleEngine.runWithDiagnostics({
      filePath: diffFile.filePath,
      fileContent,
      addedLines,
    });

    const issues: Issue[] = [...ruleResult.issues];
    issues.push(...this.runStructureAnalysis(fileContent, diffFile.filePath));
    issues.push(...analyzeStyle(fileContent, diffFile.filePath).issues);
    issues.push(...analyzeCoverage(fileContent, diffFile.filePath).issues);

    return {
      issues,
      ruleFailures: ruleResult.ruleFailures,
      rulesExecuted: ruleResult.rulesExecuted,
      rulesFailed: ruleResult.rulesFailed,
      scanErrors: [],
      scanned: true,
    };
  }

  private createSkippedResult(diffFile: DiffFile, type: ScanError['type'], message: string): FileScanResult {
    return {
      issues: [],
      ruleFailures: [],
      rulesExecuted: 0,
      rulesFailed: 0,
      scanErrors: [{ type, file: diffFile.filePath, message }],
      scanned: false,
    };
  }

  private createErrorResult(diffFile: DiffFile, type: ScanError['type'], message: string): FileScanResult {
    return {
      issues: [],
      ruleFailures: [],
      rulesExecuted: 0,
      rulesFailed: 0,
      scanErrors: [{ type, file: diffFile.filePath, message }],
      scanned: false,
    };
  }

  private async readFileContent(diffFile: DiffFile): Promise<string | null> {
    const filePath = resolve(diffFile.filePath);
    try {
      return await readFile(filePath, 'utf-8');
    } catch {
      const content = await this.diffParser.getFileContent(diffFile.filePath);
      return content ?? null;
    }
  }

  private extractAddedLines(diffFile: DiffFile): Array<{ lineNumber: number; content: string }> {
    return diffFile.hunks.flatMap((hunk) => {
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
  }

  private runStructureAnalysis(fileContent: string, filePath: string): Issue[] {
    return analyzeStructure(fileContent, filePath, {
      maxCyclomaticComplexity: this.config.thresholds['max-cyclomatic-complexity'],
      maxCognitiveComplexity: this.config.thresholds['max-cognitive-complexity'],
      maxFunctionLength: this.config.thresholds['max-function-length'],
      maxNestingDepth: this.config.thresholds['max-nesting-depth'],
      maxParamCount: this.config.thresholds['max-params'],
    }).issues;
  }

  private async getScanCandidates(options: ScanOptions): Promise<CandidateSelection> {
    const scanMode = this.getScanMode(options);
    const candidates = await this.getDiffFiles(options);
    if (scanMode === 'files') {
      return {
        scanMode,
        candidates,
        filesConsidered: options.files?.length ?? candidates.length,
        filesExcluded: (options.files?.length ?? candidates.length) - candidates.length,
      };
    }

    const filteredCandidates: DiffFile[] = [];
    let filesExcluded = 0;

    for (const candidate of candidates) {
      if (this.shouldIncludeFile(candidate.filePath)) {
        filteredCandidates.push(candidate);
      } else {
        filesExcluded++;
      }
    }

    return {
      scanMode,
      candidates: filteredCandidates,
      filesConsidered: candidates.length,
      filesExcluded,
    };
  }

  private getScanMode(options: ScanOptions): ScanMode {
    if (options.staged) {
      return 'staged';
    }

    if (options.diff) {
      return 'diff';
    }

    if (options.files && options.files.length > 0) {
      return 'files';
    }

    return 'changed';
  }

  private getDiffFiles(options: ScanOptions): Promise<DiffFile[]> {
    if (options.staged) {
      return this.diffParser.getStagedFiles();
    }

    if (options.diff) {
      return this.diffParser.getDiffFromRef(options.diff);
    }

    if (options.files && options.files.length > 0) {
      const includedFiles = options.files.filter((filePath) => this.shouldIncludeFile(filePath));
      return Promise.all(
        includedFiles.map((filePath) =>
          readFile(resolve(filePath), 'utf-8')
            .catch(() => '')
            .then((content) => ({
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
                    .map((line) => '+' + line)
                    .join('\n'),
                },
              ],
            })),
        ),
      );
    }

    return this.diffParser.getChangedFiles();
  }

  private shouldIncludeFile(filePath: string): boolean {
    const normalizedPath = filePath.split(sep).join('/');
    const includePatterns = this.config.include.length > 0 ? this.config.include : ['**/*'];
    const included = includePatterns.some((pattern) => this.matchesPattern(normalizedPath, pattern));
    if (!included) {
      return false;
    }

    return !this.config.exclude.some((pattern) => this.matchesPattern(normalizedPath, pattern));
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    let regexPattern = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    regexPattern = regexPattern.replace(/\*\*\//g, '::DOUBLE_DIR::');
    regexPattern = regexPattern.replace(/\*\*/g, '::DOUBLE_STAR::');
    regexPattern = regexPattern.replace(/\*/g, '[^/]*');
    regexPattern = regexPattern.replace(/::DOUBLE_DIR::/g, '(?:.*/)?');
    regexPattern = regexPattern.replace(/::DOUBLE_STAR::/g, '.*');
    return new RegExp(`^${regexPattern}$`).test(filePath);
  }

  private isTsJsFile(filePath: string): boolean {
    return /\.(ts|tsx|js|jsx|mts|mjs|cts|cjs)$/.test(filePath);
  }

  private attachFingerprints(issues: Issue[]): ReportIssue[] {
    const occurrenceCounts = new Map<string, number>();

    return issues.map((issue) => {
      const normalizedFile = this.normalizeRelativePath(issue.file);
      const locationComponent = `${issue.startLine}:${issue.endLine}`;
      const baseKey = [
        issue.ruleId,
        normalizedFile,
        issue.category,
        issue.severity,
        locationComponent,
      ].join('|');
      const occurrenceIndex = occurrenceCounts.get(baseKey) ?? 0;
      occurrenceCounts.set(baseKey, occurrenceIndex + 1);

      const fingerprint = createHash('sha256')
        .update(`${FINGERPRINT_VERSION}|${baseKey}|${occurrenceIndex}`)
        .digest('hex');

      return {
        ...issue,
        file: normalizedFile,
        fingerprint,
        fingerprintVersion: FINGERPRINT_VERSION,
      };
    });
  }

  private normalizeRelativePath(filePath: string): string {
    const absolutePath = resolve(filePath);
    const relativePath = relative(process.cwd(), absolutePath) || filePath;
    return relativePath.split(sep).join('/');
  }

  private async loadBaseline(baselinePath?: string): Promise<LoadedBaseline | undefined> {
    if (!baselinePath) {
      return undefined;
    }

    const baselineContent = await readFile(resolve(baselinePath), 'utf-8');
    const parsed = JSON.parse(baselineContent) as BaselineReportInput;
    const issues = this.parseBaselineIssues(parsed.issues);

    return {
      issues,
      fingerprintSet: new Set(issues.map((issue) => issue.fingerprint)),
      commit: typeof parsed.commit === 'string' ? parsed.commit : undefined,
      timestamp: typeof parsed.timestamp === 'string' ? parsed.timestamp : undefined,
    };
  }

  private parseBaselineIssues(input: unknown): FixedIssue[] {
    if (!Array.isArray(input)) {
      return [];
    }

    return input.flatMap((item) => {
      const issue = this.parseBaselineIssue(item);
      return issue ? [issue] : [];
    });
  }

  private parseBaselineIssue(input: unknown): FixedIssue | undefined {
    if (!input || typeof input !== 'object') {
      return undefined;
    }

    const issue = input as BaselineIssueInput;
    if (!this.isValidBaselineIssue(issue)) {
      return undefined;
    }

    return {
      ruleId: issue.ruleId as string,
      severity: issue.severity as FixedIssue['severity'],
      category: issue.category as FixedIssue['category'],
      file: issue.file as string,
      startLine: issue.startLine as number,
      endLine: issue.endLine as number,
      message: issue.message as string,
      fingerprint: issue.fingerprint as string,
      fingerprintVersion: typeof issue.fingerprintVersion === 'string' ? issue.fingerprintVersion : undefined,
    };
  }

  private isValidBaselineIssue(issue: BaselineIssueInput): boolean {
    return (
      typeof issue.ruleId === 'string'
      && this.isSeverity(issue.severity as FixedIssue['severity'])
      && this.isRuleCategory(issue.category as FixedIssue['category'])
      && typeof issue.file === 'string'
      && typeof issue.startLine === 'number'
      && typeof issue.endLine === 'number'
      && typeof issue.message === 'string'
      && typeof issue.fingerprint === 'string'
    );
  }

  private attachLifecycle(
    issues: ReportIssue[],
    baseline?: LoadedBaseline,
  ): ReportIssue[] {
    if (!baseline) {
      return issues;
    }

    return issues.map((issue) => ({
      ...issue,
      lifecycle: baseline.fingerprintSet.has(issue.fingerprint) ? 'existing' : 'new',
    }));
  }

  private getFixedIssues(
    issues: ReportIssue[],
    baseline?: LoadedBaseline,
  ): FixedIssue[] {
    if (!baseline) {
      return [];
    }

    const currentFingerprints = new Set(issues.map((issue) => issue.fingerprint));
    return baseline.issues.filter((issue) => !currentFingerprints.has(issue.fingerprint));
  }

  private buildLifecycleSummary(
    issues: ReportIssue[],
    fixedIssues: FixedIssue[],
    baseline?: LoadedBaseline,
  ): LifecycleSummary | undefined {
    if (!baseline) {
      return undefined;
    }

    let newIssues = 0;
    let existingIssues = 0;

    for (const issue of issues) {
      if (issue.lifecycle === 'existing') {
        existingIssues++;
      } else {
        newIssues++;
      }
    }

    return {
      newIssues,
      existingIssues,
      fixedIssues: fixedIssues.length,
      baselineUsed: true,
      baselineCommit: baseline.commit,
      baselineTimestamp: baseline.timestamp,
    };
  }

  private isSeverity(value: unknown): value is ReportIssue['severity'] {
    return value === 'high' || value === 'medium' || value === 'low' || value === 'info';
  }

  private isRuleCategory(value: unknown): value is RuleCategory {
    return (['security', 'logic', 'structure', 'style', 'coverage'] as const).includes(value as RuleCategory);
  }

  private groupByDimension(
    issues: ReportIssue[],
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
      const catIssues = issues.filter((issue) => issue.category === cat);
      grouped[cat] = calculateDimensionScore(catIssues);
    }

    return grouped;
  }
}
