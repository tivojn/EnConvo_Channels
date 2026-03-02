import { describe, it, expect } from 'vitest';
import { stripTelegramMention, stripDiscordMention } from '../mention';

describe('stripTelegramMention', () => {
  it('strips @username from text', () => {
    expect(stripTelegramMention('@MyBot hello', 'MyBot')).toBe('hello');
  });

  it('strips mention from middle of text', () => {
    expect(stripTelegramMention('hey @MyBot what up', 'MyBot')).toBe('hey  what up');
  });

  it('is case insensitive', () => {
    expect(stripTelegramMention('@MYBOT hello', 'MyBot')).toBe('hello');
  });

  it('returns empty string for bare mention', () => {
    expect(stripTelegramMention('@MyBot', 'MyBot')).toBe('');
  });

  it('preserves text without mention', () => {
    expect(stripTelegramMention('hello world', 'MyBot')).toBe('hello world');
  });

  it('handles multiple mentions of same bot', () => {
    expect(stripTelegramMention('@MyBot ask @MyBot again', 'MyBot')).toBe('ask  again');
  });
});

describe('stripDiscordMention', () => {
  it('strips <@userId> from text', () => {
    expect(stripDiscordMention('<@123456> hello', '123456')).toBe('hello');
  });

  it('strips <@!userId> nickname mention from text', () => {
    expect(stripDiscordMention('<@!123456> hello', '123456')).toBe('hello');
  });

  it('returns empty string for bare mention', () => {
    expect(stripDiscordMention('<@123456>', '123456')).toBe('');
  });

  it('preserves text without mention', () => {
    expect(stripDiscordMention('hello world', '123456')).toBe('hello world');
  });

  it('strips multiple mentions', () => {
    expect(stripDiscordMention('<@123> hey <@!123> there', '123')).toBe('hey  there');
  });
});
