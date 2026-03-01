import { Command } from 'commander';
import { loadGlobalConfig } from '../../config/store';
import { getByPath } from '../../utils/dot-path';

export function registerGet(parent: Command): void {
  parent
    .command('get <path>')
    .description('Get a config value by dot-separated path')
    .option('--json', 'Output as JSON')
    .action((dotPath: string, opts: { json?: boolean }) => {
      const config = loadGlobalConfig();
      const value = getByPath(config as unknown as Record<string, unknown>, dotPath);

      if (value === undefined) {
        console.error(`No value at path: ${dotPath}`);
        process.exit(1);
      }

      if (opts.json || typeof value === 'object') {
        console.log(JSON.stringify(value, null, 2));
      } else {
        console.log(String(value));
      }
    });
}
