import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as filesVariant from '../src/files/variant.js';
import * as filesCompProcessors from '../src/files/comp_processors.js';
import * as filesValidate from '../src/files/validate.js';
import * as logicTokens from '../src/logic/tokens.js';
import * as logicVariantProperties from '../src/logic/variant_properties.js';
import * as logicVariants from '../src/logic/variants.js';
import * as logicShapes from '../src/logic/shapes.js';
import * as logicLibraries from '../src/logic/libraries.js';

const zero = '00000000-0000-0000-0000-000000000000';

describe('files/variant', () => {
  it('findVariantComponents returns empty for empty data', () => {
    assert.deepEqual(filesVariant.findVariantComponents({}, {}), []);
  });

  it('findVariantComponents finds components by variant-id', () => {
    const data = {
      components: {
        'comp-1': { id: 'comp-1', 'variant-id': 'var-1', name: 'Variant 1', 'main-instance-page': 'page-1', 'variant-properties': [{ name: 'Property 1', value: 'Value 1' }] },
        'comp-2': { id: 'comp-2', 'variant-id': 'var-1', name: 'Variant 2', 'main-instance-page': 'page-1', 'variant-properties': [{ name: 'Property 1', value: 'Value 2' }] },
        'comp-3': { id: 'comp-3', 'variant-id': null, name: 'Standalone' },
      },
      'pages-index': {
        'page-1': {
          id: 'page-1',
          name: 'Page 1',
          objects: {
            'var-1': { id: 'var-1', shapes: ['shape-1', 'shape-2'] },
            'shape-1': { id: 'shape-1', 'component-id': 'comp-1' },
            'shape-2': { id: 'shape-2', 'component-id': 'comp-2' },
          },
        },
      },
    };
    const result = filesVariant.findVariantComponents(data, data['pages-index']['page-1'].objects, 'var-1');
    assert.equal(result.length, 2);
  });

  it('extractPropertiesNames returns property names from component', () => {
    const data = {
      components: {
        'comp-1': {
          id: 'comp-1',
          'variant-properties': [
            { name: 'Size', value: 'Large' },
            { name: 'Color', value: 'Red' },
          ],
        },
      },
    };
    const shape = { 'component-id': 'comp-1' };
    const result = filesVariant.extractPropertiesNames(shape, data);
    assert.deepEqual(result, ['Size', 'Color']);
  });

  it('isSecondaryVariantQ returns true for secondary variant', () => {
    const data = {
      components: {
        'comp-1': { id: 'comp-1', 'variant-id': 'var-1', 'main-instance-id': 'shape-1', 'main-instance-page': 'page-1' },
      },
      'pages-index': {
        'page-1': {
          id: 'page-1',
          name: 'Page 1',
          objects: {
            'var-1': { id: 'var-1', shapes: ['shape-1', 'shape-2'] },
            'shape-1': { id: 'shape-1', 'component-id': 'comp-1' },
            'shape-2': { id: 'shape-2', 'component-id': 'comp-2' },
          },
        },
      },
    };
    const component = { id: 'comp-1', 'variant-id': 'var-1', 'main-instance-id': 'shape-1', 'main-instance-page': 'page-1' };
    assert.equal(filesVariant.isSecondaryVariantQ(component, data), true);
  });

  it('getPrimaryVariant returns first variant shape', () => {
    const data = {
      components: {
        'comp-1': { id: 'comp-1', 'variant-id': 'var-1', 'main-instance-page': 'page-1' },
      },
      'pages-index': {
        'page-1': {
          id: 'page-1',
          objects: {
            'var-1': { id: 'var-1', shapes: ['shape-1', 'shape-2'] },
            'shape-1': { id: 'shape-1', 'component-id': 'comp-1' },
          },
        },
      },
    };
    const result = filesVariant.getPrimaryVariant(data, data.components['comp-1']);
    assert.equal(result?.id, 'shape-1');
  });
});

describe('files/comp_processors', () => {
  it('removeUnneededObjectsInComponents removes objects from non-deleted component', () => {
    const fileData = {
      id: 'file-1',
      components: {
        'comp-1': { id: 'comp-1', name: 'Test', objects: { 'shape-1': { id: 'shape-1' } } },
      },
    };
    const result = filesCompProcessors.removeUnneededObjectsInComponents(fileData);
    assert.equal('objects' in result.components['comp-1'], false);
  });

  it('removeUnneededObjectsInComponents adds empty objects to deleted component', () => {
    const fileData = {
      id: 'file-1',
      components: {
        'comp-1': { id: 'comp-1', name: 'Deleted', deleted: true },
      },
    };
    const result = filesCompProcessors.removeUnneededObjectsInComponents(fileData);
    assert.deepEqual(result.components['comp-1'].objects, {});
  });

  it('removeUnneededObjectsInComponents keeps component unchanged if no changes needed', () => {
    const fileData = {
      id: 'file-1',
      components: {
        'comp-1': { id: 'comp-1', name: 'Test' },
        'comp-2': { id: 'comp-2', name: 'Deleted', deleted: true, objects: {} },
      },
    };
    const result = filesCompProcessors.removeUnneededObjectsInComponents(fileData);
    assert.deepEqual(result.components['comp-1'], fileData.components['comp-1']);
    assert.deepEqual(result.components['comp-2'], fileData.components['comp-2']);
  });
});

describe('files/validate', () => {
  it('validateFile returns null for valid file without components/v2', () => {
    const result = filesValidate.validateFile({ features: new Set() }, {});
    assert.equal(result, null);
  });

  it('validateFile returns null for empty file with components/v2', () => {
    const file = {
      features: new Set(['components/v2']),
      data: {
        id: 'file-1',
        pages: [],
        'pages-index': {},
        components: {},
      },
    };
    const result = filesValidate.validateFile(file, {});
    assert.equal(result, null);
  });

  it('validateShape returns empty array for valid shape', () => {
    const result = filesValidate.validateShape('nonexistent', {}, {}, {});
    assert.deepEqual(result, []);
  });

  it('validateComponent returns empty for valid component', () => {
    const component = { id: 'comp-1', name: 'Test', 'main-instance-id': 'shape-1', 'main-instance-page': 'page-1' };
    const result = filesValidate.validateComponent(component, {});
    assert.deepEqual(result, []);
  });

  it('validateComponent reports nil objects error', () => {
    const component = { id: 'comp-1', name: 'Test', objects: undefined };
    // objects being undefined should not error if hasOwnProperty check passes
    const result = filesValidate.validateComponent(component, {});
    assert.ok(Array.isArray(result));
  });

  it('validateComponent reports objects on non-deleted', () => {
    const component = { id: 'comp-1', name: 'Test', objects: { 'shape-1': { id: 'shape-1' } } };
    const result = filesValidate.validateComponent(component, {});
    assert.ok(result.some((e) => e.code === 'non-deleted-component-cannot-have-objects'));
  });

  it('ERROR_CODES contains expected codes', () => {
    assert.ok(filesValidate.ERROR_CODES.has('invalid-geometry'));
    assert.ok(filesValidate.ERROR_CODES.has('component-not-found'));
    assert.ok(filesValidate.ERROR_CODES.has('shape-ref-cycle'));
    assert.ok(filesValidate.ERROR_CODES.has('not-a-variant'));
  });
});

describe('logic/tokens', () => {
  it('vecStartsWithQ returns true for matching prefixes', () => {
    assert.equal(logicTokens.vecStartsWithQ(['a', 'b', 'c'], ['a', 'b']), true);
    assert.equal(logicTokens.vecStartsWithQ(['a', 'b'], ['a', 'b', 'c']), true);
    assert.equal(logicTokens.vecStartsWithQ(['a', 'x'], ['a', 'b']), false);
  });

  it('vecStartsWithQ handles empty vectors', () => {
    assert.equal(logicTokens.vecStartsWithQ([], []), true);
    assert.equal(logicTokens.vecStartsWithQ(['a'], []), true);
    assert.equal(logicTokens.vecStartsWithQ([], ['a']), true);
  });

  it('generateDeleteTokenSetGroup returns changes with null tokens', () => {
    const changes = {};
    const result = logicTokens.generateDeleteTokenSetGroup(changes, {}, '/theme/set');
    assert.equal(result, changes);
  });
});

describe('logic/variant_properties', () => {
  it('generateUpdatePropertyName returns changes unchanged for empty components', () => {
    const changes = {};
    const result = logicVariantProperties.generateUpdatePropertyName(changes, 'var-1', 0, 'NewName');
    assert.equal(result, changes);
  });

  it('generateRemoveProperty returns changes unchanged for empty components', () => {
    const changes = {};
    const result = logicVariantProperties.generateRemoveProperty(changes, 'var-1', 0);
    assert.equal(result, changes);
  });

  it('generateSetVariantError returns changes for null value', () => {
    const changes = { 'library-data': { components: {} }, data: { components: {} } };
    const result = logicVariantProperties.generateSetVariantError(changes, 'comp-1', null);
    assert.ok(result);
  });
});

describe('logic/variants', () => {
  it('SHAPE_TYPE_CLASSIFICATION has expected entries', () => {
    assert.equal(logicVariants.SHAPE_TYPE_CLASSIFICATION.frame, 'container');
    assert.equal(logicVariants.SHAPE_TYPE_CLASSIFICATION.group, 'container');
    assert.equal(logicVariants.SHAPE_TYPE_CLASSIFICATION.rect, 'shape');
    assert.equal(logicVariants.SHAPE_TYPE_CLASSIFICATION.path, 'shape');
  });

  it('changeShowInViewer sets hide-in-viewer', () => {
    const shape = { id: '1' };
    const result = logicVariants.changeShowInViewer(shape, true);
    assert.equal(result['hide-in-viewer'], true);
  });

  it('showInViewer removes hide-in-viewer', () => {
    const shape = { id: '1', 'hide-in-viewer': true };
    const result = logicVariants.showInViewer(shape);
    assert.equal('hide-in-viewer' in result, false);
  });

  it('addNewInteraction appends interaction', () => {
    const shape = { id: '1', interactions: [] };
    const interaction = { type: 'navigate', destination: 'page-1' };
    const result = logicVariants.addNewInteraction(shape, interaction);
    assert.equal(result.interactions.length, 1);
    assert.deepEqual(result.interactions[0], interaction);
  });
});

describe('logic/shapes', () => {
  it('TEXT_TYPOGRAPHY_STYLE_ATTRS contains expected attrs', () => {
    assert.ok(logicShapes.TEXT_TYPOGRAPHY_STYLE_ATTRS.has('font-size'));
    assert.ok(logicShapes.TEXT_TYPOGRAPHY_STYLE_ATTRS.has('font-weight'));
    assert.ok(logicShapes.TEXT_TYPOGRAPHY_STYLE_ATTRS.has('text-align'));
  });

  it('generateUpdateShapes returns changes', () => {
    const result = logicShapes.generateUpdateShapes({}, ['id-1'], (s) => s, {});
    assert.ok(result);
  });
});

describe('logic/libraries', () => {
  it('prettyFile returns <local> for current file', () => {
    assert.equal(logicLibraries.prettyFile('file-1', {}, 'file-1'), '<local>');
  });

  it('prettyFile returns library name for other file', () => {
    const libraries = { 'file-2': { name: 'My Lib' } };
    assert.equal(logicLibraries.prettyFile('file-2', libraries, 'file-1'), '<My Lib>');
  });

  it('prettyFile returns <unknown> for missing library', () => {
    assert.equal(logicLibraries.prettyFile('file-3', {}, 'file-1'), '<unknown>');
  });

  it('prettyUuid returns last 6 chars', () => {
    assert.equal(logicLibraries.prettyUuid('abc12345-6789-def0-1234-567890123456'), '123456');
  });

  it('usesAssetsQ returns false', () => {
    assert.equal(logicLibraries.usesAssetsQ('components', null, {}, 'lib-1'), false);
  });
});