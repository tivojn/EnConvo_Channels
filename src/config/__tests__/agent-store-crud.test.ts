import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

let tmpDir: string;

// Mock the paths module to use temp dir
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

describe('agent-store CRUD', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-crud-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.resetModules();
  });

  async function importStore() {
    // Dynamic import to pick up the mocked paths
    return import('../agent-store');
  }

  it('loadAgentsRoster returns default when no file exists', async () => {
    const store = await importStore();
    const roster = store.loadAgentsRoster();
    expect(roster.version).toBe(1);
    expect(roster.team).toBe('EnConvo AI Team');
    expect(roster.members).toEqual([]);
  });

  it('addAgent creates agent with derived fields', async () => {
    const store = await importStore();
    const agent = store.addAgent({
      id: 'test-agent',
      name: 'Test Agent',
      emoji: '🧪',
      role: 'Tester',
      specialty: 'Testing',
      isLead: false,
      bindings: {
        agentPath: 'custom_bot/abc123',
        telegramBot: '@TestBot',
        instanceName: 'test',
      },
    });

    expect(agent.id).toBe('test-agent');
    expect(agent.preferenceKey).toBe('custom_bot|abc123');
    expect(agent.workspacePath).toContain('workspace-test-agent');
  });

  it('addAgent persists to disk', async () => {
    const store = await importStore();
    store.addAgent({
      id: 'persist-test',
      name: 'Persist',
      emoji: '💾',
      role: 'Tester',
      specialty: 'Testing',
      isLead: false,
      bindings: {
        agentPath: 'test/persist',
        telegramBot: '@PersistBot',
        instanceName: 'persist',
      },
    });

    const roster = store.loadAgentsRoster();
    expect(roster.members).toHaveLength(1);
    expect(roster.members[0].id).toBe('persist-test');
  });

  it('addAgent throws on duplicate ID', async () => {
    const store = await importStore();
    const agentData = {
      id: 'dup-test',
      name: 'Dup',
      emoji: '🔄',
      role: 'Tester',
      specialty: 'Testing',
      isLead: false,
      bindings: {
        agentPath: 'test/dup',
        telegramBot: '@DupBot',
        instanceName: 'dup',
      },
    };

    store.addAgent(agentData);
    expect(() => store.addAgent(agentData)).toThrow('already exists');
  });

  it('getAgent returns agent by ID', async () => {
    const store = await importStore();
    store.addAgent({
      id: 'find-me',
      name: 'FindMe',
      emoji: '🔍',
      role: 'Finder',
      specialty: 'Finding',
      isLead: false,
      bindings: {
        agentPath: 'test/find',
        telegramBot: '@FindBot',
        instanceName: 'find',
      },
    });

    const found = store.getAgent('find-me');
    expect(found).toBeDefined();
    expect(found!.name).toBe('FindMe');
  });

  it('getAgent returns undefined for unknown ID', async () => {
    const store = await importStore();
    expect(store.getAgent('nonexistent')).toBeUndefined();
  });

  it('removeAgent deletes agent', async () => {
    const store = await importStore();
    store.addAgent({
      id: 'remove-me',
      name: 'RemoveMe',
      emoji: '🗑️',
      role: 'Temporary',
      specialty: 'None',
      isLead: false,
      bindings: {
        agentPath: 'test/remove',
        telegramBot: '@RemoveBot',
        instanceName: 'remove',
      },
    });

    expect(store.removeAgent('remove-me')).toBe(true);
    expect(store.getAgent('remove-me')).toBeUndefined();
  });

  it('removeAgent returns false for unknown ID', async () => {
    const store = await importStore();
    expect(store.removeAgent('nonexistent')).toBe(false);
  });

  it('bindAgent adds channel binding', async () => {
    const store = await importStore();
    store.addAgent({
      id: 'bind-test',
      name: 'BindTest',
      emoji: '🔗',
      role: 'Tester',
      specialty: 'Binding',
      isLead: false,
      bindings: {
        agentPath: 'test/bind',
        telegramBot: '@BindBot',
        instanceName: 'bind',
      },
    });

    const result = store.bindAgent('bind-test', {
      channel: 'discord',
      instanceName: 'bind-discord',
      botHandle: 'BindBot#1234',
    });

    expect(result).toBeDefined();
    expect(result!.bindings.channelBindings).toHaveLength(1);
    expect(result!.bindings.channelBindings![0].channel).toBe('discord');
  });

  it('bindAgent replaces duplicate channel+instance binding', async () => {
    const store = await importStore();
    store.addAgent({
      id: 'rebind-test',
      name: 'RebindTest',
      emoji: '🔄',
      role: 'Tester',
      specialty: 'Rebinding',
      isLead: false,
      bindings: {
        agentPath: 'test/rebind',
        telegramBot: '@RebindBot',
        instanceName: 'rebind',
      },
    });

    store.bindAgent('rebind-test', { channel: 'discord', instanceName: 'dc', botHandle: 'Old#1' });
    store.bindAgent('rebind-test', { channel: 'discord', instanceName: 'dc', botHandle: 'New#2' });

    const agent = store.getAgent('rebind-test');
    expect(agent!.bindings.channelBindings).toHaveLength(1);
    expect(agent!.bindings.channelBindings![0].botHandle).toBe('New#2');
  });

  it('bindAgent syncs telegram legacy fields', async () => {
    const store = await importStore();
    store.addAgent({
      id: 'legacy-sync',
      name: 'LegacySync',
      emoji: '📡',
      role: 'Tester',
      specialty: 'Sync',
      isLead: false,
      bindings: {
        agentPath: 'test/legacy',
        telegramBot: '@OldBot',
        instanceName: 'old',
      },
    });

    store.bindAgent('legacy-sync', {
      channel: 'telegram',
      instanceName: 'new-instance',
      botHandle: '@NewBot',
    });

    const agent = store.getAgent('legacy-sync');
    expect(agent!.bindings.instanceName).toBe('new-instance');
    expect(agent!.bindings.telegramBot).toBe('@NewBot');
  });

  it('bindAgent returns undefined for unknown agent', async () => {
    const store = await importStore();
    expect(store.bindAgent('nonexistent', { channel: 'telegram', instanceName: 'x' })).toBeUndefined();
  });

  it('unbindAgent removes specific binding', async () => {
    const store = await importStore();
    store.addAgent({
      id: 'unbind-test',
      name: 'UnbindTest',
      emoji: '✂️',
      role: 'Tester',
      specialty: 'Unbinding',
      isLead: false,
      bindings: {
        agentPath: 'test/unbind',
        telegramBot: '@UnbindBot',
        instanceName: 'unbind',
      },
    });

    store.bindAgent('unbind-test', { channel: 'telegram', instanceName: 'tg' });
    store.bindAgent('unbind-test', { channel: 'discord', instanceName: 'dc' });

    expect(store.unbindAgent('unbind-test', 'telegram', 'tg')).toBe(true);

    const agent = store.getAgent('unbind-test');
    expect(agent!.bindings.channelBindings).toHaveLength(1);
    expect(agent!.bindings.channelBindings![0].channel).toBe('discord');
  });

  it('unbindAgent returns false for non-existent binding', async () => {
    const store = await importStore();
    store.addAgent({
      id: 'unbind-miss',
      name: 'UnbindMiss',
      emoji: '❌',
      role: 'Tester',
      specialty: 'Missing',
      isLead: false,
      bindings: {
        agentPath: 'test/miss',
        telegramBot: '@MissBot',
        instanceName: 'miss',
      },
    });

    expect(store.unbindAgent('unbind-miss', 'slack', 'nope')).toBe(false);
  });

  it('updateAgent modifies specific fields', async () => {
    const store = await importStore();
    store.addAgent({
      id: 'update-test',
      name: 'UpdateTest',
      emoji: '📝',
      role: 'Original',
      specialty: 'Original',
      isLead: false,
      bindings: {
        agentPath: 'test/update',
        telegramBot: '@UpdateBot',
        instanceName: 'update',
      },
    });

    const result = store.updateAgent('update-test', { name: 'Updated', role: 'New Role' });
    expect(result).toBeDefined();
    expect(result!.name).toBe('Updated');
    expect(result!.role).toBe('New Role');
    expect(result!.specialty).toBe('Original'); // unchanged
  });

  it('updateAgent returns undefined for unknown agent', async () => {
    const store = await importStore();
    expect(store.updateAgent('nonexistent', { name: 'X' })).toBeUndefined();
  });

  it('saveAgentsRoster strips derived fields', async () => {
    const store = await importStore();
    store.addAgent({
      id: 'strip-test',
      name: 'StripTest',
      emoji: '🎭',
      role: 'Tester',
      specialty: 'Stripping',
      isLead: false,
      bindings: {
        agentPath: 'test/strip',
        telegramBot: '@StripBot',
        instanceName: 'strip',
      },
    });

    // Read raw JSON to verify derived fields are stripped
    const raw = JSON.parse(fs.readFileSync(path.join(tmpDir, 'agents.json'), 'utf-8'));
    const member = raw.members[0];
    expect(member.preferenceKey).toBeUndefined();
    expect(member.workspacePath).toBeUndefined();
    expect(member.id).toBe('strip-test');
    expect(member.bindings.agentPath).toBe('test/strip');
  });
});
