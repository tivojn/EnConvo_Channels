import { Command } from 'commander';
import { loadAgentsRoster } from '../../config/agent-store';

export function registerBindings(parent: Command): void {
  parent
    .command('bindings')
    .description('Show agent-to-channel bindings')
    .option('--json', 'Output as JSON')
    .action((opts) => {
      const roster = loadAgentsRoster();

      if (roster.members.length === 0) {
        if (opts.json) {
          console.log(JSON.stringify({ bindings: [] }));
        } else {
          console.log('No agents configured.');
        }
        return;
      }

      const bindings = roster.members.map((m) => ({
        id: m.id,
        name: m.name,
        emoji: m.emoji,
        agentPath: m.bindings.agentPath,
        telegramBot: m.bindings.telegramBot,
        instanceName: m.bindings.instanceName,
        preferenceKey: m.preferenceKey,
      }));

      if (opts.json) {
        console.log(JSON.stringify({ bindings }, null, 2));
        return;
      }

      console.log('Agent Bindings:\n');
      for (const b of bindings) {
        console.log(`  ${b.emoji} ${b.name} (${b.id})`);
        console.log(`    EnConvo:  ${b.agentPath} → ${b.preferenceKey}`);
        console.log(`    Telegram: ${b.telegramBot} → instance "${b.instanceName}"`);
        console.log();
      }
    });
}
