import { TrustReport } from '../../types/index.js';

export function renderJsonReport(report: TrustReport): string {
  const payload = {
    schemaVersion: report.schemaVersion,
    version: report.version,
    timestamp: report.timestamp,
    commit: report.commit,
    scanMode: report.scanMode,
    overall: report.overall,
    toolHealth: report.toolHealth,
    dimensions: report.dimensions,
    issues: report.issues,
    lifecycle: report.lifecycle,
    fixedIssues: report.fixedIssues,
  };

  return JSON.stringify(payload, null, 2);
}
