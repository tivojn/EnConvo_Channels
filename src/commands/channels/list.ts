import { Command } from 'commander';
import { listAdapters } from '../../channels/registry';
import { loadGlobalConfig } from '../../config/store';

export function registerList(parent: Command): void {
  parent
    .command('list')
    .description('List available channels and their configuration status')
    .option('--json', 'Output as JSON')
    .action((opts) => {
      const adapters = listAdapters();
      const config = loadGlobalConfig();

      const results = adapters.map((adapter) => {
        const channelConfig = config.channels[adapter.info.name];
        const configured = !!channelConfig;
        const enabled = configured && (channelConfig as Record<string, unknown>).enabled === true;

        return {
          name: adapter.info.name,
          displayName: adapter.info.displayName,
          version: adapter.info.version,
          description: adapter.info.description,
          configured,
          enabled,
        };
      });

      if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      if (results.length === 0) {
        console.log('No channels available.');
        return;
      }

      console.log('Available channels:\n');
      for (const ch of results) {
        const status = ch.enabled ? 'enabled' : ch.configured ? 'disabled' : 'not configured';
        console.log(`  ${ch.displayName} (${ch.name})`);
        console.log(`    ${ch.description}`);
        console.log(`    Status: ${status}  |  Version: ${ch.version}`);
        console.log();
      }
    });
}
