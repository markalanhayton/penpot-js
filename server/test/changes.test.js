import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { processChanges } from '../src/files/changes.js';
import { v4 as uuidv4 } from 'uuid';

function makeFileData(pageId) {
  return {
    pages: [pageId],
    pagesIndex: {
      [pageId]: { id: pageId, name: 'Page 1', objects: {} },
    },
    components: {},
    media: {},
    colors: [],
    typographies: {},
  };
}

describe('processChanges', () => {
  it('returns data unchanged for empty changes', () => {
    const data = { pages: [], pagesIndex: {} };
    const result = processChanges(data, []);
    assert.deepEqual(result, data);
  });

  it('returns data for null changes', () => {
    const data = { pages: [], pagesIndex: {} };
    const result = processChanges(data, null);
    assert.equal(result, data);
  });

  it('returns data for null data', () => {
    assert.equal(processChanges(null, [{ type: 'add-page' }]), null);
  });

  it('warns on unknown change type but continues', () => {
    const data = makeFileData('p1');
    const result = processChanges(data, [{ type: 'unknown-change-type' }]);
    assert.equal(result, data);
  });
});

describe('shape operations', () => {
  const pageId = uuidv4();
  const shapeId = uuidv4();
  const frameId = uuidv4();

  it('add-obj adds a shape to page objects', () => {
    const data = makeFileData(pageId);
    data.pagesIndex[pageId].objects[frameId] = { id: frameId, type: 'frame', shapes: [] };

    processChanges(data, [{
      type: 'add-obj',
      pageId,
      frameId,
      obj: { id: shapeId, type: 'rect', parentId: frameId },
    }]);

    assert.ok(data.pagesIndex[pageId].objects[shapeId]);
    assert.ok(data.pagesIndex[pageId].objects[frameId].shapes.includes(shapeId));
  });

  it('mod-obj modifies a shape', () => {
    const data = makeFileData(pageId);
    data.pagesIndex[pageId].objects[shapeId] = { id: shapeId, type: 'rect', x: 0 };

    processChanges(data, [{
      type: 'mod-obj',
      pageId,
      id: shapeId,
      operations: [{ type: 'set', attr: 'x', val: 100 }],
    }]);

    assert.equal(data.pagesIndex[pageId].objects[shapeId].x, 100);
  });

  it('mod-obj with assign operation', () => {
    const data = makeFileData(pageId);
    data.pagesIndex[pageId].objects[shapeId] = { id: shapeId, type: 'rect' };

    processChanges(data, [{
      type: 'mod-obj',
      pageId,
      id: shapeId,
      operations: [{ type: 'assign', value: { x: 50, y: 50 } }],
    }]);

    assert.equal(data.pagesIndex[pageId].objects[shapeId].x, 50);
    assert.equal(data.pagesIndex[pageId].objects[shapeId].y, 50);
  });

  it('del-obj removes a shape', () => {
    const data = makeFileData(pageId);
    data.pagesIndex[pageId].objects[shapeId] = { id: shapeId, type: 'rect', parentId: frameId };
    data.pagesIndex[pageId].objects[frameId] = { id: frameId, shapes: [shapeId] };

    processChanges(data, [{ type: 'del-obj', pageId, id: shapeId }]);

    assert.equal(data.pagesIndex[pageId].objects[shapeId], undefined);
    assert.ok(!data.pagesIndex[pageId].objects[frameId].shapes.includes(shapeId));
  });

  it('mov-objects moves shapes between parents', () => {
    const newParentId = uuidv4();
    const data = makeFileData(pageId);
    data.pagesIndex[pageId].objects[shapeId] = { id: shapeId, type: 'rect', parentId: frameId };
    data.pagesIndex[pageId].objects[frameId] = { id: frameId, shapes: [shapeId] };
    data.pagesIndex[pageId].objects[newParentId] = { id: newParentId, shapes: [] };

    processChanges(data, [{
      type: 'mov-objects',
      pageId,
      parentId: newParentId,
      shapes: [shapeId],
    }]);

    assert.equal(data.pagesIndex[pageId].objects[shapeId].parentId, newParentId);
    assert.ok(data.pagesIndex[pageId].objects[newParentId].shapes.includes(shapeId));
    assert.ok(!data.pagesIndex[pageId].objects[frameId].shapes.includes(shapeId));
  });
});

describe('page operations', () => {
  it('add-page adds a new page', () => {
    const newPageId = uuidv4();
    const data = { pages: [], pagesIndex: {} };

    processChanges(data, [{ type: 'add-page', id: newPageId, name: 'New Page' }]);

    assert.ok(data.pagesIndex[newPageId]);
    assert.ok(data.pages.includes(newPageId));
    assert.equal(data.pagesIndex[newPageId].name, 'New Page');
  });

  it('mod-page modifies page name', () => {
    const pageId = uuidv4();
    const data = { pages: [pageId], pagesIndex: { [pageId]: { id: pageId, name: 'Old' } } };

    processChanges(data, [{ type: 'mod-page', id: pageId, name: 'New' }]);

    assert.equal(data.pagesIndex[pageId].name, 'New');
  });

  it('del-page deletes a page', () => {
    const pageId = uuidv4();
    const data = { pages: [pageId], pagesIndex: { [pageId]: { id: pageId } } };

    processChanges(data, [{ type: 'del-page', id: pageId }]);

    assert.equal(data.pagesIndex[pageId], undefined);
    assert.ok(!data.pages.includes(pageId));
  });

  it('mov-page moves page position', () => {
    const p1 = uuidv4(), p2 = uuidv4(), p3 = uuidv4();
    const data = { pages: [p1, p2, p3], pagesIndex: {} };

    processChanges(data, [{ type: 'mov-page', id: p3, index: 0 }]);

    assert.equal(data.pages[0], p3);
  });
});

describe('library operations', () => {
  it('add-color / mod-color / del-color', () => {
    const data = { pages: [], pagesIndex: {}, colors: [] };

    processChanges(data, [{ type: 'add-color', color: { id: 'c1', name: 'Red' } }]);
    assert.equal(data.colors.length, 1);

    processChanges(data, [{ type: 'mod-color', color: { id: 'c1', name: 'Blue' } }]);
    assert.equal(data.colors[0].name, 'Blue');

    processChanges(data, [{ type: 'del-color', id: 'c1' }]);
    assert.equal(data.colors.length, 0);
  });

  it('add-media / del-media', () => {
    const data = { pages: [], pagesIndex: {}, media: {} };

    processChanges(data, [{ type: 'add-media', object: { id: 'm1', name: 'img.png' } }]);
    assert.ok(data.media['m1']);

    processChanges(data, [{ type: 'del-media', id: 'm1' }]);
    assert.equal(data.media['m1'], undefined);
  });

  it('add-component / del-component', () => {
    const data = { pages: [], pagesIndex: {}, components: {} };

    processChanges(data, [{ type: 'add-component', id: 'comp1', name: 'Button' }]);
    assert.ok(data.components['comp1']);

    processChanges(data, [{ type: 'del-component', id: 'comp1' }]);
    assert.equal(data.components['comp1'], undefined);
  });

  it('mod-component', () => {
    const data = { pages: [], pagesIndex: {}, components: { comp1: { id: 'comp1', name: 'Old', path: '' } } };

    processChanges(data, [{ type: 'mod-component', id: 'comp1', name: 'New' }]);
    assert.equal(data.components['comp1'].name, 'New');
  });

  it('add-typography / del-typography', () => {
    const data = { pages: [], pagesIndex: {}, typographies: {} };

    processChanges(data, [{ type: 'add-typography', typography: { id: 't1', name: 'Heading' } }]);
    assert.ok(data.typographies['t1']);

    processChanges(data, [{ type: 'del-typography', id: 't1' }]);
    assert.equal(data.typographies['t1'], undefined);
  });
});

describe('metadata operations', () => {
  it('set-plugin-data stores and deletes', () => {
    const data = { pages: [], pagesIndex: {}, pluginData: {} };

    processChanges(data, [{
      type: 'set-plugin-data',
      objectType: 'file',
      namespace: 'my-plugin',
      key: 'setting',
      value: 'enabled',
    }]);
    assert.ok(data.pluginData['file:file:my-plugin:setting']);

    processChanges(data, [{
      type: 'set-plugin-data',
      objectType: 'file',
      namespace: 'my-plugin',
      key: 'setting',
    }]);
    assert.equal(data.pluginData['file:file:my-plugin:setting'], undefined);
  });

  it('set-guide adds and removes', () => {
    const pageId = uuidv4();
    const data = { pages: [], pagesIndex: { [pageId]: { id: pageId } } };

    processChanges(data, [{ type: 'set-guide', pageId, id: 'g1', gridType: 'column', params: { x: 100 } }]);
    assert.ok(data.pagesIndex[pageId].guides['g1']);

    processChanges(data, [{ type: 'set-guide', pageId, id: 'g1' }]);
    assert.equal(data.pagesIndex[pageId].guides['g1'], undefined);
  });

  it('set-flow adds and removes', () => {
    const pageId = uuidv4();
    const data = { pages: [], pagesIndex: { [pageId]: { id: pageId } } };

    processChanges(data, [{ type: 'set-flow', pageId, id: 'f1', params: { name: 'Flow 1' } }]);
    assert.equal(data.pagesIndex[pageId].flows.length, 1);

    processChanges(data, [{ type: 'set-flow', pageId, id: 'f1' }]);
    assert.equal(data.pagesIndex[pageId].flows.length, 0);
  });

  it('set-default-grid adds and removes', () => {
    const pageId = uuidv4();
    const data = { pages: [], pagesIndex: { [pageId]: { id: pageId, options: {} } } };

    processChanges(data, [{ type: 'set-default-grid', pageId, gridType: 'square', params: { size: 8 } }]);
    assert.ok(data.pagesIndex[pageId].options['square']);

    processChanges(data, [{ type: 'set-default-grid', pageId, gridType: 'square' }]);
    assert.equal(data.pagesIndex[pageId].options['square'], undefined);
  });

  it('set-comment-thread-position is a no-op', () => {
    const data = { pages: [], pagesIndex: {} };
    processChanges(data, [{ type: 'set-comment-thread-position' }]);
  });

  it('set-token / set-token-set / set-tokens-lib', () => {
    const data = { pages: [], pagesIndex: {} };

    processChanges(data, [{ type: 'set-token', setId: 's1', tokenId: 't1', attrs: { value: '#fff' } }]);
    assert.equal(data.tokens['s1']['t1'].value, '#fff');

    processChanges(data, [{ type: 'set-token-set', id: 'set1', attrs: { name: 'Light' } }]);
    assert.equal(data.tokenSets['set1'].name, 'Light');

    processChanges(data, [{ type: 'set-tokens-lib', tokensLib: { version: 1 } }]);
    assert.equal(data.tokensLib.version, 1);
  });
});