import * as fs from 'fs';
import * as path from 'path';
import { Command } from 'commander';
import { loadAgentsRoster, AgentMember } from '../../config/agent-store';
import { generatePrompt } from '../../services/team-prompt';
import { ENCONVO_PREFERENCES_DIR, BACKUPS_DIR, TEAM_KB_DIR } from '../../config/paths';

interface SyncResult {
  id: string;
  preferenceKey: string;
  status: string;
  prompt?: string;
}

function syncAgents(targets: AgentMember[], opts: { dryRun?: boolean; json?: boolean }): SyncResult[] {
  const results: SyncResult[] = [];

  for (const agent of targets) {
    const prompt = generatePrompt(agent);
    const prefFile = path.join(ENCONVO_PREFERENCES_DIR, `${agent.preferenceKey}.json`);

    if (opts.dryRun) {
      results.push({ id: agent.id, preferenceKey: agent.preferenceKey, status: 'dry-run', prompt });

      if (!opts.json) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`${agent.emoji} ${agent.name} (${agent.id})`);
        console.log(`Preference: ${agent.preferenceKey}`);
        console.log(`File: ${prefFile}`);
        console.log(`${'='.repeat(60)}`);
        console.log(prompt);
      }
      continue;
    }

    // Check if preference file exists
    if (!fs.existsSync(prefFile)) {
      results.push({ id: agent.id, preferenceKey: agent.preferenceKey, status: 'skipped — preference file not found' });
      if (!opts.json) {
        console.log(`  ${agent.emoji} ${agent.name}: skipped — ${prefFile} not found`);
      }
      continue;
    }

    try {
      // Read existing preference
      const raw = fs.readFileSync(prefFile, 'utf-8');
      const pref = JSON.parse(raw);

      // Backup before modifying
      if (!fs.existsSync(BACKUPS_DIR)) {
        fs.mkdirSync(BACKUPS_DIR, { recursive: true });
      }
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(BACKUPS_DIR, `${agent.preferenceKey}_${ts}.json`);
      fs.writeFileSync(backupFile, raw);

      // Update prompt field only
      pref.prompt = prompt;
      fs.writeFileSync(prefFile, JSON.stringify(pref, null, 2));

      results.push({ id: agent.id, preferenceKey: agent.preferenceKey, status: 'synced' });

      if (!opts.json) {
        console.log(`  ${agent.emoji} ${agent.name}: synced → ${prefFile}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ id: agent.id, preferenceKey: agent.preferenceKey, status: `error: ${msg}` });
      if (!opts.json) {
        console.error(`  ${agent.emoji} ${agent.name}: error — ${msg}`);
      }
    }
  }

  return results;
}

export function registerSync(parent: Command): void {
  parent
    .command('sync')
    .description('Sync agent prompts to EnConvo preferences')
    .option('--dry-run', 'Preview prompts without writing')
    .option('--agent <id>', 'Sync a specific agent only')
    .option('--json', 'Output as JSON')
    .option('--watch', 'Watch team KB for changes and auto-sync')
    .action((opts) => {
      const roster = loadAgentsRoster();

      if (roster.members.length === 0) {
        if (opts.json) {
          console.log(JSON.stringify({ error: 'No agents configured' }));
        } else {
          console.error('No agents configured. Run "enconvo agents add" first.');
        }
        process.exit(1);
      }

      let targets: AgentMember[];
      if (opts.agent) {
        const agent = roster.members.find((m) => m.id === opts.agent);
        if (!agent) {
          const msg = `Agent "${opts.agent}" not found`;
          if (opts.json) {
            console.log(JSON.stringify({ error: msg }));
          } else {
            console.error(msg);
          }
          process.exit(1);
        }
        targets = [agent];
      } else {
        targets = roster.members;
      }

      // Initial sync
      const results = syncAgents(targets, opts);

      if (opts.json && !opts.watch) {
        console.log(JSON.stringify({ action: opts.dryRun ? 'dry-run' : 'sync', results }, null, 2));
      } else if (!opts.dryRun && !opts.watch) {
        console.log(`\nSynced ${results.filter((r) => r.status === 'synced').length}/${targets.length} agents.`);
      }

      // Watch mode
      if (opts.watch) {
        if (opts.dryRun) {
          console.error('Cannot use --watch with --dry-run');
          process.exit(1);
        }

        if (!opts.json) {
          const synced = results.filter((r) => r.status === 'synced').length;
          console.log(`\nSynced ${synced}/${targets.length} agents.`);
        }

        // Ensure KB directory exists
        if (!fs.existsSync(TEAM_KB_DIR)) {
          fs.mkdirSync(TEAM_KB_DIR, { recursive: true });
        }

        if (!opts.json) {
          console.log(`\nWatching ${TEAM_KB_DIR} for changes... (Ctrl+C to stop)`);
        }

        // Debounce to avoid multiple rapid syncs on editor save
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;

        fs.watch(TEAM_KB_DIR, { persistent: true }, (eventType, filename) => {
          // Ignore non-markdown and hidden files
          if (!filename || !filename.endsWith('.md') || filename.startsWith('.')) return;

          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            const ts = new Date().toLocaleTimeString();
            if (!opts.json) {
              console.log(`\n[${ts}] ${filename} changed — syncing...`);
            }

            // Reload roster in case it changed
            const freshRoster = loadAgentsRoster();
            const freshTargets = opts.agent
              ? freshRoster.members.filter((m) => m.id === opts.agent)
              : freshRoster.members;

            const watchResults = syncAgents(freshTargets, { json: opts.json });

            if (opts.json) {
              console.log(JSON.stringify({ action: 'watch-sync', trigger: filename, results: watchResults }, null, 2));
            } else {
              const synced = watchResults.filter((r) => r.status === 'synced').length;
              console.log(`  Synced ${synced}/${freshTargets.length} agents.`);
            }
          }, 300);
        });
      }
    });
}
