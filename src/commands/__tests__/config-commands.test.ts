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

describe('config get/set/unset operations', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-cmd-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.resetModules();
  });

  async function importModules() {
    const store = await import('../../config/store');
    const dotPath = await import('../../utils/dot-path');
    return { store, dotPath };
  }

  it('config set changes enconvo.url', async () => {
    const { store, dotPath } = await importModules();

    const config = store.loadGlobalConfig();
    dotPath.setByPath(config as unknown as Record<string, unknown>, 'enconvo.url', 'http://custom:9999');
    store.saveGlobalConfig(config);

    const reloaded = store.loadGlobalConfig();
    expect(reloaded.enconvo.url).toBe('http://custom:9999');
  });

  it('config set changes enconvo.timeoutMs with numeric value', async () => {
    const { store, dotPath } = await importModules();

    const config = store.loadGlobalConfig();
    const value = dotPath.parseValue('5000');
    dotPath.setByPath(config as unknown as Record<string, unknown>, 'enconvo.timeoutMs', value);
    store.saveGlobalConfig(config);

    const reloaded = store.loadGlobalConfig();
    expect(reloaded.enconvo.timeoutMs).toBe(5000);
  });

  it('config get returns undefined for missing path', async () => {
    const { store, dotPath } = await importModules();

    const config = store.loadGlobalConfig();
    expect(dotPath.getByPath(config as unknown as Record<string, unknown>, 'nonexistent.path'))
      .toBeUndefined();
  });

  it('config get reads top-level version', async () => {
    const { store, dotPath } = await importModules();

    const config = store.loadGlobalConfig();
    expect(dotPath.getByPath(config as unknown as Record<string, unknown>, 'version')).toBe(2);
  });

  it('config set overwrites existing value', async () => {
    const { store, dotPath } = await importModules();

    const config = store.loadGlobalConfig();
    dotPath.setByPath(config as unknown as Record<string, unknown>, 'enconvo.url', 'http://first');
    store.saveGlobalConfig(config);

    const config2 = store.loadGlobalConfig();
    dotPath.setByPath(config2 as unknown as Record<string, unknown>, 'enconvo.url', 'http://second');
    store.saveGlobalConfig(config2);

    const reloaded = store.loadGlobalConfig();
    expect(reloaded.enconvo.url).toBe('http://second');
  });

  it('config get reads entire channel subtree', async () => {
    const { store, dotPath } = await importModules();

    store.setChannelInstance('telegram', 'bot1', {
      enabled: true, token: 'tok', agent: 'chat_with_ai/chat',
      allowedUserIds: [], service: { plistLabel: 'x', logPath: '/x', errorLogPath: '/x' },
    });

    const config = store.loadGlobalConfig();
    const subtree = dotPath.getByPath(config as unknown as Record<string, unknown>, 'channels.telegram');
    expect(subtree).toBeDefined();
    expect((subtree as Record<string, unknown>).instances).toBeDefined();
  });

  it('config get reads nested instance token', async () => {
    const { store, dotPath } = await importModules();

    store.setChannelInstance('telegram', 'mavis', {
      enabled: true, token: 'secret-token-123', agent: 'chat_with_ai/chat',
      allowedUserIds: [], service: { plistLabel: 'x', logPath: '/x', errorLogPath: '/x' },
    });

    const config = store.loadGlobalConfig();
    const token = dotPath.getByPath(
      config as unknown as Record<string, unknown>,
      'channels.telegram.instances.mavis.token',
    );
    expect(token).toBe('secret-token-123');
  });

  it('config unset removes enconvoApp field', async () => {
    const { store, dotPath } = await importModules();

    const config = store.loadGlobalConfig();
    dotPath.setByPath(config as unknown as Record<string, unknown>, 'enconvoApp', {
      version: '2.2.23', build: 100, lastChecked: '2026-01-01',
    });
    store.saveGlobalConfig(config);

    const config2 = store.loadGlobalConfig();
    expect(config2.enconvoApp).toBeDefined();
    const deleted = dotPath.unsetByPath(config2 as unknown as Record<string, unknown>, 'enconvoApp');
    expect(deleted).toBe(true);
    store.saveGlobalConfig(config2);

    const config3 = store.loadGlobalConfig();
    expect(config3.enconvoApp).toBeUndefined();
  });

  it('config unset returns false for missing path', async () => {
    const { store, dotPath } = await importModules();

    const config = store.loadGlobalConfig();
    expect(dotPath.unsetByPath(config as unknown as Record<string, unknown>, 'does.not.exist'))
      .toBe(false);
  });

  it('parseValue handles all types correctly', async () => {
    const { dotPath } = await importModules();

    expect(dotPath.parseValue('true')).toBe(true);
    expect(dotPath.parseValue('false')).toBe(false);
    expect(dotPath.parseValue('null')).toBe(null);
    expect(dotPath.parseValue('42')).toBe(42);
    expect(dotPath.parseValue('-3.14')).toBe(-3.14);
    expect(dotPath.parseValue('[1,2,3]')).toEqual([1, 2, 3]);
    expect(dotPath.parseValue('{"a":1}')).toEqual({ a: 1 });
    expect(dotPath.parseValue('hello world')).toBe('hello world');
  });

  it('config set changes defaultAgent', async () => {
    const { store, dotPath } = await importModules();

    const config = store.loadGlobalConfig();
    dotPath.setByPath(config as unknown as Record<string, unknown>, 'enconvo.defaultAgent', 'elena');
    store.saveGlobalConfig(config);

    const reloaded = store.loadGlobalConfig();
    expect(reloaded.enconvo.defaultAgent).toBe('elena');
  });
});
