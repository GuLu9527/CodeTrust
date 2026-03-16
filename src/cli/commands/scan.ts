import { Command } from 'commander';
import { loadConfig } from '../../core/config.js';
import { ScanEngine } from '../../core/engine.js';
import { renderTerminalReport } from '../output/terminal.js';
import { renderJsonReport } from '../output/json.js';
import { ScanOptions } from '../../types/index.js';

export function createScanCommand(): Command {
  const cmd = new Command('scan')
    .description('Run the primary live trust analysis command')
    .argument('[files...]', 'Specific files to scan')
    .option('--staged', 'Scan only git staged files')
    .option('--diff <ref>', 'Scan diff against a git ref (e.g. HEAD~1, origin/main)')
    .option('--format <format>', 'Output format: terminal, json', 'terminal')
    .option('--min-score <score>', 'Minimum trust score threshold', '0')
    .option('--baseline <path>', 'Compare current findings against a prior CodeTrust JSON report')
    .action(async (files: string[], opts) => {
      try {
        const config = await loadConfig();
        const engine = new ScanEngine(config);

        const scanOptions: ScanOptions = {
          staged: opts.staged,
          diff: opts.diff,
          files: files.length > 0 ? files : undefined,
          format: opts.format,
          minScore: parseInt(opts.minScore, 10),
          baseline: opts.baseline,
        };

        const report = await engine.scan(scanOptions);

        if (opts.format === 'json') {
          console.log(renderJsonReport(report));
        } else {
          console.log(renderTerminalReport(report));
        }

        if (scanOptions.minScore && scanOptions.minScore > 0 && report.overall.score < scanOptions.minScore) {
          process.exit(1);
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
