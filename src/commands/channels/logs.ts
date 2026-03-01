import { Command } from 'commander';
import { getAdapter } from '../../channels/registry';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';

function expandHome(p: string): string {
  return p.replace(/^~/, os.homedir());
}

export function registerLogs(parent: Command): void {
  parent
    .command('logs')
    .description('Tail channel log files')
    .requiredOption('--channel <name>', 'Channel name (e.g. telegram)')
    .option('--lines <n>', 'Number of lines to show', '50')
    .option('--follow', 'Follow log output (tail -f)', false)
    .option('--error', 'Show error log instead of stdout log')
    .option('--json', 'Output as JSON')
    .action((opts) => {
      const adapter = getAdapter(opts.channel);
      if (!adapter) {
        if (opts.json) {
          console.log(JSON.stringify({ error: `Unknown channel: ${opts.channel}` }));
        } else {
          console.error(`Unknown channel: ${opts.channel}`);
        }
        process.exit(1);
      }

      const logPaths = adapter.getLogPaths();
      const logPath = expandHome(opts.error ? logPaths.stderr : logPaths.stdout);

      if (!fs.existsSync(logPath)) {
        const msg = `Log file not found: ${logPath}`;
        if (opts.json) {
          console.log(JSON.stringify({ error: msg, path: logPath }));
        } else {
          console.error(msg);
        }
        process.exit(1);
      }

      if (opts.json) {
        // Read last N lines as JSON
        try {
          const output = execSync(`tail -n ${opts.lines} "${logPath}"`, { encoding: 'utf-8' });
          console.log(JSON.stringify({ path: logPath, lines: output.split('\n').filter(Boolean) }));
        } catch {
          console.log(JSON.stringify({ error: `Failed to read log: ${logPath}` }));
        }
        return;
      }

      // Interactive tail
      console.log(`Log: ${logPath}\n`);
      const followFlag = opts.follow ? '-f' : '';
      try {
        execSync(`tail ${followFlag} -n ${opts.lines} "${logPath}"`, { stdio: 'inherit' });
      } catch {
        // tail -f exits on SIGINT, that's fine
      }
    });
}
