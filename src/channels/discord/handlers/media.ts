import { Message } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { callEnConvo } from '../../../services/enconvo-client';
import { parseResponse } from '../../../services/response-parser';
import { loadGlobalConfig } from '../../../config/store';
import { sendParsedResponse } from '../../../services/handler-core';
import { createDiscordIO } from '../utils/file-sender';
import { getSessionId } from './commands';
import { ensureMediaDir } from '../../../utils/media-dir';

async function downloadAttachment(url: string, filename: string): Promise<string> {
  const mediaDir = ensureMediaDir('discord');
  const filePath = path.join(mediaDir, `${Date.now()}-${filename}`);
  const res = await fetch(url);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

export function createMediaHandler(agentPath?: string, instanceId?: string) {
  return async function handleMedia(message: Message): Promise<void> {
    const channelId = message.channel.id;
    const caption = message.content || 'User sent a file';
    const io = createDiscordIO(message);
    const typing = io.startTyping();

    try {
      const localPaths: string[] = [];
      for (const attachment of message.attachments.values()) {
        const filename = attachment.name ?? 'file.bin';
        const localPath = await downloadAttachment(attachment.url, filename);
        localPaths.push(localPath);
      }

      const attachmentRefs = localPaths
        .map(p => `[Attached file: ${p}]`)
        .join('\n');
      const inputText = `${caption}\n\n${attachmentRefs}`;

      const sessionId = getSessionId(channelId, instanceId);
      const globalConfig = loadGlobalConfig();

      const response = await callEnConvo(inputText, sessionId, agentPath ?? 'chat_with_ai/chat', {
        url: globalConfig.enconvo.url,
        timeoutMs: globalConfig.enconvo.timeoutMs,
      });
      typing.stop();

      const parsed = parseResponse(response);
      await sendParsedResponse(io, parsed);
    } catch (err) {
      typing.stop();
      console.error('Error handling media:', err);
      await message.reply('Failed to process the attachment.');
    }
  };
}
