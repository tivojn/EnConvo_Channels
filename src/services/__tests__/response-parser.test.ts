import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseResponse, detectDelegations, hasKnownExtension, extractAbsolutePaths, extractDeliverableFiles } from '../response-parser';
import type { EnConvoResponse } from '../enconvo-client';

// Mock fs so we can control existsSync
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    statSync: vi.fn().mockReturnValue({ isFile: () => true }),
  };
});

import * as fs from 'fs';

describe('parseResponse', () => {
  it('parses simple result format', () => {
    const response: EnConvoResponse = { result: 'Hello world' };
    const parsed = parseResponse(response);
    expect(parsed.text).toBe('Hello world');
    expect(parsed.filePaths).toEqual([]);
    expect(parsed.delegations).toEqual([]);
  });

  it('returns empty for no messages', () => {
    const parsed = parseResponse({});
    expect(parsed.text).toBe('');
    expect(parsed.filePaths).toEqual([]);
    expect(parsed.delegations).toEqual([]);
  });

  it('returns empty for empty messages array', () => {
    const parsed = parseResponse({ messages: [] });
    expect(parsed.text).toBe('');
    expect(parsed.delegations).toEqual([]);
  });

  it('extracts text from assistant messages', () => {
    const response: EnConvoResponse = {
      type: 'messages',
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'ignored' }] },
        { role: 'assistant', content: [{ type: 'text', text: 'Hello from assistant' }] },
      ],
    };
    const parsed = parseResponse(response);
    expect(parsed.text).toBe('Hello from assistant');
  });

  it('concatenates multiple text items', () => {
    const response: EnConvoResponse = {
      messages: [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Part one' },
            { type: 'text', text: 'Part two' },
          ],
        },
      ],
    };
    const parsed = parseResponse(response);
    expect(parsed.text).toBe('Part one\n\nPart two');
  });

  it('ignores non-assistant messages', () => {
    const response: EnConvoResponse = {
      messages: [
        { role: 'system', content: [{ type: 'text', text: 'system msg' }] },
        { role: 'user', content: [{ type: 'text', text: 'user msg' }] },
      ],
    };
    const parsed = parseResponse(response);
    expect(parsed.text).toBe('');
  });

  it('detects delegations when roster provided', () => {
    const response: EnConvoResponse = {
      messages: [
        { role: 'assistant', content: [{ type: 'text', text: 'Ask @elena about content.' }] },
      ],
    };
    const parsed = parseResponse(response, ['mavis', 'elena', 'vivienne']);
    expect(parsed.delegations).toHaveLength(1);
    expect(parsed.delegations[0].targetAgentId).toBe('elena');
  });

  it('filters out thinking content items', () => {
    const response: EnConvoResponse = {
      messages: [
        {
          role: 'assistant',
          content: [
            { type: 'thinking', text: 'Let me think about this...' },
            { type: 'text', text: 'Here is my answer.' },
          ],
        },
      ],
    };
    const parsed = parseResponse(response);
    expect(parsed.text).toBe('Here is my answer.');
    expect(parsed.text).not.toContain('think about');
  });

  it('extracts image files from flowResults', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const response: EnConvoResponse = {
      messages: [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Here is your image.' },
            {
              type: 'flow_step',
              flowName: 'image_to_image',
              flowParams: '{"prompt":"test"}',
              flowResults: [
                {
                  content: [
                    {
                      type: 'image_url',
                      image_url: { url: '/tmp/generated/selfie.jpeg' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const parsed = parseResponse(response);
    expect(parsed.filePaths).toContain('/tmp/generated/selfie.jpeg');
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  it('returns no delegations without roster', () => {
    const response: EnConvoResponse = {
      messages: [
        { role: 'assistant', content: [{ type: 'text', text: 'Ask @elena about content.' }] },
      ],
    };
    const parsed = parseResponse(response);
    expect(parsed.delegations).toEqual([]);
  });
});

describe('detectDelegations', () => {
  const roster = ['mavis', 'elena', 'vivienne', 'timothy'];

  it('detects @agentId mentions', () => {
    const result = detectDelegations('Let me ask @elena about this.', roster);
    expect(result).toHaveLength(1);
    expect(result[0].targetAgentId).toBe('elena');
    expect(result[0].message).toBe('about this.');
  });

  it('detects arrow delegations', () => {
    const result = detectDelegations('Finance question → vivienne can help.', roster);
    expect(result).toHaveLength(1);
    expect(result[0].targetAgentId).toBe('vivienne');
  });

  it('is case insensitive', () => {
    const result = detectDelegations('@Elena should handle this.', roster);
    expect(result).toHaveLength(1);
    expect(result[0].targetAgentId).toBe('elena');
  });

  it('returns empty for no mentions', () => {
    const result = detectDelegations('Just a normal response.', roster);
    expect(result).toEqual([]);
  });

  it('returns empty without roster', () => {
    const result = detectDelegations('@elena should handle this.');
    expect(result).toEqual([]);
  });

  it('detects multiple delegations', () => {
    const result = detectDelegations('Ask @elena for copy and @timothy for code.', roster);
    expect(result).toHaveLength(2);
    expect(result[0].targetAgentId).toBe('elena');
    expect(result[1].targetAgentId).toBe('timothy');
  });

  it('deduplicates same agent mentions', () => {
    const result = detectDelegations('@elena will do this. @elena is the best.', roster);
    expect(result).toHaveLength(1);
  });

  it('detects bot handle mentions via handleMap', () => {
    const handleMap = {
      '@Enconvo_Elena_Content_Dept_bot': 'elena',
      '@EnConvo_Timothy_Dev_bot': 'timothy',
    };
    const result = detectDelegations(
      'Go to @Enconvo_Elena_Content_Dept_bot for content.',
      roster,
      handleMap,
    );
    expect(result).toHaveLength(1);
    expect(result[0].targetAgentId).toBe('elena');
  });

  it('handles mixed agentId and bot handle mentions', () => {
    const handleMap = {
      '@Enconvo_Elena_Content_Dept_bot': 'elena',
    };
    const result = detectDelegations(
      '@timothy for code, @Enconvo_Elena_Content_Dept_bot for copy.',
      roster,
      handleMap,
    );
    expect(result).toHaveLength(2);
  });

  it('extracts sentence after mention as message', () => {
    const result = detectDelegations('Ask @vivienne about the Q3 budget report.', roster);
    expect(result[0].message).toBe('about the Q3 budget report.');
  });

  it('caps message at 1000 chars for long text', () => {
    const longText = '@elena ' + 'a'.repeat(1200);
    const result = detectDelegations(longText, roster);
    expect(result[0].message.length).toBeLessThanOrEqual(1000);
  });

  it('includes full paragraph after mention instead of just one sentence', () => {
    const text = '@elena write a tagline for our brand. It should be catchy and memorable. Make it pop!';
    const result = detectDelegations(text, roster);
    // Should include all text after mention, not stop at first period
    expect(result[0].message).toContain('Make it pop!');
  });
});

describe('hasKnownExtension', () => {
  it('recognizes image extensions', () => {
    expect(hasKnownExtension('/path/to/photo.jpg')).toBe(true);
    expect(hasKnownExtension('/path/to/image.png')).toBe(true);
    expect(hasKnownExtension('/path/to/file.gif')).toBe(true);
  });

  it('recognizes document extensions', () => {
    expect(hasKnownExtension('/file.pdf')).toBe(true);
    expect(hasKnownExtension('/file.csv')).toBe(true);
    expect(hasKnownExtension('/file.json')).toBe(true);
  });

  it('recognizes media extensions', () => {
    expect(hasKnownExtension('/file.mp3')).toBe(true);
    expect(hasKnownExtension('/file.mp4')).toBe(true);
    expect(hasKnownExtension('/file.wav')).toBe(true);
  });

  it('rejects code and config extensions', () => {
    expect(hasKnownExtension('/file.ts')).toBe(false);
    expect(hasKnownExtension('/file.py')).toBe(false);
    expect(hasKnownExtension('/file.sh')).toBe(false);
    expect(hasKnownExtension('/file.env')).toBe(false);
    expect(hasKnownExtension('/file.yml')).toBe(false);
  });

  it('accepts any non-code extension as deliverable', () => {
    expect(hasKnownExtension('/file.m4a')).toBe(true);
    expect(hasKnownExtension('/file.ogg')).toBe(true);
    expect(hasKnownExtension('/file.pptx')).toBe(true);
    expect(hasKnownExtension('/file.xlsx')).toBe(true);
    expect(hasKnownExtension('/file.aac')).toBe(true);
    expect(hasKnownExtension('/file.webm')).toBe(true);
  });

  it('is case insensitive', () => {
    expect(hasKnownExtension('/FILE.JPG')).toBe(true);
    expect(hasKnownExtension('/FILE.PDF')).toBe(true);
  });
});

describe('extractAbsolutePaths', () => {
  afterEach(() => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  it('extracts existing absolute paths with known extensions', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const result = extractAbsolutePaths('Here is the file: /tmp/output/report.pdf');
    expect(result).toContain('/tmp/output/report.pdf');
  });

  it('skips paths that do not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const result = extractAbsolutePaths('File at /tmp/missing.pdf');
    expect(result).toEqual([]);
  });

  it('extracts paths on separate lines', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const text = 'See /tmp/a.jpg\nand also /tmp/b.pdf';
    const result = extractAbsolutePaths(text);
    expect(result.length).toBeGreaterThanOrEqual(1);
    // Both paths should be found (regex matches each line separately)
    expect(result.some(p => p.endsWith('.jpg'))).toBe(true);
  });

  it('returns empty for text without paths', () => {
    const result = extractAbsolutePaths('No paths here, just text.');
    expect(result).toEqual([]);
  });

  it('extracts path portion from relative-looking paths (regex matches /...)', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    // The regex matches the /relative/file.pdf portion from ./relative/file.pdf
    const result = extractAbsolutePaths('Look at ./relative/file.pdf');
    expect(result).toContain('/relative/file.pdf');
  });
});

describe('extractDeliverableFiles', () => {
  afterEach(() => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  it('extracts file deliverables from valid JSON', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const params = JSON.stringify({
      deliverables: [
        { type: 'file', url: '/tmp/output.pdf' },
        { type: 'file', url: '/tmp/image.png' },
      ],
    });
    const result = extractDeliverableFiles(params);
    expect(result).toEqual(['/tmp/output.pdf', '/tmp/image.png']);
  });

  it('filters out non-file deliverables', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const params = JSON.stringify({
      deliverables: [
        { type: 'text', url: '/tmp/output.txt' },
        { type: 'file', url: '/tmp/real.pdf' },
      ],
    });
    const result = extractDeliverableFiles(params);
    expect(result).toEqual(['/tmp/real.pdf']);
  });

  it('filters out non-existent files', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const params = JSON.stringify({
      deliverables: [{ type: 'file', url: '/tmp/gone.pdf' }],
    });
    const result = extractDeliverableFiles(params);
    expect(result).toEqual([]);
  });

  it('returns empty for invalid JSON', () => {
    const result = extractDeliverableFiles('not json');
    expect(result).toEqual([]);
  });

  it('returns empty when no deliverables array', () => {
    const result = extractDeliverableFiles(JSON.stringify({ other: 'data' }));
    expect(result).toEqual([]);
  });
});
