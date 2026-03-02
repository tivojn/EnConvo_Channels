import { Command } from 'commander';
import { createAdapterInstance } from '../../channels/registry';
import { execSync } from 'child_process';
import { outputError } from '../../utils/command-output';

export function registerLogout(parent: Command): void {
  parent
    .command('logout')
    .description('Stop a channel instance')
    .requiredOption('--channel <name>', 'Channel type (e.g. telegram)')
    .requiredOption('--name <name>', 'Instance name (e.g. mavis)')
    .option('--json', 'Output as JSON')
    .action((opts) => {
      const adapter = createAdapterInstance(opts.channel, opts.name);
      if (!adapter) {
        outputError(opts, `Unknown channel: ${opts.channel}`);
        process.exit(1);
      }

      const label = adapter.getServiceLabel();
      try {
        execSync(`launchctl stop ${label}`, { stdio: 'inherit' });
        const result = { channel: opts.channel, instance: opts.name, action: 'stopped', label };
        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`Service "${label}" stopped.`);
        }
      } catch {
        outputError(opts, `Failed to stop service "${label}". Is it running?`);
        process.exit(1);
      }
    });
}
