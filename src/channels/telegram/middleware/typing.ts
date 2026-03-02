import { Context } from 'grammy';
import { createTypingIndicator } from '../../../utils/typing-indicator';

export function startTypingIndicator(ctx: Context): { stop: () => void } {
  const chatId = ctx.chat?.id;
  if (!chatId) return { stop: () => {} };

  return createTypingIndicator(() => ctx.replyWithChatAction('typing'), 4000);
}
