export type Severity = 'high' | 'medium' | 'low' | 'info';
export type RuleCategory = 'security' | 'logic' | 'structure' | 'style' | 'coverage';
export type TrustGrade = 'HIGH_TRUST' | 'REVIEW' | 'LOW_TRUST' | 'UNTRUSTED';
export type ScanMode = 'staged' | 'diff' | 'files' | 'changed';
export type ScanErrorType =
  | 'rule-failure'
  | 'deleted-file'
  | 'unreadable-file'
  | 'missing-file-content'
  | 'unsupported-file-type';

export interface Issue {
  ruleId: string;
  severity: Severity;
  category: RuleCategory;
  file: string;
  startLine: number;
  endLine: number;
  message: string;
  suggestion?: string;
  codeSnippet?: string;
}

export type IssueLifecycleStatus = 'new' | 'existing';

export interface ReportIssue extends Issue {
  fingerprint: string;
  fingerprintVersion: string;
  lifecycle?: IssueLifecycleStatus;
}

export interface FixedIssue {
  ruleId: string;
  severity: Severity;
  category: RuleCategory;
  file: string;
  startLine: number;
  endLine: number;
  message: string;
  fingerprint: string;
  fingerprintVersion?: string;
}

export interface LifecycleSummary {
  newIssues: number;
  existingIssues: number;
  fixedIssues: number;
  baselineUsed: boolean;
  baselineCommit?: string;
  baselineTimestamp?: string;
}

export interface DimensionScore {
  score: number;
  issues: ReportIssue[];
}

export interface RuleFailure {
  ruleId: string;
  file: string;
  message: string;
}

export interface RuleRunResult {
  issues: Issue[];
  rulesExecuted: number;
  rulesFailed: number;
  ruleFailures: RuleFailure[];
}

export interface ScanError {
  type: ScanErrorType;
  message: string;
  file?: string;
  ruleId?: string;
}

export interface ToolHealth {
  rulesExecuted: number;
  rulesFailed: number;
  filesConsidered: number;
  filesScanned: number;
  filesExcluded: number;
  filesSkipped: number;
  scanErrors: ScanError[];
  ruleFailures: RuleFailure[];
}

export interface TrustReport {
  schemaVersion: string;
  version: string;
  timestamp: string;
  commit?: string;
  scanMode: ScanMode;
  overall: {
    score: number;
    grade: TrustGrade;
    filesScanned: number;
    issuesFound: number;
  };
  toolHealth: ToolHealth;
  dimensions: {
    security: DimensionScore;
    logic: DimensionScore;
    structure: DimensionScore;
    style: DimensionScore;
    coverage: DimensionScore;
  };
  issues: ReportIssue[];
  lifecycle?: LifecycleSummary;
  fixedIssues?: FixedIssue[];
}

export interface DiffFile {
  filePath: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  content?: string;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  content: string;
}

export interface ScanOptions {
  staged?: boolean;
  diff?: string;
  files?: string[];
  minScore?: number;
  baseline?: string;
  format?: 'terminal' | 'json' | 'html';
}
