import { Command } from 'commander';
import { loadGlobalConfig, saveGlobalConfig } from '../../config/store';
import { unsetByPath } from '../../utils/dot-path';

export function registerUnset(parent: Command): void {
  parent
    .command('unset <path>')
    .description('Remove a config value by dot-separated path')
    .action((dotPath: string) => {
      const config = loadGlobalConfig();
      const deleted = unsetByPath(config as unknown as Record<string, unknown>, dotPath);

      if (!deleted) {
        console.error(`No value at path: ${dotPath}`);
        process.exit(1);
      }

      saveGlobalConfig(config);
      console.log(`Removed ${dotPath}`);
    });
}
