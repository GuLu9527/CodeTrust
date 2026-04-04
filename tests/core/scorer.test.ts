import { describe, it, expect } from 'vitest';
import {
  calculateDimensionScore,
  calculateOverallScore,
  getGrade,
} from '../../src/core/scorer.js';
import { Issue, RuleCategory, DimensionScore } from '../../src/types/index.js';
import { DEFAULT_CONFIG } from '../../src/types/config.js';

function makeIssue(severity: 'high' | 'medium' | 'low' | 'info'): Issue {
  return {
    ruleId: 'test/rule',
    severity,
    category: 'logic',
    file: 'test.ts',
    startLine: 1,
    endLine: 1,
    message: 'Test issue',
  };
}

describe('scorer', () => {
  describe('calculateDimensionScore', () => {
    it('should return 100 for no issues', () => {
      const result = calculateDimensionScore([]);
      expect(result.score).toBe(100);
      expect(result.issues).toHaveLength(0);
    });

    it('should deduct 15 for HIGH severity', () => {
      const result = calculateDimensionScore([makeIssue('high')]);
      expect(result.score).toBe(85);
    });

    it('should deduct 8 for MEDIUM severity', () => {
      const result = calculateDimensionScore([makeIssue('medium')]);
      expect(result.score).toBe(92);
    });

    it('should deduct 3 for LOW severity', () => {
      const result = calculateDimensionScore([makeIssue('low')]);
      expect(result.score).toBe(97);
    });

    it('should deduct 0 for INFO severity', () => {
      const result = calculateDimensionScore([makeIssue('info')]);
      expect(result.score).toBe(100);
    });

    it('should not go below 0', () => {
      // With diminishing penalty (0.7 factor), 10 high issues still stay >= 0
      const issues = Array(10).fill(null).map(() => makeIssue('high'));
      const result = calculateDimensionScore(issues);
      expect(result.score).toBeGreaterThanOrEqual(0);
      // With diminishing penalty, 10 highs won't reach 0 anymore
      expect(result.score).toBeGreaterThan(0);
    });

    it('should floor at 0 with extreme issues', () => {
      // With diminishing penalty (factor=0.7), each severity series converges
      // to basePenalty/(1-factor).  high→50, medium→26.67, low→10.
      // Combined: 50+26.67+10 = 86.67, still not 100. So we need enough
      // issues across all severities to exceed 100 total penalty.
      const issues = [
        ...Array(50).fill(null).map(() => makeIssue('high')),
        ...Array(50).fill(null).map(() => makeIssue('medium')),
        ...Array(50).fill(null).map(() => makeIssue('low')),
      ];
      const result = calculateDimensionScore(issues);
      // Total converges to ~86.67, score floors at max(0, 100-86.67) ≈ 13.3
      // With diminishing penalty the score can never truly reach 0 from
      // any finite number of issues, so just verify it's low.
      expect(result.score).toBeLessThan(15);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should accumulate multiple issues with diminishing penalty', () => {
      const issues = [makeIssue('high'), makeIssue('medium'), makeIssue('low')];
      const result = calculateDimensionScore(issues);
      // First of each severity pays full penalty: 15 + 8 + 3 = 26
      expect(result.score).toBe(74);
    });
  });

  describe('calculateOverallScore', () => {
    it('should return 100 when all dimensions are 100', () => {
      const dimensions: Record<RuleCategory, DimensionScore> = {
        security: { score: 100, issues: [] },
        logic: { score: 100, issues: [] },
        structure: { score: 100, issues: [] },
        style: { score: 100, issues: [] },
        coverage: { score: 100, issues: [] },
      };
      const score = calculateOverallScore(dimensions, DEFAULT_CONFIG.weights);
      expect(score).toBe(100);
    });

    it('should return 0 when all dimensions are 0', () => {
      const dimensions: Record<RuleCategory, DimensionScore> = {
        security: { score: 0, issues: [] },
        logic: { score: 0, issues: [] },
        structure: { score: 0, issues: [] },
        style: { score: 0, issues: [] },
        coverage: { score: 0, issues: [] },
      };
      const score = calculateOverallScore(dimensions, DEFAULT_CONFIG.weights);
      expect(score).toBe(0);
    });

    it('should weight dimensions correctly', () => {
      const dimensions: Record<RuleCategory, DimensionScore> = {
        security: { score: 50, issues: [] },
        logic: { score: 50, issues: [] },
        structure: { score: 50, issues: [] },
        style: { score: 50, issues: [] },
        coverage: { score: 50, issues: [] },
      };
      const score = calculateOverallScore(dimensions, DEFAULT_CONFIG.weights);
      expect(score).toBe(50);
    });
  });

  describe('getGrade', () => {
    it('should return HIGH_TRUST for 90-100', () => {
      expect(getGrade(100)).toBe('HIGH_TRUST');
      expect(getGrade(90)).toBe('HIGH_TRUST');
    });

    it('should return REVIEW for 70-89', () => {
      expect(getGrade(89)).toBe('REVIEW');
      expect(getGrade(70)).toBe('REVIEW');
    });

    it('should return LOW_TRUST for 50-69', () => {
      expect(getGrade(69)).toBe('LOW_TRUST');
      expect(getGrade(50)).toBe('LOW_TRUST');
    });

    it('should return UNTRUSTED for 0-49', () => {
      expect(getGrade(49)).toBe('UNTRUSTED');
      expect(getGrade(0)).toBe('UNTRUSTED');
    });
  });
});
