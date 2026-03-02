import { describe, it, expect } from 'vitest';
import { getSessionId, resetSession } from '../discord/handlers/commands';

describe('Discord session management', () => {
  it('getSessionId returns default format', () => {
    const id = getSessionId('123456');
    expect(id).toBe('discord-123456');
  });

  it('getSessionId includes instanceId suffix', () => {
    const id = getSessionId('123456', 'mavis');
    expect(id).toBe('discord-123456-mavis');
  });

  it('resetSession generates new session ID', () => {
    const id = resetSession('999');
    expect(id).toMatch(/^discord-999-[a-f0-9]{8}$/);
  });

  it('resetSession with instanceId includes it', () => {
    const id = resetSession('999', 'bot1');
    expect(id).toMatch(/^discord-999-bot1-[a-f0-9]{8}$/);
  });

  it('getSessionId returns overridden value after reset', () => {
    const channelId = `test-${Date.now()}`;
    const newId = resetSession(channelId);
    expect(getSessionId(channelId)).toBe(newId);
  });

  it('reset does not affect other channels', () => {
    const ch1 = `ch1-${Date.now()}`;
    const ch2 = `ch2-${Date.now()}`;
    resetSession(ch1);
    expect(getSessionId(ch2)).toBe(`discord-${ch2}`);
  });

  it('reset with instanceId does not affect bare channel', () => {
    const ch = `multi-${Date.now()}`;
    resetSession(ch, 'inst1');
    // Bare channel still returns default
    expect(getSessionId(ch)).toBe(`discord-${ch}`);
  });
});
