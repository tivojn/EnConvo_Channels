import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadGlobalConfig, listChannelInstances } from '../config/store';
import { loadAgentsRoster } from '../config/agent-store';
import { listAdapters } from '../channels/registry';
import { ENCONVO_CLI_DIR, ENCONVO_CLI_CONFIG_PATH, AGENTS_CONFIG_PATH, ENCONVO_APP_PLIST } from '../config/paths';

export function getEnConvoAppVersion(): string | null {
  try {
    if (!fs.existsSync(ENCONVO_APP_PLIST)) return null;
    const content = fs.readFileSync(ENCONVO_APP_PLIST, 'utf-8');
    const versionMatch = content.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/);
    return versionMatch?.[1] ?? null;
  } catch {
    return null;
  }
}

export function getPackageVersion(): string {
  try {
    const pkgPath = path.join(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export function registerInfoCommand(program: Command): void {
  program
    .command('info')
    .description('Show system information')
    .option('--json', 'Output as JSON')
    .action((opts: { json?: boolean }) => {
      const config = loadGlobalConfig();
      const cliVersion = getPackageVersion();
      const appVersion = getEnConvoAppVersion();
      const adapters = listAdapters();

      // Count instances
      let totalInstances = 0;
      let enabledInstances = 0;
      const channelSummary: Record<string, { total: number; enabled: number }> = {};

      for (const channelName of Object.keys(config.channels ?? {})) {
        const instances = listChannelInstances(channelName);
        const total = Object.keys(instances).length;
        const enabled = Object.values(instances).filter(i => i.enabled).length;
        totalInstances += total;
        enabledInstances += enabled;
        channelSummary[channelName] = { total, enabled };
      }

      // Agent roster info
      let agentCount = 0;
      let teamName = '';
      try {
        const roster = loadAgentsRoster();
        agentCount = roster.members.length;
        teamName = roster.team;
      } catch {
        // No roster
      }

      const info = {
        cli: {
          version: cliVersion,
          configDir: ENCONVO_CLI_DIR,
          configFile: ENCONVO_CLI_CONFIG_PATH,
          agentsFile: AGENTS_CONFIG_PATH,
          configExists: fs.existsSync(ENCONVO_CLI_CONFIG_PATH),
        },
        enconvoApp: {
          version: appVersion ?? 'not found',
          installed: appVersion !== null,
          savedVersion: config.enconvoApp?.version ?? null,
          apiUrl: config.enconvo.url,
          timeout: config.enconvo.timeoutMs,
        },
        channels: {
          adapters: adapters.map(a => ({
            name: a.info.name,
            displayName: a.info.displayName,
            version: a.info.version,
          })),
          instances: { total: totalInstances, enabled: enabledInstances },
          breakdown: channelSummary,
        },
        agents: {
          team: teamName,
          count: agentCount,
        },
        system: {
          platform: os.platform(),
          arch: os.arch(),
          nodeVersion: process.version,
          home: os.homedir(),
        },
      };

      if (opts.json) {
        console.log(JSON.stringify(info, null, 2));
        return;
      }

      console.log('enconvo_cli System Information\n');
      console.log(`  CLI Version:      ${info.cli.version}`);
      console.log(`  EnConvo App:      ${info.enconvoApp.version}${info.enconvoApp.installed ? '' : ' (not installed)'}`);
      console.log(`  API URL:          ${info.enconvoApp.apiUrl}`);
      console.log(`  Config Dir:       ${info.cli.configDir}`);
      console.log(`  Config Exists:    ${info.cli.configExists ? 'yes' : 'no'}`);
      console.log();
      console.log('  Adapters:');
      for (const a of info.channels.adapters) {
        console.log(`    ${a.displayName} (${a.name}) v${a.version}`);
      }
      console.log();
      console.log(`  Instances:        ${info.channels.instances.enabled}/${info.channels.instances.total} enabled`);
      for (const [ch, counts] of Object.entries(info.channels.breakdown)) {
        console.log(`    ${ch}: ${counts.enabled}/${counts.total}`);
      }
      console.log();
      if (info.agents.count > 0) {
        console.log(`  Team:             ${info.agents.team}`);
        console.log(`  Agents:           ${info.agents.count}`);
      } else {
        console.log('  Agents:           none configured');
      }
      console.log();
      console.log(`  Platform:         ${info.system.platform}/${info.system.arch}`);
      console.log(`  Node.js:          ${info.system.nodeVersion}`);
    });
}
