import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn().mockReturnValue('{}'),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

vi.mock('../../../services/team-prompt', () => ({
  generatePrompt: vi.fn().mockReturnValue('You are TestAgent, the Tester.'),
}));

vi.mock('../../../services/workspace', () => ({
  createWorkspace: vi.fn(),
}));

import * as fs from 'fs';
import { syncAgents } from '../sync';
import { createWorkspace } from '../../../services/workspace';
import type { AgentMember, AgentsRoster } from '../../../config/agent-store';

function makeAgent(overrides: Partial<AgentMember> = {}): AgentMember {
  return {
    id: 'test',
    name: 'TestAgent',
    emoji: '🧪',
    role: 'Tester',
    specialty: 'Testing',
    isLead: false,
    bindings: {
      agentPath: 'custom_bot/test123',
      telegramBot: '@TestBot',
      instanceName: 'test',
    },
    preferenceKey: 'custom_bot|test123',
    workspacePath: '/tmp/workspace-test',
    ...overrides,
  } as AgentMember;
}

function makeRoster(members: AgentMember[] = []): AgentsRoster {
  return { version: 1, team: 'Test Team', members };
}

describe('syncAgents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns dry-run result without writing files', () => {
    const agent = makeAgent();
    const results = syncAgents([agent], makeRoster([agent]), { dryRun: true, json: true });

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('dry-run');
    expect(results[0].prompt).toBe('You are TestAgent, the Tester.');
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('skips when preference file not found', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const agent = makeAgent();
    const results = syncAgents([agent], makeRoster([agent]), { json: true });

    expect(results).toHaveLength(1);
    expect(results[0].status).toContain('skipped');
  });

  it('syncs when preference file exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ prompt: 'old prompt', model: 'gpt-4' }));

    const agent = makeAgent();
    const results = syncAgents([agent], makeRoster([agent]), { json: true });

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('synced');
    // Should write backup and updated preference
    expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
  });

  it('preserves non-prompt fields during sync', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      prompt: 'old',
      model: 'gpt-4',
      temperature: 0.7,
    }));

    const agent = makeAgent();
    syncAgents([agent], makeRoster([agent]), { json: true });

    // Find the write that's the preference file (not the backup)
    const writeCalls = vi.mocked(fs.writeFileSync).mock.calls;
    const prefWrite = writeCalls.find(call => String(call[0]).includes('custom_bot|test123.json'));
    expect(prefWrite).toBeDefined();
    const written = JSON.parse(prefWrite![1] as string);
    expect(written.model).toBe('gpt-4');
    expect(written.temperature).toBe(0.7);
    expect(written.prompt).toBe('You are TestAgent, the Tester.');
  });

  it('creates backup before writing', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('{"prompt":"old"}');

    const agent = makeAgent();
    syncAgents([agent], makeRoster([agent]), { json: true });

    const writeCalls = vi.mocked(fs.writeFileSync).mock.calls;
    const backupWrite = writeCalls.find(call => String(call[0]).includes('backup'));
    expect(backupWrite).toBeDefined();
  });

  it('handles multiple agents', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('{"prompt":"x"}');

    const agents = [makeAgent({ id: 'a' }), makeAgent({ id: 'b' })];
    const results = syncAgents(agents, makeRoster(agents), { json: true });

    expect(results).toHaveLength(2);
    expect(results.every(r => r.status === 'synced')).toBe(true);
  });

  it('handles read error gracefully', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation(() => { throw new Error('EACCES'); });

    const agent = makeAgent();
    const results = syncAgents([agent], makeRoster([agent]), { json: true });

    expect(results[0].status).toContain('error');
    expect(results[0].status).toContain('EACCES');
  });

  it('regenerates workspace when regenWorkspace is true', () => {
    const agent = makeAgent();
    const roster = makeRoster([agent]);
    syncAgents([agent], roster, { dryRun: true, json: true, regenWorkspace: true });

    expect(createWorkspace).toHaveBeenCalledWith(agent, roster);
  });

  it('does not regenerate workspace by default', () => {
    const agent = makeAgent();
    syncAgents([agent], makeRoster([agent]), { dryRun: true, json: true });

    expect(createWorkspace).not.toHaveBeenCalled();
  });

  it('includes preferenceKey in results', () => {
    const agent = makeAgent({ preferenceKey: 'custom_bot|xyz' });
    const results = syncAgents([agent], makeRoster([agent]), { dryRun: true, json: true });

    expect(results[0].preferenceKey).toBe('custom_bot|xyz');
  });
});
