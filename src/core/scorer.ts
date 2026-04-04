import { ReportIssue, DimensionScore, TrustGrade, RuleCategory } from '../types/index.js';
import { DimensionWeights } from '../types/config.js';
import { isZhLocale } from '../i18n/index.js';

// Base penalty per severity. Info-level issues are advisory and do not
// affect the trust score.
const SEVERITY_PENALTY: Record<string, number> = {
  high: 15,
  medium: 8,
  low: 3,
  info: 0,
};

// Diminishing factor: the Nth issue of the same severity contributes
// basePenalty * DIMINISHING_FACTOR^(N-1).  This prevents a handful of
// repeated issues from immediately zeroing out the score on larger files.
const DIMINISHING_FACTOR = 0.7;

export function calculateDimensionScore(issues: ReportIssue[]): DimensionScore {
  let score = 100;

  // Track how many issues of each severity we've seen so far
  const severityCounts: Record<string, number> = {};

  for (const issue of issues) {
    const base = SEVERITY_PENALTY[issue.severity] ?? 0;
    if (base === 0) continue;

    const n = severityCounts[issue.severity] ?? 0;
    severityCounts[issue.severity] = n + 1;

    // Diminishing penalty: first issue pays full, subsequent issues pay less
    const penalty = base * Math.pow(DIMINISHING_FACTOR, n);
    score -= penalty;
  }

  return {
    score: Math.round(Math.max(0, Math.min(100, score)) * 10) / 10,
    issues,
  };
}

export function calculateOverallScore(
  dimensions: Record<RuleCategory, DimensionScore>,
  weights: DimensionWeights,
): number {
  const score =
    dimensions.security.score * weights.security +
    dimensions.logic.score * weights.logic +
    dimensions.structure.score * weights.structure +
    dimensions.style.score * weights.style +
    dimensions.coverage.score * weights.coverage;

  return Math.round(Math.max(0, Math.min(100, score)));
}

export function getGrade(score: number): TrustGrade {
  if (score >= 90) return 'HIGH_TRUST';
  if (score >= 70) return 'REVIEW';
  if (score >= 50) return 'LOW_TRUST';
  return 'UNTRUSTED';
}

export function getGradeEmoji(grade: TrustGrade): string {
  switch (grade) {
    case 'HIGH_TRUST':
      return '✅';
    case 'REVIEW':
      return '⚠️';
    case 'LOW_TRUST':
      return '⚠️';
    case 'UNTRUSTED':
      return '❌';
  }
}

export function getGradeLabel(grade: TrustGrade): string {
  const isZh = isZhLocale();
  if (isZh) {
    switch (grade) {
      case 'HIGH_TRUST':
        return '高信任 — 可安全合并';
      case 'REVIEW':
        return '建议审查';
      case 'LOW_TRUST':
        return '低信任 — 需仔细审查';
      case 'UNTRUSTED':
        return '不可信 — 不应合并';
    }
  }
  switch (grade) {
    case 'HIGH_TRUST':
      return 'HIGH TRUST — Safe to merge';
    case 'REVIEW':
      return 'REVIEW RECOMMENDED';
    case 'LOW_TRUST':
      return 'LOW TRUST — Careful review needed';
    case 'UNTRUSTED':
      return 'UNTRUSTED — Do not merge without changes';
  }
}
