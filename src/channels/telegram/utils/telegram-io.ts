import { Context, InputFile } from 'grammy';
import { ChannelIO } from '../../../services/handler-core';
import { startTypingIndicator } from '../middleware/typing';
import { TELEGRAM_MAX_LENGTH } from '../../../utils/message-splitter';
import { isImageFile } from '../../../utils/file-types';

/** Shared ChannelIO factory for Telegram — used by both message and media handlers. */
export function createTelegramIO(ctx: Context): ChannelIO {
  return {
    maxMessageLength: TELEGRAM_MAX_LENGTH,
    sendText: async (text: string) => {
      try {
        await ctx.reply(text, { parse_mode: 'Markdown' });
      } catch {
        await ctx.reply(text);
      }
    },
    sendFile: async (filePath: string) => {
      if (isImageFile(filePath)) {
        await ctx.replyWithPhoto(new InputFile(filePath));
      } else {
        await ctx.replyWithDocument(new InputFile(filePath));
      }
    },
    startTyping: () => startTypingIndicator(ctx),
  };
}
