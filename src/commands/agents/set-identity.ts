import { Command } from 'commander';
import { getAgent, updateAgent, loadAgentsRoster } from '../../config/agent-store';
import { createWorkspace } from '../../services/workspace';
import { outputError } from '../../utils/command-output';

export function registerSetIdentity(parent: Command): void {
  parent
    .command('set-identity <id>')
    .description('Update agent identity fields')
    .option('--name <name>', 'Display name')
    .option('--chinese-name <name>', 'Chinese name')
    .option('--role <role>', 'Role title')
    .option('--specialty <specialty>', 'Specialty description')
    .option('--emoji <emoji>', 'Agent emoji')
    .option('--json', 'Output as JSON')
    .action((id: string, opts) => {
      const existing = getAgent(id);
      if (!existing) {
        outputError(opts, `Agent "${id}" not found`);
        process.exit(1);
      }

      const updates: Record<string, string> = {};
      if (opts.name) updates.name = opts.name;
      if (opts.chineseName) updates.chineseName = opts.chineseName;
      if (opts.role) updates.role = opts.role;
      if (opts.specialty) updates.specialty = opts.specialty;
      if (opts.emoji) updates.emoji = opts.emoji;

      if (Object.keys(updates).length === 0) {
        outputError(opts, 'No updates provided. Use --name, --role, --specialty, --emoji, or --chinese-name.');
        process.exit(1);
      }

      const updated = updateAgent(id, updates);
      if (!updated) {
        process.exit(1);
        return;
      }

      // Regenerate workspace files
      const roster = loadAgentsRoster();
      createWorkspace(updated, roster);

      if (opts.json) {
        console.log(JSON.stringify({ action: 'updated', agent: updated }, null, 2));
      } else {
        console.log(`Updated ${updated.emoji} ${updated.name} (${id})`);
        console.log(`  Workspace files regenerated at ${updated.workspacePath}`);
      }
    });
}
