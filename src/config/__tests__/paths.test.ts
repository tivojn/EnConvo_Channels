import { describe, it, expect } from 'vitest';
import * as os from 'os';
import {
  ENCONVO_CLI_DIR,
  ENCONVO_CLI_CONFIG_PATH,
  AGENTS_CONFIG_PATH,
  BACKUPS_DIR,
  WORKSPACES_DIR,
  TEAM_KB_DIR,
  ENCONVO_PREFERENCES_DIR,
  ENCONVO_COMMANDS_DIR,
  ENCONVO_APP_PLIST,
} from '../paths';

describe('config paths', () => {
  const home = os.homedir();

  it('ENCONVO_CLI_DIR is in home directory', () => {
    expect(ENCONVO_CLI_DIR).toBe(`${home}/.enconvo_cli`);
  });

  it('config file is inside CLI dir', () => {
    expect(ENCONVO_CLI_CONFIG_PATH).toBe(`${home}/.enconvo_cli/config.json`);
    expect(ENCONVO_CLI_CONFIG_PATH.startsWith(ENCONVO_CLI_DIR)).toBe(true);
  });

  it('agents config is inside CLI dir', () => {
    expect(AGENTS_CONFIG_PATH).toBe(`${home}/.enconvo_cli/agents.json`);
    expect(AGENTS_CONFIG_PATH.startsWith(ENCONVO_CLI_DIR)).toBe(true);
  });

  it('backups dir is inside CLI dir', () => {
    expect(BACKUPS_DIR).toBe(`${home}/.enconvo_cli/backups`);
    expect(BACKUPS_DIR.startsWith(ENCONVO_CLI_DIR)).toBe(true);
  });

  it('workspaces dir equals CLI dir', () => {
    expect(WORKSPACES_DIR).toBe(ENCONVO_CLI_DIR);
  });

  it('team KB dir is inside CLI dir', () => {
    expect(TEAM_KB_DIR).toBe(`${home}/.enconvo_cli/kb`);
    expect(TEAM_KB_DIR.startsWith(ENCONVO_CLI_DIR)).toBe(true);
  });

  it('EnConvo preferences dir is in .config', () => {
    expect(ENCONVO_PREFERENCES_DIR).toBe(`${home}/.config/enconvo/installed_preferences`);
  });

  it('EnConvo commands dir is in .config', () => {
    expect(ENCONVO_COMMANDS_DIR).toBe(`${home}/.config/enconvo/installed_commands`);
  });

  it('EnConvo app plist is in Applications', () => {
    expect(ENCONVO_APP_PLIST).toBe('/Applications/EnConvo.app/Contents/Info.plist');
  });
});
