import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { next, zero } from '../../src/uuid.js';
import {
  BASE_FONT_SIZE, EMPTY_FILE_DATA, makeFileData, makeFile, fileData, updateFileData,
  updatePages, updateComponents, findComponentFile, getComponentFromLibraries, getComponentRoot,
  getBaseFontSize, setBaseFontSize, getComponentContainer, getComponentShape, getRefShape,
  getShapeInCopy, findRefShape, findNearMatch, advanceShapeRef, findRefComponent,
  findRemoteShape, directCopyQ, findSwapSlot, matchSwapSlotQ, findRefIdForSwapped,
  getComponentShapes, isMainOfKnownComponentQ, loadComponentObjects, deleteComponentData,
  restoreComponent, purgeComponent, usesAssetQ, findAssetTypeUsages, usedInQ,
  usedAssetsChangedSince, getOrAddLibraryPage, getComponentContainerFromHead,
  updateObjectsTree, updateAllShapes, getRefChainUntilTargetRef,
  getTouchedFromRefChainUntilTargetRef, detachExternalReferences,
  containersSeqFromFile, objectContainersSeqFromFile, updateContainer, updateContainers, getComponentLibrary, resolveComponent,
  getComponentPage, dumpShape, dumpComponent,
} from '../../src/types/file.js';
import { makeContainer } from '../../src/types/container.js';

function makePage(id, name, objects = {}) {
  return { id, name, objects: { [zero]: { id: zero, type: 'frame', name: 'Root', shapes: [], 'parent-id': null }, ...objects } };
}

function makeSimpleFileData(components = {}) {
  const pageId = next();
  const page = makePage(pageId, 'Page 1');
  return {
    id: 'file1',
    pages: [pageId],
    'pages-index': { [pageId]: page },
    components,
    options: { 'components-v2': true, 'base-font-size': '16px' },
  };
}

function makeShape(id, name, opts = {}) {
  return { id, name, type: 'frame', shapes: [], 'parent-id': zero, 'frame-id': zero, ...opts };
}

function makeFileWithComponent() {
  const fileId = 'file1';
  const compId = 'comp1';
  const mainId = 'main1';
  const copyId = 'copy1';
  const rootId = zero;

  const mainShape = makeShape(mainId, 'MainFrame', {
    'component-root': true,
    'component-id': compId,
    'component-file': fileId,
    'main-instance': true,
  });

  const copyShape = makeShape(copyId, 'CopyFrame', {
    'shape-ref': mainId,
    'component-id': compId,
    'component-file': fileId,
  });

  const rootShape = { id: rootId, type: 'frame', name: 'Root', shapes: [mainId, copyId], 'parent-id': null, 'frame-id': zero };

  const pageId = 'page1';
  const page = {
    id: pageId, name: 'Page 1',
    objects: { [rootId]: rootShape, [mainId]: mainShape, [copyId]: copyShape },
  };

  const component = {
    id: compId, name: 'MyComponent', path: '',
    'main-instance-id': mainId,
    'main-instance-page': pageId,
  };

  const fileData = {
    id: fileId,
    pages: [pageId],
    'pages-index': { [pageId]: page },
    components: { [compId]: component },
    options: { 'components-v2': true, 'base-font-size': '16px' },
  };

  return { fileId, compId, mainId, copyId, pageId, fileData, component, mainShape, copyShape };
}

describe('file', () => {
  it('BASE_FONT_SIZE', () => {
    assert.equal(BASE_FONT_SIZE, '16px');
  });

  it('EMPTY_FILE_DATA', () => {
    assert.deepEqual(EMPTY_FILE_DATA.pages, []);
    assert.deepEqual(EMPTY_FILE_DATA['pages-index'], {});
  });

  it('makeFileData creates file with one page', () => {
    const fd = makeFileData('file1');
    assert.ok(fd.id);
    assert.ok(fd.options['components-v2']);
    assert.equal(fd.options['base-font-size'], '16px');
    const pageIds = fd.pages;
    assert.equal(pageIds.length, 1);
  });

  it('makeFile with defaults', () => {
    const f = makeFile({ name: 'Test' });
    assert.ok(f.id);
    assert.equal(f.name, 'Test');
    assert.equal(f.revn, 0);
    assert.ok(f['created-at']);
    assert.ok(f['modified-at']);
    assert.equal(f['is-shared'], false);
  });

  it('fileData', () => {
    const f = { data: { pages: [] } };
    assert.deepEqual(fileData(f), { pages: [] });
  });

  it('updateFileData', () => {
    const f = { data: { pages: [] } };
    const updated = updateFileData(f, (d) => ({ ...d, extra: true }));
    assert.ok(updated.data.extra);
  });

  it('getBaseFontSize default', () => {
    assert.equal(getBaseFontSize({}), '16px');
    assert.equal(getBaseFontSize({ options: { 'base-font-size': '12px' } }), '12px');
  });

  it('setBaseFontSize', () => {
    const fd = { options: {} };
    const updated = setBaseFontSize(fd, '10px');
    assert.equal(updated.options['base-font-size'], '10px');
  });

  it('getComponentContainer for active component', () => {
    const { fileData, compId, pageId } = makeFileWithComponent();
    const component = fileData.components[compId];
    const container = getComponentContainer(fileData, component);
    assert.equal(container.type, 'page');
    assert.equal(container.id, pageId);
  });

  it('getComponentContainer for deleted component', () => {
    const { fileData, compId } = makeFileWithComponent();
    const deletedComp = { ...fileData.components[compId], deleted: true, objects: {} };
    const container = getComponentContainer(fileData, deletedComp);
    assert.equal(container.type, 'component');
    assert.equal(container.id, compId);
  });

  it('getComponentContainerFromHead with libraries', () => {
    const { fileId, compId, copyId, fileData } = makeFileWithComponent();
    const libraries = { [fileId]: { id: fileId, data: fileData } };
    const copyShape = fileData['pages-index']['page1'].objects[copyId];
    const container = getComponentContainerFromHead(copyShape, libraries, { includeDeleted: true });
    assert.equal(container.type, 'page');
  });

  it('getComponentContainerFromHead returns undefined without libraries', () => {
    const shape = { id: 's1', 'component-file': 'missing-lib', 'component-id': 'comp1' };
    const result = getComponentContainerFromHead(shape, {}, { includeDeleted: true });
    assert.equal(result, undefined);
  });

  it('getComponentShape for active component', () => {
    const { fileData, compId, mainId } = makeFileWithComponent();
    const component = fileData.components[compId];
    const childId = mainId;

    const shape = getComponentShape(fileData, component, childId);
    assert.equal(shape.id, childId);
    assert.equal(shape.name, 'MainFrame');
  });

  it('getComponentShape for deleted component', () => {
    const { fileData, compId } = makeFileWithComponent();
    const deletedComp = { ...fileData.components[compId], deleted: true, objects: { [compId]: { id: compId, name: 'Deleted' } } };
    const shape = getComponentShape(fileData, deletedComp, compId);
    assert.equal(shape.name, 'Deleted');
  });

  it('getRefShape returns referenced shape', () => {
    const { fileData, compId, mainId, copyId } = makeFileWithComponent();
    const component = fileData.components[compId];
    const copyShape = fileData['pages-index']['page1'].objects[copyId];
    const ref = getRefShape(fileData, component, copyShape);
    assert.equal(ref.id, mainId);
  });

  it('getRefShape returns undefined for no shape-ref', () => {
    const { fileData, compId, mainId } = makeFileWithComponent();
    const component = fileData.components[compId];
    const mainShape = fileData['pages-index']['page1'].objects[mainId];
    const ref = getRefShape(fileData, component, mainShape);
    assert.equal(ref, undefined);
  });

  it('getShapeInCopy finds matching shape-ref', () => {
    const mainShapeId = 'main1';
    const rootCopyId = 'rootCopy';
    const copyChildId = 'copyChild1';

    const objects = {
      [zero]: { id: zero, type: 'frame', name: 'Root', shapes: [rootCopyId], 'parent-id': null },
      [rootCopyId]: makeShape(rootCopyId, 'RootCopy', { shapes: [copyChildId] }),
      [copyChildId]: makeShape(copyChildId, 'CopyChild', { 'shape-ref': mainShapeId }),
    };

    const fd = { objects };
    const mainShape = { id: mainShapeId, name: 'MainChild' };
    const rootCopy = objects[rootCopyId];
    const result = getShapeInCopy(fd, mainShape, rootCopy);
    assert.ok(result);
    assert.equal(result.id, copyChildId);
  });

  it('getShapeInCopy returns null when no match', () => {
    const rootCopyId = 'rootCopy';
    const objects = {
      [zero]: { id: zero, type: 'frame', name: 'Root', shapes: [rootCopyId], 'parent-id': null },
      [rootCopyId]: makeShape(rootCopyId, 'RootCopy', { shapes: [] }),
    };

    const fd = { objects };
    const mainShape = { id: 'nonexistent', name: 'NoSuch' };
    const rootCopy = objects[rootCopyId];
    const result = getShapeInCopy(fd, mainShape, rootCopy);
    assert.equal(result, null);
  });

  it('findRefShape finds referenced shape', () => {
    const { fileId, fileData, compId, copyId, mainId } = makeFileWithComponent();
    const file = { id: fileId, data: fileData };
    const copyShape = fileData['pages-index']['page1'].objects[copyId];
    const page = fileData['pages-index']['page1'];

    const ref = findRefShape(file, makeContainer(page, 'page'), {}, copyShape);
    assert.equal(ref.id, mainId);
  });

  it('findRefShape returns undefined for shape without component', () => {
    const { fileData } = makeFileWithComponent();
    const page = fileData['pages-index']['page1'];
    const rootShape = page.objects[zero];
    const ref = findRefShape(null, makeContainer(page, 'page'), {}, rootShape);
    assert.equal(ref, undefined);
  });

  it('findRefComponent finds component for a copy shape', () => {
    const { fileId, fileData, compId, copyId } = makeFileWithComponent();
    const file = { id: fileId, data: fileData };
    const copyShape = fileData['pages-index']['page1'].objects[copyId];
    const page = fileData['pages-index']['page1'];

    const component = findRefComponent(file, page, {}, copyShape);
    assert.equal(component.id, compId);
  });

  it('getComponentShapes for active component', () => {
    const { fileData, compId, mainId } = makeFileWithComponent();
    const component = fileData.components[compId];
    const shapes = getComponentShapes(fileData, component);
    assert.ok(shapes.length > 0);
    assert.ok(shapes.some((s) => s.id === mainId));
  });

  it('getComponentShapes for deleted component with objects', () => {
    const { fileData, compId } = makeFileWithComponent();
    const deletedComp = { ...fileData.components[compId], deleted: true, objects: { [compId]: { id: compId, name: 'X' } } };
    const shapes = getComponentShapes(fileData, deletedComp);
    assert.equal(shapes.length, 1);
    assert.equal(shapes[0].id, compId);
  });

  it('isMainOfKnownComponentQ returns true for main instance in library', () => {
    const { fileId, compId, mainId, fileData } = makeFileWithComponent();
    const mainShape = fileData['pages-index']['page1'].objects[mainId];
    const libraries = { [fileId]: { id: fileId, data: fileData } };
    assert.equal(isMainOfKnownComponentQ(mainShape, libraries), true);
  });

  it('isMainOfKnownComponentQ returns false for non-main shape', () => {
    const { copyId, fileData } = makeFileWithComponent();
    const copyShape = fileData['pages-index']['page1'].objects[copyId];
    assert.equal(isMainOfKnownComponentQ(copyShape, {}), false);
  });

  it('loadComponentObjects for component without objects', () => {
    const { fileData, compId, mainId, pageId } = makeFileWithComponent();
    const component = fileData.components[compId];
    const loaded = loadComponentObjects(fileData, component);
    assert.ok(loaded.objects);
    assert.ok(mainId in loaded.objects);
  });

  it('loadComponentObjects skips if objects already exist', () => {
    const { fileData, compId } = makeFileWithComponent();
    const component = { ...fileData.components[compId], objects: { x: { id: 'x' } } };
    const loaded = loadComponentObjects(fileData, component);
    assert.equal(loaded, component);
  });

  it('deleteComponentData marks deleted', () => {
    const { fileData, compId } = makeFileWithComponent();
    const result = deleteComponentData(fileData, compId, false);
    assert.ok(result.components[compId].deleted);
  });

  it('deleteComponentData purges when skipUndelete', () => {
    const { fileData, compId } = makeFileWithComponent();
    const result = deleteComponentData(fileData, compId, true);
    assert.equal(result.components[compId], undefined);
  });

  it('restoreComponent restores deleted component', () => {
    const { fileData, compId, pageId } = makeFileWithComponent();
    let data = deleteComponentData(fileData, compId, false);
    data = restoreComponent(data, compId, pageId);
    assert.equal(data.components[compId].deleted, undefined);
  });

  it('purgeComponent removes component entirely', () => {
    const { fileData, compId } = makeFileWithComponent();
    const result = purgeComponent(fileData, compId);
    assert.equal(result.components[compId], undefined);
  });

  it('usesAssetQ for component', () => {
    const { fileId, compId, copyId, fileData } = makeFileWithComponent();
    const copyShape = fileData['pages-index']['page1'].objects[copyId];
    assert.equal(usesAssetQ('component', copyShape, fileId, { id: compId }), true);
  });

  it('usesAssetQ for color', () => {
    const shape = makeShape('s1', 'S', {
      fills: [{ 'fill-color-ref-id': 'color1', 'fill-color-ref-file': 'lib1' }],
    });
    assert.equal(usesAssetQ('color', shape, 'lib1', { id: 'color1' }), true);
    assert.equal(usesAssetQ('color', shape, 'lib2', { id: 'color1' }), false);
  });

  it('usesAssetQ for typography', () => {
    const shape = makeShape('s1', 'S', {
      type: 'text',
      content: {
        type: 'paragraph',
        children: [{ type: 'textNode', 'typography-ref-id': 'typo1', 'typography-ref-file': 'lib1' }],
      },
    });
    assert.equal(usesAssetQ('typography', shape, 'lib1', { id: 'typo1' }), true);
  });

  it('usesAssetQ returns false for unknown type', () => {
    const shape = makeShape('s1', 'S');
    assert.equal(usesAssetQ('unknown', shape, 'lib1', { id: 'x' }), false);
  });

  it('getOrAddLibraryPage creates new page when none exists', () => {
    const fd = makeSimpleFileData();
    const [newFd, pageId, pos] = getOrAddLibraryPage(fd, 50);
    assert.ok(pageId);
    assert.equal(pos.x, 0);
    assert.equal(pos.y, 0);
    const newPage = newFd['pages-index'][pageId];
    assert.equal(newPage.name, 'Main components');
  });

  it('getOrAddLibraryPage finds existing page', () => {
    const fd = makeSimpleFileData();
    const mcPageId = 'mc-page';
    const mcPage = makePage(mcPageId, 'Main components');
    fd.pages.push(mcPageId);
    fd['pages-index'][mcPageId] = mcPage;
    const [newFd, pageId] = getOrAddLibraryPage(fd, 50);
    assert.equal(pageId, mcPageId);
  });

  it('updateObjectsTree keeps shapes', () => {
    const { fileData } = makeFileWithComponent();
    const container = makeContainer(fileData['pages-index']['page1'], 'page');
    const result = updateObjectsTree(container, (shape) => ({ result: 'keep' }));
    assert.deepEqual(result.objects, container.objects);
  });

  it('updateObjectsTree updates shapes', () => {
    const { fileData, mainId } = makeFileWithComponent();
    const container = makeContainer(fileData['pages-index']['page1'], 'page');
    const result = updateObjectsTree(container, (shape) => {
      if (shape.id === mainId) {
        return { result: 'update', 'updated-shape': { ...shape, name: 'Updated' } };
      }
      return { result: 'keep' };
    });
    assert.equal(result.objects[mainId].name, 'Updated');
  });

  it('updateObjectsTree removes shapes', () => {
    const shapeId = next();
    const container = makeContainer(
      makePage('p1', 'Page', {
        [zero]: { id: zero, type: 'frame', name: 'Root', shapes: [shapeId], 'parent-id': null, 'frame-id': zero },
        [shapeId]: makeShape(shapeId, 'ToBeRemoved'),
      }),
      'page'
    );
    const result = updateObjectsTree(container, (shape) => {
      if (shape.id === shapeId) return { result: 'remove' };
      return { result: 'keep' };
    });
    assert.equal(result.objects[shapeId], undefined);
    assert.ok(!result.objects[zero].shapes.includes(shapeId));
  });

  it('updateAllShapes uses updateObjectsTree', () => {
    const fd = makeSimpleFileData();
    const pageId = fd.pages[0];
    const shapeId = next();
    fd['pages-index'][pageId].objects[shapeId] = makeShape(shapeId, 'Test');
    fd['pages-index'][pageId].objects[zero].shapes.push(shapeId);

    const result = updateAllShapes(fd, (shape) => {
      if (shape.name === 'Test') {
        return { result: 'update', 'updated-shape': { ...shape, name: 'Updated' } };
      }
      return { result: 'keep' };
    });

    assert.equal(result['pages-index'][pageId].objects[shapeId].name, 'Updated');
  });

  it('detachExternalReferences keeps same-file refs', () => {
    const { fileData, fileId } = makeFileWithComponent();
    const file = { id: fileId, data: fileData };
    const result = detachExternalReferences(file, fileId);
    const page = result.data['pages-index']['page1'];
    assert.equal(page.objects['copy1']['component-file'], fileId);
  });

  it('detachExternalReferences removes refs from other files', () => {
    const { fileData } = makeFileWithComponent();
    const pageId = 'page1';
    const shapeId = 'ext1';
    fileData['pages-index'][pageId].objects[shapeId] = makeShape(shapeId, 'ExtRef', {
      'component-file': 'external-lib',
      'component-id': 'ext-comp',
      'shape-ref': 'ext-shape',
      'component-root': true,
    });

    const file = { id: 'file1', data: fileData };
    const result = detachExternalReferences(file, 'file1');
    const detached = result.data['pages-index'][pageId].objects[shapeId];
    assert.equal(detached['component-file'], undefined);
    assert.equal(detached['component-id'], undefined);
  });

  it('detachExternalReferences removes refs from other files', () => {
    const { fileData } = makeFileWithComponent();
    const pageId = 'page1';
    const shapeId = 'ext1';
    fileData['pages-index'][pageId].objects[shapeId] = makeShape(shapeId, 'ExtRef', {
      'component-file': 'external-lib',
      'component-id': 'ext-comp',
      'shape-ref': 'ext-shape',
      'component-root': true,
    });

    const file = { id: 'file1', data: fileData };
    const result = detachExternalReferences(file, 'file1');
    const detached = result.data['pages-index'][pageId].objects[shapeId];
    assert.equal(detached['component-file'], undefined);
    assert.equal(detached['component-id'], undefined);
  });

  it('getComponentRoot for active component', () => {
    const { fileData, compId, mainId } = makeFileWithComponent();
    const component = fileData.components[compId];
    const root = getComponentRoot(fileData, component);
    assert.equal(root.id, mainId);
  });

  it('getComponentRoot for deleted component', () => {
    const { fileData, compId, mainId } = makeFileWithComponent();
    const deletedComp = { ...fileData.components[compId], deleted: true, objects: { [mainId]: { id: mainId, name: 'Root' } }, 'main-instance-id': mainId };
    const root = getComponentRoot(fileData, deletedComp);
    assert.equal(root.id, mainId);
    assert.equal(root.name, 'Root');
  });

  it('findComponentFile returns local file', () => {
    const { fileId, fileData } = makeFileWithComponent();
    const file = { id: fileId, data: fileData };
    assert.equal(findComponentFile(file, {}, fileId), file);
  });

  it('findComponentFile returns from libraries', () => {
    const lib = { id: 'lib1', data: {} };
    const result = findComponentFile(null, { lib1: lib }, 'lib1');
    assert.equal(result, lib);
  });

  it('getComponentFromLibraries finds component', () => {
    const { fileId, compId, fileData } = makeFileWithComponent();
    const libraries = { [fileId]: { id: fileId, data: fileData } };
    const comp = getComponentFromLibraries(libraries, fileId, compId);
    assert.equal(comp.id, compId);
  });

  it('getComponentFromLibraries returns undefined for missing library', () => {
    assert.equal(getComponentFromLibraries({}, 'missing', 'comp1'), undefined);
  });

  it('resolveComponent resolves from local file', () => {
    const { fileId, compId, fileData, copyId } = makeFileWithComponent();
    const copyShape = fileData['pages-index']['page1'].objects[copyId];
    const file = { id: fileId, data: fileData };
    const comp = resolveComponent(copyShape, file, {});
    assert.equal(comp.id, compId);
  });

  it('getComponentLibrary', () => {
    const { fileId, copyId, fileData } = makeFileWithComponent();
    const copyShape = fileData['pages-index']['page1'].objects[copyId];
    const libraries = { [fileId]: { id: fileId, data: fileData } };
    assert.equal(getComponentLibrary(libraries, copyShape).id, fileId);
  });

  it('getComponentPage', () => {
    const { fileData, compId, pageId } = makeFileWithComponent();
    const component = fileData.components[compId];
    assert.equal(getComponentPage(fileData, component).id, pageId);
  });

  it('containersSeqFromFile', () => {
    const fd = makeSimpleFileData();
    const containers = containersSeqFromFile(fd);
    assert.ok(containers.length >= 1);
    assert.equal(containers[0].type, 'page');
  });

  it('objectContainersSeqFromFile', () => {
    const fd = makeSimpleFileData();
    const containers = objectContainersSeqFromFile(fd);
    assert.ok(containers.length >= 1);
  });

  it('updateContainer updates a page', () => {
    const fd = makeSimpleFileData();
    const pageId = fd.pages[0];
    const page = fd['pages-index'][pageId];
    const container = makeContainer(page, 'page');
    const result = updateContainer(fd, container, (p) => ({ ...p, name: 'Updated' }));
    assert.equal(result['pages-index'][pageId].name, 'Updated');
  });

  it('updatePages', () => {
    const fd = makeSimpleFileData();
    const result = updatePages(fd, (container) => ({ ...container, name: 'Renamed' }));
    const pageId = result.pages[0];
    assert.equal(result['pages-index'][pageId].name, 'Renamed');
  });

  it('updateComponents with components', () => {
    const { fileData, compId } = makeFileWithComponent();
    const result = updateComponents(fileData, (container) => ({ ...container, name: 'UpdatedComp' }));
    assert.equal(result.components[compId].name, 'UpdatedComp');
  });

  it('updateComponents with no components', () => {
    const fd = makeSimpleFileData();
    const result = updateComponents(fd, (c) => c);
    assert.deepEqual(result, fd);
  });

  it('updateContainers', () => {
    const fd = makeSimpleFileData();
    const result = updateContainers(fd, (container) => ({ ...container, name: 'Updated' }));
    const pageId = result.pages[0];
    assert.equal(result['pages-index'][pageId].name, 'Updated');
  });

  it('findSwapSlot returns swap slot from shape', () => {
    const shape = { id: 's1', touched: new Set(['swap-slot-slot1']) };
    assert.equal(findSwapSlot(shape, {}, null), 'slot1');
  });

  it('findSwapSlot returns undefined when shape has no swap slot and no ref', () => {
    const shape = { id: 's1' };
    const container = makeContainer(makePage('p1', 'Page'), 'page');
    assert.equal(findSwapSlot(shape, container, null, {}), undefined);
  });

  it('getRefChainUntilTargetRef', () => {
    const { fileData, fileId, compId, copyId } = makeFileWithComponent();
    const copyShape = fileData['pages-index']['page1'].objects[copyId];
    const container = makeContainer(fileData['pages-index']['page1'], 'page');
    const chain = getRefChainUntilTargetRef(container, {}, copyShape, copyId);
    assert.ok(Array.isArray(chain));
    assert.equal(chain[0].id, copyId);
  });

  it('getTouchedFromRefChainUntilTargetRef', () => {
    const { fileData, copyId } = makeFileWithComponent();
    const copyShape = fileData['pages-index']['page1'].objects[copyId];
    const container = makeContainer(fileData['pages-index']['page1'], 'page');
    const touched = getTouchedFromRefChainUntilTargetRef(container, {}, copyShape, null);
    assert.ok(touched instanceof Set || typeof touched === 'object');
  });

  it('usedInQ returns false when no assets used', () => {
    const fd = makeSimpleFileData();
    assert.equal(usedInQ(fd, 'lib1', { id: 'comp1' }, 'component'), false);
  });

  it('directCopyQ', () => {
    const { fileId, compId, copyId, fileData } = makeFileWithComponent();
    const copyShape = fileData['pages-index']['page1'].objects[copyId];
    const libraries = { [fileId]: { id: fileId, data: fileData } };
    const component = fileData.components[compId];
    const page = fileData['pages-index']['page1'];
    const result = directCopyQ(copyShape, component, page, { id: fileId, data: fileData }, libraries);
    assert.equal(typeof result, 'boolean');
  });

  it('advanceShapeRef returns undefined when no ref shapes available', () => {
    const { fileData } = makeFileWithComponent();
    const shape = makeShape('s1', 'NoRef');
    const container = makeContainer(fileData['pages-index']['page1'], 'page');
    const result = advanceShapeRef(null, container, {}, shape, 1);
    assert.equal(result, undefined);
  });

  it('dumpShape produces output for a shape', () => {
    const shape = makeShape('s1', 'TestShape');
    const objects = { [zero]: { id: zero, type: 'frame', name: 'Root', shapes: ['s1'], 'parent-id': null }, s1: shape };
    const output = dumpShape('s1', 0, objects, null, {}, {});
    assert.ok(output.includes('TestShape'));
  });

  it('dumpComponent produces output for a component', () => {
    const { fileData, compId } = makeFileWithComponent();
    const component = fileData.components[compId];
    const output = dumpComponent(component, { id: 'file1', data: fileData }, {}, {});
    assert.ok(output.includes('MyComponent'));
  });
});