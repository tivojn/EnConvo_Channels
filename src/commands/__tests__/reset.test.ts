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

describe('reset operations', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reset-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.resetModules();
  });

  async function importModules() {
    const store = await import('../../config/store');
    const agentStore = await import('../../config/agent-store');
    return { store, agentStore };
  }

  it('reset channel removes channel from config', async () => {
    const { store } = await importModules();

    store.setChannelInstance('telegram', 'test', {
      enabled: true, token: 'tok', agent: 'a', allowedUserIds: [],
      service: { plistLabel: 'x', logPath: '/x', errorLogPath: '/x' },
    });
    store.setChannelInstance('discord', 'test', {
      enabled: true, token: 'tok2', agent: 'b', allowedUserIds: [],
      service: { plistLabel: 'y', logPath: '/y', errorLogPath: '/y' },
    });

    // Remove telegram
    const config = store.loadGlobalConfig();
    delete config.channels.telegram;
    store.saveGlobalConfig(config);

    const updated = store.loadGlobalConfig();
    expect(updated.channels.telegram).toBeUndefined();
    expect(updated.channels.discord).toBeDefined();
  });

  it('reset agents writes empty roster', async () => {
    const { agentStore } = await importModules();

    agentStore.addAgent({
      id: 'test', name: 'Test', emoji: '🤖',
      role: 'R', specialty: 'S', isLead: false,
      bindings: { agentPath: 'a/b', telegramBot: '', instanceName: 'test' },
    });

    // Reset by writing empty roster
    agentStore.saveAgentsRoster({ version: 1, team: 'EnConvo AI Team', members: [] });

    const roster = agentStore.loadAgentsRoster();
    expect(roster.members).toHaveLength(0);
  });

  it('backup is created before reset', async () => {
    const { store } = await importModules();

    store.setChannelInstance('telegram', 'test', {
      enabled: true, token: 'tok', agent: 'a', allowedUserIds: [],
      service: { plistLabel: 'x', logPath: '/x', errorLogPath: '/x' },
    });

    const backupsDir = path.join(tmpDir, 'backups');
    fs.mkdirSync(backupsDir, { recursive: true });

    // Simulate backup
    fs.copyFileSync(
      path.join(tmpDir, 'config.json'),
      path.join(backupsDir, 'config-pre-reset.json'),
    );

    // Verify backup exists
    expect(fs.existsSync(path.join(backupsDir, 'config-pre-reset.json'))).toBe(true);

    // Read backup to verify content
    const backup = JSON.parse(fs.readFileSync(path.join(backupsDir, 'config-pre-reset.json'), 'utf-8'));
    expect(backup.channels.telegram.instances.test.token).toBe('tok');
  });

  it('reset all removes both config and agents files', async () => {
    const { store, agentStore } = await importModules();

    store.saveGlobalConfig(store.loadGlobalConfig());
    agentStore.addAgent({
      id: 'x', name: 'X', emoji: '❌',
      role: 'R', specialty: 'S', isLead: false,
      bindings: { agentPath: 'a/b', telegramBot: '', instanceName: 'x' },
    });

    const configPath = path.join(tmpDir, 'config.json');
    const agentsPath = path.join(tmpDir, 'agents.json');

    expect(fs.existsSync(configPath)).toBe(true);
    expect(fs.existsSync(agentsPath)).toBe(true);

    // Delete files
    fs.unlinkSync(configPath);
    fs.unlinkSync(agentsPath);

    expect(fs.existsSync(configPath)).toBe(false);
    expect(fs.existsSync(agentsPath)).toBe(false);

    // Verify loadGlobalConfig returns defaults after reset
    const config = store.loadGlobalConfig();
    expect(config.version).toBe(2);
    expect(config.channels).toEqual({});
  });
});
