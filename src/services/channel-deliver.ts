import * as fs from 'fs';
import { ParsedResponse } from './response-parser';
import { isImageFile } from '../utils/file-types';

/**
 * Deliver a parsed response to a Telegram chat via Bot API.
 * Sends text with Markdown fallback, then sends files as photo/document.
 */
export async function deliverTelegram(token: string, chatId: string, parsed: ParsedResponse): Promise<void> {
  const { Bot, InputFile } = await import('grammy');
  const bot = new Bot(token);

  if (parsed.text) {
    try {
      await bot.api.sendMessage(chatId, parsed.text, { parse_mode: 'Markdown' });
    } catch {
      await bot.api.sendMessage(chatId, parsed.text);
    }
  }

  for (const filePath of parsed.filePaths) {
    if (!fs.existsSync(filePath)) continue;
    if (isImageFile(filePath)) {
      await bot.api.sendPhoto(chatId, new InputFile(filePath));
    } else {
      await bot.api.sendDocument(chatId, new InputFile(filePath));
    }
  }
}

/**
 * Deliver a parsed response to a Discord channel via REST API.
 * Sends text in 2000-char chunks, then sends files via form upload.
 */
export async function deliverDiscord(token: string, channelId: string, parsed: ParsedResponse): Promise<void> {
  const baseUrl = `https://discord.com/api/v10/channels/${channelId}/messages`;
  const headers = {
    Authorization: `Bot ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'DiscordBot (https://enconvo.com, 1.0)',
  };

  if (parsed.text) {
    const { splitMessage, DISCORD_MAX_LENGTH } = await import('../utils/message-splitter');
    const chunks = splitMessage(parsed.text, DISCORD_MAX_LENGTH);
    for (const chunk of chunks) {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content: chunk }),
      });
      if (!res.ok) throw new Error(`Discord API ${res.status}: ${await res.text()}`);
    }
  }

  for (const filePath of parsed.filePaths) {
    if (!fs.existsSync(filePath)) continue;
    const form = new FormData();
    const fileData = fs.readFileSync(filePath);
    const fileName = filePath.slice(filePath.lastIndexOf('/') + 1);
    form.append('files[0]', new Blob([fileData]), fileName);
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'User-Agent': 'DiscordBot (https://enconvo.com, 1.0)',
      },
      body: form,
    });
    if (!res.ok) throw new Error(`Discord file upload ${res.status}: ${await res.text()}`);
  }
}
