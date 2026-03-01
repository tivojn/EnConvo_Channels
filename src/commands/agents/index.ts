import { Command } from 'commander';
import { registerList } from './list';
import { registerAdd } from './add';
import { registerDelete } from './delete';
import { registerSetIdentity } from './set-identity';
import { registerSync } from './sync';
import { registerBindings } from './bindings';

export function registerAgentsCommands(program: Command): void {
  const agents = program
    .command('agents')
    .description('Manage the agent team roster and workspaces');

  registerList(agents);
  registerAdd(agents);
  registerDelete(agents);
  registerSetIdentity(agents);
  registerSync(agents);
  registerBindings(agents);
}
