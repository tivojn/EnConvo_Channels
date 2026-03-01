import { describe, it, expect } from 'vitest';
import { getAdapter, listAdapterNames, listAdapters, createAdapterInstance } from '../registry';

describe('channel registry', () => {
  it('lists known adapter names', () => {
    const names = listAdapterNames();
    expect(names).toContain('telegram');
    expect(names).toContain('discord');
    expect(names.length).toBeGreaterThanOrEqual(2);
  });

  it('lists adapter instances', () => {
    const adapters = listAdapters();
    expect(adapters.length).toBeGreaterThanOrEqual(2);
    for (const adapter of adapters) {
      expect(adapter.info).toBeDefined();
      expect(adapter.info.name).toBeTruthy();
      expect(adapter.capabilities).toBeDefined();
    }
  });

  it('gets telegram adapter', () => {
    const adapter = getAdapter('telegram');
    expect(adapter).toBeDefined();
    expect(adapter!.info.name).toBe('telegram');
    expect(adapter!.capabilities.text).toBe(true);
    expect(adapter!.capabilities.groupChats).toBe(true);
  });

  it('gets discord adapter', () => {
    const adapter = getAdapter('discord');
    expect(adapter).toBeDefined();
    expect(adapter!.info.name).toBe('discord');
    expect(adapter!.capabilities.text).toBe(true);
  });

  it('returns undefined for unknown adapter', () => {
    const adapter = getAdapter('whatsapp');
    expect(adapter).toBeUndefined();
  });

  it('creates telegram adapter instance', () => {
    const adapter = createAdapterInstance('telegram', 'test-instance');
    expect(adapter).toBeDefined();
    expect(adapter!.info.name).toBe('telegram');
  });

  it('creates discord adapter instance', () => {
    const adapter = createAdapterInstance('discord', 'test-instance');
    expect(adapter).toBeDefined();
    expect(adapter!.info.name).toBe('discord');
  });

  it('returns undefined for unknown adapter instance', () => {
    const adapter = createAdapterInstance('slack', 'test');
    expect(adapter).toBeUndefined();
  });

  it('adapters have required interface methods', () => {
    const adapter = getAdapter('telegram')!;
    expect(typeof adapter.start).toBe('function');
    expect(typeof adapter.stop).toBe('function');
    expect(typeof adapter.getStatus).toBe('function');
    expect(typeof adapter.validateCredentials).toBe('function');
    expect(typeof adapter.getLogPaths).toBe('function');
    expect(typeof adapter.resolve).toBe('function');
    expect(typeof adapter.getServiceLabel).toBe('function');
  });

  it('telegram adapter has correct capabilities', () => {
    const adapter = getAdapter('telegram')!;
    const caps = adapter.capabilities;
    expect(caps.text).toBe(true);
    expect(caps.images).toBe(true);
    expect(caps.documents).toBe(true);
    expect(caps.groupChats).toBe(true);
    expect(caps.multiAccount).toBe(true);
  });

  it('discord adapter has correct capabilities', () => {
    const adapter = getAdapter('discord')!;
    const caps = adapter.capabilities;
    expect(caps.text).toBe(true);
    expect(caps.images).toBe(true);
    expect(caps.groupChats).toBe(true);
  });
});
