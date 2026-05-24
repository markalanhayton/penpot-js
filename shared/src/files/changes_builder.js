import { getIn, concatVec, withoutNils, getf } from '../data.js';
import { next as uuidNext, zero as uuidZero } from '../uuid.js';
import { makeFileData } from '../types/file.js';
import { inComponentCopyQ } from '../types/component.js';
import { close as mthClose } from '../math.js';

const UNDEFINED = Symbol('undefined');

export function emptyChanges(origin, pageId) {
  const changes = {
    'redo-changes': [],
    'undo-changes': [],
    origin: origin ?? null,
  };
  if (pageId != null) {
    return withMeta(changes, { 'page-id': pageId });
  }
  return changes;
}

export function setSaveUndoQ(changes, saveUndo) {
  return { ...changes, 'save-undo?': saveUndo };
}

export function setStackUndoQ(changes, stackUndo) {
  return { ...changes, 'stack-undo?': stackUndo };
}

export function setUndoGroup(changes, undoGroup) {
  if (undoGroup == null) return changes;
  return { ...changes, 'undo-group': undoGroup };
}

export function setTranslationQ(changes, translation) {
  if (!translation) return changes;
  return { ...changes, 'translation?': true };
}

export function withPage(changes, page) {
  return withMeta(changes, { page, 'page-id': page.id });
}

export function withPageId(changes, pageId) {
  return withMeta(changes, { 'page-id': pageId });
}

export function withContainer(changes, container) {
  if (container.type === 'page') {
    return withMeta(changes, { 'page-id': container.id });
  }
  return withMeta(changes, { 'component-id': container.id });
}

export function withObjects(changes, objects) {
  let fdata = makeFileData(uuidNext(), uuidZero);
  fdata = {
    ...fdata,
    'pages-index': { ...fdata['pages-index'], [uuidZero]: { ...fdata['pages-index'][uuidZero], objects } },
  };
  return withMeta(changes, { 'file-data': fdata, 'applied-changes-count': 0 });
}

export function withFileData(changes, fdata) {
  const pageId = getMeta(changes, 'page-id');
  const updatedFdata = {
    ...fdata,
    'pages-index': { ...fdata['pages-index'], [uuidZero]: fdata['pages-index']?.[pageId] },
  };
  return withMeta(changes, { 'file-data': updatedFdata, 'applied-changes-count': 0 });
}

export function withLibraryData(changes, data) {
  return withMeta(changes, { 'library-data': data });
}

export function amendLastChange(changes, f) {
  const redo = changes['redo-changes'];
  if (redo.length === 0) return changes;
  const last = redo[redo.length - 1];
  const updated = f(last);
  return { ...changes, 'redo-changes': [...redo.slice(0, -1), updated] };
}

export function amendChanges(changes, f) {
  return { ...changes, 'redo-changes': changes['redo-changes'].map(f) };
}

export function concatChanges(changes1, changes2) {
  return {
    ...changes1,
    'redo-changes': concatVec(changes1['redo-changes'], changes2['redo-changes']),
    'undo-changes': [...changes2['undo-changes'], ...changes1['undo-changes']],
  };
}

export function lookupObjects(changes) {
  const data = getMeta(changes, 'file-data');
  return getIn(data, ['pages-index', uuidZero, 'objects']);
}

export function applyChangesLocal(changes, options = {}) {
  const fileData = getMeta(changes, 'file-data');
  if (!fileData) return changes;

  const libraryData = getMeta(changes, 'library-data');
  const index = getMeta(changes, 'applied-changes-count') ?? 0;
  const redoChanges = changes['redo-changes'];

  const newChanges = index < redoChanges.length
    ? redoChanges.slice(index).map((c) => ({ ...c, 'page-id': uuidZero, 'component-id': undefined }))
    : [];

  const newFileData = processChanges(fileData, newChanges);
  const newLibraryData = options['apply-to-library?']
    ? processChanges(libraryData, newChanges)
    : libraryData;

  return withMeta(changes, {
    'file-data': newFileData,
    'library-data': newLibraryData,
    'applied-changes-count': redoChanges.length,
  });
}

export function getLibraryData(changes) {
  return getMeta(changes, 'library-data');
}

export function getObjects(changes) {
  return getIn(getMeta(changes, 'file-data'), ['pages-index', uuidZero, 'objects']);
}

export function getPage(changes) {
  return getMeta(changes, 'page');
}

export function getPageId(changes) {
  return getMeta(changes, 'page-id');
}

// --- Page changes ---

export function addEmptyPage(changes, id, name) {
  changes = { ...changes, 'redo-changes': [...changes['redo-changes'], { type: 'add-page', id, name }] };
  changes = { ...changes, 'undo-changes': [{ type: 'del-page', id }, ...changes['undo-changes']] };
  return applyChangesLocal(changes);
}

export function addPage(changes, id, page) {
  changes = { ...changes, 'redo-changes': [...changes['redo-changes'], { type: 'add-page', id, page }] };
  changes = { ...changes, 'undo-changes': [{ type: 'del-page', id }, ...changes['undo-changes']] };
  return applyChangesLocal(changes);
}

export function modPage(changes, page, options) {
  const pageId = page?.id ?? getPageId(changes);
  const redo = { type: 'mod-page', id: pageId };
  const undo = { type: 'mod-page', id: pageId };

  if (options.name != null) { redo.name = options.name; undo.name = page.name; }
  if (options.background != null) { redo.background = options.background; undo.background = page.background; }
  if (options['pixel-grid-color'] != null) { redo['pixel-grid-color'] = options['pixel-grid-color']; undo['pixel-grid-color'] = page['pixel-grid-color']; }
  if (options['pixel-grid-opacity'] != null) { redo['pixel-grid-opacity'] = options['pixel-grid-opacity']; undo['pixel-grid-opacity'] = page['pixel-grid-opacity']; }

  changes = { ...changes, 'redo-changes': [...changes['redo-changes'], redo] };
  changes = { ...changes, 'undo-changes': [undo, ...changes['undo-changes']] };
  return applyChangesLocal(changes);
}

export function delPage(changes, page) {
  changes = { ...changes, 'redo-changes': [...changes['redo-changes'], { type: 'del-page', id: page.id }] };
  changes = { ...changes, 'undo-changes': [{ type: 'add-page', id: page.id, page }, ...changes['undo-changes']] };
  return applyChangesLocal(changes);
}

export function movePage(changes, pageId, index, prevIndex) {
  changes = { ...changes, 'redo-changes': [...changes['redo-changes'], { type: 'mov-page', id: pageId, index }] };
  changes = { ...changes, 'undo-changes': [{ type: 'mov-page', id: pageId, index: prevIndex }, ...changes['undo-changes']] };
  return applyChangesLocal(changes);
}

export function setGuide(changes, id, guide) {
  const pageId = getPageId(changes);
  const page = getPage(changes);
  const oldVal = getIn(page, ['guides', id]);

  changes = { ...changes, 'redo-changes': [...changes['redo-changes'], { type: 'set-guide', 'page-id': pageId, id, params: guide }] };
  changes = { ...changes, 'undo-changes': [{ type: 'set-guide', 'page-id': pageId, id, params: oldVal }, ...changes['undo-changes']] };
  return changes;
}

export function setFlow(changes, id, flow) {
  const pageId = getPageId(changes);
  const page = getPage(changes);
  const oldVal = getIn(page, ['flows', id]);

  changes = { ...changes, 'redo-changes': [...changes['redo-changes'], { type: 'set-flow', 'page-id': pageId, id, params: flow }] };
  changes = { ...changes, 'undo-changes': [{ type: 'set-flow', 'page-id': pageId, id, params: oldVal }, ...changes['undo-changes']] };
  return applyChangesLocal(changes);
}

// --- Shape tree changes ---

export function addObject(changes, obj, options = {}) {
  const { index, 'ignore-touched': ignoreTouched = false } = options;
  const pageId = getPageId(changes);
  const objects = lookupObjects(changes);

  const addObj = { ...obj };
  if (index != null) addObj.index = index;

  const parent = objects?.[obj['parent-id']];
  const addChange = {
    type: 'add-obj',
    id: obj.id,
    'page-id': pageId,
    'parent-id': obj['parent-id'],
    'frame-id': obj['frame-id'],
    ...(index != null ? { index } : {}),
    'ignore-touched': ignoreTouched,
    obj: addObj,
  };

  const delChange = {
    type: 'del-obj',
    id: obj.id,
    'page-id': pageId,
  };

  let undoChanges = [delChange, ...changes['undo-changes']];
  if (parent && inComponentCopyQ(parent) && !ignoreTouched) {
    undoChanges = [{
      type: 'mod-obj',
      'page-id': pageId,
      id: parent.id,
      operations: [{ type: 'set-touched', touched: parent.touched }],
    }, ...undoChanges];
  }

  return applyChangesLocal({
    ...changes,
    'redo-changes': [...changes['redo-changes'], addChange],
    'undo-changes': undoChanges,
  });
}

export function addObjects(changes, objects, options) {
  let result = changes;
  for (const obj of objects) {
    result = addObject(result, obj, options);
  }
  return result;
}

export function changeParent(changes, parentId, shapes, index, options = {}) {
  const pageId = getPageId(changes);
  const objects = lookupObjects(changes);

  const setParentChange = {
    type: 'mov-objects',
    'parent-id': parentId,
    'page-id': pageId,
    shapes: [...shapes].reverse().map((s) => s.id),
    ...(index != null ? { index } : {}),
    ...(options['allow-altering-copies'] ? { 'allow-altering-copies': true } : {}),
    ...(options['ignore-touched'] ? { 'ignore-touched': true } : {}),
  };

  const mkUndoChange = (undoChanges, shape) => {
    const prevSibling = getPrevSibling(objects, shape.id);
    const undo = {
      type: 'mov-objects',
      'page-id': pageId,
      'parent-id': shape['parent-id'],
      shapes: [shape.id],
      'after-shape': prevSibling,
      index: 0,
    };
    if (options['allow-altering-copies']) undo['allow-altering-copies'] = true;
    return undo;
  };

  const parent = objects?.[parentId];
  let undoChanges = [setParentChange, ...changes['undo-changes']];
  if (parent && inComponentCopyQ(parent)) {
    undoChanges = [{
      type: 'mod-obj',
      'page-id': pageId,
      id: parent.id,
      operations: [{ type: 'set-touched', touched: parent.touched }],
    }, ...undoChanges];
  }

  return applyChangesLocal({
    ...changes,
    'redo-changes': [...changes['redo-changes'], setParentChange],
    'undo-changes': shapes.reduce((acc, shape) => [mkUndoChange(acc, shape), ...acc], undoChanges),
  });
}

export function changedAttrs(object, objects, updateFn, options = {}) {
  const { attrs, 'with-objects?': withObjects } = options;
  const newObj = withObjects ? updateFn(object, objects) : updateFn(object);
  if (object === newObj) return null;

  const allAttrs = attrs ?? new Set([...Object.keys(object), ...Object.keys(newObj)]);
  return allAttrs.filter((attr) => object[attr] !== newObj[attr]);
}

export function updateShapes(changes, ids, updateFn, options = {}) {
  const { attrs, 'ignore-geometry?': ignoreGeometry = false, 'ignore-touched': ignoreTouched = false, 'with-objects?': withObjects = false } = options;
  const pageId = getPageId(changes);
  const componentId = getMeta(changes, 'component-id');
  const objects = lookupObjects(changes);

  let result = { ...changes };

  for (const id of ids) {
    const oldObj = objects?.[id];
    if (!oldObj) continue;

    const newObj = withObjects ? updateFn(oldObj, objects) : updateFn(oldObj);
    if (oldObj === newObj) continue;

    const allAttrs = attrs ?? [...new Set([...Object.keys(oldObj), ...Object.keys(newObj)])];

    const rops = [];
    const uops = [];
    for (const attr of allAttrs) {
      const oldVal = oldObj[attr];
      const newVal = newObj[attr];
      if (oldVal !== newVal) {
        rops.push({ type: 'set', attr, val: newVal, 'ignore-geometry': ignoreGeometry, 'ignore-touched': ignoreTouched });
        uops.push({ type: 'set', attr, val: oldVal, 'ignore-touched': true });
      }
    }

    if (uops.length > 0) {
      uops.push({ type: 'set-touched', touched: oldObj.touched });
    }

    if (rops.length > 0) {
      const change = { type: 'mod-obj', id, ...(pageId != null ? { 'page-id': pageId } : {}), ...(componentId != null ? { 'component-id': componentId } : {}) };
      result = {
        ...result,
        'redo-changes': [...result['redo-changes'], { ...change, operations: rops }],
        'undo-changes': uops.length > 0 ? [{ ...change, operations: uops }, ...result['undo-changes']] : result['undo-changes'],
      };
    }
  }

  return applyChangesLocal(result);
}

export function removeObjects(changes, ids, options = {}) {
  const { 'ignore-touched': ignoreTouched = false } = options;
  const pageId = getPageId(changes);
  const objects = lookupObjects(changes);

  const redoChanges = ids.map((id) => {
    const change = { type: 'del-obj', 'page-id': pageId, id };
    if (ignoreTouched) change['ignore-touched'] = true;
    return change;
  });

  const undoChanges = [];
  for (const id of ids) {
    const shape = objects?.[id];
    if (shape) {
      const parent = objects?.[shape['parent-id']];
      if (parent) {
        undoChanges.push({
          type: 'mov-objects',
          'page-id': pageId,
          'parent-id': shape['parent-id'],
          shapes: [id],
          'after-shape': getPrevSibling(objects, shape.id),
          index: 0,
          'ignore-touched': true,
        });
      }
      const addObj = shape.shapes ? { ...shape, shapes: [] } : shape;
      undoChanges.push({
        type: 'add-obj',
        id,
        'page-id': pageId,
        'parent-id': shape['parent-id'],
        'frame-id': shape['frame-id'],
        index: getPositionOnParent(objects, id),
        obj: addObj,
      });
    }
  }

  return applyChangesLocal({
    ...changes,
    'redo-changes': [...changes['redo-changes'], ...redoChanges],
    'undo-changes': [...undoChanges, ...changes['undo-changes']],
  });
}

// --- Library changes ---

export function addColor(changes, color) {
  changes = { ...changes, 'redo-changes': [...changes['redo-changes'], { type: 'add-color', color }] };
  changes = { ...changes, 'undo-changes': [{ type: 'del-color', id: color.id }, ...changes['undo-changes']] };
  return applyChangesLocal(changes);
}

export function updateColor(changes, color) {
  const libraryData = getLibraryData(changes);
  const prevColor = libraryData?.colors?.[color.id];
  changes = { ...changes, 'redo-changes': [...changes['redo-changes'], { type: 'mod-color', color }] };
  changes = { ...changes, 'undo-changes': [{ type: 'mod-color', color: prevColor }, ...changes['undo-changes']] };
  return applyChangesLocal(changes);
}

export function deleteColor(changes, colorId) {
  const libraryData = getLibraryData(changes);
  const prevColor = libraryData?.colors?.[colorId];
  changes = { ...changes, 'redo-changes': [...changes['redo-changes'], { type: 'del-color', id: colorId }] };
  changes = { ...changes, 'undo-changes': [{ type: 'add-color', color: prevColor }, ...changes['undo-changes']] };
  return applyChangesLocal(changes);
}

export function addMedia(changes, object) {
  changes = { ...changes, 'redo-changes': [...changes['redo-changes'], { type: 'add-media', object }] };
  changes = { ...changes, 'undo-changes': [{ type: 'del-media', id: object.id }, ...changes['undo-changes']] };
  return applyChangesLocal(changes);
}

export function updateMedia(changes, object) {
  const libraryData = getLibraryData(changes);
  const prevObject = libraryData?.media?.[object.id];
  changes = { ...changes, 'redo-changes': [...changes['redo-changes'], { type: 'mod-media', object }] };
  changes = { ...changes, 'undo-changes': [{ type: 'mod-media', object: prevObject }, ...changes['undo-changes']] };
  return applyChangesLocal(changes);
}

export function deleteMedia(changes, id) {
  const libraryData = getLibraryData(changes);
  const prevObject = libraryData?.media?.[id];
  changes = { ...changes, 'redo-changes': [...changes['redo-changes'], { type: 'del-media', id }] };
  changes = { ...changes, 'undo-changes': [{ type: 'add-media', object: prevObject }, ...changes['undo-changes']] };
  return applyChangesLocal(changes);
}

export function addTypography(changes, typography) {
  changes = { ...changes, 'redo-changes': [...changes['redo-changes'], { type: 'add-typography', typography }] };
  changes = { ...changes, 'undo-changes': [{ type: 'del-typography', id: typography.id }, ...changes['undo-changes']] };
  return applyChangesLocal(changes);
}

export function updateTypography(changes, typography) {
  const libraryData = getLibraryData(changes);
  const prevTypography = libraryData?.typographies?.[typography.id];
  changes = { ...changes, 'redo-changes': [...changes['redo-changes'], { type: 'mod-typography', typography }] };
  changes = { ...changes, 'undo-changes': [{ type: 'mod-typography', typography: prevTypography }, ...changes['undo-changes']] };
  return applyChangesLocal(changes);
}

export function deleteTypography(changes, typographyId) {
  const libraryData = getLibraryData(changes);
  const prevTypography = libraryData?.typographies?.[typographyId];
  changes = { ...changes, 'redo-changes': [...changes['redo-changes'], { type: 'del-typography', id: typographyId }] };
  changes = { ...changes, 'undo-changes': [{ type: 'add-typography', typography: prevTypography }, ...changes['undo-changes']] };
  return applyChangesLocal(changes);
}

export function addComponent(changes, id, path, name, updatedShapes, mainInstanceId, mainInstancePage, annotation, variantId, variantProperties, options = {}) {
  const pageId = getPageId(changes);
  const objects = lookupObjects(changes);

  const mkChange = (shape) => ({
    type: 'mod-obj',
    'page-id': pageId,
    id: shape.id,
    operations: [
      { type: 'set', attr: 'component-id', val: shape['component-id'] },
      { type: 'set', attr: 'component-file', val: shape['component-file'] },
      { type: 'set', attr: 'component-root', val: shape['component-root'] },
      { type: 'set', attr: 'main-instance', val: shape['main-instance'] },
      { type: 'set', attr: 'shape-ref', val: shape['shape-ref'] },
      { type: 'set', attr: 'touched', val: shape.touched },
    ],
  });

  const addCompChange = {
    type: 'add-component',
    id,
    path,
    name,
    'main-instance-id': mainInstanceId,
    'main-instance-page': mainInstancePage,
    annotation,
    ...(variantId != null ? { 'variant-id': variantId } : {}),
    ...(variantProperties?.length > 0 ? { 'variant-properties': variantProperties } : {}),
  };

  const undoChange = {
    type: 'del-component',
    id,
    'skip-undelete?': true,
  };

  let result = { ...changes };
  result = { ...result, 'redo-changes': [...result['redo-changes'], addCompChange, ...updatedShapes.map(mkChange)] };
  result = { ...result, 'undo-changes': [undoChange, ...updatedShapes.map((s) => mkChange(objects?.[s.id])).filter(Boolean), ...result['undo-changes']] };

  return applyChangesLocal(result, options['apply-changes-local-library?'] ? { 'apply-to-library?': true } : {});
}

export function updateComponent(changes, id, updateFn, options = {}) {
  const libraryData = getLibraryData(changes);
  const prevComponent = libraryData?.components?.[id];
  const newComponent = updateFn(prevComponent);

  if (!prevComponent) return changes;

  const mkModComp = (comp) => {
    const change = {
      type: 'mod-component',
      id,
      name: comp.name,
      path: comp.path,
      'main-instance-id': comp['main-instance-id'],
      'main-instance-page': comp['main-instance-page'],
      annotation: comp.annotation,
      objects: comp.objects,
      'modified-at': comp['modified-at'],
    };
    if (comp['variant-id'] != null) change['variant-id'] = comp['variant-id'];
    if (comp['variant-properties']?.length > 0) change['variant-properties'] = comp['variant-properties'];
    return change;
  };

  let result = { ...changes };
  result = { ...result, 'redo-changes': [...result['redo-changes'], mkModComp(newComponent)] };
  result = { ...result, 'undo-changes': [mkModComp(prevComponent), ...result['undo-changes']] };

  return applyChangesLocal(result, options['apply-changes-local-library?'] ? { 'apply-to-library?': true } : {});
}

export function deleteComponent(changes, id, pageId) {
  changes = { ...changes, 'redo-changes': [...changes['redo-changes'], { type: 'del-component', id }] };
  changes = { ...changes, 'undo-changes': [{ type: 'restore-component', id, 'page-id': pageId }, ...changes['undo-changes']] };
  return changes;
}

export function restoreComponent(changes, id, pageId, delta) {
  changes = { ...changes, 'redo-changes': [...changes['redo-changes'], { type: 'restore-component', id, 'page-id': pageId }] };
  changes = { ...changes, 'undo-changes': [{ type: 'del-component', id, delta }, ...changes['undo-changes']] };
  return changes;
}

// --- Design Tokens changes ---

export function setTokensLib(changes, tokensLib) {
  const libraryData = getLibraryData(changes);
  const prevTokensLib = libraryData?.['tokens-lib'];
  changes = { ...changes, 'redo-changes': [...changes['redo-changes'], { type: 'set-tokens-lib', 'tokens-lib': tokensLib }] };
  changes = { ...changes, 'undo-changes': [{ type: 'set-tokens-lib', 'tokens-lib': prevTokensLib }, ...changes['undo-changes']] };
  return applyChangesLocal(changes);
}

export function setTokenSet(changes, setId, tokenSet) {
  const libraryData = getLibraryData(changes);
  const prevTokensLib = libraryData?.['tokens-lib'];
  const prevSet = prevTokensLib?.sets?.[setId];
  changes = { ...changes, 'redo-changes': [...changes['redo-changes'], { type: 'set-token-set', id: setId, 'token-set': tokenSet }] };
  changes = { ...changes, 'undo-changes': [{ type: 'set-token-set', id: setId, 'token-set': prevSet }, ...changes['undo-changes']] };
  return applyChangesLocal(changes);
}

export function setActiveTokenThemes(changes, activeThemePaths) {
  const libraryData = getLibraryData(changes);
  const prevActivePaths = libraryData?.['tokens-lib']?.['active-theme-paths'] ?? new Set();
  changes = { ...changes, 'redo-changes': [...changes['redo-changes'], { type: 'set-active-token-themes', 'theme-paths': activeThemePaths }] };
  changes = { ...changes, 'undo-changes': [{ type: 'set-active-token-themes', 'theme-paths': prevActivePaths }, ...changes['undo-changes']] };
  return applyChangesLocal(changes);
}

export function setBaseFontSize(changes, newBaseFontSize) {
  const fileData = getMeta(changes, 'file-data');
  const previousFontSize = fileData?.options?.['base-font-size'] ?? '16px';
  changes = { ...changes, 'redo-changes': [...changes['redo-changes'], { type: 'set-base-font-size', 'base-font-size': newBaseFontSize }] };
  changes = { ...changes, 'undo-changes': [{ type: 'set-base-font-size', 'base-font-size': previousFontSize }, ...changes['undo-changes']] };
  return applyChangesLocal(changes);
}

// --- Misc changes ---

export function reorderChildren(changes, id, children) {
  const pageId = getPageId(changes);
  const objects = lookupObjects(changes);
  const shape = objects?.[id];
  if (!shape) return changes;

  const oldChildren = shape.shapes ?? [];
  const redoChange = { type: 'reorder-children', 'parent-id': shape.id, 'page-id': pageId, shapes: children };
  const undoChange = { type: 'reorder-children', 'parent-id': shape.id, 'page-id': pageId, shapes: oldChildren };

  changes = { ...changes, 'redo-changes': [...changes['redo-changes'], redoChange] };
  changes = { ...changes, 'undo-changes': [undoChange, ...changes['undo-changes']] };
  return applyChangesLocal(changes);
}

export function reorderGridChildren(changes, ids) {
  return changes;
}

export function setTextContent(changes, id, content, prevContent) {
  const pageId = getPageId(changes);
  const redoChange = { type: 'mod-obj', 'page-id': pageId, id, operations: [{ type: 'set', attr: 'content', val: content }] };
  const undoChange = { type: 'mod-obj', 'page-id': pageId, id, operations: [{ type: 'set', attr: 'content', val: prevContent }] };

  return { ...changes, 'redo-changes': [...changes['redo-changes'], redoChange], 'undo-changes': [undoChange, ...changes['undo-changes']] };
}

export function moveTokenSet(changes, opts) {
  const redo = {
    type: 'move-token-set',
    'from-path': opts['from-path'],
    'to-path': opts['to-path'],
    'before-path': opts['before-path'],
    'before-group': opts['before-group?'],
  };
  const undo = {
    type: 'move-token-set',
    'from-path': opts['to-path'],
    'to-path': opts['from-path'],
    'before-path': opts['prev-before-path'],
    'before-group': opts['prev-before-group?'],
  };
  changes = { ...changes, 'redo-changes': [...changes['redo-changes'], redo] };
  changes = { ...changes, 'undo-changes': [undo, ...changes['undo-changes']] };
  return applyChangesLocal(changes);
}

export function moveTokenSetGroup(changes, opts) {
  const redo = {
    type: 'move-token-set-group',
    'from-path': opts['from-path'],
    'to-path': opts['to-path'],
    'before-path': opts['before-path'],
    'before-group': opts['before-group?'],
  };
  const undo = {
    type: 'move-token-set-group',
    'from-path': opts['to-path'],
    'to-path': opts['from-path'],
    'before-path': opts['prev-before-path'],
    'before-group': opts['prev-before-group?'],
  };
  changes = { ...changes, 'redo-changes': [...changes['redo-changes'], redo] };
  changes = { ...changes, 'undo-changes': [undo, ...changes['undo-changes']] };
  return applyChangesLocal(changes);
}

// --- Helper functions ---

function withMeta(obj, meta) {
  return Object.assign(Object.create(null), obj, { __meta: { ...(obj.__meta ?? {}), ...meta } });
}

function getMeta(obj, key) {
  return obj?.__meta?.[key];
}

function getPrevSibling(objects, id) {
  if (!objects) return null;
  const shape = objects[id];
  if (!shape) return null;
  const parent = objects[shape['parent-id']];
  if (!parent) return null;
  const shapes = parent.shapes ?? [];
  const index = shapes.indexOf(id);
  return index > 0 ? shapes[index - 1] : null;
}

function getPositionOnParent(objects, id) {
  if (!objects) return 0;
  const shape = objects[id];
  if (!shape) return 0;
  const parent = objects[shape['parent-id']];
  if (!parent) return 0;
  return (parent.shapes ?? []).indexOf(id);
}

function processChanges(data, changes) {
  if (!data || !changes || changes.length === 0) return data;
  let result = { ...data };
  for (const change of changes) {
    result = applySingleChange(result, change);
  }
  return result;
}

function applySingleChange(data, change) {
  if (!data) return data;
  switch (change.type) {
    case 'add-page':
      return { ...data, pages: [...(data.pages ?? []), change.id], 'pages-index': { ...(data['pages-index'] ?? {}), [change.id]: change.page ?? { id: change.id, name: change.name } } };
    case 'del-page': {
      const { [change.id]: _, ...rest } = data['pages-index'] ?? {};
      return { ...data, pages: (data.pages ?? []).filter((p) => p !== change.id), 'pages-index': rest };
    }
    case 'add-obj': {
      const pageId = change['page-id'];
      const objects = getIn(data, ['pages-index', pageId, 'objects']) ?? {};
      const parent = objects[change['parent-id']];
      const newObjects = { ...objects, [change.id]: change.obj };
      if (parent) {
        const shapes = parent.shapes ?? [];
        const index = change.index ?? shapes.length;
        const newShapes = [...shapes.slice(0, index), change.id, ...shapes.slice(index)];
        newObjects[change['parent-id']] = { ...parent, shapes: newShapes };
      }
      return setIn(data, ['pages-index', pageId, 'objects'], newObjects);
    }
    case 'del-obj': {
      const pageId = change['page-id'];
      const objects = getIn(data, ['pages-index', pageId, 'objects']) ?? {};
      const shape = objects[change.id];
      if (!shape) return data;
      const { [change.id]: _, ...rest } = objects;
      const parent = rest[shape['parent-id']];
      if (parent) {
        rest[shape['parent-id']] = { ...parent, shapes: (parent.shapes ?? []).filter((s) => s !== change.id) };
      }
      return setIn(data, ['pages-index', pageId, 'objects'], rest);
    }
    case 'mod-obj': {
      const pageId = change['page-id'];
      const objects = getIn(data, ['pages-index', pageId, 'objects']) ?? {};
      const shape = objects[change.id];
      if (!shape) return data;
      let newShape = { ...shape };
      for (const op of (change.operations ?? [])) {
        if (op.type === 'set') {
          newShape = { ...newShape, [op.attr]: op.val };
        } else if (op.type === 'set-touched') {
          newShape = { ...newShape, touched: op.touched };
        }
      }
      const newObjects = { ...objects, [change.id]: newShape };
      return setIn(data, ['pages-index', pageId, 'objects'], newObjects);
    }
    case 'add-color':
      return { ...data, colors: { ...(data.colors ?? {}), [change.color.id]: change.color } };
    case 'del-color': {
      const { [change.id]: _, ...rest } = data.colors ?? {};
      return { ...data, colors: rest };
    }
    case 'mod-color':
      return { ...data, colors: { ...(data.colors ?? {}), [change.color.id]: change.color } };
    case 'add-media':
      return { ...data, media: { ...(data.media ?? {}), [change.object.id]: change.object } };
    case 'del-media': {
      const { [change.id]: _, ...rest } = data.media ?? {};
      return { ...data, media: rest };
    }
    case 'mod-media':
      return { ...data, media: { ...(data.media ?? {}), [change.object.id]: change.object } };
    case 'add-typography':
      return { ...data, typographies: { ...(data.typographies ?? {}), [change.typography.id]: change.typography } };
    case 'del-typography': {
      const { [change.id]: _, ...rest } = data.typographies ?? {};
      return { ...data, typographies: rest };
    }
    case 'mod-typography':
      return { ...data, typographies: { ...(data.typographies ?? {}), [change.typography.id]: change.typography } };
    case 'add-component':
      return { ...data, components: { ...(data.components ?? {}), [change.id]: { id: change.id, path: change.path, name: change.name, 'main-instance-id': change['main-instance-id'], 'main-instance-page': change['main-instance-page'], annotation: change.annotation, 'variant-id': change['variant-id'], 'variant-properties': change['variant-properties'] } } };
    case 'del-component': {
      const { [change.id]: _, ...rest } = data.components ?? {};
      return { ...data, components: rest };
    }
    case 'mod-component': {
      const comps = { ...(data.components ?? {}) };
      const prev = comps[change.id] ?? {};
      comps[change.id] = { ...prev, ...withoutNils({ name: change.name, path: change.path, 'main-instance-id': change['main-instance-id'], 'main-instance-page': change['main-instance-page'], annotation: change.annotation, objects: change.objects, 'variant-id': change['variant-id'], 'variant-properties': change['variant-properties'], 'modified-at': change['modified-at'] }) };
      return { ...data, components: comps };
    }
    default:
      return data;
  }
}

function setIn(obj, path, value) {
  if (path.length === 0) return value;
  const key = path[0];
  if (path.length === 1) {
    return Array.isArray(obj) ? [...obj.slice(0, key), value, ...obj.slice(key + 1)] : { ...obj, [key]: value };
  }
  const nested = obj?.[key];
  return Array.isArray(obj)
    ? [...obj.slice(0, key), setIn(nested, path.slice(1), value), ...obj.slice(key + 1)]
    : { ...obj, [key]: setIn(nested, path.slice(1), value) };
}