import { Command } from 'commander';
import { setChannelGroup, removeChannelGroup, listChannelGroups } from '../../config/store';

export function registerGroups(parent: Command): void {
  const groups = parent
    .command('groups')
    .description('Manage named chat groups for channels');

  // List groups (default action when no subcommand)
  groups
    .command('list', { isDefault: true })
    .description('List all saved groups')
    .option('--channel <name>', 'Filter by channel', 'telegram')
    .option('--json', 'Output as JSON')
    .action((opts) => {
      const records = listChannelGroups(opts.channel);
      const entries = Object.entries(records);

      if (opts.json) {
        console.log(JSON.stringify({ channel: opts.channel, groups: records }, null, 2));
        return;
      }

      if (entries.length === 0) {
        console.log(`No groups saved for "${opts.channel}".`);
        console.log('Add one: enconvo channels groups add --name main --chat-id "-5063546642" --label "My Group"');
        return;
      }

      console.log(`Groups for ${opts.channel}:\n`);
      for (const [key, group] of entries) {
        console.log(`  ${key}: ${group.chatId}  (${group.name})`);
      }
    });

  // Add a group
  groups
    .command('add')
    .description('Save a named group')
    .option('--channel <name>', 'Channel type', 'telegram')
    .requiredOption('--name <name>', 'Short name for the group (e.g. main)')
    .requiredOption('--chat-id <id>', 'Telegram chat ID')
    .requiredOption('--label <label>', 'Human-readable label')
    .action((opts) => {
      setChannelGroup(opts.channel, opts.name, { chatId: opts.chatId, name: opts.label });
      console.log(`Group "${opts.name}" saved → ${opts.chatId} (${opts.label})`);
    });

  // Remove a group
  groups
    .command('remove')
    .description('Remove a saved group')
    .option('--channel <name>', 'Channel type', 'telegram')
    .requiredOption('--name <name>', 'Group name to remove')
    .action((opts) => {
      const removed = removeChannelGroup(opts.channel, opts.name);
      if (removed) {
        console.log(`Group "${opts.name}" removed.`);
      } else {
        console.error(`Group "${opts.name}" not found for channel "${opts.channel}".`);
        process.exit(1);
      }
    });
}
