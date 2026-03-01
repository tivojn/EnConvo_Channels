import { Command } from 'commander';
import { ENCONVO_CLI_CONFIG_PATH, ENCONVO_CLI_DIR, AGENTS_CONFIG_PATH } from '../../config/paths';

export function registerPath(parent: Command): void {
  parent
    .command('path')
    .description('Show config file paths')
    .option('--json', 'Output as JSON')
    .action((opts: { json?: boolean }) => {
      const paths = {
        configDir: ENCONVO_CLI_DIR,
        configFile: ENCONVO_CLI_CONFIG_PATH,
        agentsFile: AGENTS_CONFIG_PATH,
      };

      if (opts.json) {
        console.log(JSON.stringify(paths, null, 2));
      } else {
        console.log(`Config dir:    ${paths.configDir}`);
        console.log(`Config file:   ${paths.configFile}`);
        console.log(`Agents file:   ${paths.agentsFile}`);
      }
    });
}
