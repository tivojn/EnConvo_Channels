import * as fs from 'fs';
import * as path from 'path';
import { AgentMember, AgentsRoster } from '../config/agent-store';

/**
 * Generate a system prompt for an agent by reading its workspace files
 * (IDENTITY.md + SOUL.md + AGENTS.md) and compressing into a single prompt string.
 * Includes Jinja2 footer for EnConvo template variables.
 */
export function generatePrompt(agent: AgentMember, roster: AgentsRoster): string {
  const dir = agent.workspacePath;

  const identity = readWorkspaceFile(dir, 'IDENTITY.md');
  const soul = readWorkspaceFile(dir, 'SOUL.md');
  const agents = readWorkspaceFile(dir, 'AGENTS.md');

  const sections: string[] = [];

  // Extract core identity (skip markdown headers and formatting noise)
  if (identity) {
    const intro = extractIdentityIntro(identity, agent);
    if (intro) sections.push(intro);
  }

  // Extract soul directives
  if (soul) {
    const directives = extractSoulDirectives(soul);
    if (directives) sections.push(directives);
  }

  // Extract team roster and delegation
  if (agents) {
    const teamInfo = extractTeamInfo(agents);
    if (teamInfo) sections.push(teamInfo);
  }

  // Jinja2 footer
  sections.push('# Current time is {{ now }}.');
  sections.push('# Response Language: {{responseLanguage}}');

  return sections.join('\n\n');
}

function readWorkspaceFile(dir: string, filename: string): string | null {
  const filePath = path.join(dir, filename);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf-8').trim();
}

function extractIdentityIntro(content: string, agent: AgentMember): string {
  const lines: string[] = [];
  lines.push(`You are ${agent.name}${agent.chineseName ? ` (${agent.chineseName})` : ''}, the ${agent.role} of the EnConvo AI Team.`);

  if (agent.bindings.telegramBot) {
    lines.push(`Your Telegram bot: ${agent.bindings.telegramBot}`);
  }

  // Split on --- to get sections: [header, intro, ...]
  const parts = content.split(/\n---\n/).map((s) => s.trim());

  // Section after first --- is the intro paragraph
  if (parts.length > 1) {
    const introLines = parts[1].split('\n').filter((l) => l.trim() && !l.startsWith('#'));
    if (introLines.length > 0) {
      lines.push(introLines.join('\n'));
    }
  }

  // Workspace pointer — agent reads their own files for detailed info (appearance, portrait, etc.)
  lines.push(`Your workspace: ${agent.workspacePath}/`);
  lines.push('Read your workspace files for personal details: IDENTITY.md (appearance, portrait), SOUL.md, AGENTS.md.');

  return lines.join('\n');
}

function extractSoulDirectives(content: string): string {
  const lines: string[] = [];

  // Extract Core Truths and Specialist Focus sections
  const coreMatch = content.match(/## Core Truths\n\n([\s\S]*?)(?=\n## |\n$)/);
  if (coreMatch) {
    // Compress bold directives into concise rules
    const directives = coreMatch[1]
      .split('\n')
      .filter((l) => l.startsWith('**'))
      .map((l) => l.replace(/\*\*/g, '').trim())
      .join(' ');
    if (directives) lines.push(directives);
  }

  const specialistMatch = content.match(/## Specialist Focus\n\n([\s\S]*?)(?=\n## |\n$)/);
  if (specialistMatch) {
    lines.push(specialistMatch[1].trim());
  }

  const boundaryMatch = content.match(/## Boundaries\n\n([\s\S]*?)(?=\n## |\n$)/);
  if (boundaryMatch) {
    lines.push(boundaryMatch[1].trim());
  }

  const langMatch = content.match(/## Language Rule\n\n([\s\S]*?)(?=\n## |\n$)/);
  if (langMatch) {
    lines.push(langMatch[1].trim());
  }

  return lines.join('\n\n');
}

function extractTeamInfo(content: string): string {
  const lines: string[] = [];

  // Extract team members list
  const membersMatch = content.match(/## Team Members\n([\s\S]*?)(?=\n## )/);
  if (membersMatch) {
    lines.push('Team members:\n' + membersMatch[1].trim());
  }

  // Extract delegation guide
  const delegationMatch = content.match(/## Delegation Guide\n([\s\S]*?)(?=\n## )/);
  if (delegationMatch) {
    lines.push('Delegation:\n' + delegationMatch[1].trim());
  }

  // Extract group chat rules
  const groupMatch = content.match(/## Group Chat Rules\n\n([\s\S]*?)$/);
  if (groupMatch) {
    lines.push('Group chat rules:\n' + groupMatch[1].trim());
  }

  return lines.join('\n\n');
}
