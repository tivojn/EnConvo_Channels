import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../services/session-manager', () => ({
  getSessionId: vi.fn().mockReturnValue('tg-123-mavis'),
  getAgent: vi.fn().mockReturnValue({ path: 'chat_with_ai/chat' }),
}));

vi.mock('../../../../services/handler-core', () => ({
  handleMessage: vi.fn(),
  buildRosterContext: vi.fn().mockReturnValue({ rosterIds: [], handleMap: {}, members: [] }),
}));

vi.mock('../../utils/telegram-io', () => ({
  createTelegramIO: vi.fn().mockReturnValue({
    maxMessageLength: 4096,
    sendText: vi.fn(),
    sendFile: vi.fn(),
    startTyping: vi.fn().mockReturnValue({ stop: vi.fn() }),
  }),
}));

vi.mock('../../../../utils/mention', () => ({
  stripTelegramMention: vi.fn((text: string, username: string) =>
    text.replace(new RegExp(`@${username}`, 'gi'), '').trim(),
  ),
}));

import { createTextMessageHandler } from '../message';
import { handleMessage } from '../../../../services/handler-core';
import { stripTelegramMention } from '../../../../utils/mention';

function makeCtx(overrides: Record<string, unknown> = {}): any {
  return {
    message: { text: 'Hello', reply_to_message: null },
    chat: { id: 123 },
    me: { username: 'TestBot' },
    ...overrides,
  };
}

describe('createTextMessageHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls handleMessage with text content', async () => {
    const handler = createTextMessageHandler('custom_bot/abc', 'mavis');
    await handler(makeCtx());
    expect(handleMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ text: 'Hello', agentPath: 'custom_bot/abc' }),
      expect.anything(),
    );
  });

  it('skips when no text', async () => {
    const handler = createTextMessageHandler();
    await handler(makeCtx({ message: { text: undefined, reply_to_message: null } }));
    expect(handleMessage).not.toHaveBeenCalled();
  });

  it('skips when no chatId', async () => {
    const handler = createTextMessageHandler();
    await handler(makeCtx({ chat: undefined }));
    expect(handleMessage).not.toHaveBeenCalled();
  });

  it('strips bot mention from text', async () => {
    const handler = createTextMessageHandler();
    await handler(makeCtx({ message: { text: '@TestBot Hello there', reply_to_message: null } }));
    expect(stripTelegramMention).toHaveBeenCalledWith('@TestBot Hello there', 'TestBot');
    expect(handleMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ text: 'Hello there' }),
      expect.anything(),
    );
  });

  it('uses reply text on bare mention', async () => {
    vi.mocked(stripTelegramMention).mockReturnValueOnce('');
    const handler = createTextMessageHandler();
    await handler(makeCtx({
      message: {
        text: '@TestBot',
        reply_to_message: { text: 'Previous message content' },
      },
    }));
    expect(handleMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ text: 'Previous message content' }),
      expect.anything(),
    );
  });

  it('uses nudge fallback on bare mention without reply', async () => {
    vi.mocked(stripTelegramMention).mockReturnValueOnce('');
    const handler = createTextMessageHandler();
    await handler(makeCtx({ message: { text: '@TestBot', reply_to_message: null } }));
    expect(handleMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ text: 'Hey, what can I help you with?' }),
      expect.anything(),
    );
  });

  it('uses default agent path when no pinned path', async () => {
    const handler = createTextMessageHandler();
    await handler(makeCtx());
    expect(handleMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ agentPath: 'chat_with_ai/chat' }),
      expect.anything(),
    );
  });

  it('passes channel and instanceId correctly', async () => {
    const handler = createTextMessageHandler('custom_bot/x', 'elena');
    await handler(makeCtx());
    expect(handleMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ channel: 'telegram', instanceId: 'elena' }),
      expect.anything(),
    );
  });

  it('converts chatId to string', async () => {
    const handler = createTextMessageHandler();
    await handler(makeCtx({ chat: { id: 99999 } }));
    expect(handleMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ chatId: '99999' }),
      expect.anything(),
    );
  });
});
