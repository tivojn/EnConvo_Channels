import { describe, it, expect, vi } from 'vitest';
import { createMentionGate } from '../mention-gate';

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    chat: { type: 'group', id: 123 },
    me: { id: 99, username: 'TestBot' },
    message: {
      entities: [],
      reply_to_message: null,
    },
    entities: vi.fn().mockReturnValue([]),
    ...overrides,
  } as any;
}

describe('createMentionGate', () => {
  const gate = createMentionGate();

  it('passes through private chats', async () => {
    const next = vi.fn();
    const ctx = makeCtx({ chat: { type: 'private', id: 1 } });
    await gate(ctx, next);
    expect(next).toHaveBeenCalled();
  });

  it('passes through bot commands', async () => {
    const next = vi.fn();
    const ctx = makeCtx({
      message: {
        entities: [{ type: 'bot_command', offset: 0, length: 6 }],
        reply_to_message: null,
      },
    });
    await gate(ctx, next);
    expect(next).toHaveBeenCalled();
  });

  it('passes through reply to bot message', async () => {
    const next = vi.fn();
    const ctx = makeCtx({
      message: {
        entities: [],
        reply_to_message: { from: { id: 99 } },
      },
    });
    await gate(ctx, next);
    expect(next).toHaveBeenCalled();
  });

  it('passes through when bot is @mentioned', async () => {
    const next = vi.fn();
    const ctx = makeCtx({
      entities: vi.fn().mockImplementation((type: string) => {
        if (type === 'mention') return [{ text: '@TestBot' }];
        return [];
      }),
    });
    await gate(ctx, next);
    expect(next).toHaveBeenCalled();
  });

  it('passes through case-insensitive @mention', async () => {
    const next = vi.fn();
    const ctx = makeCtx({
      entities: vi.fn().mockImplementation((type: string) => {
        if (type === 'mention') return [{ text: '@testbot' }];
        return [];
      }),
    });
    await gate(ctx, next);
    expect(next).toHaveBeenCalled();
  });

  it('passes through text_mention (by user ID)', async () => {
    const next = vi.fn();
    const ctx = makeCtx({
      entities: vi.fn().mockImplementation((type: string) => {
        if (type === 'text_mention') return [{ user: { id: 99 } }];
        return [];
      }),
    });
    await gate(ctx, next);
    expect(next).toHaveBeenCalled();
  });

  it('ignores group messages without mention or reply', async () => {
    const next = vi.fn();
    const ctx = makeCtx();
    await gate(ctx, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('ignores reply to non-bot message', async () => {
    const next = vi.fn();
    const ctx = makeCtx({
      message: {
        entities: [],
        reply_to_message: { from: { id: 42 } },
      },
    });
    await gate(ctx, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('ignores @mention of different bot', async () => {
    const next = vi.fn();
    const ctx = makeCtx({
      entities: vi.fn().mockImplementation((type: string) => {
        if (type === 'mention') return [{ text: '@OtherBot' }];
        return [];
      }),
    });
    await gate(ctx, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('ignores text_mention of different user', async () => {
    const next = vi.fn();
    const ctx = makeCtx({
      entities: vi.fn().mockImplementation((type: string) => {
        if (type === 'text_mention') return [{ user: { id: 42 } }];
        return [];
      }),
    });
    await gate(ctx, next);
    expect(next).not.toHaveBeenCalled();
  });
});
