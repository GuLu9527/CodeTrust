import { Command } from 'commander';
import { loadConfig } from '../../core/config.js';
import { ScanEngine } from '../../core/engine.js';
import { renderTerminalReport } from '../output/terminal.js';
import { renderJsonReport } from '../output/json.js';

export function createReportCommand(): Command {
  const cmd = new Command('report')
    .description('Render a report for a diff-based scan (transitional wrapper around scan)')
    .option('--json', 'Output as JSON')
    .option('--diff <ref>', 'Diff against a git ref for report presentation', 'HEAD~1')
    .action(async (opts) => {
      try {
        const config = await loadConfig();
        const engine = new ScanEngine(config);

        const report = await engine.scan({ diff: opts.diff });

        if (opts.json) {
          console.log(renderJsonReport(report));
        } else {
          console.log(renderTerminalReport(report));
        }
      } catch (err) {
        if (err instanceof Error) {
          console.error(`Error: ${err.message}`);
        } else {
          console.error('An unexpected error occurred');
        }
        process.exit(1);
      }
    });

  return cmd;
}
