import { Command } from 'commander';
import { getAdapter } from '../../channels/registry';
import { loadGlobalConfig } from '../../config/store';
import { execSync } from 'child_process';

export function registerLogin(parent: Command): void {
  parent
    .command('login')
    .description('Start a channel service')
    .requiredOption('--channel <name>', 'Channel name (e.g. telegram)')
    .option('-f, --foreground', 'Run in foreground (blocking)')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const adapter = getAdapter(opts.channel);
      if (!adapter) {
        outputError(opts, `Unknown channel: ${opts.channel}`);
        process.exit(1);
      }

      const config = loadGlobalConfig();
      const channelConfig = config.channels[opts.channel] as Record<string, unknown> | undefined;

      if (!channelConfig) {
        outputError(opts, `Channel "${opts.channel}" is not configured. Run: enconvo channels add --channel ${opts.channel} --token <token>`);
        process.exit(1);
      }

      if (!channelConfig.enabled) {
        outputError(opts, `Channel "${opts.channel}" is disabled. Run: enconvo channels add --channel ${opts.channel}`);
        process.exit(1);
      }

      if (opts.foreground) {
        // Run in foreground — blocking
        if (!opts.json) {
          console.log(`Starting ${adapter.info.displayName} in foreground...`);
        }

        const shutdown = () => {
          console.log('\nShutting down...');
          adapter.stop().then(() => process.exit(0));
        };
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);

        try {
          await adapter.start(channelConfig);
        } catch (err) {
          outputError(opts, `Failed to start: ${err}`);
          process.exit(1);
        }
      } else {
        // Start via launchd
        const label = adapter.getServiceLabel();
        try {
          execSync(`launchctl start ${label}`, { stdio: 'inherit' });
          const result = { channel: opts.channel, action: 'started', method: 'launchd', label };
          if (opts.json) {
            console.log(JSON.stringify(result, null, 2));
          } else {
            console.log(`Service "${label}" started.`);
            console.log(`Run 'enconvo channels logs --channel ${opts.channel}' to view output.`);
          }
        } catch {
          outputError(opts, `Failed to start service "${label}". Is it installed? Run: npm run install-service`);
          process.exit(1);
        }
      }
    });
}

function outputError(opts: { json?: boolean }, msg: string): void {
  if (opts.json) {
    console.log(JSON.stringify({ error: msg }));
  } else {
    console.error(msg);
  }
}
