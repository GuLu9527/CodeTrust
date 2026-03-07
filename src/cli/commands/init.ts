import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Command } from 'commander';
import pc from 'picocolors';
import { generateDefaultConfig } from '../../core/config.js';

export function createInitCommand(): Command {
  const cmd = new Command('init')
    .description('Initialize CodeTrust configuration file')
    .action(async () => {
      const configPath = resolve('.codetrust.yml');

      if (existsSync(configPath)) {
        console.log(pc.yellow('⚠️  .codetrust.yml already exists. Skipping.'));
        return;
      }

      try {
        await writeFile(configPath, generateDefaultConfig(), 'utf-8');
        console.log(pc.green('✅ Created .codetrust.yml'));
        console.log(pc.dim('   Edit this file to customize scan behavior.'));
      } catch (err) {
        if (err instanceof Error) {
          console.error(pc.red(`Error creating config: ${err.message}`));
        }
        process.exit(1);
      }
    });

  return cmd;
}
