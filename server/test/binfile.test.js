import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { encode, decode } from '../src/files/blob.js';

const SAMPLE_FILE_DATA = {
  id: randomUUID(),
  name: 'Test File',
  pages: [],
  pagesIndex: {},
  components: {},
  media: {},
  colors: {},
  typographies: {},
  version: 67,
  features: ['fdata/shape-data-type', 'styles/v2'],
};

const SAMPLE_PAGE = {
  id: randomUUID(),
  name: 'Page 1',
  width: 1200,
  height: 800,
  objects: {
    [randomUUID()]: {
      id: randomUUID(),
      type: 'rect',
      name: 'Rectangle',
      x: 100,
      y: 100,
      width: 200,
      height: 150,
      fills: [{ 'fill-type': 'solid', 'fill-color': '#ff0000', 'fill-opacity': 1 }],
      strokes: [],
      shapes: [],
    },
  },
};

describe('binfile import/export utilities', () => {
  describe('normalizeImportData', () => {
    const normalizeImportData = (data) => {
      if (!data) return { pages: [], pagesIndex: {}, components: {}, media: {}, colors: {}, typographies: {} };
      const normalized = { ...data };
      if (normalized.pages && Array.isArray(normalized.pages)) {
        normalized.pages = normalized.pages.map((p, i) => normalizeImportPage(p, i)).filter(Boolean);
      } else if (normalized.pagesIndex) {
        const pages = [];
        const idx = { ...normalized.pagesIndex };
        for (const [pageId, pageData] of Object.entries(idx)) {
          const page = normalizeImportPage({ ...pageData, id: pageId }, pages.length);
          if (page) { pages.push(page); idx[pageId] = page; }
        }
        normalized.pages = pages;
        normalized.pagesIndex = idx;
      } else {
        normalized.pages = [];
      }
      if (!normalized.pagesIndex && normalized.pages) {
        normalized.pagesIndex = {};
        for (const page of normalized.pages) { normalized.pagesIndex[page.id] = page; }
      }
      normalized.components = normalized.components || {};
      normalized.media = normalized.media || {};
      normalized.colors = normalized.colors || {};
      normalized.typographies = normalized.typographies || {};
      return normalized;
    };

    const normalizeImportPage = (page, index) => {
      if (!page) return null;
      const normalized = { ...page };
      if (!normalized.id) normalized.id = randomUUID();
      if (!normalized.name) normalized.name = `Page ${index + 1}`;
      if (!normalized.width) normalized.width = 1200;
      if (!normalized.height) normalized.height = 800;
      if (normalized.objects) {
        if (Array.isArray(normalized.objects)) {
          const map = {};
          for (const obj of normalized.objects) { if (obj && obj.id) map[obj.id] = obj; }
          normalized.objects = map;
        }
        for (const obj of Object.values(normalized.objects)) {
          if (obj) {
            if (obj.shapes && Array.isArray(obj.shapes)) {
              obj.shapes = obj.shapes.map(s => typeof s === 'string' ? s : s?.id).filter(Boolean);
            }
            if (obj.children && Array.isArray(obj.children)) {
              obj.shapes = obj.children.map(c => typeof c === 'string' ? c : c?.id).filter(Boolean);
              delete obj.children;
            }
          }
        }
      } else {
        normalized.objects = {};
      }
      return normalized;
    };

    it('normalizes empty data', () => {
      const result = normalizeImportData(null);
      assert.deepEqual(Object.keys(result).sort(), ['colors', 'components', 'media', 'pages', 'pagesIndex', 'typographies'].sort());
      assert.equal(result.pages.length, 0);
    });

    it('normalizes pages array with objects', () => {
      const data = { pages: [SAMPLE_PAGE], components: {}, media: {} };
      const result = normalizeImportData(data);
      assert.equal(result.pages.length, 1);
      assert.ok(result.pagesIndex[result.pages[0].id]);
    });

    it('converts objects array to map', () => {
      const shapeId = randomUUID();
      const page = {
        id: randomUUID(),
        name: 'Test',
        width: 800,
        height: 600,
        objects: [{ id: shapeId, type: 'rect', shapes: [] }],
      };
      const result = normalizeImportData({ pages: [page] });
      assert.equal(typeof result.pages[0].objects, 'object');
      assert.ok(result.pages[0].objects[shapeId]);
    });

    it('converts children to shapes array', () => {
      const shapeId1 = randomUUID();
      const shapeId2 = randomUUID();
      const frameId = randomUUID();
      const page = {
        id: randomUUID(),
        name: 'Test',
        width: 800,
        height: 600,
        objects: {
          [frameId]: {
            id: frameId,
            type: 'frame',
            shapes: [],
            children: [shapeId1, shapeId2],
          },
        },
      };
      const result = normalizeImportData({ pages: [page] });
      const frame = result.pages[0].objects[frameId];
      assert.ok(frame.shapes, 'frame should have shapes');
      assert.equal(frame.shapes.length, 2);
      assert.equal(frame.children, undefined);
    });

    it('defaults page dimensions when missing', () => {
      const page = { id: randomUUID(), objects: {} };
      const result = normalizeImportData({ pages: [page] });
      assert.equal(result.pages[0].width, 1200);
      assert.equal(result.pages[0].height, 800);
    });

    it('preserves existing properties', () => {
      const data = {
        pages: [{ id: randomUUID(), name: 'Custom', width: 1920, height: 1080, objects: {} }],
        components: { comp1: { id: 'comp1' } },
        media: { img1: { id: 'img1' } },
        colors: { c1: { id: 'c1' } },
        typographies: { t1: { id: 't1' } },
      };
      const result = normalizeImportData(data);
      assert.equal(result.pages[0].name, 'Custom');
      assert.equal(result.pages[0].width, 1920);
      assert.equal(result.pages[0].height, 1080);
      assert.ok(result.components.comp1);
      assert.ok(result.media.img1);
    });
  });

  describe('cleanShapePreDecode/cleanShapePostDecode', () => {
    const cleanShapePreDecode = (shape) => {
      if (!shape || typeof shape !== 'object') return shape;
      const cleaned = { ...shape };
      if (cleaned['bool-content'] !== undefined && cleaned['boolContent'] === undefined) {
        cleaned['boolContent'] = cleaned['bool-content'];
        delete cleaned['bool-content'];
      }
      if (cleaned['shadow-color'] !== undefined && cleaned['shadowColor'] === undefined) {
        cleaned['shadowColor'] = cleaned['shadow-color'];
        delete cleaned['shadow-color'];
      }
      return cleaned;
    };

    it('converts kebab-case bool-content to camelCase', () => {
      const shape = { id: 's1', 'bool-content': [{ id: 'c1' }] };
      const cleaned = cleanShapePreDecode(shape);
      assert.equal(cleaned['boolContent'], shape['bool-content']);
      assert.equal(cleaned['bool-content'], undefined);
    });

    it('converts kebab-case shadow-color to camelCase', () => {
      const shape = { id: 's1', 'shadow-color': '#ff0000' };
      const cleaned = cleanShapePreDecode(shape);
      assert.equal(cleaned['shadowColor'], '#ff0000');
      assert.equal(cleaned['shadow-color'], undefined);
    });

    it('preserves camelCase properties', () => {
      const shape = { id: 's1', boolContent: [{ id: 'c1' }], shadowColor: '#00ff00' };
      const cleaned = cleanShapePreDecode(shape);
      assert.deepEqual(cleaned.boolContent, shape.boolContent);
      assert.equal(cleaned.shadowColor, shape.shadowColor);
    });
  });

  describe('applyFeatureMigrations', () => {
    const applyFeatureMigrations = (data) => {
      if (!data) return data;
      const result = { ...data };
      result.version = result.version || 0;
      if (!result.features) result.features = [];
      if (typeof result.features === 'object' && !Array.isArray(result.features)) {
        result.features = Object.keys(result.features);
      }
      const requiredFeatures = [
        'fdata/shape-data-type', 'styles/v2', 'layout/grid',
        'components/v2', 'plugins/runtime', 'design-tokens/v1', 'variants/v1',
      ];
      const featureSet = new Set([...result.features, ...requiredFeatures]);
      result.features = [...featureSet];
      return result;
    };

    it('adds missing required features', () => {
      const data = { version: 0, features: ['styles/v2'] };
      const result = applyFeatureMigrations(data);
      assert.ok(result.features.includes('fdata/shape-data-type'));
      assert.ok(result.features.includes('layout/grid'));
      assert.ok(result.features.includes('components/v2'));
      assert.ok(result.features.includes('plugins/runtime'));
      assert.ok(result.features.includes('design-tokens/v1'));
      assert.ok(result.features.includes('variants/v1'));
      assert.ok(result.features.includes('styles/v2'));
    });

    it('initializes features if missing', () => {
      const data = { version: 5 };
      const result = applyFeatureMigrations(data);
      assert.ok(Array.isArray(result.features));
      assert.ok(result.features.length >= 7);
    });

    it('converts feature object to array', () => {
      const data = { version: 3, features: { 'styles/v2': true, 'layout/grid': true } };
      const result = applyFeatureMigrations(data);
      assert.ok(Array.isArray(result.features));
      assert.ok(result.features.includes('styles/v2'));
    });
  });

  describe('createIdMap', () => {
    const createIdMap = (data) => {
      const idMap = {};
      function addId(oldId) {
        if (!oldId || idMap[oldId]) return idMap[oldId] || oldId;
        const newId = randomUUID();
        idMap[oldId] = newId;
        return newId;
      }
      if (data.id) addId(data.id);
      if (data.pages) {
        if (Array.isArray(data.pages)) {
          for (const pageId of data.pages) { if (typeof pageId === 'string') addId(pageId); }
        }
      }
      if (data.pagesIndex) {
        for (const [pageId, pageData] of Object.entries(data.pagesIndex)) {
          addId(pageId);
          if (pageData && pageData.objects) {
            const objects = Array.isArray(pageData.objects) ? pageData.objects : Object.values(pageData.objects);
            for (const shape of objects) { if (shape && shape.id) addId(shape.id); }
          }
        }
      }
      if (data.components) { for (const compId of Object.keys(data.components)) addId(compId); }
      if (data.media) { for (const mediaId of Object.keys(data.media)) addId(mediaId); }
      if (data.colors) {
        if (Array.isArray(data.colors)) { for (const c of data.colors) { if (c && c.id) addId(c.id); } }
        else { for (const colorId of Object.keys(data.colors)) addId(colorId); }
      }
      if (data.typographies) {
        if (Array.isArray(data.typographies)) { for (const t of data.typographies) { if (t && t.id) addId(t.id); } }
        else { for (const typoId of Object.keys(data.typographies)) addId(typoId); }
      }
      return idMap;
    };

    it('remaps file ID', () => {
      const fileId = randomUUID();
      const data = { id: fileId, pages: [], pagesIndex: {} };
      const idMap = createIdMap(data);
      assert.ok(idMap[fileId]);
      assert.notEqual(idMap[fileId], fileId);
    });

    it('remaps page IDs from pagesIndex', () => {
      const pageId = randomUUID();
      const data = { pagesIndex: { [pageId]: { id: pageId, name: 'Page 1', objects: {} } } };
      const idMap = createIdMap(data);
      assert.ok(idMap[pageId]);
    });

    it('remaps shape IDs', () => {
      const shapeId = randomUUID();
      const pageId = randomUUID();
      const data = {
        pagesIndex: {
          [pageId]: { id: pageId, name: 'Page 1', objects: { [shapeId]: { id: shapeId, type: 'rect' } } },
        },
      };
      const idMap = createIdMap(data);
      assert.ok(idMap[shapeId]);
    });

    it('remaps component, media, color, typography IDs', () => {
      const compId = randomUUID();
      const mediaId = randomUUID();
      const colorId = randomUUID();
      const typoId = randomUUID();
      const data = {
        components: { [compId]: { id: compId } },
        media: { [mediaId]: { id: mediaId } },
        colors: { [colorId]: { id: colorId } },
        typographies: { [typoId]: { id: typoId } },
      };
      const idMap = createIdMap(data);
      assert.ok(idMap[compId]);
      assert.ok(idMap[mediaId]);
      assert.ok(idMap[colorId]);
      assert.ok(idMap[typoId]);
    });
  });

  describe('collectMediaRefs', () => {
    const collectMediaRefs = (data) => {
      const refs = new Set();
      if (!data) return refs;
      const pages = data.pages || Object.values(data.pagesIndex || {});
      for (const page of pages) {
        const objects = page?.objects || {};
        const objArr = Array.isArray(objects) ? objects : Object.values(objects);
        for (const shape of objArr) {
          if (!shape) continue;
          scanShapeMedia(shape, refs);
        }
      }
      return refs;
    };

    const scanShapeMedia = (shape, refs) => {
      if (!shape) return;
      if (shape.fills) {
        for (const fill of shape.fills) {
          if (fill && fill['fill-type'] === 'image' && fill['fill-image-media']) {
            refs.add(fill['fill-image-media']);
          }
        }
      }
      if (shape.strokes) {
        for (const stroke of shape.strokes) {
          if (stroke && stroke['stroke-type'] === 'image' && stroke['stroke-image-media']) {
            refs.add(stroke['stroke-image-media']);
          }
        }
      }
      const children = shape.shapes || shape.children || [];
      const childArr = Array.isArray(children) ? children : Object.values(children);
      for (const child of childArr) {
        if (typeof child === 'object' && child !== null) scanShapeMedia(child, refs);
      }
    };

    it('collects fill image media refs', () => {
      const mediaId = randomUUID();
      const shapeId = randomUUID();
      const pageId = randomUUID();
      const data = {
        pages: [{
          id: pageId,
          objects: {
            [shapeId]: {
              id: shapeId,
              fills: [{ 'fill-type': 'image', 'fill-image-media': mediaId }],
              strokes: [],
            },
          },
        }],
      };
      const refs = collectMediaRefs(data);
      assert.ok(refs.has(mediaId));
    });

    it('collects stroke image media refs', () => {
      const mediaId = randomUUID();
      const shapeId = randomUUID();
      const pageId = randomUUID();
      const data = {
        pages: [{
          id: pageId,
          objects: {
            [shapeId]: {
              id: shapeId,
              fills: [],
              strokes: [{ 'stroke-type': 'image', 'stroke-image-media': mediaId }],
            },
          },
        }],
      };
      const refs = collectMediaRefs(data);
      assert.ok(refs.has(mediaId));
    });

    it('returns empty set for null data', () => {
      const refs = collectMediaRefs(null);
      assert.equal(refs.size, 0);
    });

    it('deduplicates media refs', () => {
      const mediaId = randomUUID();
      const shapeId1 = randomUUID();
      const shapeId2 = randomUUID();
      const pageId = randomUUID();
      const data = {
        pages: [{
          id: pageId,
          objects: {
            [shapeId1]: {
              id: shapeId1,
              fills: [{ 'fill-type': 'image', 'fill-image-media': mediaId }],
            },
            [shapeId2]: {
              id: shapeId2,
              fills: [{ 'fill-type': 'image', 'fill-image-media': mediaId }],
            },
          },
        }],
      };
      const refs = collectMediaRefs(data);
      assert.equal(refs.size, 1);
    });
  });

  describe('getExtFromMtype', () => {
    const getExtFromMtype = (mtype) => {
      if (!mtype) return '.bin';
      if (mtype.includes('png')) return '.png';
      if (mtype.includes('jpeg') || mtype.includes('jpg')) return '.jpg';
      if (mtype.includes('webp')) return '.webp';
      if (mtype.includes('gif')) return '.gif';
      if (mtype.includes('svg')) return '.svg';
      if (mtype.includes('pdf')) return '.pdf';
      if (mtype.includes('woff2')) return '.woff2';
      if (mtype.includes('woff')) return '.woff';
      if (mtype.includes('ttf')) return '.ttf';
      if (mtype.includes('otf')) return '.otf';
      return '.bin';
    };

    it('returns .png for image/png', () => assert.equal(getExtFromMtype('image/png'), '.png'));
    it('returns .jpg for image/jpeg', () => assert.equal(getExtFromMtype('image/jpeg'), '.jpg'));
    it('returns .webp for image/webp', () => assert.equal(getExtFromMtype('image/webp'), '.webp'));
    it('returns .svg for image/svg+xml', () => assert.equal(getExtFromMtype('image/svg+xml'), '.svg'));
    it('returns .woff2 for font/woff2', () => assert.equal(getExtFromMtype('font/woff2'), '.woff2'));
    it('returns .bin for unknown', () => assert.equal(getExtFromMtype('application/octet-stream'), '.bin'));
    it('returns .bin for null', () => assert.equal(getExtFromMtype(null), '.bin'));
  });

  describe('ZIP archive format (export/import round-trip)', () => {
    it('creates a valid ZIP buffer with archiver', async () => {
      const { ZipArchive } = await import('archiver');
      const chunks = [];
      const archive = new ZipArchive({ zlib: { level: 6 } });
      archive.on('data', (chunk) => chunks.push(chunk));

      const manifest = {
        type: 'penpot/export-files',
        version: 3,
        'generated-by': 'penpot-js',
        created: new Date().toISOString(),
        features: [],
        files: [{ id: 'test-file', name: 'Test File', 'is-shared': false }],
        relations: [],
      };
      archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
      archive.append(JSON.stringify({ pages: [], components: {} }), { name: 'files/test-file.json' });
      archive.finalize();

      await new Promise((resolve) => archive.on('end', resolve));
      const buffer = Buffer.concat(chunks);
      assert.ok(buffer.length > 0);
      assert.equal(buffer[0], 0x50); // PK header
      assert.equal(buffer[1], 0x4B);
    });

    it('JSZip can read an archiver-created ZIP', async () => {
      const { ZipArchive } = await import('archiver');
      const JSZip = (await import('jszip')).default;
      const chunks = [];
      const archive = new ZipArchive({ zlib: { level: 6 } });
      archive.on('data', (chunk) => chunks.push(chunk));

      const testData = { pages: [{ id: 'p1', name: 'Page 1', objects: {} }], components: {} };
      archive.append(JSON.stringify({ type: 'penpot/export-files', version: 3, files: [] }), { name: 'manifest.json' });
      archive.append(JSON.stringify(testData), { name: 'files/test.json' });
      archive.finalize();

      await new Promise((resolve) => archive.on('end', resolve));
      const buffer = Buffer.concat(chunks);

      const zip = await JSZip.loadAsync(buffer);
      const manifestEntry = zip.file('manifest.json');
      assert.ok(manifestEntry, 'manifest.json should exist in ZIP');

      const manifestText = await manifestEntry.async('string');
      const manifest = JSON.parse(manifestText);
      assert.equal(manifest.type, 'penpot/export-files');

      const fileEntry = zip.file('files/test.json');
      assert.ok(fileEntry, 'files/test.json should exist in ZIP');
      const fileText = await fileEntry.async('string');
      const fileData = JSON.parse(fileText);
      assert.ok(fileData.pages);
    });
  });
});

describe('blob encode/decode round-trip (binfile data)', () => {
  it('round-trips file data with pages and components', async () => {
    const pageId = randomUUID();
    const shapeId = randomUUID();
    const compId = randomUUID();
    const mediaId = randomUUID();

    const data = {
      id: randomUUID(),
      name: 'Test File',
      pages: [pageId],
      pagesIndex: {
        [pageId]: {
          id: pageId,
          name: 'Page 1',
          objects: {
            [shapeId]: {
              id: shapeId,
              type: 'rect',
              fills: [{ 'fill-type': 'image', 'fill-image-media': mediaId }],
              strokes: [],
            },
          },
        },
      },
      components: { [compId]: { id: compId, name: 'Button' } },
      media: { [mediaId]: { id: mediaId, mtype: 'image/png', width: 800, height: 600 } },
      colors: {},
      typographies: {},
      version: 67,
    };

    const encoded = await encode(data, { version: 5 });
    const decoded = await decode(encoded);
    assert.equal(decoded.name, 'Test File');
    assert.equal(decoded.pages.length, 1);
    assert.ok(decoded.pagesIndex[pageId]);
    assert.ok(decoded.components[compId]);
  });
});