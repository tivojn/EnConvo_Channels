import { Command } from 'commander';
import { getAdapter } from '../../channels/registry';
import { setChannelConfig, loadGlobalConfig } from '../../config/store';

export function registerAdd(parent: Command): void {
  parent
    .command('add')
    .description('Configure a channel')
    .requiredOption('--channel <name>', 'Channel name (e.g. telegram)')
    .option('--token <token>', 'Bot/API token')
    .option('--validate', 'Validate credentials before saving')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const adapter = getAdapter(opts.channel);
      if (!adapter) {
        const msg = `Unknown channel: ${opts.channel}`;
        if (opts.json) {
          console.log(JSON.stringify({ error: msg }));
        } else {
          console.error(msg);
        }
        process.exit(1);
      }

      const existing = loadGlobalConfig().channels[opts.channel] as Record<string, unknown> | undefined;

      const channelConfig: Record<string, unknown> = {
        ...(existing ?? {}),
        enabled: true,
      };

      if (opts.token) {
        channelConfig.token = opts.token;
      }

      // Set default service config for telegram
      if (opts.channel === 'telegram' && !channelConfig.service) {
        channelConfig.service = {
          plistLabel: 'com.enconvo.telegram-adapter',
          logPath: '~/Library/Logs/enconvo-telegram-adapter.log',
          errorLogPath: '~/Library/Logs/enconvo-telegram-adapter-error.log',
        };
        if (!channelConfig.allowedUserIds) {
          channelConfig.allowedUserIds = [];
        }
      }

      // Validate if requested
      if (opts.validate) {
        console.log('Validating credentials...');
        const result = await adapter.validateCredentials(channelConfig);
        if (!result.valid) {
          const msg = `Validation failed: ${result.error}`;
          if (opts.json) {
            console.log(JSON.stringify({ error: msg }));
          } else {
            console.error(msg);
          }
          process.exit(1);
        }
      }

      setChannelConfig(opts.channel, channelConfig);

      const output = { channel: opts.channel, action: 'added', config: channelConfig };
      if (opts.json) {
        console.log(JSON.stringify(output, null, 2));
      } else {
        console.log(`Channel "${opts.channel}" configured and enabled.`);
        console.log(`Config saved to ~/.enconvo_cli/config.json`);
      }
    });
}
