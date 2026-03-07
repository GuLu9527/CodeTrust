import { Command } from 'commander';
import pc from 'picocolors';
import Table from 'cli-table3';
import { loadConfig } from '../../core/config.js';
import { RuleEngine } from '../../rules/engine.js';

export function createRulesCommand(): Command {
  const cmd = new Command('rules')
    .description('Manage analysis rules');

  cmd
    .command('list')
    .description('List all available rules')
    .action(async () => {
      const config = await loadConfig();
      const ruleEngine = new RuleEngine(config);
      const rules = ruleEngine.listRules();

      const table = new Table({
        head: [
          pc.bold('ID'),
          pc.bold('Category'),
          pc.bold('Severity'),
          pc.bold('Title'),
        ],
        style: { head: [], border: [] },
      });

      for (const rule of rules) {
        const isDisabled = config.rules.disabled.includes(rule.id);
        const id = isDisabled ? pc.strikethrough(pc.dim(rule.id)) : rule.id;
        const status = isDisabled ? pc.dim(' (disabled)') : '';

        table.push([
          id + status,
          rule.category,
          formatSeverity(rule.severity),
          rule.title,
        ]);
      }

      console.log('');
      console.log(pc.bold('📋 CodeTrust Rules'));
      console.log('');
      console.log(table.toString());
      console.log('');
      console.log(pc.dim(`Total: ${rules.length} rules`));
    });

  return cmd;
}

function formatSeverity(severity: string): string {
  switch (severity) {
    case 'high':
      return pc.red('HIGH');
    case 'medium':
      return pc.yellow('MEDIUM');
    case 'low':
      return pc.cyan('LOW');
    case 'info':
      return pc.dim('INFO');
    default:
      return severity;
  }
}
