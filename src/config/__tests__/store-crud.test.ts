import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

let tmpDir: string;

vi.mock('../paths', () => {
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

describe('config store CRUD', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'store-crud-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.resetModules();
  });

  async function importStore() {
    return import('../store');
  }

  it('loadGlobalConfig returns defaults when no file exists', async () => {
    const store = await importStore();
    const config = store.loadGlobalConfig();
    expect(config.version).toBe(2);
    expect(config.enconvo.url).toBe('http://localhost:54535');
    expect(config.enconvo.timeoutMs).toBe(120000);
    expect(config.channels).toEqual({});
  });

  it('saveGlobalConfig creates config file', async () => {
    const store = await importStore();
    const config = store.loadGlobalConfig();
    config.enconvo.url = 'http://custom:9999';
    store.saveGlobalConfig(config);

    const raw = JSON.parse(fs.readFileSync(path.join(tmpDir, 'config.json'), 'utf-8'));
    expect(raw.enconvo.url).toBe('http://custom:9999');
  });

  it('saveGlobalConfig creates directory if missing', async () => {
    // Remove the temp dir to test auto-creation
    fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = path.join(os.tmpdir(), `store-crud-deep-${Date.now()}`);

    const store = await importStore();
    const config = store.loadGlobalConfig();
    store.saveGlobalConfig(config);

    expect(fs.existsSync(path.join(tmpDir, 'config.json'))).toBe(true);
    // Clean up the new dir
    fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'store-crud-'));
  });

  it('setChannelInstance adds an instance', async () => {
    const store = await importStore();
    store.setChannelInstance('telegram', 'mavis', {
      enabled: true,
      token: 'tok-123',
      agent: 'chat_with_ai/chat',
      allowedUserIds: [111],
      service: { plistLabel: 'test', logPath: '/tmp/log', errorLogPath: '/tmp/err' },
    });

    const instance = store.getChannelInstance('telegram', 'mavis');
    expect(instance).toBeDefined();
    expect(instance!.token).toBe('tok-123');
    expect(instance!.enabled).toBe(true);
  });

  it('setChannelInstance overwrites existing instance', async () => {
    const store = await importStore();
    const base = {
      enabled: true, token: 'old', agent: 'a', allowedUserIds: [] as number[],
      service: { plistLabel: 'x', logPath: '/x', errorLogPath: '/x' },
    };
    store.setChannelInstance('telegram', 'test', base);
    store.setChannelInstance('telegram', 'test', { ...base, token: 'new' });

    expect(store.getChannelInstance('telegram', 'test')!.token).toBe('new');
  });

  it('getChannelInstance returns undefined for missing channel', async () => {
    const store = await importStore();
    expect(store.getChannelInstance('nonexistent', 'test')).toBeUndefined();
  });

  it('removeChannelInstance with delete removes instance', async () => {
    const store = await importStore();
    store.setChannelInstance('telegram', 'test', {
      enabled: true, token: 'tok', agent: 'a', allowedUserIds: [],
      service: { plistLabel: 'x', logPath: '/x', errorLogPath: '/x' },
    });

    expect(store.removeChannelInstance('telegram', 'test', true)).toBe(true);
    expect(store.getChannelInstance('telegram', 'test')).toBeUndefined();
  });

  it('removeChannelInstance without delete disables instance', async () => {
    const store = await importStore();
    store.setChannelInstance('telegram', 'test', {
      enabled: true, token: 'tok', agent: 'a', allowedUserIds: [],
      service: { plistLabel: 'x', logPath: '/x', errorLogPath: '/x' },
    });

    expect(store.removeChannelInstance('telegram', 'test', false)).toBe(true);
    const inst = store.getChannelInstance('telegram', 'test');
    expect(inst).toBeDefined();
    expect(inst!.enabled).toBe(false);
  });

  it('removeChannelInstance returns false for unknown', async () => {
    const store = await importStore();
    expect(store.removeChannelInstance('telegram', 'nope', true)).toBe(false);
  });

  it('removeChannelInstance removes channel entry when last instance deleted', async () => {
    const store = await importStore();
    store.setChannelInstance('telegram', 'only', {
      enabled: true, token: 'tok', agent: 'a', allowedUserIds: [],
      service: { plistLabel: 'x', logPath: '/x', errorLogPath: '/x' },
    });
    store.removeChannelInstance('telegram', 'only', true);

    const config = store.loadGlobalConfig();
    expect(config.channels.telegram).toBeUndefined();
  });

  it('listChannelInstances returns all instances', async () => {
    const store = await importStore();
    const inst = {
      enabled: true, token: 'tok', agent: 'a', allowedUserIds: [] as number[],
      service: { plistLabel: 'x', logPath: '/x', errorLogPath: '/x' },
    };
    store.setChannelInstance('telegram', 'a', inst);
    store.setChannelInstance('telegram', 'b', { ...inst, token: 'tok2' });

    const list = store.listChannelInstances('telegram');
    expect(Object.keys(list)).toHaveLength(2);
    expect(list.a.token).toBe('tok');
    expect(list.b.token).toBe('tok2');
  });

  it('listChannelInstances returns empty for unknown channel', async () => {
    const store = await importStore();
    expect(store.listChannelInstances('nonexistent')).toEqual({});
  });

  it('setChannelGroup adds a group', async () => {
    const store = await importStore();
    store.setChannelInstance('telegram', 'default', {
      enabled: true, token: 'tok', agent: 'a', allowedUserIds: [],
      service: { plistLabel: 'x', logPath: '/x', errorLogPath: '/x' },
    });
    store.setChannelGroup('telegram', 'main', { chatId: '-123', name: 'Main' });

    const group = store.getChannelGroup('telegram', 'main');
    expect(group).toBeDefined();
    expect(group!.chatId).toBe('-123');
    expect(group!.name).toBe('Main');
  });

  it('removeChannelGroup removes a group', async () => {
    const store = await importStore();
    store.setChannelInstance('telegram', 'default', {
      enabled: true, token: 'tok', agent: 'a', allowedUserIds: [],
      service: { plistLabel: 'x', logPath: '/x', errorLogPath: '/x' },
    });
    store.setChannelGroup('telegram', 'grp', { chatId: '-999', name: 'Group' });

    expect(store.removeChannelGroup('telegram', 'grp')).toBe(true);
    expect(store.getChannelGroup('telegram', 'grp')).toBeUndefined();
  });

  it('removeChannelGroup returns false for unknown', async () => {
    const store = await importStore();
    expect(store.removeChannelGroup('telegram', 'nope')).toBe(false);
  });

  it('resolveChatId resolves from --chat', async () => {
    const store = await importStore();
    expect(store.resolveChatId({ chat: '12345' }, 'telegram')).toBe('12345');
  });

  it('resolveChatId resolves from --group', async () => {
    const store = await importStore();
    store.setChannelInstance('telegram', 'default', {
      enabled: true, token: 'tok', agent: 'a', allowedUserIds: [],
      service: { plistLabel: 'x', logPath: '/x', errorLogPath: '/x' },
    });
    store.setChannelGroup('telegram', 'test', { chatId: '-456', name: 'Test' });

    expect(store.resolveChatId({ group: 'test' }, 'telegram')).toBe('-456');
  });

  it('resolveChatId throws when neither --chat nor --group', async () => {
    const store = await importStore();
    expect(() => store.resolveChatId({}, 'telegram')).toThrow('--chat');
  });

  it('resolveChatId throws for unknown group', async () => {
    const store = await importStore();
    expect(() => store.resolveChatId({ group: 'unknown' }, 'telegram')).toThrow('not found');
  });

  it('auto-migrates flat v1 config to instances format', async () => {
    // Write a v1-style config
    const v1Config = {
      version: 1,
      enconvo: { url: 'http://localhost:54535', timeoutMs: 120000, agents: [], defaultAgent: '' },
      channels: {
        telegram: {
          token: 'v1-token',
          enabled: true,
          allowedUserIds: [999],
        },
      },
    };
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify(v1Config));

    const store = await importStore();
    const config = store.loadGlobalConfig();

    // Should have migrated to instances format and upgraded version
    expect(config.version).toBe(2);
    expect(config.channels.telegram.instances.default).toBeDefined();
    expect(config.channels.telegram.instances.default.token).toBe('v1-token');
    expect(config.channels.telegram.instances.default.allowedUserIds).toEqual([999]);
  });

  it('loadGlobalConfig handles corrupted JSON gracefully', async () => {
    fs.writeFileSync(path.join(tmpDir, 'config.json'), 'not-json!!!');

    const store = await importStore();
    const config = store.loadGlobalConfig();
    // Should return defaults
    expect(config.version).toBe(2);
    expect(config.channels).toEqual({});
  });
});
