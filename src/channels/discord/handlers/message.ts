import { Client, Message } from 'discord.js';
import * as fs from 'fs';
import { callEnConvo } from '../../../services/enconvo-client';
import { parseResponse } from '../../../services/response-parser';
import { loadGlobalConfig } from '../../../config/store';
import { splitMessage } from '../utils/message-splitter';
import { sendFile } from '../utils/file-sender';
import { startTypingIndicator } from '../middleware/typing';
import { getSessionId } from './commands';

export function createTextMessageHandler(client: Client, agentPath?: string, instanceId?: string) {
  return async function handleTextMessage(message: Message): Promise<void> {
    let text = message.content;
    const channelId = message.channel.id;
    if (!text) return;

    // Strip @mention of this bot from text
    if (client.user) {
      text = text.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
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
    const typing = startTypingIndicator(message.channel as any);

    try {
      const response = await callEnConvo(text, sessionId, agentPath ?? 'chat_with_ai/chat', {
        url: globalConfig.enconvo.url,
        timeoutMs: globalConfig.enconvo.timeoutMs,
      });
      typing.stop();

      const parsed = parseResponse(response);

      if (!parsed.text && parsed.filePaths.length === 0) {
        await message.reply('(EnConvo returned an empty response)');
        return;
      }

      if (parsed.text) {
        const chunks = splitMessage(parsed.text);
        for (const chunk of chunks) {
          await message.reply(chunk);
        }
      }

      for (const filePath of parsed.filePaths) {
        try {
          if (!fs.existsSync(filePath)) continue;
          await sendFile(message, filePath);
        } catch (err) {
          console.error(`Failed to send file ${filePath}:`, err);
        }
      }
    } catch (err) {
      typing.stop();

      if (err instanceof Error && err.name === 'AbortError') {
        await message.reply('Request timed out. EnConvo took too long to respond.');
      } else if (err instanceof Error && err.message.includes('fetch failed')) {
        await message.reply('Cannot reach EnConvo API. Is it running on localhost:54535?');
      } else {
        console.error('Error handling message:', err);
        await message.reply('Something went wrong while processing your message.');
      }
    }
  };
}
