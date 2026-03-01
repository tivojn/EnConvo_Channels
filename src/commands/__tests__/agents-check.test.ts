import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

let tmpDir: string;

vi.mock('../../config/paths', () => {
  return {
    get ENCONVO_CLI_DIR() { return tmpDir; },
    get ENCONVO_CLI_CONFIG_PATH() { return path.join(tmpDir, 'config.json'); },
    get AGENTS_CONFIG_PATH() { return path.join(tmpDir, 'agents.json'); },
    get BACKUPS_DIR() { return path.join(tmpDir, 'backups'); },
    get WORKSPACES_DIR() { return tmpDir; },
    get TEAM_KB_DIR() { return path.join(tmpDir, 'kb'); },
    get ENCONVO_PREFERENCES_DIR() { return path.join(tmpDir, 'preferences'); },
    get ENCONVO_COMMANDS_DIR() { return path.join(tmpDir, 'commands'); },
    ENCONVO_APP_PLIST: '/Applications/EnConvo.app/Contents/Info.plist',
  };
});

describe('agents check data operations', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-check-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.resetModules();
  });

  async function importModules() {
    const agentStore = await import('../../config/agent-store');
    const store = await import('../../config/store');
    return { agentStore, store };
  }

  it('agent with complete workspace passes workspace check', async () => {
    const { agentStore } = await importModules();

    agentStore.addAgent({
      id: 'mavis', name: 'Mavis', emoji: '👑',
      role: 'Lead', specialty: 'General', isLead: true,
      bindings: { agentPath: 'chat_with_ai/chat', telegramBot: '@Bot', instanceName: 'mavis' },
    });

    const roster = agentStore.loadAgentsRoster();
    const agent = roster.members[0];

    // Create workspace files
    fs.mkdirSync(agent.workspacePath, { recursive: true });
    fs.writeFileSync(path.join(agent.workspacePath, 'IDENTITY.md'), '# Mavis');
    fs.writeFileSync(path.join(agent.workspacePath, 'SOUL.md'), '# Soul');
    fs.writeFileSync(path.join(agent.workspacePath, 'AGENTS.md'), '# Agents');

    const files = ['IDENTITY.md', 'SOUL.md', 'AGENTS.md'];
    const allExist = files.every(f => fs.existsSync(path.join(agent.workspacePath, f)));
    expect(allExist).toBe(true);
  });

  it('agent with missing workspace files is detectable', async () => {
    const { agentStore } = await importModules();

    agentStore.addAgent({
      id: 'test', name: 'Test', emoji: '🤖',
      role: 'Agent', specialty: 'Test', isLead: false,
      bindings: { agentPath: 'x/y', telegramBot: '', instanceName: 'test' },
    });

    const roster = agentStore.loadAgentsRoster();
    const agent = roster.members[0];

    // Only create workspace dir, not files
    fs.mkdirSync(agent.workspacePath, { recursive: true });

    const files = ['IDENTITY.md', 'SOUL.md', 'AGENTS.md'];
    const missing = files.filter(f => !fs.existsSync(path.join(agent.workspacePath, f)));
    expect(missing).toEqual(['IDENTITY.md', 'SOUL.md', 'AGENTS.md']);
  });

  it('team KB detection works with existing dir', async () => {
    const kbDir = path.join(tmpDir, 'kb');
    fs.mkdirSync(kbDir, { recursive: true });
    fs.writeFileSync(path.join(kbDir, 'rules.md'), '# Rules');
    fs.writeFileSync(path.join(kbDir, 'style.md'), '# Style');

    const files = fs.readdirSync(kbDir).filter(f => !f.startsWith('.'));
    expect(files).toHaveLength(2);
  });

  it('team KB detection handles missing dir', () => {
    const kbDir = path.join(tmpDir, 'kb');
    expect(fs.existsSync(kbDir)).toBe(false);
  });

  it('preference file prompt check works', async () => {
    const { agentStore } = await importModules();

    agentStore.addAgent({
      id: 'mavis', name: 'Mavis', emoji: '👑',
      role: 'Lead', specialty: 'General', isLead: true,
      bindings: { agentPath: 'chat_with_ai/chat', telegramBot: '@Bot', instanceName: 'mavis' },
    });

    const roster = agentStore.loadAgentsRoster();
    const agent = roster.members[0];

    // Create preference file with synced prompt
    const prefDir = path.join(tmpDir, 'preferences');
    fs.mkdirSync(prefDir, { recursive: true });
    const prefFile = path.join(prefDir, `${agent.preferenceKey}.json`);
    fs.writeFileSync(prefFile, JSON.stringify({
      prompt: 'You are Mavis, the Team Lead with a specialty in General.',
    }));

    const pref = JSON.parse(fs.readFileSync(prefFile, 'utf-8'));
    expect(pref.prompt.startsWith('You are Mavis')).toBe(true);
  });

  it('stored version comparison detects changes', () => {
    const stored = { version: '2.2.23', build: 100, lastChecked: '2026-01-01' };
    const current = { version: '2.2.24', build: 101 };

    const changed = stored.version !== current.version || stored.build !== current.build;
    expect(changed).toBe(true);
  });

  it('stored version comparison detects no change', () => {
    const stored = { version: '2.2.23', build: 100, lastChecked: '2026-01-01' };
    const current = { version: '2.2.23', build: 100 };

    const changed = stored.version !== current.version || stored.build !== current.build;
    expect(changed).toBe(false);
  });

  it('channel instance check for agent bindings', async () => {
    const { agentStore, store } = await importModules();

    agentStore.addAgent({
      id: 'mavis', name: 'Mavis', emoji: '👑',
      role: 'Lead', specialty: 'General', isLead: true,
      bindings: { agentPath: 'chat_with_ai/chat', telegramBot: '@Bot', instanceName: 'mavis' },
    });

    // Instance exists
    store.setChannelInstance('telegram', 'mavis', {
      enabled: true, token: 'tok', agent: 'chat_with_ai/chat',
      allowedUserIds: [], service: { plistLabel: 'x', logPath: '/x', errorLogPath: '/x' },
    });

    const instance = store.getChannelInstance('telegram', 'mavis');
    expect(instance).toBeDefined();
    expect(instance!.agent).toBe('chat_with_ai/chat');
  });
});
