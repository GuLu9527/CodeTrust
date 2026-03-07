export { ScanEngine } from './core/engine.js';
export { loadConfig, generateDefaultConfig } from './core/config.js';
export { RuleEngine } from './rules/engine.js';
export { DiffParser } from './parsers/diff.js';
export {
  calculateDimensionScore,
  calculateOverallScore,
  getGrade,
  getGradeEmoji,
  getGradeLabel,
} from './core/scorer.js';

export type {
  Issue,
  DiffFile,
  DiffHunk,
  TrustReport,
  DimensionScore,
  ScanOptions,
  Severity,
  RuleCategory,
  TrustGrade,
} from './types/index.js';

export type { CodeTrustConfig } from './types/config.js';
