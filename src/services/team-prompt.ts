import * as fs from 'fs';
import * as path from 'path';
import { AgentMember } from '../config/agent-store';
import { TEAM_KB_DIR } from '../config/paths';

/**
 * Read all files in the team KB directory and return their contents concatenated.
 * These rules are injected directly into the system prompt so agents can't ignore them.
 */
function loadTeamKB(): string {
  if (!fs.existsSync(TEAM_KB_DIR)) return '';
  const files = fs.readdirSync(TEAM_KB_DIR)
    .filter((f) => f.endsWith('.md') && !f.startsWith('.'))
    .sort();
  if (files.length === 0) return '';

  const sections: string[] = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(TEAM_KB_DIR, file), 'utf-8').trim();
    if (content) sections.push(content);
  }
  return sections.join('\n\n');
}

/**
 * Generate a lean pointer prompt for an agent.
 * Workspace files are read by the agent at conversation start via read_file.
 * Team KB rules are injected directly into the prompt for reliable enforcement.
 */
export function generatePrompt(agent: AgentMember): string {
  const lines: string[] = [];

  lines.push(`You are ${agent.name}${agent.chineseName ? ` (${agent.chineseName})` : ''}, the ${agent.role} of the EnConvo AI Team.`);

  if (agent.bindings.telegramBot) {
    lines.push(`Your Telegram bot: ${agent.bindings.telegramBot}`);
  }

  lines.push('');
  lines.push(`Your workspace: ${agent.workspacePath}/`);
  lines.push(`Team knowledge base: ${TEAM_KB_DIR}/`);
  lines.push('');
  lines.push('IMPORTANT: At the start of every conversation, read your workspace files and team KB:');
  lines.push('- IDENTITY.md — your identity, appearance, portrait');
  lines.push('- SOUL.md — your personality and directives');
  lines.push('- AGENTS.md — team roster, delegation rules, group chat rules');
  lines.push(`- Team KB (all files in ${TEAM_KB_DIR}/) — shared team rules and standards`);
  lines.push('');
  lines.push('Follow all rules in these files. Re-read them if asked to refresh.');

  // Inject team KB rules directly into the prompt
  const teamKB = loadTeamKB();
  if (teamKB) {
    lines.push('');
    lines.push('---');
    lines.push('MANDATORY TEAM RULES (enforced — no exceptions):');
    lines.push('');
    lines.push(teamKB);
  }

  lines.push('');
  lines.push('# Current time is {{ now }}.');
  lines.push('# Response Language: {{responseLanguage}}');

  return lines.join('\n');
}
