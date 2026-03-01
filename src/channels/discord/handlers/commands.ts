import * as crypto from 'crypto';
import { Message } from 'discord.js';
import { loadGlobalConfig } from '../../../config/store';

// Session overrides for !reset — keyed by "channelId:instanceId"
const sessionOverrides = new Map<string, string>();

export function getSessionId(channelId: string, instanceId?: string): string {
  const key = instanceId ? `${channelId}:${instanceId}` : channelId;
  const suffix = instanceId ? `-${instanceId}` : '';
  return sessionOverrides.get(key) ?? `discord-${channelId}${suffix}`;
}

export function resetSession(channelId: string, instanceId?: string): string {
  const key = instanceId ? `${channelId}:${instanceId}` : channelId;
  const suffix = instanceId ? `-${instanceId}` : '';
  const newId = `discord-${channelId}${suffix}-${crypto.randomUUID().slice(0, 8)}`;
  sessionOverrides.set(key, newId);
  return newId;
}

/**
 * Handle !reset, !status, !help commands.
 * Returns true if the message was a command, false otherwise.
 */
export async function handleCommand(
  message: Message,
  agentPath?: string,
  instanceId?: string,
): Promise<boolean> {
  const text = message.content.trim();
  const channelId = message.channel.id;

  if (/^!reset\b/i.test(text)) {
    const newSessionId = resetSession(channelId, instanceId);
    await message.reply(`Session reset. New session: ${newSessionId}`);
    return true;
  }

  if (/^!status\b/i.test(text)) {
    const globalConfig = loadGlobalConfig();
    const sessionId = getSessionId(channelId, instanceId);
    const agentDisplay = agentPath ? `${agentPath} (pinned)` : 'default';

    try {
      const res = await fetch(`${globalConfig.enconvo.url}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        await message.reply(
          `Status: Connected\n` +
          `EnConvo: ${globalConfig.enconvo.url}\n` +
          `Agent: ${agentDisplay}\n` +
          `Session: ${sessionId}`
        );
      } else {
        await message.reply(`Status: EnConvo returned ${res.status}`);
      }
    } catch {
      await message.reply('Status: Cannot reach EnConvo API. Is it running?');
    }
    return true;
  }

  if (/^!help\b/i.test(text)) {
    const isServer = !!message.guild;
    const botMention = message.client.user ? `<@${message.client.user.id}>` : '@bot';
    const serverSection = isServer
      ? '\n\n' +
        'Server Usage:\n' +
        `- Mention me: ${botMention} your message\n` +
        '- Reply to my message to continue a thread\n' +
        '- I only respond when mentioned or replied to'
      : '';

    const agentDisplay = agentPath ?? 'default';
    await message.reply(
      'EnConvo Discord Bot\n\n' +
      `Agent: ${agentDisplay}\n\n` +
      'Send me text, images, or files and I\'ll forward them to EnConvo AI.\n\n' +
      'Commands:\n' +
      '`!reset` - Start a fresh conversation (clears context)\n' +
      '`!status` - Check if EnConvo is reachable\n' +
      '`!help` - Show this message' +
      serverSection
    );
    return true;
  }

  return false;
}
