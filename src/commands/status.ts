import { Command } from 'commander';
import { loadGlobalConfig, listChannelInstances } from '../config/store';
import { loadAgentsRoster } from '../config/agent-store';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show overall system status')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      const config = loadGlobalConfig();
      const roster = loadAgentsRoster();

      // Gather channel instances
      const channelStatus: Record<string, { instances: number; enabled: number }> = {};
      for (const channelName of Object.keys(config.channels ?? {})) {
        const instances = listChannelInstances(channelName);
        const entries = Object.entries(instances);
        const enabled = entries.filter(([, inst]) => inst.enabled).length;
        channelStatus[channelName] = { instances: entries.length, enabled };
      }

      // Probe EnConvo API
      let enconvoReachable = false;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        const resp = await fetch(`${config.enconvo.url}/health`, { signal: controller.signal });
        clearTimeout(timer);
        enconvoReachable = resp.ok;
      } catch {
        // Not reachable
      }

      const status = {
        enconvo: {
          url: config.enconvo.url,
          reachable: enconvoReachable,
        },
        agents: {
          team: roster.team,
          count: roster.members.length,
          lead: roster.members.find(m => m.isLead)?.name ?? 'none',
        },
        channels: channelStatus,
      };

      if (opts.json) {
        console.log(JSON.stringify(status, null, 2));
        return;
      }

      // Human-readable output
      console.log(`EnConvo API:  ${config.enconvo.url} ${enconvoReachable ? '(reachable)' : '(unreachable)'}`);
      console.log(`Team:         ${roster.team} (${roster.members.length} agents)`);
      console.log(`Lead:         ${status.agents.lead}`);
      console.log();

      if (Object.keys(channelStatus).length === 0) {
        console.log('Channels:     none configured');
      } else {
        console.log('Channels:');
        for (const [ch, info] of Object.entries(channelStatus)) {
          console.log(`  ${ch}: ${info.enabled}/${info.instances} instances enabled`);
        }
      }
    });
}
