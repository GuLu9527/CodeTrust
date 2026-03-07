import { writeFile, chmod, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Command } from 'commander';
import pc from 'picocolors';

const HOOK_CONTENT = `#!/bin/sh
# CodeTrust pre-commit hook
codetrust scan --staged --min-score 70 --format terminal
if [ $? -ne 0 ]; then
  echo ""
  echo "CodeTrust: Trust score below threshold. Use --no-verify to bypass."
  exit 1
fi
`;

export function createHookCommand(): Command {
  const cmd = new Command('hook')
    .description('Manage git hooks');

  cmd
    .command('install')
    .description('Install pre-commit hook')
    .action(async () => {
      const gitDir = resolve('.git');

      if (!existsSync(gitDir)) {
        console.error(pc.red('Error: Not a git repository.'));
        process.exit(1);
      }

      const hooksDir = join(gitDir, 'hooks');
      const hookPath = join(hooksDir, 'pre-commit');

      try {
        if (!existsSync(hooksDir)) {
          await mkdir(hooksDir, { recursive: true });
        }

        if (existsSync(hookPath)) {
          console.log(pc.yellow('⚠️  pre-commit hook already exists. Skipping.'));
          console.log(pc.dim('   Remove .git/hooks/pre-commit to reinstall.'));
          return;
        }

        await writeFile(hookPath, HOOK_CONTENT, 'utf-8');
        await chmod(hookPath, '755');

        console.log(pc.green('✅ Installed pre-commit hook'));
        console.log(pc.dim('   CodeTrust will run on every commit.'));
        console.log(pc.dim('   Use --no-verify to bypass.'));
      } catch (err) {
        if (err instanceof Error) {
          console.error(pc.red(`Error installing hook: ${err.message}`));
        }
        process.exit(1);
      }
    });

  return cmd;
}
