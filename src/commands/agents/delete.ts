import * as fs from 'fs';
import { Command } from 'commander';
import { getAgent, removeAgent } from '../../config/agent-store';
import { outputError } from '../../utils/command-output';

export function registerDelete(parent: Command): void {
  parent
    .command('delete <id>')
    .description('Remove an agent from the team roster')
    .option('--force', 'Also delete workspace directory')
    .option('--json', 'Output as JSON')
    .action((id: string, opts) => {
      const agent = getAgent(id);
      if (!agent) {
        outputError(opts, `Agent "${id}" not found`);
        process.exit(1);
      }

      removeAgent(id);

      if (opts.force && fs.existsSync(agent.workspacePath)) {
        fs.rmSync(agent.workspacePath, { recursive: true });
      }

      if (opts.json) {
        console.log(JSON.stringify({ action: 'deleted', id, workspaceRemoved: opts.force ?? false }));
      } else {
        console.log(`Removed ${agent.emoji} ${agent.name} (${id}) from roster`);
        if (opts.force) {
          console.log(`  Workspace deleted: ${agent.workspacePath}`);
        } else {
          console.log(`  Workspace kept: ${agent.workspacePath} (use --force to delete)`);
        }
      }
    });
}
