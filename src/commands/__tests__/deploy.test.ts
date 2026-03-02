import { describe, it, expect } from 'vitest';
import { generatePlist } from '../channels/deploy';

describe('generatePlist', () => {
  it('generates valid plist with correct label', () => {
    const plist = generatePlist('telegram', 'mavis', '/path/to/run.sh');
    expect(plist).toContain('<string>com.enconvo.telegram-mavis</string>');
  });

  it('includes run.sh path in ProgramArguments', () => {
    const plist = generatePlist('telegram', 'elena', '/home/user/scripts/run.sh');
    expect(plist).toContain('<string>/home/user/scripts/run.sh</string>');
  });

  it('includes channel login arguments', () => {
    const plist = generatePlist('telegram', 'elena', '/path/run.sh');
    expect(plist).toContain('<string>channels</string>');
    expect(plist).toContain('<string>login</string>');
    expect(plist).toContain('<string>--channel</string>');
    expect(plist).toContain('<string>telegram</string>');
    expect(plist).toContain('<string>--name</string>');
    expect(plist).toContain('<string>elena</string>');
    expect(plist).toContain('<string>-f</string>');
  });

  it('includes correct log paths', () => {
    const plist = generatePlist('discord', 'test-bot', '/path/run.sh');
    expect(plist).toContain('enconvo-discord-test-bot.log');
    expect(plist).toContain('enconvo-discord-test-bot-error.log');
  });

  it('sets RunAtLoad and KeepAlive', () => {
    const plist = generatePlist('telegram', 'mavis', '/path/run.sh');
    expect(plist).toContain('<key>RunAtLoad</key>');
    expect(plist).toContain('<key>KeepAlive</key>');
  });

  it('includes PATH environment variable', () => {
    const plist = generatePlist('telegram', 'mavis', '/path/run.sh');
    expect(plist).toContain('<key>PATH</key>');
    expect(plist).toContain('/opt/homebrew/bin');
  });

  it('is valid XML', () => {
    const plist = generatePlist('telegram', 'mavis', '/path/run.sh');
    expect(plist).toMatch(/^<\?xml version="1.0"/);
    expect(plist).toMatch(/<\/plist>$/);
  });
});
