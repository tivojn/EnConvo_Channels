import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSessionId, resetSession, handleCommand } from '../commands';

vi.mock('../../../../config/store', () => ({
  loadGlobalConfig: vi.fn().mockReturnValue({
    enconvo: { url: 'http://localhost:54535', timeoutMs: 30000 },
  }),
}));

describe('getSessionId', () => {
  it('returns default session ID without instanceId', () => {
    expect(getSessionId('ch123')).toBe('discord-ch123');
  });

  it('includes instanceId in session ID', () => {
    expect(getSessionId('ch123', 'mavis')).toBe('discord-ch123-mavis');
  });
});

describe('resetSession', () => {
  it('returns a new session ID with UUID suffix', () => {
    const newId = resetSession('ch456');
    expect(newId).toMatch(/^discord-ch456-[a-f0-9]{8}$/);
  });

  it('includes instanceId in reset session ID', () => {
    const newId = resetSession('ch456', 'elena');
    expect(newId).toMatch(/^discord-ch456-elena-[a-f0-9]{8}$/);
  });

  it('overrides getSessionId after reset', () => {
    const newId = resetSession('ch789');
    expect(getSessionId('ch789')).toBe(newId);
  });

  it('overrides are per-channel+instance', () => {
    resetSession('ch100', 'bot1');
    // Different instance should still have default
    expect(getSessionId('ch100', 'bot2')).toBe('discord-ch100-bot2');
  });

  it('generates different IDs on each reset', () => {
    const id1 = resetSession('ch200');
    const id2 = resetSession('ch200');
    expect(id1).not.toBe(id2);
  });
});

function makeMessage(content: string, overrides: Record<string, unknown> = {}): any {
  return {
    content,
    channel: { id: 'ch-test' },
    guild: null,
    client: { user: { id: '999' } },
    reply: vi.fn(),
    ...overrides,
  };
}

describe('handleCommand', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('handles !reset and returns true', async () => {
    const msg = makeMessage('!reset');
    const result = await handleCommand(msg);
    expect(result).toBe(true);
    expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('Session reset'));
  });

  it('!reset is case-insensitive', async () => {
    const msg = makeMessage('!RESET');
    const result = await handleCommand(msg);
    expect(result).toBe(true);
    expect(msg.reply).toHaveBeenCalled();
  });

  it('handles !status with successful health check', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
    } as Response);
    const msg = makeMessage('!status');
    const result = await handleCommand(msg, 'custom_bot/abc', 'mavis');
    expect(result).toBe(true);
    const replyText = msg.reply.mock.calls[0][0];
    expect(replyText).toContain('Connected');
    expect(replyText).toContain('custom_bot/abc (pinned)');
  });

  it('handles !status with failed health check', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 503,
    } as Response);
    const msg = makeMessage('!status');
    const result = await handleCommand(msg);
    expect(result).toBe(true);
    expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('503'));
  });

  it('handles !status when EnConvo is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const msg = makeMessage('!status');
    const result = await handleCommand(msg);
    expect(result).toBe(true);
    expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('Cannot reach'));
  });

  it('!status shows default agent when no agentPath', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true } as Response);
    const msg = makeMessage('!status');
    await handleCommand(msg);
    expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('Agent: default'));
  });

  it('handles !help in DM (no server section)', async () => {
    const msg = makeMessage('!help');
    const result = await handleCommand(msg);
    expect(result).toBe(true);
    const replyText = msg.reply.mock.calls[0][0] as string;
    expect(replyText).toContain('EnConvo Discord Bot');
    expect(replyText).toContain('!reset');
    expect(replyText).not.toContain('Mention me');
  });

  it('handles !help in server (includes server section)', async () => {
    const msg = makeMessage('!help', { guild: { id: 'guild-1' } });
    const result = await handleCommand(msg);
    expect(result).toBe(true);
    const replyText = msg.reply.mock.calls[0][0] as string;
    expect(replyText).toContain('Mention me');
    expect(replyText).toContain('<@999>');
  });

  it('!help shows agentPath when provided', async () => {
    const msg = makeMessage('!help');
    await handleCommand(msg, 'custom_bot/xyz');
    const replyText = msg.reply.mock.calls[0][0] as string;
    expect(replyText).toContain('Agent: custom_bot/xyz');
  });

  it('returns false for non-command messages', async () => {
    const msg = makeMessage('Hello world');
    const result = await handleCommand(msg);
    expect(result).toBe(false);
    expect(msg.reply).not.toHaveBeenCalled();
  });

  it('returns false for partial command matches', async () => {
    const msg = makeMessage('!resetting things');
    const result = await handleCommand(msg);
    expect(result).toBe(false);
  });

  it('!reset with extra text still triggers', async () => {
    const msg = makeMessage('!reset please');
    const result = await handleCommand(msg);
    expect(result).toBe(true);
  });
});
