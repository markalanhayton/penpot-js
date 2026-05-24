import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IMAGE_TYPES, FONT_TYPES, ALL_MEDIA_TYPES, MTYPE_TO_EXTENSION, FORMAT_TO_MTYPE,
  MEDIA_THUMBNAIL_OPTIONS, PROFILE_THUMBNAIL_OPTIONS,
  mtypeToExtension, validateMediaType, validateFontType, validateMediaSize,
  bigEnoughForThumbnail, isSvgImage } from '../src/media/index.js';

describe('media constants', () => {
  it('IMAGE_TYPES is non-empty set', () => {
    assert.ok(IMAGE_TYPES instanceof Set);
    assert.ok(IMAGE_TYPES.size > 0);
  });

  it('FONT_TYPES is non-empty set', () => {
    assert.ok(FONT_TYPES instanceof Set);
    assert.ok(FONT_TYPES.size > 0);
  });

  it('ALL_MEDIA_TYPES includes image and font types', () => {
    assert.ok(ALL_MEDIA_TYPES.size >= IMAGE_TYPES.size + FONT_TYPES.size);
  });

  it('MTYPE_TO_EXTENSION has common mappings', () => {
    assert.equal(MTYPE_TO_EXTENSION['image/png'], 'png');
    assert.equal(MTYPE_TO_EXTENSION['image/jpeg'], 'jpg');
  });

  it('FORMAT_TO_MTYPE has common mappings', () => {
    assert.equal(FORMAT_TO_MTYPE['png'], 'image/png');
    assert.equal(FORMAT_TO_MTYPE['jpg'], 'image/jpeg');
  });

  it('MEDIA_THUMBNAIL_OPTIONS has width and height', () => {
    assert.ok(MEDIA_THUMBNAIL_OPTIONS.width > 0);
    assert.ok(MEDIA_THUMBNAIL_OPTIONS.height > 0);
  });

  it('PROFILE_THUMBNAIL_OPTIONS has width and height', () => {
    assert.ok(PROFILE_THUMBNAIL_OPTIONS.width > 0);
    assert.ok(PROFILE_THUMBNAIL_OPTIONS.height > 0);
  });
});

describe('mtypeToExtension', () => {
  it('returns extension for known types', () => {
    assert.equal(mtypeToExtension('image/png'), 'png');
    assert.equal(mtypeToExtension('image/jpeg'), 'jpg');
    assert.equal(mtypeToExtension('image/svg+xml'), 'svg');
  });

  it('returns null for unknown types', () => {
    assert.equal(mtypeToExtension('application/unknown'), null);
  });
});

describe('validateMediaType', () => {
  it('returns upload for valid image types', () => {
    const result = validateMediaType({ mtype: 'image/png' });
    assert.equal(result.mtype, 'image/png');
  });

  it('throws for invalid types', () => {
    assert.throws(() => validateMediaType({ mtype: 'application/pdf' }), /invalid media/);
  });
});

describe('validateFontType', () => {
  it('returns upload for valid font types', () => {
    const result = validateFontType({ mtype: 'font/ttf' });
    assert.equal(result.mtype, 'font/ttf');
  });

  it('throws for invalid types', () => {
    assert.throws(() => validateFontType({ mtype: 'image/png' }), /invalid media/);
  });
});

describe('validateMediaSize', () => {
  it('returns upload when under default limit', () => {
    const result = validateMediaSize({ size: 1024, mtype: 'image/png' });
    assert.equal(result.size, 1024);
  });

  it('throws when over limit', () => {
    assert.throws(() => validateMediaSize({ size: Number.MAX_SAFE_INTEGER, mtype: 'image/png' }), /greater than/);
  });
});

describe('bigEnoughForThumbnail', () => {
  it('returns true for reasonable dimensions', () => {
    assert.ok(bigEnoughForThumbnail({ width: 200, height: 200 }));
  });

  it('returns false for tiny dimensions', () => {
    assert.ok(!bigEnoughForThumbnail({ width: 1, height: 1 }));
  });
});