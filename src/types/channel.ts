export interface ChannelInfo {
  name: string;
  displayName: string;
  version: string;
  description: string;
}

export interface ChannelCapabilities {
  text: boolean;
  images: boolean;
  documents: boolean;
  audio: boolean;
  video: boolean;
  groupChats: boolean;
  multiAccount: boolean;
}

export interface ChannelStatusResult {
  running: boolean;
  uptime?: string;
  details?: Record<string, string>;
  error?: string;
}

export interface ChannelResolveResult {
  found: boolean;
  identifier: string;
  kind: string;
  displayName?: string;
  details?: Record<string, string>;
}

export interface ChannelConfig {
  enabled: boolean;
  [key: string]: unknown;
}

export interface ChannelAdapter {
  readonly info: ChannelInfo;
  readonly capabilities: ChannelCapabilities;

  start(config: Record<string, unknown>): Promise<void>;
  stop(): Promise<void>;
  getStatus(probe?: boolean): Promise<ChannelStatusResult>;
  validateCredentials(config: Record<string, unknown>): Promise<{ valid: boolean; error?: string }>;
  getLogPaths(): { stdout: string; stderr: string };
  resolve(identifier: string, kind: string): Promise<ChannelResolveResult>;
  getServiceLabel(): string;
}
