import { Command } from 'commander';
import { loadAgentsRoster } from '../../config/agent-store';

export function registerList(parent: Command): void {
  parent
    .command('list')
    .description('List team agents')
    .option('--bindings', 'Show channel bindings')
    .option('--json', 'Output as JSON')
    .action((opts) => {
      const roster = loadAgentsRoster();

      if (roster.members.length === 0) {
        if (opts.json) {
          console.log(JSON.stringify({ team: roster.team, members: [] }));
        } else {
          console.log('No agents configured. Run "enconvo agents add" to add one.');
        }
        return;
      }

      if (opts.json) {
        console.log(JSON.stringify(roster, null, 2));
        return;
      }

      console.log(`${roster.team}\n`);

      for (const m of roster.members) {
        const lead = m.isLead ? ' (lead)' : '';
        console.log(`  ${m.emoji} ${m.name}${lead} — ${m.role}`);
        console.log(`    ID: ${m.id} | Specialty: ${m.specialty}`);
        if (m.chineseName) {
          console.log(`    Chinese name: ${m.chineseName}`);
        }
        if (opts.bindings) {
          console.log(`    Agent path: ${m.bindings.agentPath}`);
          console.log(`    Telegram: ${m.bindings.telegramBot}`);
          console.log(`    Instance: ${m.bindings.instanceName}`);
          console.log(`    Preference: ${m.preferenceKey}`);
        }
        console.log();
      }
    });
}
