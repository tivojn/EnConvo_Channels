import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { loadGlobalConfig, saveGlobalConfig, GlobalConfig } from '../config/store';
import { loadAgentsRoster, saveAgentsRoster, AgentsRoster } from '../config/agent-store';
import { ENCONVO_CLI_CONFIG_PATH, AGENTS_CONFIG_PATH, BACKUPS_DIR } from '../config/paths';

export interface ExportBundle {
  exportedAt: string;
  cliVersion: string;
  config: GlobalConfig;
  agents: AgentsRoster;
}

/** Strip all bot tokens from a config, replacing with ***REDACTED*** */
export function stripTokens(config: GlobalConfig): void {
  for (const channelName of Object.keys(config.channels)) {
    for (const instName of Object.keys(config.channels[channelName].instances)) {
      config.channels[channelName].instances[instName].token = '***REDACTED***';
    }
  }
}

/** Check if any instance tokens are redacted */
export function hasRedactedTokens(config: GlobalConfig): boolean {
  for (const ch of Object.values(config.channels)) {
    for (const inst of Object.values(ch.instances)) {
      if (inst.token === '***REDACTED***') return true;
    }
  }
  return false;
}

/** Count channels, instances, and agents in a bundle */
export function countBundleInventory(bundle: ExportBundle): { channels: number; instances: number; agents: number } {
  const channels = Object.keys(bundle.config.channels).length;
  let instances = 0;
  for (const ch of Object.values(bundle.config.channels)) {
    instances += Object.keys(ch.instances).length;
  }
  const agents = bundle.agents.members?.length ?? 0;
  return { channels, instances, agents };
}

/** Merge imported config into existing config (non-destructive) */
export function mergeConfigs(
  current: GlobalConfig,
  imported: GlobalConfig,
): void {
  for (const [chName, chData] of Object.entries(imported.channels)) {
    if (!current.channels[chName]) {
      current.channels[chName] = chData;
    } else {
      for (const [instName, inst] of Object.entries(chData.instances)) {
        if (!current.channels[chName].instances[instName]) {
          current.channels[chName].instances[instName] = inst;
        }
      }
    }
  }
}

/** Merge imported agents into existing roster (skip duplicates) */
export function mergeAgents(
  current: AgentsRoster,
  imported: AgentsRoster,
): void {
  const existingIds = new Set(current.members.map(m => m.id));
  for (const member of imported.members ?? []) {
    if (!existingIds.has(member.id)) {
      current.members.push(member);
    }
  }
}

export function registerExportCommand(program: Command): void {
  program
    .command('export')
    .description('Export configuration and agent roster to a JSON file')
    .option('-o, --output <path>', 'Output file path')
    .option('--strip-tokens', 'Remove bot tokens from export (for sharing)')
    .action((opts) => {
      const config = loadGlobalConfig();
      const agents = loadAgentsRoster();

      if (opts.stripTokens) {
        stripTokens(config);
      }

      const bundle: ExportBundle = {
        exportedAt: new Date().toISOString(),
        cliVersion: '2.0.0',
        config,
        agents,
      };

      const outputPath = opts.output ?? `enconvo-export-${Date.now()}.json`;
      fs.writeFileSync(outputPath, JSON.stringify(bundle, null, 2) + '\n');
      console.log(`Exported to ${outputPath}`);

      if (opts.stripTokens) {
        console.log('Note: Bot tokens have been redacted.');
      }
    });
}

export function registerImportCommand(program: Command): void {
  program
    .command('import')
    .description('Import configuration and agent roster from a JSON file')
    .argument('<file>', 'Path to the export JSON file')
    .option('--merge', 'Merge with existing config instead of replacing')
    .option('--dry-run', 'Show what would be imported without writing')
    .action((file, opts) => {
      if (!fs.existsSync(file)) {
        console.error(`File not found: ${file}`);
        process.exit(1);
      }

      let bundle: ExportBundle;
      try {
        bundle = JSON.parse(fs.readFileSync(file, 'utf-8'));
      } catch {
        console.error('Failed to parse import file. Is it valid JSON?');
        process.exit(1);
      }

      if (!bundle.config || !bundle.agents) {
        console.error('Invalid export file — missing config or agents section.');
        process.exit(1);
      }

      // Inventory
      const inv = countBundleInventory(bundle);

      console.log(`\nImport summary (exported ${bundle.exportedAt || 'unknown'}):`);
      console.log(`  Channels: ${inv.channels}`);
      console.log(`  Instances: ${inv.instances}`);
      console.log(`  Agents: ${inv.agents}`);

      if (hasRedactedTokens(bundle.config)) {
        console.log('\n  Warning: Some tokens are redacted. Those instances will need tokens re-added.');
      }

      if (opts.dryRun) {
        console.log('\n  (dry run — no changes made)');
        return;
      }

      // Backup current config before import
      if (!fs.existsSync(BACKUPS_DIR)) {
        fs.mkdirSync(BACKUPS_DIR, { recursive: true });
      }
      const timestamp = Date.now();
      if (fs.existsSync(ENCONVO_CLI_CONFIG_PATH)) {
        fs.copyFileSync(ENCONVO_CLI_CONFIG_PATH, path.join(BACKUPS_DIR, `config-pre-import-${timestamp}.json`));
      }
      if (fs.existsSync(AGENTS_CONFIG_PATH)) {
        fs.copyFileSync(AGENTS_CONFIG_PATH, path.join(BACKUPS_DIR, `agents-pre-import-${timestamp}.json`));
      }

      if (opts.merge) {
        const currentConfig = loadGlobalConfig();
        const currentAgents = loadAgentsRoster();

        mergeConfigs(currentConfig, bundle.config);
        mergeAgents(currentAgents, bundle.agents);

        saveGlobalConfig(currentConfig);
        saveAgentsRoster(currentAgents);
        console.log('\n  Merged into existing configuration.');
      } else {
        // Replace
        saveGlobalConfig(bundle.config);
        saveAgentsRoster(bundle.agents);
        console.log('\n  Configuration replaced.');
      }

      console.log(`  Backup saved to ${BACKUPS_DIR}/`);
    });
}
