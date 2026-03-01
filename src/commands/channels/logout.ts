import { Command } from 'commander';
import { getAdapter } from '../../channels/registry';
import { execSync } from 'child_process';

export function registerLogout(parent: Command): void {
  parent
    .command('logout')
    .description('Stop a channel service')
    .requiredOption('--channel <name>', 'Channel name (e.g. telegram)')
    .option('--json', 'Output as JSON')
    .action((opts) => {
      const adapter = getAdapter(opts.channel);
      if (!adapter) {
        if (opts.json) {
          console.log(JSON.stringify({ error: `Unknown channel: ${opts.channel}` }));
        } else {
          console.error(`Unknown channel: ${opts.channel}`);
        }
        process.exit(1);
      }

      const label = adapter.getServiceLabel();
      try {
        execSync(`launchctl stop ${label}`, { stdio: 'inherit' });
        const result = { channel: opts.channel, action: 'stopped', label };
        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`Service "${label}" stopped.`);
        }
      } catch {
        if (opts.json) {
          console.log(JSON.stringify({ error: `Failed to stop service "${label}". Is it running?` }));
        } else {
          console.error(`Failed to stop service "${label}". Is it running?`);
        }
        process.exit(1);
      }
    });
}
