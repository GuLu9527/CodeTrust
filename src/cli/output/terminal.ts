import pc from 'picocolors';
import Table from 'cli-table3';
import { TrustReport, Issue } from '../../types/index.js';
import { getGradeEmoji, getGradeLabel } from '../../core/scorer.js';
import { isZhLocale } from '../../i18n/index.js';

// 翻译字典
const en = {
  reportTitle: '📊 CodeTrust Report',
  overallScore: 'Overall Trust Score',
  dimension: 'Dimension',
  score: 'Score',
  details: 'Details',
  noIssues: 'No issues',
  issuesFound: '{{count}} issue(s) found',
  issuesHeader: 'Issues ({{count}}):',
  noIssuesFound: 'No issues found! 🎉',
  scanned: 'Scanned {{count}} file(s)',
};

const zh = {
  reportTitle: '📊 CodeTrust 报告',
  overallScore: '总体信任评分',
  dimension: '维度',
  score: '评分',
  details: '详情',
  noIssues: '无问题',
  issuesFound: '发现 {{count}} 个问题',
  issuesHeader: '问题列表 ({{count}}):',
  noIssuesFound: '未发现问题! 🎉',
  scanned: '扫描了 {{count}} 个文件',
};

export function renderTerminalReport(report: TrustReport): string {
  const isZh = isZhLocale();
  const t = isZh ? zh : en;

  const lines: string[] = [];

  const commitLabel = report.commit ? ` — commit ${report.commit}` : '';
  lines.push('');
  lines.push(pc.bold(`${t.reportTitle}${commitLabel}`));
  lines.push(pc.dim('═'.repeat(50)));
  lines.push('');

  const emoji = getGradeEmoji(report.overall.grade);
  const label = getGradeLabel(report.overall.grade);
  const scoreColor = getScoreColor(report.overall.score);
  lines.push(
    `${t.overallScore}: ${scoreColor(pc.bold(String(report.overall.score) + '/100'))} ${emoji} ${pc.bold(label)}`,
  );
  lines.push('');

  const table = new Table({
    head: [
      pc.bold(t.dimension),
      pc.bold(t.score),
      pc.bold(t.details),
    ],
    style: { head: [], border: [] },
    colWidths: [16, 8, 40],
  });

  const dimLabels = isZh ? {
    security: '安全',
    logic: '逻辑',
    structure: '结构',
    style: '风格',
    coverage: '覆盖',
  } : {
    security: 'Security',
    logic: 'Logic',
    structure: 'Structure',
    style: 'Style',
    coverage: 'Coverage',
  };

  const dims = ['security', 'logic', 'structure', 'style', 'coverage'] as const;

  for (const dim of dims) {
    const d = report.dimensions[dim];
    const dimEmoji = d.score >= 80 ? '✅' : d.score >= 60 ? '⚠️' : '❌';
    const color = getScoreColor(d.score);
    const issueCount = d.issues.length;
    const detail = issueCount === 0
      ? pc.green(t.noIssues)
      : t.issuesFound.replace('{{count}}', String(issueCount));

    table.push([
      `${dimEmoji} ${dimLabels[dim]}`,
      color(String(d.score)),
      detail,
    ]);
  }

  lines.push(table.toString());
  lines.push('');

  if (report.issues.length > 0) {
    lines.push(pc.bold(t.issuesHeader.replace('{{count}}', String(report.issues.length))));
    lines.push('');

    for (const issue of report.issues) {
      lines.push(formatIssue(issue, isZh));
    }
  } else {
    lines.push(pc.green(pc.bold(t.noIssuesFound)));
  }

  lines.push('');
  lines.push(
    pc.dim(`${t.scanned.replace('{{count}}', String(report.overall.filesScanned))} • ${new Date(report.timestamp).toLocaleString()}`),
  );
  lines.push('');

  return lines.join('\n');
}

function formatIssue(issue: Issue, isZh?: boolean): string {
  const severityLabel = formatSeverity(issue.severity, isZh);
  const location = pc.dim(`${issue.file}:${issue.startLine}-${issue.endLine}`);
  const message = issue.message;
  const suggestion = issue.suggestion ? `\n           ${pc.dim('💡 ' + issue.suggestion)}` : '';

  return `  ${severityLabel} ${location}\n           ${message}${suggestion}\n`;
}

function formatSeverity(severity: string, isZh?: boolean): string {
  if (isZh) {
    switch (severity) {
      case 'high':
        return pc.red(pc.bold('❌ 高  '));
      case 'medium':
        return pc.yellow(pc.bold('⚠️ 中'));
      case 'low':
        return pc.cyan(pc.bold('ℹ️ 低  '));
      case 'info':
        return pc.dim('📝 提示 ');
      default:
        return severity;
    }
  }
  switch (severity) {
    case 'high':
      return pc.red(pc.bold('❌ HIGH  '));
    case 'medium':
      return pc.yellow(pc.bold('⚠️ MEDIUM'));
    case 'low':
      return pc.cyan(pc.bold('ℹ️ LOW   '));
    case 'info':
      return pc.dim('📝 INFO  ');
    default:
      return severity;
  }
}

function getScoreColor(score: number): (text: string) => string {
  if (score >= 90) return pc.green;
  if (score >= 70) return pc.yellow;
  if (score >= 50) return pc.magenta;
  return pc.red;
}
