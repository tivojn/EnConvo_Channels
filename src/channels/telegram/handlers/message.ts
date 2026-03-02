import { Context } from 'grammy';
import { getSessionId, getAgent } from '../../../services/session-manager';
import { handleMessage, buildRosterContext } from '../../../services/handler-core';
import { createTelegramIO } from '../utils/telegram-io';
import { stripTelegramMention } from '../../../utils/mention';

export function createTextMessageHandler(pinnedAgentPath?: string, instanceId?: string) {
  const roster = buildRosterContext(instanceId);

  return async function handleTextMessage(ctx: Context): Promise<void> {
    let text = ctx.message?.text;
    const chatId = ctx.chat?.id;
    if (!text || !chatId) return;

    // Strip @mention from text before sending to EnConvo
    if (ctx.me?.username) {
      text = stripTelegramMention(text, ctx.me.username);
    }

    // Bare @mention with no text — use replied-to message or nudge
    if (!text) {
      const replyText = ctx.message?.reply_to_message?.text;
      text = replyText || 'Hey, what can I help you with?';
    }

    const sessionId = getSessionId(chatId, instanceId);
    const agentPath = pinnedAgentPath ?? getAgent(chatId).path;
    const io = createTelegramIO(ctx);

    await handleMessage(io, {
      text,
      sessionId,
      agentPath,
      channel: 'telegram',
      chatId: String(chatId),
      instanceId,
    }, roster);
  };
}

// Legacy export for npm run dev path
export const handleTextMessage = createTextMessageHandler();
