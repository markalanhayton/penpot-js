import * as d from '../data.js';
import * as uuid from '../uuid.js';
import * as cph from './helpers.js';
import * as cpc from './changes.js';
import * as typesColor from '../types/color.js';
import * as typesFile from '../types/file.js';
import * as typesPage from '../types/page.js';
import * as typesShape from '../types/shape_type.js';
import * as typesTypography from '../types/typography.js';
import * as typesVariant from '../types/variant.js';
import * as typesPath from '../types/path.js';
import * as gsh from '../geom/shapes/shapes.js';
import * as csvg from '../svg.js';
import * as fmig from './migrations.js';

const ROOT_ID = uuid.zero;

const defaultFeatures = new Set([
  'fdata/shape-data-type',
  'styles/v2',
  'layout/grid',
  'components/v2',
  'plugins/runtime',
  'design-tokens/v1',
  'variants/v1',
]);

const builderMigrations = new Set(fmig.availableMigrations);
builderMigrations.delete('003-convert-path-content');
builderMigrations.delete('0002-clean-shape-interactions');
builderMigrations.delete('0003-fix-root-shape');

function defaultUuid(v) {
  return v ?? uuid.next();
}

function trackUsedName(state, name) {
  const containerId = state['::current-page-id'];
  const unames = state['::unames']?.[containerId] ?? new Set();
  const newUnames = new Set(unames);
  newUnames.add(name);
  return {
    ...state,
    '::unames': {
      ...state['::unames'],
      [containerId]: newUnames,
    },
  };
}

function uniqueName(name, state) {
  const containerId = state['::current-page-id'];
  const unames = state['::unames']?.[containerId] ?? new Set();
  return d.uniqueName(name, unames);
}

function assignShapeName(shape, state) {
  let result = { ...shape };
  if (result.name == null) {
    const type = result.type;
    result.name = type === 'frame'
      ? 'Board'
      : (type.charAt(0).toUpperCase() + type.slice(1));
  }
  result.name = uniqueName(result.name, state);
  return result;
}

function commitChange(state, change, { addContainer = false } = {}) {
  const fileId = state['::current-file-id'];
  if (fileId == null) throw new Error('no current file id');

  let finalChange = { ...change };
  if (addContainer) {
    finalChange['page-id'] = state['::current-page-id'];
    finalChange['frame-id'] = state['::current-frame-id'];
  }

  const files = { ...state['::files'] };
  const file = { ...files[fileId] };
  file.data = cpc.processChanges(file.data, [finalChange], false);
  files[fileId] = file;

  return { ...state, '::files': files };
}

function commitShape(state, shape) {
  const parentId = state['::parent-stack']?.[state['::parent-stack'].length - 1];
  const frameId = state['::current-frame-id'];
  const pageId = state['::current-page-id'];

  const change = {
    type: 'add-obj',
    id: shape.id,
    'ignore-touched': true,
    obj: shape,
    'parent-id': parentId,
    'frame-id': frameId,
    'page-id': pageId,
  };

  let newState = commitChange(state, change);
  newState = trackUsedName(newState, shape.name);
  return newState;
}

function clearNames(file) {
  const result = { ...file };
  delete result['::unames'];
  return result;
}

export function createEmptyFile(name = 'New File') {
  const fileId = uuid.next();
  const pageId = uuid.next();
  const page = typesPage.makeEmptyPage({ id: pageId, name: 'Page 1' });
  const data = typesFile.makeFileData(fileId, pageId);

  return {
    id: fileId,
    name,
    revn: 0,
    vern: 0,
    'is-shared': false,
    version: fmig.version,
    data,
    features: new Set(defaultFeatures),
    migrations: new Set(builderMigrations),
  };
}

export function buildFile(options = {}) {
  const {
    name = 'New File',
    fileId,
    pageId,
    onPage,
  } = options;

  const theFileId = fileId ?? uuid.next();
  const thePageId = pageId ?? uuid.next();
  const page = typesPage.makeEmptyPage({ id: thePageId, name: 'Page 1' });
  const data = typesFile.makeFileData(theFileId, thePageId);

  let file = {
    id: theFileId,
    name,
    revn: 0,
    vern: 0,
    'is-shared': false,
    version: fmig.version,
    data,
    features: new Set(defaultFeatures),
    migrations: new Set(builderMigrations),
  };

  if (onPage) {
    const result = onPage({ data: file.data, pageId: thePageId, fileId: theFileId });
    if (result) {
      file = { ...file, data: result };
    }
  }

  return file;
}

export function createState() {
  return {};
}

export function getCurrentPage(state) {
  const fileId = state['::current-file-id'];
  const pageId = state['::current-page-id'];
  if (fileId == null) throw new Error('expected current-file-id to be assigned');
  if (pageId == null) throw new Error('expected current-page-id to be assigned');
  return state['::files']?.[fileId]?.data?.['pages-index']?.[pageId];
}

export function getCurrentObjects(state) {
  const page = getCurrentPage(state);
  return page?.objects;
}

export function getShape(state, shapeId) {
  const objects = getCurrentObjects(state);
  return objects?.[shapeId];
}

export function addFile(state, params = {}) {
  const id = defaultUuid(params.id);
  const fileParams = {
    ...params,
    id,
    features: new Set(defaultFeatures),
    migrations: new Set(builderMigrations),
  };
  const file = typesFile.makeFile(fileParams);

  return {
    ...state,
    '::files': {
      ...state['::files'],
      [id]: file,
    },
    '::current-file-id': id,
  };
}

export function closeFile(state) {
  state = closePage(state);
  const result = { ...state };
  delete result['::current-file-id'];
  return result;
}

export function addPage(state, params = {}) {
  const page = typesPage.makeEmptyPage(params);
  const change = { type: 'add-page', page };

  let newState = commitChange(state, change);
  newState = {
    ...newState,
    '::current-page-id': page.id,
    '::current-frame-id': ROOT_ID,
    '::parent-stack': [ROOT_ID],
    '::last-id': null,
  };
  return newState;
}

export function closePage(state) {
  const result = { ...state };
  delete result['::current-page-id'];
  delete result['::parent-stack'];
  delete result['::last-id'];
  return clearNames(result);
}

export function addBoard(state, params = {}) {
  const shape = typesShape.setupShape(assignShapeName({
    ...params,
    id: defaultUuid(params.id),
    type: 'frame',
  }, state));

  let newState = commitShape(state, shape);
  newState = {
    ...newState,
    '::parent-stack': [...(newState['::parent-stack'] || []), shape.id],
    '::current-frame-id': shape.id,
    '::last-id': shape.id,
  };
  return newState;
}

export function closeBoard(state) {
  const parentStack = state['::parent-stack'] ?? [];
  const parentId = parentStack[parentStack.length - 1];
  const parent = getShape(state, parentId);

  const newFrameId = parent?.['frame-id'] ?? ROOT_ID;
  const newStack = parentStack.slice(0, -1);

  return {
    ...state,
    '::current-frame-id': newFrameId,
    '::parent-stack': newStack,
  };
}

export function addGroup(state, params = {}) {
  const shape = typesShape.setupShape(assignShapeName({
    ...params,
    id: defaultUuid(params.id),
    type: 'group',
  }, state));

  let newState = commitShape(state, shape);
  newState = {
    ...newState,
    '::last-id': shape.id,
    '::parent-stack': [...(newState['::parent-stack'] || []), shape.id],
  };
  return newState;
}

export function closeGroup(state) {
  const parentStack = state['::parent-stack'] ?? [];
  const groupId = parentStack[parentStack.length - 1];
  const group = getShape(state, groupId);
  if (!group) {
    const newStack = parentStack.slice(0, -1);
    return { ...state, '::parent-stack': newStack };
  }

  const objects = getCurrentObjects(state);
  const children = (group.shapes || [])
    .map(id => objects?.[id])
    .filter(Boolean);

  if (children.length === 0) {
    throw new Error('group expects to have at least 1 children');
  }

  if (group['masked-group']) {
    const mask = children[0];
    const change = {
      type: 'mod-obj',
      id: groupId,
      'page-id': state['::current-page-id'],
      operations: [
        { type: 'set', attr: 'x', val: mask.selrect?.x, 'ignore-touched': true },
        { type: 'set', attr: 'y', val: mask.selrect?.y, 'ignore-touched': true },
        { type: 'set', attr: 'width', val: mask.selrect?.width, 'ignore-touched': true },
        { type: 'set', attr: 'height', val: mask.selrect?.height, 'ignore-touched': true },
        { type: 'set', attr: 'flip-x', val: mask['flip-x'], 'ignore-touched': true },
        { type: 'set', attr: 'flip-y', val: mask['flip-y'], 'ignore-touched': true },
        { type: 'set', attr: 'selrect', val: mask.selrect, 'ignore-touched': true },
        { type: 'set', attr: 'points', val: mask.points, 'ignore-touched': true },
      ],
    };
    return commitChange(state, change, { addContainer: true });
  } else {
    const updatedGroup = gsh.updateGroupSelrect(group, children);
    const change = {
      type: 'mod-obj',
      id: groupId,
      'page-id': state['::current-page-id'],
      operations: [
        { type: 'set', attr: 'selrect', val: updatedGroup.selrect, 'ignore-touched': true },
        { type: 'set', attr: 'points', val: updatedGroup.points, 'ignore-touched': true },
        { type: 'set', attr: 'x', val: updatedGroup.selrect?.x, 'ignore-touched': true },
        { type: 'set', attr: 'y', val: updatedGroup.selrect?.y, 'ignore-touched': true },
        { type: 'set', attr: 'width', val: updatedGroup.selrect?.width, 'ignore-touched': true },
        { type: 'set', attr: 'height', val: updatedGroup.selrect?.height, 'ignore-touched': true },
      ],
    };
    return commitChange(state, change, { addContainer: true });
  }
}

export function addBool(state, params) {
  const { 'group-id': groupId, type: boolType } = params;
  const group = getShape(state, groupId);
  if (!group) throw new Error(`group not found: ${groupId}`);

  const objects = getCurrentObjects(state);
  const children = (group.shapes || [])
    .filter(id => objects?.[id] && !cph.frameShapeQ(objects[id]) && !typesVariant.isVariantQ(objects[id]));

  if (!children || children.length === 0) {
    throw new Error('expected a group with at least one shape for creating a bool');
  }

  const head = boolType === 'difference' ? children[0] : children[children.length - 1];
  const fills = (head?.['svg-attrs'] && (head.fills == null || head.fills.length === 0))
    ? typesPath.getDefaultBoolFills()
    : (head?.fills ?? []);

  const boolShape = {
    ...group,
    type: 'bool',
    'bool-type': boolType,
    fills,
    strokes: head?.strokes ?? [],
  };

  const updatedBool = typesPath.updateBoolShape(boolShape, objects);
  const selrect = updatedBool.selrect;

  const change = {
    type: 'mod-obj',
    id: group.id,
    'page-id': state['::current-page-id'],
    operations: [
      { type: 'set', attr: 'content', val: updatedBool.content, 'ignore-touched': true },
      { type: 'set', attr: 'type', val: 'bool', 'ignore-touched': true },
      { type: 'set', attr: 'bool-type', val: boolType, 'ignore-touched': true },
      { type: 'set', attr: 'selrect', val: selrect, 'ignore-touched': true },
      { type: 'set', attr: 'points', val: updatedBool.points, 'ignore-touched': true },
      { type: 'set', attr: 'x', val: selrect?.x, 'ignore-touched': true },
      { type: 'set', attr: 'y', val: selrect?.y, 'ignore-touched': true },
      { type: 'set', attr: 'width', val: selrect?.width, 'ignore-touched': true },
      { type: 'set', attr: 'height', val: selrect?.height, 'ignore-touched': true },
      { type: 'set', attr: 'fills', val: fills, 'ignore-touched': true },
      { type: 'set', attr: 'strokes', val: head?.strokes ?? [], 'ignore-touched': true },
    ],
  };

  let newState = commitChange(state, change, { addContainer: true });
  newState = { ...newState, '::last-id': group.id };
  return newState;
}

export function addShape(state, params = {}) {
  let obj = { ...params };
  if (obj['svg-attrs']) {
    obj = { ...obj, 'svg-attrs': csvg.attrsToProps(obj['svg-attrs']) };
  }
  obj = typesShape.setupShape(obj);
  obj = assignShapeName(obj, state);

  let newState = commitShape(state, obj);
  newState = { ...newState, '::last-id': obj.id };
  return newState;
}

export function addLibraryColor(state, color) {
  const newColor = {
    ...color,
    opacity: color.opacity ?? 1,
    id: defaultUuid(color.id),
  };

  const change = { type: 'add-color', color: newColor };
  let newState = commitChange(state, change);
  newState = { ...newState, '::last-id': newColor.id };
  return newState;
}

export function addLibraryTypography(state, typography) {
  const newTypo = {
    ...typography,
    id: defaultUuid(typography.id),
  };
  const cleanTypo = d.withoutNils(newTypo);

  const change = {
    type: 'add-typography',
    id: cleanTypo.id,
    typography: cleanTypo,
  };

  let newState = commitChange(state, change);
  newState = { ...newState, '::last-id': cleanTypo.id };
  return newState;
}

export function addComponent(state, params) {
  const componentId = defaultUuid(params['component-id']);
  const fileId = params['file-id'] ?? state['::current-file-id'];
  const pageId = params['page-id'] ?? state['::current-page-id'];
  const frameId = params['frame-id'] ?? state['::current-frame-id'];
  const name = params.name ?? 'anonymous';
  const path = params.path ?? '';
  const variantId = params['variant-id'];
  const variantProperties = params['variant-properties'];

  const change1 = d.withoutNils({
    type: 'add-component',
    id: componentId,
    name,
    path: d.nilv(path, ''),
    'main-instance-id': frameId,
    'main-instance-page': pageId,
    'variant-id': variantId,
    'variant-properties': variantProperties,
  });

  const change2 = {
    type: 'mod-obj',
    id: frameId,
    'page-id': pageId,
    operations: [
      { type: 'set', attr: 'component-root', val: true },
      { type: 'set', attr: 'main-instance', val: true },
      { type: 'set', attr: 'component-id', val: componentId },
      { type: 'set', attr: 'component-file', val: fileId },
    ],
  };

  let newState = commitChange(state, change1);
  newState = commitChange(newState, change2);
  return newState;
}

export function addTokensLib(state, tokensLib) {
  return commitChange(state, { type: 'set-tokens-lib', 'tokens-lib': tokensLib });
}

export function deleteShape(state, id) {
  return commitChange(state, {
    type: 'del-obj',
    'page-id': state['::current-page-id'],
    'ignore-touched': true,
    id,
  });
}

export function updateShape(state, shapeId, f) {
  const pageId = state['::current-page-id'];
  const objects = getCurrentObjects(state);
  const oldShape = objects?.[shapeId];
  if (!oldShape) return state;

  const newShape = f(oldShape);
  const allKeys = new Set([...Object.keys(oldShape), ...Object.keys(newShape)]);

  const operations = [];
  for (const attr of allKeys) {
    const oldVal = oldShape[attr];
    const newVal = newShape[attr];
    if (oldVal !== newVal) {
      operations.push({ type: 'set', attr, val: newVal, 'ignore-touched': true });
    }
  }

  return commitChange(state, {
    type: 'mod-obj',
    operations,
    'page-id': pageId,
    id: shapeId,
  });
}

export function addGuide(state, guide) {
  const newGuide = { ...guide };
  if (newGuide.id == null) {
    newGuide.id = uuid.next();
  }
  const pageId = state['::current-page-id'];
  let newState = commitChange(state, {
    type: 'set-guide',
    'page-id': pageId,
    id: newGuide.id,
    params: newGuide,
  });
  newState = { ...newState, '::last-id': newGuide.id };
  return newState;
}

export function deleteGuide(state, id) {
  const pageId = state['::current-page-id'];
  return commitChange(state, {
    type: 'set-guide',
    'page-id': pageId,
    id,
    params: null,
  });
}

export function updateGuide(state, guide) {
  const pageId = state['::current-page-id'];
  return commitChange(state, {
    type: 'set-guide',
    'page-id': pageId,
    id: guide.id,
    params: guide,
  });
}

export function addFileMedia(state, params, { mtype, size, blob } = {}) {
  const mediaId = uuid.next();
  const fileId = state['::current-file-id'];
  const id = defaultUuid(params.id);
  const { name, width, height } = params;

  let newState = { ...state };

  newState = {
    ...newState,
    '::blobs': {
      ...newState['::blobs'],
      [mediaId]: { mtype, size, blob },
    },
    '::media': {
      ...newState['::media'],
      [mediaId]: {
        id: mediaId,
        bucket: 'file-media-object',
        'content-type': mtype,
        size,
      },
    },
    '::file-media': {
      ...newState['::file-media'],
      [id]: {
        id,
        'created-at': Date.now(),
        name,
        width,
        height,
        'file-id': fileId,
        'media-id': mediaId,
        'is-local': true,
        mtype,
      },
    },
  };

  newState = { ...newState, '::last-id': id };
  return newState;
}