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

describe('exported check functions', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-fn-'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function makeAgent(id: string) {
    return {
      id,
      name: `Agent ${id}`,
      emoji: '🤖',
      role: 'Tester',
      specialty: 'Testing',
      isLead: false,
      bindings: { agentPath: 'test/bot', telegramBot: `@${id}Bot`, instanceName: id },
      preferenceKey: `test|${id}`,
      workspacePath: path.join(tmpDir, `workspace-${id}`),
    };
  }

  async function importCheck() {
    return import('../agents/check');
  }

  describe('checkAgent', () => {
    it('returns all fail when nothing exists', async () => {
      const { checkAgent } = await importCheck();
      const agent = makeAgent('empty');
      const results = checkAgent(agent);

      expect(results.length).toBeGreaterThanOrEqual(4);
      expect(results.find(r => r.label === 'Command file')?.status).toBe('fail');
      expect(results.find(r => r.label === 'Preference')?.status).toBe('fail');
      expect(results.find(r => r.label === 'Prompt synced')?.status).toBe('fail');
      expect(results.find(r => r.label === 'Workspace')?.status).toBe('fail');
    });

    it('returns ok for command file when it exists', async () => {
      const { checkAgent } = await importCheck();
      const agent = makeAgent('cmd');
      const cmdsDir = path.join(tmpDir, 'commands');
      fs.mkdirSync(cmdsDir, { recursive: true });
      fs.writeFileSync(path.join(cmdsDir, `${agent.preferenceKey}.json`), '{}');
      const results = checkAgent(agent);
      expect(results.find(r => r.label === 'Command file')?.status).toBe('ok');
    });

    it('returns ok for preference when it exists', async () => {
      const { checkAgent } = await importCheck();
      const agent = makeAgent('pref');
      const prefsDir = path.join(tmpDir, 'preferences');
      fs.mkdirSync(prefsDir, { recursive: true });
      fs.writeFileSync(path.join(prefsDir, `${agent.preferenceKey}.json`), JSON.stringify({ prompt: '' }));
      const results = checkAgent(agent);
      expect(results.find(r => r.label === 'Preference')?.status).toBe('ok');
    });

    it('detects synced prompt when header matches', async () => {
      const { checkAgent } = await importCheck();
      const agent = makeAgent('synced');
      const prefsDir = path.join(tmpDir, 'preferences');
      fs.mkdirSync(prefsDir, { recursive: true });
      fs.writeFileSync(
        path.join(prefsDir, `${agent.preferenceKey}.json`),
        JSON.stringify({ prompt: `You are ${agent.name}, the great tester` }),
      );
      const results = checkAgent(agent);
      expect(results.find(r => r.label === 'Prompt synced')?.status).toBe('ok');
    });

    it('warns when prompt does not match expected header', async () => {
      const { checkAgent } = await importCheck();
      const agent = makeAgent('mismatch');
      const prefsDir = path.join(tmpDir, 'preferences');
      fs.mkdirSync(prefsDir, { recursive: true });
      fs.writeFileSync(
        path.join(prefsDir, `${agent.preferenceKey}.json`),
        JSON.stringify({ prompt: 'Some old prompt that was not synced' }),
      );
      const results = checkAgent(agent);
      expect(results.find(r => r.label === 'Prompt synced')?.status).toBe('warn');
    });

    it('returns ok workspace when all 3 files exist', async () => {
      const { checkAgent } = await importCheck();
      const agent = makeAgent('ws');
      fs.mkdirSync(agent.workspacePath, { recursive: true });
      fs.writeFileSync(path.join(agent.workspacePath, 'IDENTITY.md'), '');
      fs.writeFileSync(path.join(agent.workspacePath, 'SOUL.md'), '');
      fs.writeFileSync(path.join(agent.workspacePath, 'AGENTS.md'), '');
      const results = checkAgent(agent);
      expect(results.find(r => r.label === 'Workspace')?.status).toBe('ok');
    });

    it('fails workspace when files are missing', async () => {
      const { checkAgent } = await importCheck();
      const agent = makeAgent('ws-partial');
      fs.mkdirSync(agent.workspacePath, { recursive: true });
      fs.writeFileSync(path.join(agent.workspacePath, 'IDENTITY.md'), '');
      const results = checkAgent(agent);
      const ws = results.find(r => r.label === 'Workspace');
      expect(ws?.status).toBe('fail');
      expect(ws?.detail).toContain('SOUL.md');
      expect(ws?.detail).toContain('AGENTS.md');
    });
  });

  describe('checkTeamKB', () => {
    it('warns when KB directory does not exist', async () => {
      const { checkTeamKB } = await importCheck();
      const result = checkTeamKB();
      expect(result.status).toBe('warn');
      expect(result.detail).toContain('not found');
    });

    it('returns ok with file count', async () => {
      const { checkTeamKB } = await importCheck();
      fs.mkdirSync(path.join(tmpDir, 'kb'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'kb', 'guide.md'), '');
      fs.writeFileSync(path.join(tmpDir, 'kb', 'rules.md'), '');
      const result = checkTeamKB();
      expect(result.status).toBe('ok');
      expect(result.detail).toContain('2 files');
    });

    it('excludes hidden files from count', async () => {
      const { checkTeamKB } = await importCheck();
      fs.mkdirSync(path.join(tmpDir, 'kb'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'kb', '.DS_Store'), '');
      fs.writeFileSync(path.join(tmpDir, 'kb', 'visible.md'), '');
      const result = checkTeamKB();
      expect(result.detail).toContain('1 file');
    });
  });

  describe('checkEnConvoVersion', () => {
    it('returns consistent result structure', async () => {
      const { checkEnConvoVersion } = await importCheck();
      const result = checkEnConvoVersion(undefined);

      // Regardless of whether EnConvo is installed, structure is valid
      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('current');
      expect(result).toHaveProperty('changed');
      expect(['ok', 'warn']).toContain(result.result.status);
      expect(result.result.label).toBe('EnConvo app');
    });

    it('detects version change when stored differs', async () => {
      const { checkEnConvoVersion, getEnConvoVersion } = await importCheck();
      const current = getEnConvoVersion();
      if (!current) return; // Skip on machines without EnConvo

      const stored = { version: '0.0.1', build: 1, lastChecked: '2020-01-01' };
      const result = checkEnConvoVersion(stored);

      expect(result.changed).toBe(true);
      expect(result.result.status).toBe('warn');
      expect(result.result.detail).toContain('CHANGED');
    });

    it('detects no change when stored matches current', async () => {
      const { checkEnConvoVersion, getEnConvoVersion } = await importCheck();
      const current = getEnConvoVersion();
      if (!current) return; // Skip on machines without EnConvo

      const stored = { version: current.version, build: current.build, lastChecked: '2026-01-01' };
      const result = checkEnConvoVersion(stored);

      expect(result.changed).toBe(false);
      expect(result.result.status).toBe('ok');
      expect(result.result.detail).toContain('matches');
    });
  });

  describe('STATUS_ICON', () => {
    it('has icons for all statuses', async () => {
      const { STATUS_ICON } = await importCheck();
      expect(STATUS_ICON.ok).toBeDefined();
      expect(STATUS_ICON.warn).toBeDefined();
      expect(STATUS_ICON.fail).toBeDefined();
    });

    it('ok is checkmark, warn and fail are x', async () => {
      const { STATUS_ICON } = await importCheck();
      expect(STATUS_ICON.ok).toBe('\u2713');
      expect(STATUS_ICON.warn).toBe('\u2717');
      expect(STATUS_ICON.fail).toBe('\u2717');
    });
  });
});
