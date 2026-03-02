import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTypingIndicator } from '../typing-indicator';

beforeEach(() => {
  vi.useFakeTimers();
});

describe('createTypingIndicator', () => {
  it('calls sendFn immediately', async () => {
    const sendFn = vi.fn().mockResolvedValue(undefined);
    createTypingIndicator(sendFn, 5000);
    await vi.advanceTimersByTimeAsync(0);
    expect(sendFn).toHaveBeenCalledTimes(1);
  });

  it('repeats at the given interval', async () => {
    const sendFn = vi.fn().mockResolvedValue(undefined);
    createTypingIndicator(sendFn, 3000);
    await vi.advanceTimersByTimeAsync(0);    // first call
    await vi.advanceTimersByTimeAsync(3000); // second
    await vi.advanceTimersByTimeAsync(3000); // third
    expect(sendFn).toHaveBeenCalledTimes(3);
  });

  it('stops when stop() is called', async () => {
    const sendFn = vi.fn().mockResolvedValue(undefined);
    const { stop } = createTypingIndicator(sendFn, 2000);
    await vi.advanceTimersByTimeAsync(0);
    expect(sendFn).toHaveBeenCalledTimes(1);

    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(sendFn).toHaveBeenCalledTimes(1);
  });

  it('stops automatically when sendFn throws', async () => {
    const sendFn = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('gone'));
    createTypingIndicator(sendFn, 1000);
    await vi.advanceTimersByTimeAsync(0);    // first: ok
    await vi.advanceTimersByTimeAsync(1000); // second: throws
    await vi.advanceTimersByTimeAsync(5000); // no more calls
    expect(sendFn).toHaveBeenCalledTimes(2);
  });

  it('returns an object with stop method', () => {
    const sendFn = vi.fn().mockResolvedValue(undefined);
    const result = createTypingIndicator(sendFn, 1000);
    expect(result).toHaveProperty('stop');
    expect(typeof result.stop).toBe('function');
    result.stop();
  });
});
