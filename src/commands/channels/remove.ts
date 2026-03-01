import { Command } from 'commander';
import { removeChannelConfig } from '../../config/store';

export function registerRemove(parent: Command): void {
  parent
    .command('remove')
    .description('Remove or disable a channel configuration')
    .requiredOption('--channel <name>', 'Channel name (e.g. telegram)')
    .option('--delete', 'Permanently delete config (default: just disable)')
    .option('--json', 'Output as JSON')
    .action((opts) => {
      const removed = removeChannelConfig(opts.channel, !!opts.delete);

      const result = {
        channel: opts.channel,
        action: opts.delete ? 'deleted' : 'disabled',
        success: removed,
      };

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (!removed) {
        console.log(`Channel "${opts.channel}" is not configured.`);
      } else if (opts.delete) {
        console.log(`Channel "${opts.channel}" configuration deleted.`);
      } else {
        console.log(`Channel "${opts.channel}" disabled.`);
      }
    });
}
