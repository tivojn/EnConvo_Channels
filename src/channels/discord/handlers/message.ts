import { Client, Message } from 'discord.js';
import { loadGlobalConfig } from '../../../config/store';
import { handleMessage, buildRosterContext } from '../../../services/handler-core';
import { createDiscordIO } from '../utils/file-sender';
import { getSessionId } from './commands';
import { stripDiscordMention } from '../../../utils/mention';

export function createTextMessageHandler(client: Client, agentPath?: string, instanceId?: string) {
  const roster = buildRosterContext(instanceId);

  return async function handleTextMessage(message: Message): Promise<void> {
    let text = message.content;
    const channelId = message.channel.id;
    if (!text) return;

    // Strip @mention of this bot from text
    if (client.user) {
      text = stripDiscordMention(text, client.user.id);
    }

    // Bare @mention with no text — use replied-to message or nudge
    if (!text) {
      if (message.reference?.messageId) {
        try {
          const referenced = await message.channel.messages.fetch(message.reference.messageId);
          text = referenced.content || 'Hey, what can I help you with?';
        } catch {
          text = 'Hey, what can I help you with?';
        }
      } else {
        text = 'Hey, what can I help you with?';
      }
    }

    const sessionId = getSessionId(channelId, instanceId);
    const globalConfig = loadGlobalConfig();
    const io = createDiscordIO(message);

    await handleMessage(io, {
      text,
      sessionId,
      agentPath: agentPath ?? 'chat_with_ai/chat',
      channel: 'discord',
      chatId: channelId,
      instanceId,
      apiOptions: {
        url: globalConfig.enconvo.url,
        timeoutMs: globalConfig.enconvo.timeoutMs,
      },
    }, roster);
  };
}
