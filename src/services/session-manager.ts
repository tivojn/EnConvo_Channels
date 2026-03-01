import * as crypto from 'crypto';
import { config, AgentConfig } from '../channels/telegram/config';

const sessionOverrides = new Map<number, string>();
const agentOverrides = new Map<number, string>();

export function getSessionId(chatId: number): string {
  return sessionOverrides.get(chatId) ?? `telegram-${chatId}`;
}

export function resetSession(chatId: number): string {
  const newId = `telegram-${chatId}-${crypto.randomUUID().slice(0, 8)}`;
  sessionOverrides.set(chatId, newId);
  return newId;
}

export function getAgent(chatId: number): AgentConfig {
  const agentId = agentOverrides.get(chatId) ?? config.enconvo.defaultAgent;
  return config.enconvo.agents.find(a => a.id === agentId) ?? config.enconvo.agents[0];
}

export function setAgent(chatId: number, agentId: string): AgentConfig | null {
  const agent = config.enconvo.agents.find(a => a.id === agentId);
  if (!agent) return null;
  agentOverrides.set(chatId, agentId);
  return agent;
}
