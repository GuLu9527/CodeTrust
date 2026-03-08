import { readFileSync, writeFileSync } from 'node:fs';
import { Issue } from '../types/index.js';
import { CodeTrustConfig } from '../types/config.js';
import { RuleEngine } from '../rules/engine.js';
import { Fix, RuleContext } from '../rules/types.js';
import { t } from '../i18n/index.js';
import pc from 'picocolors';

export interface FixResult {
  file: string;
  applied: number;
  skipped: number;
  details: FixDetail[];
}

export interface FixDetail {
  ruleId: string;
  line: number;
  message: string;
  status: 'applied' | 'skipped' | 'conflict';
}

export interface FixOptions {
  files: string[];
  dryRun?: boolean;
  ruleId?: string;
  maxIterations?: number;
}

export class FixEngine {
  private ruleEngine: RuleEngine;

  constructor(config: CodeTrustConfig) {
    this.ruleEngine = new RuleEngine(config);
  }

  /**
   * Fix issues in files. Returns results per file.
   * Uses text range replacement to preserve formatting.
   * Applies fixes iteratively (up to maxIterations) to handle cascading issues.
   */
  async fix(options: FixOptions): Promise<FixResult[]> {
    const results: FixResult[] = [];
    const maxIter = options.maxIterations ?? 10;

    for (const filePath of options.files) {
      const result = this.fixFile(filePath, options.dryRun ?? true, options.ruleId, maxIter);
      if (result.applied > 0 || result.skipped > 0) {
        results.push(result);
      }
    }

    return results;
  }

  private fixFile(filePath: string, dryRun: boolean, ruleId: string | undefined, maxIter: number): FixResult {
    const result: FixResult = {
      file: filePath,
      applied: 0,
      skipped: 0,
      details: [],
    };

    let content: string;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      return result;
    }

    for (let iter = 0; iter < maxIter; iter++) {
      const context: RuleContext = {
        filePath,
        fileContent: content,
        addedLines: [],
      };

      // Get all issues
      let issues = this.ruleEngine.run(context);

      // Filter by ruleId if specified
      if (ruleId) {
        issues = issues.filter((i) => i.ruleId === ruleId);
      }

      // Get fixable rules
      const fixableRules = this.ruleEngine.getRules().filter((r) => r.fixable && r.fix);
      const fixableRuleMap = new Map(fixableRules.map((r) => [r.id, r]));

      // Collect fixes
      const fixesWithIssues: Array<{ fix: Fix; issue: Issue }> = [];

      for (const issue of issues) {
        const rule = fixableRuleMap.get(issue.ruleId);
        if (!rule || !rule.fix) continue;

        const fix = rule.fix(context, issue);
        if (fix) {
          fixesWithIssues.push({ fix, issue });
        }
      }

      if (fixesWithIssues.length === 0) break;

      // Sort fixes by range start (descending) so we apply from end to start
      // This avoids offset shifts affecting earlier fixes
      fixesWithIssues.sort((a, b) => b.fix.range[0] - a.fix.range[0]);

      // Detect conflicts (overlapping ranges)
      const nonConflicting: typeof fixesWithIssues = [];
      for (const item of fixesWithIssues) {
        const hasConflict = nonConflicting.some(
          (existing) =>
            item.fix.range[0] < existing.fix.range[1] &&
            item.fix.range[1] > existing.fix.range[0],
        );

        if (hasConflict) {
          result.skipped++;
          result.details.push({
            ruleId: item.issue.ruleId,
            line: item.issue.startLine,
            message: item.issue.message,
            status: 'conflict',
          });
        } else {
          nonConflicting.push(item);
        }
      }

      if (nonConflicting.length === 0) break;

      // Apply fixes (already sorted descending by range start)
      let newContent = content;
      for (const { fix, issue } of nonConflicting) {
        const before = newContent.slice(0, fix.range[0]);
        const after = newContent.slice(fix.range[1]);
        newContent = before + fix.text + after;

        result.applied++;
        result.details.push({
          ruleId: issue.ruleId,
          line: issue.startLine,
          message: issue.message,
          status: 'applied',
        });
      }

      content = newContent;

      // Only one iteration for now unless there are cascading fixes
      if (nonConflicting.length === 0) break;
    }

    // Write the fixed content back (unless dry-run)
    if (!dryRun && result.applied > 0) {
      writeFileSync(filePath, content, 'utf-8');
    }

    return result;
  }

  /**
   * Format fix results for terminal output.
   */
  static formatResults(results: FixResult[], dryRun: boolean): string {
    if (results.length === 0) {
      return pc.green(t('No fixable issues found.', '未发现可修复的问题。'));
    }

    const lines: string[] = [];
    const modeLabel = dryRun
      ? pc.yellow(t('[DRY RUN]', '[预演模式]'))
      : pc.green(t('[APPLIED]', '[已应用]'));

    lines.push(`\n${modeLabel} ${t('Fix Results:', '修复结果：')}\n`);

    let totalApplied = 0;
    let totalSkipped = 0;

    for (const result of results) {
      lines.push(pc.bold(pc.underline(result.file)));

      for (const detail of result.details) {
        const icon =
          detail.status === 'applied'
            ? pc.green('✓')
            : detail.status === 'conflict'
              ? pc.yellow('⚠')
              : pc.dim('–');
        const lineRef = pc.dim(`L${detail.line}`);
        const ruleRef = pc.cyan(detail.ruleId);
        lines.push(`  ${icon} ${lineRef} ${ruleRef} ${detail.message}`);
      }

      totalApplied += result.applied;
      totalSkipped += result.skipped;
      lines.push('');
    }

    lines.push(
      pc.bold(
        t(
          `${totalApplied} fix(es) ${dryRun ? 'would be' : ''} applied, ${totalSkipped} skipped`,
          `${totalApplied} 个修复${dryRun ? '将被' : '已'}应用，${totalSkipped} 个跳过`,
        ),
      ),
    );

    if (dryRun) {
      lines.push(
        pc.dim(
          t(
            'Run without --dry-run to apply fixes.',
            '移除 --dry-run 以应用修复。',
          ),
        ),
      );
    }

    return lines.join('\n');
  }
}
