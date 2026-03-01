import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { loadGlobalConfig, saveGlobalConfig } from '../config/store';
import { ENCONVO_CLI_CONFIG_PATH, AGENTS_CONFIG_PATH, BACKUPS_DIR } from '../config/paths';

export function registerResetCommand(program: Command): void {
  program
    .command('reset')
    .description('Reset configuration to defaults (backs up current config first)')
    .option('--channel <name>', 'Reset a specific channel only')
    .option('--agents', 'Reset agent roster only')
    .option('--all', 'Reset everything (config + agents)')
    .option('--force', 'Skip confirmation')
    .action((opts) => {
      if (!opts.channel && !opts.agents && !opts.all) {
        console.log('Specify what to reset:');
        console.log('  --channel <name>  Reset a specific channel');
        console.log('  --agents          Reset agent roster');
        console.log('  --all             Reset everything');
        return;
      }

      // Ensure backups dir
      if (!fs.existsSync(BACKUPS_DIR)) {
        fs.mkdirSync(BACKUPS_DIR, { recursive: true });
      }

      const timestamp = Date.now();

      if (opts.channel) {
        resetChannel(opts.channel, timestamp);
        return;
      }

      if (opts.agents) {
        resetAgents(timestamp);
        return;
      }

      if (opts.all) {
        resetAll(timestamp);
        return;
      }
    });
}

function resetChannel(channelName: string, timestamp: number): void {
  const config = loadGlobalConfig();

  if (!config.channels[channelName]) {
    console.log(`Channel "${channelName}" not found in config.`);
    return;
  }

  // Backup
  if (fs.existsSync(ENCONVO_CLI_CONFIG_PATH)) {
    fs.copyFileSync(ENCONVO_CLI_CONFIG_PATH, path.join(BACKUPS_DIR, `config-pre-reset-${timestamp}.json`));
  }

  const instanceCount = Object.keys(config.channels[channelName].instances).length;
  delete config.channels[channelName];
  saveGlobalConfig(config);

  console.log(`Reset ${channelName} (${instanceCount} instance(s) removed).`);
  console.log(`Backup saved to ${BACKUPS_DIR}/`);
}

function resetAgents(timestamp: number): void {
  if (fs.existsSync(AGENTS_CONFIG_PATH)) {
    fs.copyFileSync(AGENTS_CONFIG_PATH, path.join(BACKUPS_DIR, `agents-pre-reset-${timestamp}.json`));
    fs.writeFileSync(AGENTS_CONFIG_PATH, JSON.stringify({ version: 1, team: 'EnConvo AI Team', members: [] }, null, 2) + '\n');
    console.log('Agent roster reset to empty.');
    console.log(`Backup saved to ${BACKUPS_DIR}/`);
  } else {
    console.log('No agent roster found — nothing to reset.');
  }
}

function resetAll(timestamp: number): void {
  if (fs.existsSync(ENCONVO_CLI_CONFIG_PATH)) {
    fs.copyFileSync(ENCONVO_CLI_CONFIG_PATH, path.join(BACKUPS_DIR, `config-pre-reset-${timestamp}.json`));
    fs.unlinkSync(ENCONVO_CLI_CONFIG_PATH);
  }

  if (fs.existsSync(AGENTS_CONFIG_PATH)) {
    fs.copyFileSync(AGENTS_CONFIG_PATH, path.join(BACKUPS_DIR, `agents-pre-reset-${timestamp}.json`));
    fs.unlinkSync(AGENTS_CONFIG_PATH);
  }

  console.log('All configuration reset to defaults.');
  console.log(`Backup saved to ${BACKUPS_DIR}/`);
  console.log('Run `enconvo configure` to set up again.');
}
