import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

let tmpDir: string;
let prefsDir: string;
let backupsDir: string;

vi.mock('../../config/paths', () => ({
  get ENCONVO_CLI_DIR() { return tmpDir; },
  get AGENTS_CONFIG_PATH() { return path.join(tmpDir, 'agents.json'); },
  get ENCONVO_PREFERENCES_DIR() { return prefsDir; },
  get BACKUPS_DIR() { return backupsDir; },
  get TEAM_KB_DIR() { return path.join(tmpDir, 'team-kb'); },
  get ENCONVO_COMMANDS_DIR() { return path.join(tmpDir, 'commands'); },
  ENCONVO_APP_PLIST: '/Applications/EnConvo.app/Contents/Info.plist',
}));

vi.mock('../../services/workspace', () => ({
  createWorkspace: vi.fn(),
}));

describe('syncAgents', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-test-'));
    prefsDir = path.join(tmpDir, 'prefs');
    backupsDir = path.join(tmpDir, 'backups');
    fs.mkdirSync(prefsDir, { recursive: true });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function makeAgent(id: string, agentPath = 'test/bot') {
    return {
      id,
      name: `Agent ${id}`,
      emoji: '🤖',
      role: 'Tester',
      specialty: 'Testing',
      isLead: false,
      bindings: { agentPath, telegramBot: `@${id}Bot`, instanceName: id },
      preferenceKey: agentPath.replace('/', '|'),
      workspacePath: path.join(tmpDir, `workspace-${id}`),
    };
  }

  async function importSync() {
    return import('../agents/sync');
  }

  it('returns dry-run status with prompt preview', async () => {
    const { syncAgents } = await importSync();
    const agent = makeAgent('alpha', 'custom_bot/alpha');
    const roster = { version: 1, team: 'Test', members: [agent] };

    const results = syncAgents([agent], roster, { dryRun: true });

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('dry-run');
    expect(results[0].prompt).toContain('You are Agent alpha');
  });

  it('skips agents without preference file', async () => {
    const { syncAgents } = await importSync();
    const agent = makeAgent('missing', 'custom_bot/missing');
    const roster = { version: 1, team: 'Test', members: [agent] };

    const results = syncAgents([agent], roster, {});

    expect(results).toHaveLength(1);
    expect(results[0].status).toContain('skipped');
  });

  it('syncs prompt to existing preference file', async () => {
    const { syncAgents } = await importSync();
    const agent = makeAgent('sync-target', 'custom_bot/sync');
    const roster = { version: 1, team: 'Test', members: [agent] };

    // Create preference file
    const prefFile = path.join(prefsDir, `${agent.preferenceKey}.json`);
    fs.writeFileSync(prefFile, JSON.stringify({ prompt: 'old prompt', model: 'gpt-4' }));

    const results = syncAgents([agent], roster, {});

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('synced');

    // Verify file was updated
    const updated = JSON.parse(fs.readFileSync(prefFile, 'utf-8'));
    expect(updated.prompt).toContain('You are Agent sync-target');
    expect(updated.model).toBe('gpt-4'); // other fields preserved
  });

  it('creates backup before syncing', async () => {
    const { syncAgents } = await importSync();
    const agent = makeAgent('backup-test', 'custom_bot/backup');
    const roster = { version: 1, team: 'Test', members: [agent] };

    const prefFile = path.join(prefsDir, `${agent.preferenceKey}.json`);
    fs.writeFileSync(prefFile, JSON.stringify({ prompt: 'original' }));

    syncAgents([agent], roster, {});

    // Backup directory should exist with a file
    expect(fs.existsSync(backupsDir)).toBe(true);
    const backupFiles = fs.readdirSync(backupsDir);
    expect(backupFiles.length).toBe(1);
    expect(backupFiles[0]).toContain(agent.preferenceKey);
  });

  it('handles multiple agents', async () => {
    const { syncAgents } = await importSync();
    const a1 = makeAgent('a1', 'custom_bot/a1');
    const a2 = makeAgent('a2', 'custom_bot/a2');
    const roster = { version: 1, team: 'Test', members: [a1, a2] };

    // Only a1 has a preference file
    fs.writeFileSync(path.join(prefsDir, `${a1.preferenceKey}.json`), JSON.stringify({ prompt: '' }));

    const results = syncAgents([a1, a2], roster, {});

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe('synced');
    expect(results[1].status).toContain('skipped');
  });

  it('calls createWorkspace when regenWorkspace is true', async () => {
    const { syncAgents } = await importSync();
    const { createWorkspace } = await import('../../services/workspace');
    const agent = makeAgent('regen', 'custom_bot/regen');
    const roster = { version: 1, team: 'Test', members: [agent] };

    syncAgents([agent], roster, { dryRun: true, regenWorkspace: true });

    expect(createWorkspace).toHaveBeenCalledWith(agent, roster);
  });
});
