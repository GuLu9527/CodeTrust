export type Severity = 'high' | 'medium' | 'low' | 'info';
export type RuleCategory = 'security' | 'logic' | 'structure' | 'style' | 'coverage';
export type TrustGrade = 'HIGH_TRUST' | 'REVIEW' | 'LOW_TRUST' | 'UNTRUSTED';

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

export interface DimensionScore {
  score: number;
  issues: Issue[];
}

export interface TrustReport {
  version: string;
  timestamp: string;
  commit?: string;
  overall: {
    score: number;
    grade: TrustGrade;
    filesScanned: number;
    issuesFound: number;
  };
  dimensions: {
    security: DimensionScore;
    logic: DimensionScore;
    structure: DimensionScore;
    style: DimensionScore;
    coverage: DimensionScore;
  };
  issues: Issue[];
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
  format?: 'terminal' | 'json' | 'html';
}
