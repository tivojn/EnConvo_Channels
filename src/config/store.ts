import * as fs from 'fs';
import * as path from 'path';
import { ENCONVO_CLI_DIR, ENCONVO_CLI_CONFIG_PATH } from './paths';

export interface AgentConfig {
  id: string;
  name: string;
  path: string;
  description: string;
}

export interface GlobalConfig {
  version: number;
  enconvo: {
    url: string;
    timeoutMs: number;
    agents: AgentConfig[];
    defaultAgent: string;
  };
  channels: Record<string, Record<string, unknown>>;
}

const DEFAULT_CONFIG: GlobalConfig = {
  version: 1,
  enconvo: {
    url: 'http://localhost:54535',
    timeoutMs: 120000,
    agents: [
      { id: 'mavis', name: 'Mavis', path: 'chat_with_ai/chat', description: 'Default AI assistant' },
    ],
    defaultAgent: 'mavis',
  },
  channels: {},
};

export function ensureConfigDir(): void {
  if (!fs.existsSync(ENCONVO_CLI_DIR)) {
    fs.mkdirSync(ENCONVO_CLI_DIR, { recursive: true });
  }
}

export function loadGlobalConfig(): GlobalConfig {
  if (!fs.existsSync(ENCONVO_CLI_CONFIG_PATH)) {
    return { ...DEFAULT_CONFIG, channels: {} };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(ENCONVO_CLI_CONFIG_PATH, 'utf-8'));
    return {
      version: raw.version ?? 1,
      enconvo: {
        url: raw.enconvo?.url ?? DEFAULT_CONFIG.enconvo.url,
        timeoutMs: raw.enconvo?.timeoutMs ?? DEFAULT_CONFIG.enconvo.timeoutMs,
        agents: raw.enconvo?.agents ?? DEFAULT_CONFIG.enconvo.agents,
        defaultAgent: raw.enconvo?.defaultAgent ?? DEFAULT_CONFIG.enconvo.defaultAgent,
      },
      channels: raw.channels ?? {},
    };
  } catch {
    return { ...DEFAULT_CONFIG, channels: {} };
  }
}

export function saveGlobalConfig(config: GlobalConfig): void {
  ensureConfigDir();
  fs.writeFileSync(ENCONVO_CLI_CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
}

export function getChannelConfig(channelName: string): Record<string, unknown> | undefined {
  const config = loadGlobalConfig();
  return config.channels[channelName] as Record<string, unknown> | undefined;
}

export function setChannelConfig(channelName: string, channelConfig: Record<string, unknown>): void {
  const config = loadGlobalConfig();
  config.channels[channelName] = channelConfig;
  saveGlobalConfig(config);
}

export function removeChannelConfig(channelName: string, deleteConfig: boolean): boolean {
  const config = loadGlobalConfig();
  if (!config.channels[channelName]) return false;
  if (deleteConfig) {
    delete config.channels[channelName];
  } else {
    (config.channels[channelName] as Record<string, unknown>).enabled = false;
  }
  saveGlobalConfig(config);
  return true;
}

/**
 * Migrate from legacy project-local config.json + .env into ~/.enconvo_cli/config.json.
 * Only runs if no global config exists yet.
 */
export function migrateFromLegacy(projectRoot: string): boolean {
  if (fs.existsSync(ENCONVO_CLI_CONFIG_PATH)) return false;

  const legacyConfigPath = path.join(projectRoot, 'config.json');
  const legacyEnvPath = path.join(projectRoot, '.env');

  if (!fs.existsSync(legacyConfigPath)) return false;

  try {
    const raw = JSON.parse(fs.readFileSync(legacyConfigPath, 'utf-8'));
    let botToken: string | undefined;

    if (fs.existsSync(legacyEnvPath)) {
      const envContent = fs.readFileSync(legacyEnvPath, 'utf-8');
      const match = envContent.match(/^BOT_TOKEN=(.+)$/m);
      if (match) botToken = match[1].trim();
    }

    const config: GlobalConfig = {
      version: 1,
      enconvo: {
        url: raw.enconvo?.url ?? DEFAULT_CONFIG.enconvo.url,
        timeoutMs: raw.enconvo?.timeoutMs ?? DEFAULT_CONFIG.enconvo.timeoutMs,
        agents: raw.enconvo?.agents ?? DEFAULT_CONFIG.enconvo.agents,
        defaultAgent: raw.enconvo?.defaultAgent ?? DEFAULT_CONFIG.enconvo.defaultAgent,
      },
      channels: {},
    };

    if (botToken) {
      config.channels.telegram = {
        enabled: true,
        token: botToken,
        allowedUserIds: raw.telegram?.allowedUserIds ?? [],
        service: {
          plistLabel: 'com.enconvo.telegram-adapter',
          logPath: '~/Library/Logs/enconvo-telegram-adapter.log',
          errorLogPath: '~/Library/Logs/enconvo-telegram-adapter-error.log',
        },
      };
    }

    saveGlobalConfig(config);
    return true;
  } catch {
    return false;
  }
}
