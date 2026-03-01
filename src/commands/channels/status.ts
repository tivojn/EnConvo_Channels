import { Command } from 'commander';
import { getAdapter, listAdapterNames } from '../../channels/registry';
import { loadGlobalConfig } from '../../config/store';
import { execSync } from 'child_process';

export function registerStatus(parent: Command): void {
  parent
    .command('status')
    .description('Show runtime status of channels')
    .option('--probe', 'Probe live connection (requires running service)')
    .option('--channel <name>', 'Check a specific channel')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const config = loadGlobalConfig();
      const channelNames = opts.channel ? [opts.channel] : listAdapterNames();

      const results: Record<string, unknown>[] = [];

      for (const name of channelNames) {
        const adapter = getAdapter(name);
        if (!adapter) {
          results.push({ channel: name, error: 'Unknown channel' });
          continue;
        }

        const channelConfig = config.channels[name];
        const configured = !!channelConfig;
        const enabled = configured && (channelConfig as Record<string, unknown>).enabled === true;

        // Check if launchd service is running
        let serviceRunning = false;
        try {
          const label = adapter.getServiceLabel();
          const output = execSync(`launchctl list ${label} 2>/dev/null`, { encoding: 'utf-8' });
          serviceRunning = !output.includes('"ExitCode"') || output.includes('"PID"');
        } catch {
          // Service not loaded
        }

        const result: Record<string, unknown> = {
          channel: name,
          configured,
          enabled,
          serviceRunning,
        };

        if (opts.probe && serviceRunning) {
          // For probing, we'd need a running in-process bot. Show service-level info instead.
          const logs = adapter.getLogPaths();
          result.logPath = logs.stdout;
          result.probe = 'Service is running (use `enconvo channels logs` to inspect)';
        }

        results.push(result);
      }

      if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      for (const r of results) {
        if (r.error) {
          console.log(`${r.channel}: ${r.error}`);
          continue;
        }
        console.log(`${r.channel}:`);
        console.log(`  Configured: ${r.configured ? 'yes' : 'no'}`);
        console.log(`  Enabled:    ${r.enabled ? 'yes' : 'no'}`);
        console.log(`  Service:    ${r.serviceRunning ? 'running' : 'stopped'}`);
        if (r.probe) console.log(`  Probe:      ${r.probe}`);
        console.log();
      }
    });
}
