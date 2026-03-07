import { Command } from 'commander';
import { createScanCommand } from './commands/scan.js';
import { createReportCommand } from './commands/report.js';
import { createInitCommand } from './commands/init.js';
import { createRulesCommand } from './commands/rules.js';
import { createHookCommand } from './commands/hook.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'));

const program = new Command();

program
  .name('codetrust')
  .description('AI code trust verification tool — verify AI-generated code with deterministic algorithms')
  .version(pkg.version);

program.addCommand(createScanCommand());
program.addCommand(createReportCommand());
program.addCommand(createInitCommand());
program.addCommand(createRulesCommand());
program.addCommand(createHookCommand());

program.parse();
