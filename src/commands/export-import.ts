import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { loadGlobalConfig, saveGlobalConfig, GlobalConfig } from '../config/store';
import { loadAgentsRoster, saveAgentsRoster, AgentsRoster } from '../config/agent-store';
import { ENCONVO_CLI_CONFIG_PATH, AGENTS_CONFIG_PATH, BACKUPS_DIR } from '../config/paths';

interface ExportBundle {
  exportedAt: string;
  cliVersion: string;
  config: GlobalConfig;
  agents: AgentsRoster;
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
        for (const channelName of Object.keys(config.channels)) {
          for (const instName of Object.keys(config.channels[channelName].instances)) {
            config.channels[channelName].instances[instName].token = '***REDACTED***';
          }
        }
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
      const channelCount = Object.keys(bundle.config.channels).length;
      let instanceCount = 0;
      for (const ch of Object.values(bundle.config.channels)) {
        instanceCount += Object.keys(ch.instances).length;
      }
      const agentCount = bundle.agents.members?.length ?? 0;

      console.log(`\nImport summary (exported ${bundle.exportedAt || 'unknown'}):`);
      console.log(`  Channels: ${channelCount}`);
      console.log(`  Instances: ${instanceCount}`);
      console.log(`  Agents: ${agentCount}`);

      // Check for redacted tokens
      let hasRedacted = false;
      for (const ch of Object.values(bundle.config.channels)) {
        for (const inst of Object.values(ch.instances)) {
          if (inst.token === '***REDACTED***') hasRedacted = true;
        }
      }
      if (hasRedacted) {
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
        // Merge: add imported channels/agents without overwriting existing
        const currentConfig = loadGlobalConfig();
        const currentAgents = loadAgentsRoster();

        for (const [chName, chData] of Object.entries(bundle.config.channels)) {
          if (!currentConfig.channels[chName]) {
            currentConfig.channels[chName] = chData;
          } else {
            for (const [instName, inst] of Object.entries(chData.instances)) {
              if (!currentConfig.channels[chName].instances[instName]) {
                currentConfig.channels[chName].instances[instName] = inst;
              }
            }
          }
        }

        const existingIds = new Set(currentAgents.members.map(m => m.id));
        for (const member of bundle.agents.members ?? []) {
          if (!existingIds.has(member.id)) {
            currentAgents.members.push(member);
          }
        }

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
