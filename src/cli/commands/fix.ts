import { Command } from 'commander';
import { loadConfig } from '../../core/config.js';
import { FixEngine } from '../../core/fix-engine.js';
import { resolve } from 'node:path';
import { readdirSync, statSync } from 'node:fs';

/**
 * Recursively collect all .ts/.tsx/.js/.jsx files under a directory,
 * respecting common ignore patterns.
 */
function collectFiles(dir: string): string[] {
  const ignorePatterns = ['node_modules', 'dist', '.git', 'coverage', '.next', 'build'];
  const results: string[] = [];

  function walk(d: string): void {
    const entries = readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      if (ignorePatterns.includes(entry.name)) continue;
      const fullPath = resolve(d, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}

export function createFixCommand(): Command {
  const cmd = new Command('fix')
    .description('Auto-fix issues in source files')
    .argument('[files...]', 'Specific files or directories to fix (default: src/)')
    .option('--dry-run', 'Preview fixes without applying them (default)', true)
    .option('--apply', 'Actually apply the fixes')
    .option('--rule <ruleId>', 'Only fix issues from a specific rule')
    .action(async (files: string[], opts) => {
      try {
        const config = await loadConfig();
        const engine = new FixEngine(config);

        // Resolve files
        let targetFiles: string[];
        if (files.length > 0) {
          targetFiles = [];
          for (const f of files) {
            const resolved = resolve(f);
            try {
              const stat = statSync(resolved);
              if (stat.isDirectory()) {
                targetFiles.push(...collectFiles(resolved));
              } else {
                targetFiles.push(resolved);
              }
            } catch {
              console.error(`File not found: ${f}`);
            }
          }
        } else {
          // Default: scan src/ directory
          targetFiles = collectFiles(resolve('src'));
        }

        if (targetFiles.length === 0) {
          console.log('No files to fix.');
          return;
        }

        const dryRun = !opts.apply;

        const results = await engine.fix({
          files: targetFiles,
          dryRun,
          ruleId: opts.rule,
        });

        console.log(FixEngine.formatResults(results, dryRun));
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
