import { ChannelAdapter } from '../types/channel';
import { TelegramAdapter } from './telegram/adapter';

const adapters = new Map<string, ChannelAdapter>();

// Register built-in adapters
adapters.set('telegram', new TelegramAdapter());

export function getAdapter(name: string): ChannelAdapter | undefined {
  return adapters.get(name);
}

export function listAdapterNames(): string[] {
  return [...adapters.keys()];
}

export function listAdapters(): ChannelAdapter[] {
  return [...adapters.values()];
}
