import { describe, it, expect } from 'vitest';
import { getPackageVersion } from '../info';

describe('getPackageVersion', () => {
  it('returns a version string from package.json', () => {
    const version = getPackageVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('does not return unknown', () => {
    expect(getPackageVersion()).not.toBe('unknown');
  });
});
