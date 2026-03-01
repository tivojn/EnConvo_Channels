import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadGlobalConfig, listChannelInstances } from '../config/store';

function expandHome(p: string): string {
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

export function registerLogsCommand(program: Command): void {
  program
    .command('logs')
    .description('Tail adapter log files')
    .option('-c, --channel <name>', 'Channel name', 'telegram')
    .option('-n, --name <instance>', 'Instance name')
    .option('-e, --errors', 'Show error log instead of stdout log')
    .option('--lines <n>', 'Number of lines to show', '50')
    .option('--list', 'List available log files')
    .action((opts: { channel: string; name?: string; errors?: boolean; lines: string; list?: boolean }) => {
      const config = loadGlobalConfig();

      if (opts.list) {
        listAllLogs(config);
        return;
      }

      const instances = listChannelInstances(opts.channel);
      const names = Object.keys(instances);

      if (names.length === 0) {
        console.log(`No instances configured for channel "${opts.channel}".`);
        return;
      }

      const instanceName = opts.name ?? names[0];
      const instance = instances[instanceName];

      if (!instance) {
        console.log(`Instance "${instanceName}" not found for channel "${opts.channel}".`);
        console.log(`Available: ${names.join(', ')}`);
        return;
      }

      const logKey = opts.errors ? 'errorLogPath' : 'logPath';
      const logPath = instance.service?.[logKey];

      if (!logPath) {
        console.log(`No ${logKey} configured for ${opts.channel}/${instanceName}.`);
        return;
      }

      const resolvedPath = expandHome(logPath);

      if (!fs.existsSync(resolvedPath)) {
        console.log(`Log file not found: ${resolvedPath}`);
        console.log('The adapter may not have been started yet.');
        return;
      }

      const lineCount = parseInt(opts.lines, 10);
      const content = fs.readFileSync(resolvedPath, 'utf-8');
      const lines = content.split('\n');
      const tail = lines.slice(-lineCount).join('\n');

      console.log(`--- ${resolvedPath} (last ${lineCount} lines) ---\n`);
      console.log(tail);
    });
}

function listAllLogs(config: ReturnType<typeof loadGlobalConfig>): void {
  let found = false;

  for (const channelName of Object.keys(config.channels ?? {})) {
    const instances = config.channels[channelName]?.instances ?? {};
    for (const [name, inst] of Object.entries(instances)) {
      if (inst.service?.logPath || inst.service?.errorLogPath) {
        if (!found) {
          console.log('Available log files:\n');
          found = true;
        }
        const logExists = inst.service.logPath ? fs.existsSync(expandHome(inst.service.logPath)) : false;
        const errExists = inst.service.errorLogPath ? fs.existsSync(expandHome(inst.service.errorLogPath)) : false;
        console.log(`  ${channelName}/${name}:`);
        if (inst.service.logPath) {
          console.log(`    stdout: ${inst.service.logPath} ${logExists ? '(exists)' : '(not found)'}`);
        }
        if (inst.service.errorLogPath) {
          console.log(`    stderr: ${inst.service.errorLogPath} ${errExists ? '(exists)' : '(not found)'}`);
        }
      }
    }
  }

  if (!found) {
    console.log('No log files configured.');
  }
}
