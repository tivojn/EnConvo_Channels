import { describe, it, expect } from 'vitest';
import { IMAGE_EXTS, isImageFile } from '../file-types';

describe('file-types', () => {
  it('IMAGE_EXTS contains standard image extensions', () => {
    expect(IMAGE_EXTS.has('.png')).toBe(true);
    expect(IMAGE_EXTS.has('.jpg')).toBe(true);
    expect(IMAGE_EXTS.has('.jpeg')).toBe(true);
    expect(IMAGE_EXTS.has('.gif')).toBe(true);
    expect(IMAGE_EXTS.has('.webp')).toBe(true);
    expect(IMAGE_EXTS.has('.bmp')).toBe(true);
  });

  it('IMAGE_EXTS does not contain non-image extensions', () => {
    expect(IMAGE_EXTS.has('.pdf')).toBe(false);
    expect(IMAGE_EXTS.has('.txt')).toBe(false);
    expect(IMAGE_EXTS.has('.mp4')).toBe(false);
  });

  it('isImageFile returns true for image paths', () => {
    expect(isImageFile('/tmp/photo.png')).toBe(true);
    expect(isImageFile('/home/user/pic.JPEG')).toBe(true);
    expect(isImageFile('test.GIF')).toBe(true);
  });

  it('isImageFile returns false for non-image paths', () => {
    expect(isImageFile('/tmp/report.pdf')).toBe(false);
    expect(isImageFile('/tmp/data.csv')).toBe(false);
    expect(isImageFile('video.mp4')).toBe(false);
  });

  it('isImageFile handles edge cases', () => {
    expect(isImageFile('noext')).toBe(false);
    expect(isImageFile('.png')).toBe(true); // just extension
    expect(isImageFile('/path/to/file.PNG')).toBe(true); // uppercase
  });
});
