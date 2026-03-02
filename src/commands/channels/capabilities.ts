import { Command } from 'commander';
import { getAdapter } from '../../channels/registry';
import { outputError } from '../../utils/command-output';

export function registerCapabilities(parent: Command): void {
  parent
    .command('capabilities')
    .description('Show supported features of a channel')
    .requiredOption('--channel <name>', 'Channel name (e.g. telegram)')
    .option('--json', 'Output as JSON')
    .action((opts) => {
      const adapter = getAdapter(opts.channel);
      if (!adapter) {
        outputError(opts, `Unknown channel: ${opts.channel}`);
        process.exit(1);
      }

      const result = {
        channel: adapter.info.name,
        displayName: adapter.info.displayName,
        version: adapter.info.version,
        capabilities: adapter.capabilities,
      };

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(`${adapter.info.displayName} v${adapter.info.version}\n`);
      console.log('Capabilities:');
      const caps = adapter.capabilities;
      const entries: [string, boolean][] = [
        ['Text messages', caps.text],
        ['Images', caps.images],
        ['Documents', caps.documents],
        ['Audio', caps.audio],
        ['Video', caps.video],
        ['Group chats', caps.groupChats],
        ['Multi-account', caps.multiAccount],
      ];
      for (const [label, supported] of entries) {
        console.log(`  ${supported ? '+' : '-'} ${label}`);
      }
    });
}
