import { TrustReport } from '../../types/index.js';

export function renderJsonReport(report: TrustReport): string {
  return JSON.stringify(report, null, 2);
}
