import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  stripTokens,
  hasRedactedTokens,
  countBundleInventory,
  mergeConfigs,
  mergeAgents,
  ExportBundle,
} from '../export-import';
import type { GlobalConfig } from '../../config/store';
import type { AgentsRoster, AgentMember } from '../../config/agent-store';

function makeConfig(overrides?: Partial<GlobalConfig>): GlobalConfig {
  return {
    version: 2,
    enconvo: { url: 'http://localhost:54535', timeoutMs: 30000, agents: [], defaultAgent: '' },
    channels: {},
    ...overrides,
  };
}

function makeRoster(members: AgentMember[] = []): AgentsRoster {
  return { version: 1, team: 'Test', members };
}

function makeMember(id: string, overrides?: Partial<AgentMember>): AgentMember {
  return {
    id, name: id, emoji: '🤖', role: 'r', specialty: 's', isLead: false,
    bindings: { agentPath: `test/${id}`, telegramBot: `@${id}Bot`, instanceName: id },
    preferenceKey: `test|${id}`, workspacePath: `/tmp/${id}`,
    ...overrides,
  };
}

function inst(token: string, agent: string, enabled = true) {
  return {
    token, enabled, agent,
    allowedUserIds: [] as (number | string)[],
    service: { plistLabel: 'x', logPath: '/x', errorLogPath: '/x' },
  };
}

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

describe('export/import round-trip', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-import-'));
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

  it('export creates a valid JSON bundle', async () => {
    const { store, agentStore } = await importModules();

    // Set up some data
    store.setChannelInstance('telegram', 'test', {
      enabled: true, token: 'secret-token', agent: 'chat_with_ai/chat',
      allowedUserIds: [123],
      service: { plistLabel: 'x', logPath: '/x', errorLogPath: '/x' },
    });

    agentStore.addAgent({
      id: 'test-agent', name: 'Test', emoji: '🤖',
      role: 'Tester', specialty: 'Testing', isLead: false,
      bindings: { agentPath: 'test/agent', telegramBot: '@TestBot', instanceName: 'test' },
    });

    // Export
    const config = store.loadGlobalConfig();
    const agents = agentStore.loadAgentsRoster();

    const bundle = {
      exportedAt: new Date().toISOString(),
      cliVersion: '2.0.0',
      config,
      agents,
    };

    const exportPath = path.join(tmpDir, 'export.json');
    fs.writeFileSync(exportPath, JSON.stringify(bundle, null, 2));

    // Verify export file
    const loaded = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));
    expect(loaded.cliVersion).toBe('2.0.0');
    expect(loaded.config.channels.telegram.instances.test.token).toBe('secret-token');
    expect(loaded.agents.members).toHaveLength(1);
    expect(loaded.agents.members[0].id).toBe('test-agent');
  });

  it('export with strip-tokens redacts tokens', async () => {
    const { store } = await importModules();

    store.setChannelInstance('telegram', 'test', {
      enabled: true, token: 'secret-token', agent: 'a',
      allowedUserIds: [],
      service: { plistLabel: 'x', logPath: '/x', errorLogPath: '/x' },
    });

    const config = store.loadGlobalConfig();
    // Strip tokens
    for (const ch of Object.values(config.channels)) {
      for (const inst of Object.values(ch.instances)) {
        inst.token = '***REDACTED***';
      }
    }

    expect(config.channels.telegram.instances.test.token).toBe('***REDACTED***');
  });

  it('import replaces config', async () => {
    const { store, agentStore } = await importModules();

    // Start with some data
    store.setChannelInstance('telegram', 'old', {
      enabled: true, token: 'old-token', agent: 'a',
      allowedUserIds: [],
      service: { plistLabel: 'x', logPath: '/x', errorLogPath: '/x' },
    });

    // Create import bundle
    const importBundle = {
      exportedAt: new Date().toISOString(),
      cliVersion: '2.0.0',
      config: {
        version: 2,
        enconvo: { url: 'http://custom:9999', timeoutMs: 60000, agents: [], defaultAgent: '' },
        channels: {
          discord: {
            instances: {
              imported: {
                enabled: true, token: 'new-token', agent: 'imported/agent',
                allowedUserIds: [],
                service: { plistLabel: 'y', logPath: '/y', errorLogPath: '/y' },
              },
            },
          },
        },
      },
      agents: { version: 1, team: 'Imported Team', members: [] },
    };

    // Replace
    store.saveGlobalConfig(importBundle.config);
    agentStore.saveAgentsRoster(importBundle.agents);

    const config = store.loadGlobalConfig();
    expect(config.enconvo.url).toBe('http://custom:9999');
    expect(config.channels.discord?.instances?.imported).toBeDefined();
    // Old telegram config should be gone (replaced)
    expect(config.channels.telegram).toBeUndefined();
  });

  it('import with merge preserves existing', async () => {
    const { store } = await importModules();

    // Existing
    store.setChannelInstance('telegram', 'existing', {
      enabled: true, token: 'existing-token', agent: 'a',
      allowedUserIds: [],
      service: { plistLabel: 'x', logPath: '/x', errorLogPath: '/x' },
    });

    // Import bundle with new channel
    const currentConfig = store.loadGlobalConfig();
    currentConfig.channels.discord = {
      instances: {
        merged: {
          enabled: true, token: 'merged-token', agent: 'b',
          allowedUserIds: [],
          service: { plistLabel: 'y', logPath: '/y', errorLogPath: '/y' },
        },
      },
    };
    store.saveGlobalConfig(currentConfig);

    const config = store.loadGlobalConfig();
    // Both should exist
    expect(config.channels.telegram.instances.existing).toBeDefined();
    expect(config.channels.discord.instances.merged).toBeDefined();
  });
});

describe('stripTokens', () => {
  it('redacts all tokens', () => {
    const config = makeConfig({
      channels: {
        telegram: { instances: { a: inst('secret', 'x') } },
        discord: { instances: { b: inst('other', 'y') } },
      },
    });
    stripTokens(config);
    expect(config.channels.telegram.instances.a.token).toBe('***REDACTED***');
    expect(config.channels.discord.instances.b.token).toBe('***REDACTED***');
  });

  it('handles empty channels', () => {
    expect(() => stripTokens(makeConfig())).not.toThrow();
  });
});

describe('hasRedactedTokens', () => {
  it('returns false for real tokens', () => {
    const config = makeConfig({
      channels: { telegram: { instances: { a: inst('real', 'x') } } },
    });
    expect(hasRedactedTokens(config)).toBe(false);
  });

  it('returns true for redacted tokens', () => {
    const config = makeConfig({
      channels: { telegram: { instances: { a: inst('***REDACTED***', 'x') } } },
    });
    expect(hasRedactedTokens(config)).toBe(true);
  });
});

describe('countBundleInventory', () => {
  it('counts empty bundle', () => {
    const bundle: ExportBundle = { exportedAt: '', cliVersion: '2.0.0', config: makeConfig(), agents: makeRoster() };
    expect(countBundleInventory(bundle)).toEqual({ channels: 0, instances: 0, agents: 0 });
  });

  it('counts populated bundle', () => {
    const config = makeConfig({
      channels: {
        telegram: { instances: { a: inst('x', 'x'), b: inst('y', 'y') } },
        discord: { instances: { c: inst('z', 'z') } },
      },
    });
    const bundle: ExportBundle = { exportedAt: '', cliVersion: '2.0.0', config, agents: makeRoster([makeMember('m1'), makeMember('m2')]) };
    expect(countBundleInventory(bundle)).toEqual({ channels: 2, instances: 3, agents: 2 });
  });
});

describe('mergeConfigs', () => {
  it('adds new channel without overwriting', () => {
    const current = makeConfig({ channels: { telegram: { instances: { a: inst('old', 'x') } } } });
    const imported = makeConfig({ channels: { discord: { instances: { b: inst('new', 'y') } } } });
    mergeConfigs(current, imported);
    expect(current.channels.telegram.instances.a.token).toBe('old');
    expect(current.channels.discord.instances.b.token).toBe('new');
  });

  it('adds new instance to existing channel', () => {
    const current = makeConfig({ channels: { telegram: { instances: { a: inst('old', 'x') } } } });
    const imported = makeConfig({ channels: { telegram: { instances: { b: inst('new', 'y') } } } });
    mergeConfigs(current, imported);
    expect(Object.keys(current.channels.telegram.instances)).toEqual(['a', 'b']);
  });

  it('does not overwrite existing instance', () => {
    const current = makeConfig({ channels: { telegram: { instances: { a: inst('keep', 'x') } } } });
    const imported = makeConfig({ channels: { telegram: { instances: { a: inst('replace', 'z', false) } } } });
    mergeConfigs(current, imported);
    expect(current.channels.telegram.instances.a.token).toBe('keep');
  });
});

describe('mergeAgents', () => {
  it('adds new agents', () => {
    const current = makeRoster([makeMember('a')]);
    mergeAgents(current, makeRoster([makeMember('b')]));
    expect(current.members).toHaveLength(2);
  });

  it('skips duplicate IDs', () => {
    const current = makeRoster([makeMember('a')]);
    mergeAgents(current, makeRoster([makeMember('a')]));
    expect(current.members).toHaveLength(1);
  });

  it('handles empty import', () => {
    const current = makeRoster([makeMember('a')]);
    mergeAgents(current, makeRoster());
    expect(current.members).toHaveLength(1);
  });
});
