import { Command } from 'commander';
import { registerGet } from './get';
import { registerSet } from './set';
import { registerUnset } from './unset';
import { registerPath } from './path';

export function registerConfigCommands(program: Command): void {
  const config = program
    .command('config')
    .description('Read and write configuration values');

  registerGet(config);
  registerSet(config);
  registerUnset(config);
  registerPath(config);
}
