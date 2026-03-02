import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCallEnConvo, mockParseResponse, mockStop } = vi.hoisted(() => ({
  mockCallEnConvo: vi.fn().mockResolvedValue('AI response text'),
  mockParseResponse: vi.fn().mockReturnValue({ text: 'parsed', filePaths: [] }),
  mockStop: vi.fn(),
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return { ...actual, writeFileSync: vi.fn() };
});

vi.mock('../../../../config/store', () => ({
  loadGlobalConfig: vi.fn().mockReturnValue({
    enconvo: { url: 'http://localhost:54535', timeoutMs: 30000 },
  }),
}));

vi.mock('../../../../services/handler-core', () => ({
  sendParsedResponse: vi.fn(),
  buildRosterContext: vi.fn(),
}));

vi.mock('../../../../services/enconvo-client', () => ({
  callEnConvo: (...args: unknown[]) => mockCallEnConvo(...args),
}));

vi.mock('../../../../services/response-parser', () => ({
  parseResponse: (...args: unknown[]) => mockParseResponse(...args),
}));

vi.mock('../../utils/file-sender', () => ({
  createDiscordIO: vi.fn().mockReturnValue({
    maxMessageLength: 2000,
    sendText: vi.fn(),
    sendFile: vi.fn(),
    startTyping: vi.fn().mockReturnValue({ stop: mockStop }),
  }),
}));

vi.mock('../commands', () => ({
  getSessionId: vi.fn().mockReturnValue('discord-ch1'),
}));

vi.mock('../../../../utils/media-dir', () => ({
  ensureMediaDir: vi.fn().mockReturnValue('/tmp/test-media'),
}));

import { createMediaHandler } from '../media';
import { sendParsedResponse } from '../../../../services/handler-core';

function makeMessage(overrides: Record<string, unknown> = {}): any {
  const attachments = new Map();
  return {
    content: 'Check this file',
    channel: { id: 'ch1' },
    attachments,
    reply: vi.fn(),
    ...overrides,
  };
}

function addAttachment(msg: any, name: string, url: string) {
  msg.attachments.set(name, { name, url });
}

describe('createMediaHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock global fetch for attachment download
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    } as Response);
  });

  it('downloads attachments and calls callEnConvo', async () => {
    const handler = createMediaHandler('custom_bot/abc', 'mavis');
    const msg = makeMessage();
    addAttachment(msg, 'photo.jpg', 'https://cdn.discord.com/photo.jpg');
    await handler(msg);

    expect(globalThis.fetch).toHaveBeenCalledWith('https://cdn.discord.com/photo.jpg');
    expect(mockCallEnConvo).toHaveBeenCalledWith(
      expect.stringContaining('Check this file'),
      'discord-ch1',
      'custom_bot/abc',
      expect.anything(),
    );
  });

  it('includes file path references in input text', async () => {
    const handler = createMediaHandler();
    const msg = makeMessage();
    addAttachment(msg, 'doc.pdf', 'https://cdn.discord.com/doc.pdf');
    await handler(msg);

    const inputText = mockCallEnConvo.mock.calls[0][0] as string;
    expect(inputText).toContain('[Attached file:');
    expect(inputText).toContain('doc.pdf');
  });

  it('handles multiple attachments', async () => {
    const handler = createMediaHandler();
    const msg = makeMessage();
    addAttachment(msg, 'a.jpg', 'https://cdn.discord.com/a.jpg');
    addAttachment(msg, 'b.png', 'https://cdn.discord.com/b.png');
    await handler(msg);

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    const inputText = mockCallEnConvo.mock.calls[0][0] as string;
    expect(inputText).toContain('a.jpg');
    expect(inputText).toContain('b.png');
  });

  it('uses caption fallback when no content', async () => {
    const handler = createMediaHandler();
    const msg = makeMessage({ content: '' });
    addAttachment(msg, 'file.bin', 'https://cdn.discord.com/file.bin');
    await handler(msg);

    const inputText = mockCallEnConvo.mock.calls[0][0] as string;
    expect(inputText).toContain('User sent a file');
  });

  it('stops typing after successful response', async () => {
    const handler = createMediaHandler();
    const msg = makeMessage();
    addAttachment(msg, 'x.txt', 'https://cdn.discord.com/x.txt');
    await handler(msg);

    expect(mockStop).toHaveBeenCalled();
    expect(sendParsedResponse).toHaveBeenCalled();
  });

  it('stops typing and replies with error on failure', async () => {
    mockCallEnConvo.mockRejectedValueOnce(new Error('API down'));
    const handler = createMediaHandler();
    const msg = makeMessage();
    addAttachment(msg, 'y.txt', 'https://cdn.discord.com/y.txt');
    await handler(msg);

    expect(mockStop).toHaveBeenCalled();
    expect(msg.reply).toHaveBeenCalledWith('Failed to process the attachment.');
  });

  it('defaults agentPath to chat_with_ai/chat', async () => {
    const handler = createMediaHandler();
    const msg = makeMessage();
    addAttachment(msg, 'z.txt', 'https://cdn.discord.com/z.txt');
    await handler(msg);

    expect(mockCallEnConvo).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'chat_with_ai/chat',
      expect.anything(),
    );
  });

  it('parses response and sends it', async () => {
    const handler = createMediaHandler();
    const msg = makeMessage();
    addAttachment(msg, 'img.png', 'https://cdn.discord.com/img.png');
    await handler(msg);

    expect(mockParseResponse).toHaveBeenCalledWith('AI response text');
    expect(sendParsedResponse).toHaveBeenCalledWith(
      expect.anything(),
      { text: 'parsed', filePaths: [] },
    );
  });
});
