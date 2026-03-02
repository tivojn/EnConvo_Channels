import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import { outputError, expandHome } from '../command-output';

describe('outputError', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('outputs JSON when opts.json is true', () => {
    outputError({ json: true }, 'something went wrong');
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ error: 'something went wrong' }));
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('outputs to stderr when opts.json is false', () => {
    outputError({ json: false }, 'something went wrong');
    expect(errorSpy).toHaveBeenCalledWith('Error: something went wrong');
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('outputs to stderr when opts.json is undefined', () => {
    outputError({}, 'missing thing');
    expect(errorSpy).toHaveBeenCalledWith('Error: missing thing');
  });
});

describe('expandHome', () => {
  it('expands ~ to home directory', () => {
    const result = expandHome('~/Documents');
    expect(result).toBe(`${os.homedir()}/Documents`);
  });

  it('does not modify paths without ~', () => {
    expect(expandHome('/usr/local')).toBe('/usr/local');
  });

  it('only expands leading ~', () => {
    expect(expandHome('/home/~user')).toBe('/home/~user');
  });

  it('handles bare ~', () => {
    expect(expandHome('~')).toBe(os.homedir());
  });
});
