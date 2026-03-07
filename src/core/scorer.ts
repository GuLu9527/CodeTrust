import { Issue, DimensionScore, TrustGrade, RuleCategory } from '../types/index.js';
import { DimensionWeights } from '../types/config.js';
import { isZhLocale } from '../i18n/index.js';

// Info-level issues (e.g. console-in-code) have 0 penalty — they are
// advisory only and do not affect the trust score.
const SEVERITY_PENALTY: Record<string, number> = {
  high: 15,
  medium: 8,
  low: 3,
  info: 0,
};

export function calculateDimensionScore(issues: Issue[]): DimensionScore {
  let score = 100;

  for (const issue of issues) {
    score -= SEVERITY_PENALTY[issue.severity] ?? 0;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
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
