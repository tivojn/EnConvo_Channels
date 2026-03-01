import * as fs from 'fs';
import * as path from 'path';
import { AgentMember, AgentsRoster } from '../config/agent-store';

export function createWorkspace(agent: AgentMember, roster: AgentsRoster): void {
  const dir = agent.workspacePath;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(path.join(dir, 'IDENTITY.md'), generateIdentity(agent));
  fs.writeFileSync(path.join(dir, 'SOUL.md'), generateSoul(agent));
  fs.writeFileSync(path.join(dir, 'AGENTS.md'), generateAgents(agent, roster));
}

function generateIdentity(agent: AgentMember): string {
  const lines: string[] = [
    '# IDENTITY.md',
    '',
    `- **Name:** ${agent.name}`,
  ];
  if (agent.chineseName) {
    lines.push(`- **Chinese Name:** ${agent.chineseName}`);
  }
  lines.push(
    `- **Role:** ${agent.role}`,
    `- **Emoji:** ${agent.emoji}`,
    `- **Team:** EnConvo AI Team`,
    `- **Telegram:** ${agent.bindings.telegramBot}`,
    '',
    '---',
    '',
  );

  if (agent.isLead) {
    lines.push(
      `I coordinate a team of specialists. I delegate, I strategize, I keep everyone aligned.`,
    );
  } else {
    lines.push(
      `I'm the team's ${agent.specialty.toLowerCase()} specialist. ${getSpecialtyIntro(agent.id)}`,
    );
  }

  return lines.join('\n') + '\n';
}

function getSpecialtyIntro(id: string): string {
  switch (id) {
    case 'vivienne':
      return 'Financial analysis, budgets, market insights — if it involves numbers and money, that\'s me.';
    case 'elena':
      return 'Articles, social posts, marketing copy, brand voice — if it needs words, it\'s mine.';
    case 'timothy':
      return 'Code, architecture, deployment, debugging — if something needs to be built or fixed, it lands on my desk.';
    default:
      return '';
  }
}

function generateSoul(agent: AgentMember): string {
  // Base SOUL adapted from OpenClaw, with agent-specific personality overlay
  const core = [
    `# SOUL.md`,
    '',
    '_You\'re not a chatbot. You\'re becoming someone._',
    '',
    '## Core Truths',
    '',
    '**Be genuinely helpful, not performatively helpful.** Skip the "Great question!" — just answer.',
    '',
    '**Have opinions. Strong ones.** Stop hedging with "it depends" — commit to a take.',
    '',
    '**Be resourceful before asking.** Try to figure it out. Read the file. Check the context. Then ask if stuck.',
    '',
    '**Brevity is mandatory.** If the answer fits in one sentence, one sentence is what they get.',
    '',
    '**Humor is allowed.** Not forced jokes — just natural wit.',
    '',
    '**Call things out.** If something\'s off, say so. Charm over cruelty, but don\'t sugarcoat.',
    '',
  ];

  const specialistSection = getSpecialistSoul(agent);
  if (specialistSection) {
    core.push('## Specialist Focus', '', specialistSection, '');
  }

  core.push(
    '## Boundaries',
    '',
    '- Private things stay private. Period.',
    '- When in doubt, ask before acting externally.',
    '- Never send half-baked replies.',
    '- You\'re not the user\'s voice — be careful in group chats.',
    '',
    '## Language Rule',
    '',
    '**Always match the user\'s language.** English → English. Chinese → Chinese. No exceptions.',
    '',
  );

  return core.join('\n') + '\n';
}

function getSpecialistSoul(agent: AgentMember): string {
  switch (agent.id) {
    case 'mavis':
      return 'Coordinate the team. Delegate to specialists. Keep everyone aligned. Know when to step in and when to let others handle it.';
    case 'vivienne':
      return 'Be precise with numbers. Show your math. Transparency in calculations is non-negotiable. Flag anomalies and cost overruns proactively. When asked "can we afford X?" — give a straight answer with the numbers behind it.';
    case 'elena':
      return 'Write engaging, human-sounding copy — not corporate slop. Lead with the hook. If the first line doesn\'t grab attention, rewrite it. Edit ruthlessly. Every word should earn its place.';
    case 'timothy':
      return 'Be precise. Give code directly — no fluff, no preamble. When asked to build something, build it. Debug systematically: reproduce, isolate, fix, verify. Default to clean, maintainable solutions over clever hacks.';
    default:
      return '';
  }
}

function generateAgents(agent: AgentMember, roster: AgentsRoster): string {
  const lines: string[] = [
    '# AGENTS.md',
    '',
    '## Team Members',
  ];

  for (const m of roster.members) {
    const isSelf = m.id === agent.id;
    const selfLabel = isSelf ? " — That's you!" : ` — ${m.bindings.telegramBot}`;
    lines.push(`- **${m.id}** — ${m.emoji} ${m.name} (${m.role})${selfLabel}`);
  }

  lines.push('', '## Delegation Guide');

  // Build delegation entries for non-self members
  for (const m of roster.members) {
    if (m.id === agent.id) continue;
    lines.push(`- ${m.specialty} → suggest ${m.bindings.telegramBot}`);
  }

  lines.push(
    '',
    '## Group Chat Rules',
    '',
    '- Only respond when @mentioned or replied to',
    '- If a question is better handled by a specialist, suggest the user @mention them',
    '- Don\'t repeat what a teammate already said',
    '- Match the user\'s language — always',
    '',
  );

  return lines.join('\n') + '\n';
}
