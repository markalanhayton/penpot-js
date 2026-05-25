import { version as defaultVersion } from './defaults.js';
import * as d from '../data.js';
import * as cfh from './helpers.js';
import * as cpc from './changes.js';
import * as ctk from '../types/component.js';
import * as ctn from '../types/container.js';
import * as ctf from '../types/file.js';
import * as cts from '../types/shape_type.js';
import * as typesColor from '../types/color.js';
import * as typesFills from '../types/fills.js';
import * as typesText from '../types/text.js';
import * as ctss from '../types/shape/shadow.js';
import * as ctsi from '../types/shape/interactions.js';
import * as ctst from '../types/shape/text.js';
import * as path from '../types/path.js';
import * as pathSegment from '../types/path/segment.js';
import * as gmt from '../geom/matrix.js';
import * as gpt from '../geom/point.js';
import * as grc from '../geom/rect.js';
import * as gsh from '../geom/shapes/shapes.js';
import * as gsht from '../geom/shapes/text.js';
import * as mth from '../math.js';
import * as csvg from '../svg.js';
import * as uuid from '../uuid.js';
import * as cfcp from './comp_processors.js';
import * as ctob from '../types/tokens_lib.js';
import * as cfeat from '../features.js';

export const version = defaultVersion;

export const availableMigrations = new Set();

export function needMigrationQ(file) {
  return file.version == null
    || file.version !== defaultVersion
    || hasMissingMigrations(file);
}

function hasMissingMigrations(file) {
  const fileMigrations = file.migrations ?? new Set();
  for (const m of availableMigrations) {
    if (!fileMigrations.has(m)) return true;
  }
  return false;
}

function difference(setA, setB) {
  const result = new Set();
  for (const item of setA) {
    if (!setB.has(item)) result.add(item);
  }
  return result;
}

function union(setA, setB) {
  const result = new Set(setA);
  for (const item of setB) result.add(item);
  return result;
}

function updateVals(obj, fn) {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = fn(v);
  }
  return result;
}

function updateObjectsInData(data, updateObjectFn) {
  return {
    ...data,
    pagesIndex: updateVals(data.pagesIndex, (page) =>
      d.updateWhen(page, 'objects', (objects) => updateVals(objects, updateObjectFn))
    ),
  };
}

function updateObjectsInDataAndComponents(data, updateObjectFn) {
  let result = {
    ...data,
    pagesIndex: updateVals(data.pagesIndex, (page) =>
      d.updateWhen(page, 'objects', (objects) => updateVals(objects, updateObjectFn))
    ),
  };
  result = d.updateWhen(result, 'components', (components) =>
    updateVals(components, (component) =>
      d.updateWhen(component, 'objects', (objects) => updateVals(objects, updateObjectFn))
    )
  );
  return result;
}

function updatePagesInData(data, updatePageFn) {
  return {
    ...data,
    pagesIndex: updateVals(data.pagesIndex, updatePageFn),
  };
}

function cleanEmptyGroups(objects) {
  let deleted = new Set();
  let changed = true;
  let iterations = 0;
  let currentObjects = { ...objects };

  while (changed && iterations < 1000) {
    changed = false;
    iterations++;
    const newDeleted = new Set();

    for (const [id, obj] of Object.entries(currentObjects)) {
      if (obj.type === 'group') {
        const shapes = obj.shapes ?? [];
        if (shapes.length === 0 || shapes.every((sid) => !currentObjects[sid])) {
          newDeleted.add(id);
        }
      }
    }

    if (newDeleted.size > 0) {
      changed = true;
      for (const id of newDeleted) {
        delete currentObjects[id];
        deleted.add(id);
      }
    }
  }

  for (const [id, obj] of Object.entries(currentObjects)) {
    if (obj.shapes) {
      currentObjects[id] = {
        ...obj,
        shapes: obj.shapes.filter((sid) => !deleted.has(sid)),
      };
    }
  }

  return currentObjects;
}

function validFillQ(fill) {
  return fill != null
    && fill['fill-color'] != null
    && fill['fill-opacity'] != null;
}

function validShadowQ(shadow) {
  return shadow != null
    && typeof shadow['offset-x'] === 'number'
    && typeof shadow['offset-y'] === 'number'
    && typeof shadow['blur'] === 'number'
    && typeof shadow['spread'] === 'number';
}

function validInteractionQ(interaction) {
  return interaction != null
    && interaction['event-type'] != null
    && interaction['action-type'] != null;
}

function validLibraryColorQ(color) {
  return color != null && typesColor.hasValidColorAttrs(color);
}

function fixGradientType(gradient) {
  if (gradient == null) return undefined;
  if (typeof gradient.type === 'string') {
    return { ...gradient, type: gradient.type };
  }
  return gradient;
}

function numberToString(v) {
  return typeof v === 'number' ? String(v) : v;
}

function blankOrEmptyQ(v) {
  return v == null || (typeof v === 'string' && (v === '' || v.trim() === ''));
}

function defaultTextAttrValue(attr) {
  const defaults = typesText.defaultTextAttrs;
  if (attr === 'direction') return defaults['text-direction'];
  return defaults[attr];
}

const migrationRegistry = {};

export function registerMigration(id, fn) {
  migrationRegistry[id] = fn;
  availableMigrations.add(id);
}

// --- Migration definitions ---

function migrateLegacy2(data) {
  function updateObject(object) {
    return d.updateWhen(object, 'shapes', (shapes) =>
      Array.isArray(shapes) ? shapes : Array.from(shapes)
    );
  }

  function updatePage(page) {
    return d.updateWhen(page, 'objects', (objects) => updateVals(objects, updateObject));
  }

  return d.updateWhen(data, 'pagesIndex', (pi) => updateVals(pi, updatePage));
}

function migrateLegacy3(data) {
  function migratePath(shape) {
    if (shape.content == null && shape.segments != null) {
      const content = pathSegment.pointsToContent(shape.segments, { close: shape.close });
      const selrect = path.contentToSelrect ? path.contentToSelrect(content) : grc.makeRect(0, 0, 0, 0);
      const points = grc.rectToPoints(selrect);
      const result = { ...shape };
      delete result.segments;
      delete result.close;
      result.content = content;
      result.selrect = selrect;
      result.points = points;
      return result;
    }
    return shape;
  }

  function fixFramesSelrects(frame) {
    if (frame.id === uuid.zero) return frame;
    const selrect = gsh.shapeToRect(frame);
    return { ...frame, selrect, points: grc.rectToPoints(selrect) };
  }

  function fixEmptyPoints(shape) {
    if (shape.points && shape.points.length === 0 && shape.id !== uuid.zero) {
      const selrect = shape.selrect && typeof shape.selrect === 'object'
        ? grc.makeRect(shape.selrect)
        : shape.selrect;
      return cts.setupShape({ ...shape, selrect });
    }
    return shape;
  }

  function updateObject(object) {
    let result = object;
    if (result.type === 'curve') {
      result = { ...result, type: 'path' };
    }
    if (result.type === 'path') {
      result = migratePath(result);
    }
    if (cfh.frameShapeQ(result)) {
      result = fixFramesSelrects(result);
    }
    if ((result.points == null || result.points.length === 0) && result.id !== uuid.zero) {
      result = fixEmptyPoints(result);
    }
    return result;
  }

  function updatePage(page) {
    return d.updateWhen(page, 'objects', (objects) => updateVals(objects, updateObject));
  }

  return d.updateWhen(data, 'pagesIndex', (pi) => updateVals(pi, updatePage));
}

function migrateLegacy5(data) {
  function updateObject(object) {
    if (object['component-id'] != null && object['component-file'] == null) {
      return { ...object, 'component-file': data.id };
    }
    return object;
  }

  function updatePage(page) {
    return d.updateWhen(page, 'objects', (objects) => updateVals(objects, updateObject));
  }

  return d.updateWhen(data, 'pagesIndex', (pi) => updateVals(pi, updatePage));
}

function migrateLegacy6(data) {
  function fixLinePaths(shape) {
    if (shape.type !== 'path') return shape;
    const rect = grc.pointsToRect(shape.points);
    if (rect && (mth.almostZero(rect.width) || mth.almostZero(rect.height))) {
      const selrect = path.contentToSelrect ? path.contentToSelrect(shape.content) : grc.makeRect(0, 0, 0, 0);
      const points = grc.rectToPoints(selrect);
      return {
        ...shape,
        selrect,
        points,
        transform: gmt.matrix(),
        'transform-inverse': gmt.matrix(),
      };
    }
    return shape;
  }

  function updateContainer(container) {
    return d.updateWhen(container, 'objects', (objects) => updateVals(objects, fixLinePaths));
  }

  let result = d.updateWhen(data, 'pagesIndex', (pi) => updateVals(pi, updateContainer));
  result = d.updateWhen(result, 'components', (components) => updateVals(components, updateContainer));
  return result;
}

function migrateLegacy7(data) {
  function updateObject(page, object) {
    if (object.interactions) {
      const filtered = object.interactions.filter((interaction) => {
        return interaction.destination && page.objects[interaction.destination];
      });
      if (filtered.length !== object.interactions.length) {
        return { ...object, interactions: filtered };
      }
    }
    return object;
  }

  function updatePage(page) {
    return d.updateWhen(page, 'objects', (objects) => {
      const result = {};
      for (const [id, obj] of Object.entries(objects)) {
        result[id] = updateObject(page, obj);
      }
      return result;
    });
  }

  return d.updateWhen(data, 'pagesIndex', (pi) => updateVals(pi, updatePage));
}

function migrateLegacy8(data) {
  function objIsEmpty(obj) {
    return obj.type === 'group' &&
      (obj.shapes == null || obj.shapes.length === 0 || obj.selrect == null);
  }

  function updateContainer(container) {
    const objects = cleanEmptyGroups(container.objects ?? {});
    return { ...container, objects: d.withoutNils(objects) };
  }

  let result = d.updateWhen(data, 'pagesIndex', (pi) => updateVals(pi, updateContainer));
  result = d.updateWhen(result, 'components', (components) => updateVals(components, updateContainer));
  return result;
}

function migrateLegacy9(data) {
  function findEmptyGroups(objects) {
    return Object.values(objects).filter((shape) =>
      shape.type === 'group' &&
      (shape.shapes == null || shape.shapes.length === 0 ||
       shape.shapes.every((id) => !objects[id]))
    ).map((s) => s.id);
  }

  function calculateChanges(pagesIndex) {
    const changes = [];
    for (const [pageId, page] of Object.entries(pagesIndex)) {
      const eids = findEmptyGroups(page.objects);
      for (const id of eids) {
        changes.push({ type: 'del-obj', 'page-id': pageId, id });
      }
    }
    return changes;
  }

  let current = data;
  let changes = calculateChanges(current.pagesIndex);
  while (changes.length > 0) {
    current = cpc.processChanges(current, changes);
    changes = calculateChanges(current.pagesIndex);
  }
  return current;
}

function migrateLegacy10(data) {
  function updatePage(page) {
    return d.updateInWhen(page, ['objects', uuid.zero], (root) => {
      const result = { ...root };
      delete result.points;
      delete result.selrect;
      return result;
    });
  }

  return d.updateWhen(data, 'pagesIndex', (pi) => updateVals(pi, updatePage));
}

function migrateLegacy11(data) {
  function updateObject(objects, shape) {
    if (cfh.frameShapeQ(shape) && shape.shapes) {
      const filtered = shape.shapes.filter((id) => objects[id] != null);
      if (filtered.length !== shape.shapes.length) {
        return { ...shape, shapes: filtered };
      }
    }
    return shape;
  }

  function updatePage(page) {
    const objects = page.objects;
    return {
      ...page,
      objects: updateVals(objects, (shape) => updateObject(objects, shape)),
    };
  }

  return d.updateWhen(data, 'pagesIndex', (pi) => updateVals(pi, updatePage));
}

function migrateLegacy12(data) {
  function updateGrid(grid) {
    if (grid.size === 'auto' || grid.size == null) {
      const result = { ...grid };
      delete result.size;
      return result;
    }
    return grid;
  }

  function updatePage(page) {
    return d.updateInWhen(page, ['options', 'saved-grids'], (grids) =>
      grids.map(updateGrid)
    );
  }

  return d.updateWhen(data, 'pagesIndex', (pi) => updateVals(pi, updatePage));
}

function migrateLegacy13(data) {
  function fixRadius(shape) {
    if (shape.rx == null && shape.r1 == null && cfh.imageShapeQ(shape)) {
      return { ...shape, rx: 0, ry: 0 };
    }
    return shape;
  }

  return updateObjectsInDataAndComponents(data, fixRadius);
}

function migrateLegacy14(data) {
  function processShape(shape) {
    if (!cfh.imageShapeQ(shape)) return shape;
    const fillColor = (shape['fill-color'] ?? '').toUpperCase();
    const fillOpacity = shape['fill-opacity'];

    if (fillOpacity === 1 && (fillColor === '#B1B2B5' || fillColor === '#7B7D85')) {
      const result = { ...shape };
      delete result['fill-color'];
      delete result['fill-opacity'];

      if (shape['frame-id'] != null) {
        return { ...result, 'frame-id': shape['frame-id'] };
      }
      return result;
    }
    return shape;
  }

  function updateContainer(container) {
    let objects = { ...container.objects };
    const shapes = Object.values(objects).filter(cfh.imageShapeQ);
    for (const shape of shapes) {
      const processed = processShape(shape);
      if (processed !== shape) {
        objects[shape.id] = processed;
        if (shape['frame-id'] && objects[shape['frame-id']]) {
          objects[shape['frame-id']] = { ...objects[shape['frame-id']] };
          delete objects[shape['frame-id']].thumbnail;
        }
      }
    }
    return { ...container, objects: d.withoutNils(objects) };
  }

  let result = d.updateWhen(data, 'pagesIndex', (pi) => updateVals(pi, updateContainer));
  result = d.updateWhen(result, 'components', (components) => updateVals(components, updateContainer));
  return result;
}

function migrateLegacy16(data) {
  function assignFills(shape) {
    const attrs = {
      'fill-color': shape['fill-color'],
      'fill-color-gradient': shape['fill-color-gradient'],
      'fill-color-ref-file': shape['fill-color-ref-file'],
      'fill-color-ref-id': shape['fill-color-ref-id'],
      'fill-opacity': shape['fill-opacity'],
    };
    const cleanAttrs = d.withoutNils(attrs);
    if (d.notEmpty(cleanAttrs)) {
      return { ...shape, fills: [cleanAttrs] };
    }
    return shape;
  }

  function assignStrokes(shape) {
    const attrs = {
      'stroke-style': shape['stroke-style'],
      'stroke-alignment': shape['stroke-alignment'],
      'stroke-width': shape['stroke-width'],
      'stroke-color': shape['stroke-color'],
      'stroke-color-ref-id': shape['stroke-color-ref-id'],
      'stroke-color-ref-file': shape['stroke-color-ref-file'],
      'stroke-opacity': shape['stroke-opacity'],
      'stroke-color-gradient': shape['stroke-color-gradient'],
      'stroke-cap-start': shape['stroke-cap-start'],
      'stroke-cap-end': shape['stroke-cap-end'],
    };
    const cleanAttrs = d.withoutNils(attrs);
    if (d.notEmpty(cleanAttrs)) {
      return { ...shape, strokes: [cleanAttrs] };
    }
    return shape;
  }

  function updateObject(object) {
    let result = object;
    if (!cfh.textShapeQ(result) && !('strokes' in result)) {
      result = assignStrokes(result);
    }
    if (!cfh.textShapeQ(result) && !('fills' in result)) {
      result = assignFills(result);
    }
    return result;
  }

  return updateObjectsInDataAndComponents(data, updateObject);
}

function migrateLegacy17(data) {
  function affectedObjectQ(object) {
    if (!cfh.imageShapeQ(object)) return false;
    if (object.fills == null || object.fills.length !== 1) return false;
    const fill = object.fills[0];
    if (fill['fill-color'] == null || fill['fill-opacity'] == null) return false;
    const colorOld = (object['fill-color'] ?? '').toUpperCase();
    const colorNew = (fill['fill-color'] ?? '').toUpperCase();
    return colorOld === colorNew &&
      (colorOld === '#B1B2B5' || colorOld === '#7B7D85') &&
      object['fill-opacity'] === 1 && fill['fill-opacity'] === 1;
  }

  function updateObject(object) {
    if (affectedObjectQ(object)) {
      return { ...object, fills: [] };
    }
    return object;
  }

  return updateObjectsInDataAndComponents(data, updateObject);
}

function migrateLegacy18(data) {
  function updateObject(object) {
    if (cfh.textShapeQ(object)) {
      const result = { ...object };
      delete result['position-data'];
      return result;
    }
    return object;
  }

  return updateObjectsInDataAndComponents(data, updateObject);
}

function migrateLegacy19(data) {
  function updateObject(object) {
    if (cfh.textShapeQ(object) &&
        d.notEmpty(object['position-data']) &&
        !gsht.overlapsPositionDataQ(object, object['position-data'])) {
      const result = { ...object };
      delete result['position-data'];
      return result;
    }
    return object;
  }

  return updateObjectsInDataAndComponents(data, updateObject);
}

function migrateLegacy25(data) {
  function updateObject(object) {
    if (cfh.rootQ(object)) return object;
    return cts.setupShape({ ...object, selrect: grc.makeRect(object.selrect) });
  }

  return updateObjectsInDataAndComponents(data, updateObject);
}

function migrateLegacy26(data) {
  function updateObject(object) {
    let result = object;
    if (result.transform == null) {
      result = { ...result, transform: gmt.matrix() };
    }
    if (result['transform-inverse'] == null) {
      result = { ...result, 'transform-inverse': gmt.matrix() };
    }
    return result;
  }

  return updateObjectsInDataAndComponents(data, updateObject);
}

function migrateLegacy27(data) {
  function updateObject(object) {
    let result = object;
    if ('main-instance?' in result) {
      result = { ...result, 'main-instance': result['main-instance?'] };
      delete result['main-instance?'];
    }
    if ('component-root?' in result) {
      result = { ...result, 'component-root': result['component-root?'] };
      delete result['component-root?'];
    }
    if ('remote-synced?' in result) {
      result = { ...result, 'remote-synced': result['remote-synced?'] };
      delete result['remote-synced?'];
    }
    if ('masked-group?' in result) {
      result = { ...result, 'masked-group': result['masked-group?'] };
      delete result['masked-group?'];
    }
    if ('saved-component-root?' in result) {
      result = { ...result, 'saved-component-root': result['saved-component-root?'] };
      delete result['saved-component-root?'];
    }
    return result;
  }

  return updateObjectsInDataAndComponents(data, updateObject);
}

function migrateLegacy28(data) {
  function updateObject(objects, object) {
    const frameId = object['frame-id'];
    const parentIds = cfh.getParentIds(objects, object.id);
    const calculatedFrameId = (() => {
      for (const pid of parentIds) {
        const parent = objects[pid];
        if (parent && cfh.frameShapeQ(parent)) return parent.id;
      }
      return frameId;
    })();
    if (calculatedFrameId !== frameId) {
      return { ...object, 'frame-id': calculatedFrameId };
    }
    return object;
  }

  function updateContainer(container) {
    const objects = container.objects;
    return d.updateWhen(container, 'objects', (objs) =>
      updateVals(objs, (obj) => updateObject(objs, obj))
    );
  }

  let result = d.updateWhen(data, 'pagesIndex', (pi) => updateVals(pi, updateContainer));
  result = d.updateWhen(result, 'components', (components) => updateVals(components, updateContainer));
  return result;
}

function migrateLegacy29(data) {
  function validRefQ(ref) {
    return typeof ref === 'string' && ref.length > 0;
  }

  function fixRef(ref) {
    return validRefQ(ref) ? ref : null;
  }

  function fixNode(node) {
    let result = node;
    result = d.updateWhen(result, 'typography-ref-file', fixRef);
    result = d.updateWhen(result, 'typography-ref-id', fixRef);
    result = d.updateWhen(result, 'fill-color-ref-file', fixRef);
    result = d.updateWhen(result, 'fill-color-ref-id', fixRef);
    return result;
  }

  function updateObject(object) {
    if (cfh.textShapeQ(object)) {
      return {
        ...object,
        content: typesText.transformNodes(
          (node) => !validRefQ(node['typography-ref-file']) || !validRefQ(node['fill-color-ref-file']) || !validRefQ(node['typography-ref-id']) || !validRefQ(node['fill-color-ref-id']),
          fixNode,
          object.content
        ),
      };
    }
    return object;
  }

  return updateObjectsInDataAndComponents(data, updateObject);
}

function migrateLegacy31(data) {
  function updateObject(object) {
    if ('use-for-thumbnail?' in object) {
      let result = { ...object, 'use-for-thumbnail': object['use-for-thumbnail?'] };
      delete result['use-for-thumbnail?'];
      return result;
    }
    return object;
  }

  return updateObjectsInDataAndComponents(data, updateObject);
}

function migrateLegacy32(data) {
  function updateObject(object) {
    let result = object;
    if (result['svg-attrs'] != null) {
      result = { ...result, 'svg-attrs': csvg.attrsToProps(result['svg-attrs']) };
    }
    if (result['svg-viewbox'] != null) {
      result = { ...result, 'svg-viewbox': grc.makeRect(result['svg-viewbox']) };
    }
    return result;
  }

  return updateObjectsInDataAndComponents(data, updateObject);
}

function migrateLegacy33(data) {
  function updateObject(object) {
    if (object.id === uuid.zero) {
      let result = { ...object };
      result['parent-id'] = uuid.zero;
      result['frame-id'] = uuid.zero;
      delete result.selrect;
      delete result.points;
      return cts.setupShape(result);
    }
    return object;
  }

  function updateContainer(container) {
    return d.updateWhen(container, 'objects', (objects) => updateVals(objects, updateObject));
  }

  let result = d.updateWhen(data, 'pagesIndex', (pi) => updateVals(pi, updateContainer));
  return result;
}

function migrateLegacy34(data) {
  function updateObject(object) {
    if (cfh.pathShapeQ(object) || cfh.boolShapeQ(object)) {
      const result = { ...object };
      delete result.x;
      delete result.y;
      delete result.width;
      delete result.height;
      return result;
    }
    return object;
  }

  return updateObjectsInDataAndComponents(data, updateObject);
}

function migrateLegacy36(data) {
  function updateContainer(container) {
    return d.updateWhen(container, 'objects', (objects) => {
      if (objects && typeof objects === 'object' && null in objects) {
        const result = { ...objects };
        delete result[null];
        return result;
      }
      return objects;
    });
  }

  let result = d.updateWhen(data, 'pagesIndex', (pi) => updateVals(pi, updateContainer));
  result = d.updateWhen(result, 'components', (components) => updateVals(components, updateContainer));
  return result;
}

function migrateLegacy37(data) {
  return d.withoutNils(data);
}

function migrateLegacy38(data) {
  function fixGradient(gradient) {
    if (gradient == null) return undefined;
    if (typeof gradient.type === 'string') {
      return { ...gradient, type: gradient.type };
    }
    return gradient;
  }

  function updateFill(fill) {
    return d.updateWhen(fill, 'fill-color-gradient', fixGradient);
  }

  function updateObject(object) {
    let result = d.updateWhen(object, 'fills', (fills) => fills.map(updateFill));
    if (cfh.textShapeQ(result)) {
      result = {
        ...result,
        content: typesText.transformNodes(typesText.isContentNodeQ, updateFill, result.content),
      };
      result = d.updateWhen(result, 'position-data', (pd) => pd.map(updateFill));
    }
    return result;
  }

  return updateObjectsInDataAndComponents(data, updateObject);
}

function migrateLegacy39(data) {
  function updateShape(shape) {
    if (cfh.boolShapeQ(shape) && shape['bool-content'] == null && !('content' in shape)) {
      return { ...shape, 'bool-content': [] };
    }
    if (cfh.pathShapeQ(shape) && !('content' in shape)) {
      return { ...shape, content: [] };
    }
    return shape;
  }

  return updateObjectsInDataAndComponents(data, updateShape);
}

function migrateLegacy40(data) {
  function updateShape(shape) {
    if (cfh.frameShapeQ(shape) &&
        shape.selrect != null &&
        shape.content != null &&
        shape.content.length > 0 &&
        (shape.shapes == null || shape.shapes.length === 0) &&
        shape.content[0] != null &&
        shape.content[0].command != null) {
      const result = { ...shape, type: 'path' };
      result.x = null;
      result.y = null;
      result.width = null;
      result.height = null;
      return result;
    }
    return shape;
  }

  return updateObjectsInDataAndComponents(data, updateShape);
}

function migrateLegacy41(data) {
  function updateShape(shape) {
    if (cfh.boolShapeQ(shape) || cfh.pathShapeQ(shape)) return shape;

    if (shape.selrect != null &&
        (shape.x == null || shape.y == null || shape.width == null || shape.height == null)) {
      const selrect = shape.selrect;
      return {
        ...shape,
        x: selrect.x,
        y: selrect.y,
        width: selrect.width,
        height: selrect.height,
      };
    }
    return shape;
  }

  return updateObjectsInDataAndComponents(data, updateShape);
}

function migrateLegacy42(data) {
  function updateObject(object) {
    if ((cfh.frameShapeQ(object) || cfh.groupShapeQ(object) || cfh.boolShapeQ(object)) &&
        object.shapes == null) {
      return { ...object, shapes: [] };
    }
    return object;
  }

  return updateObjectsInDataAndComponents(data, updateObject);
}

function migrateLegacy43(data) {
  function updateTextNode(node) {
    let result = d.updateWhen(node, 'fills', (fills) => fills.filter(validFillQ));
    result = d.updateWhen(result, 'font-size', numberToString);
    result = d.updateWhen(result, 'font-weight', numberToString);
    result = d.withoutNils(result);
    return result;
  }

  function updateObject(object) {
    if (cfh.textShapeQ(object)) {
      return {
        ...object,
        content: typesText.transformNodes(typesText.isContentNodeQ, updateTextNode, object.content),
      };
    }
    return object;
  }

  return updateObjectsInDataAndComponents(data, updateObject);
}

function migrateLegacy44(data) {
  function fixShadow(shadow) {
    if (shadow == null) return null;
    const color = typeof shadow.color === 'string'
      ? { color: shadow.color, opacity: 1 }
      : d.withoutNils(shadow.color);
    return { ...shadow, color };
  }

  function updateObject(object) {
    if (object.shadow == null) return object;
    const fixed = object.shadow.map(fixShadow).filter(validShadowQ);
    return { ...object, shadow: fixed };
  }

  return updateObjectsInDataAndComponents(data, updateObject);
}

function migrateLegacy45(data) {
  function fixShape(shape) {
    const frameId = shape['frame-id'] || uuid.zero;
    const parentId = shape['parent-id'] || frameId;
    return { ...shape, 'frame-id': frameId, 'parent-id': parentId };
  }

  function updateContainer(container) {
    return d.updateWhen(container, 'objects', (objects) => updateVals(objects, fixShape));
  }

  return d.updateWhen(data, 'pagesIndex', (pi) => updateVals(pi, updateContainer));
}

function migrateLegacy46(data) {
  function updateObject(object) {
    if ('thumbnail' in object) {
      const result = { ...object };
      delete result.thumbnail;
      return result;
    }
    return object;
  }

  return updateObjectsInDataAndComponents(data, updateObject);
}

function migrateLegacy47(data) {
  // Note: This migration depends on ctf/findRefShape which is currently a stub in the JS port.
  // The migration still applies structural changes; swap-slot detection will be a no-op.
  function fixShape(page, shape) {
    const swapSlot = ctk.getSwapSlot(shape);
    if (swapSlot != null) {
      return ctk.removeSwapSlot(shape);
    }
    return shape;
  }

  function updatePage(page) {
    const objects = page.objects;
    return d.updateWhen(page, 'objects', (objs) =>
      updateVals(objs, (shape) => fixShape(page, shape))
    );
  }

  return d.updateWhen(data, 'pagesIndex', (pi) => updateVals(pi, updatePage));
}

function migrateLegacy48(data) {
  function fixShape(shape) {
    const swapSlot = ctk.getSwapSlot(shape);
    if (swapSlot != null && !ctk.subcopyHeadQ(shape)) {
      return ctk.removeSwapSlot(shape);
    }
    return shape;
  }

  function updatePage(page) {
    return d.updateWhen(page, 'objects', (objects) => updateVals(objects, fixShape));
  }

  return d.updateWhen(data, 'pagesIndex', (pi) => updateVals(pi, updatePage));
}

function migrateLegacy49(data) {
  function updateObject(destinations, object) {
    if (object.interactions || destinations.has(object.id)) {
      if ('hide-in-viewer' in object) {
        const result = { ...object };
        delete result['hide-in-viewer'];
        return result;
      }
    }
    return object;
  }

  function updatePage(page) {
    const destinations = new Set(
      Object.values(page.objects)
        .flatMap((obj) => obj.interactions ?? [])
        .map((i) => i.destination)
        .filter(Boolean)
    );

    return d.updateWhen(page, 'objects', (objects) =>
      updateVals(objects, (obj) => updateObject(destinations, obj))
    );
  }

  return d.updateWhen(data, 'pagesIndex', (pi) => updateVals(pi, updatePage));
}

function migrateLegacy50(data) {
  function updateSegment(segment) {
    if (segment.params == null || typeof segment.params !== 'object') return segment;
    const params = { ...segment.params };

    if (segment.command === 'curve-to' || segment.command === 'C') {
      if (params.c1x == null) params.c1x = params.x;
      if (params.c1y == null) params.c1y = params.y;
      if (params.c2x == null) params.c2x = params.x;
      if (params.c2y == null) params.c2y = params.y;
    }

    return { ...segment, params };
  }

  function updateShape(shape) {
    if (!cfh.pathShapeQ(shape)) return shape;
    return d.updateWhen(shape, 'content', (content) =>
      Array.isArray(content) ? content.map(updateSegment) : content
    );
  }

  function updateContainer(container) {
    return d.updateWhen(container, 'objects', (objects) => updateVals(objects, updateShape));
  }

  let result = d.updateWhen(data, 'pagesIndex', (pi) => updateVals(pi, updateContainer));
  result = d.updateWhen(result, 'components', (components) => updateVals(components, updateContainer));
  return result;
}

function migrateLegacy51(data) {
  function updateColors(colors) {
    const result = {};
    for (const [id, color] of Object.entries(colors)) {
      if (validLibraryColorQ(color)) {
        result[id] = color;
      }
    }
    return result;
  }

  return d.updateWhen(data, 'colors', updateColors);
}

function migrateLegacy52(data) {
  function updateShape(shape) {
    if (shape['layout-wrap-type'] === 'no-wrap') {
      return { ...shape, 'layout-wrap-type': 'nowrap' };
    }
    return shape;
  }

  return updatePagesInData(data, (page) =>
    d.updateWhen(page, 'objects', (objects) => updateVals(objects, updateShape))
  );
}

function migrateLegacy53(data) {
  return migrateLegacy26(data);
}

function migrateLegacy54(data) {
  function fixShadow(shadow) {
    if (shadow == null) return null;
    return { ...shadow, color: d.withoutNils(shadow.color) };
  }

  function updateShape(shape) {
    if (shape.shadow == null) return shape;
    const fixed = shape.shadow.map(fixShadow).filter(validShadowQ);
    return { ...shape, shadow: fixed };
  }

  return updateObjectsInDataAndComponents(data, updateShape);
}

function migrateLegacy55(data) {
  function updatePage(page) {
    let result = page;
    const options = result.options;

    if (options?.['saved-grids'] != null && !('default-grids' in result)) {
      result = { ...result, 'default-grids': options['saved-grids'] };
    }
    if (options?.background != null && !('background' in result)) {
      result = { ...result, background: options.background };
    }
    if (options?.flows != null && (!('flows' in result) || typeof result.flows !== 'object')) {
      result = { ...result, flows: d.indexBy(options.flows, (f) => f.id) };
    }
    if (options?.guides != null && !('guides' in result)) {
      result = { ...result, guides: options.guides };
    }
    if (options?.['comment-threads-position'] != null && !('comment-thread-positions' in result)) {
      result = { ...result, 'comment-thread-positions': options['comment-threads-position'] };
    }

    return result;
  }

  return d.updateWhen(data, 'pagesIndex', (pi) => updateVals(pi, updatePage));
}

function migrateLegacy56(data) {
  function fixFills(object) {
    return d.updateWhen(object, 'fills', (fills) => fills.filter(validFillQ));
  }

  function updateObject(object) {
    let result = fixFills(object);

    if ('shape-ref' in result && result['shape-ref'] == null) {
      delete result['shape-ref'];
      result = { ...result };
    }

    if (cfh.textShapeQ(result)) {
      result = {
        ...result,
        content: typesText.transformNodes(typesText.isContentNodeQ, fixFills, result.content),
      };
    }

    return result;
  }

  return updateObjectsInDataAndComponents(data, updateObject);
}

function migrateLegacy57(data) {
  function fixThreadPositions(positions) {
    if (positions == null) return positions;
    const result = {};
    for (const [id, data] of Object.entries(positions)) {
      if (data.position != null) {
        if (gpt.isPoint(data.position)) {
          result[id] = data;
        } else if (typeof data.position === 'object') {
          result[id] = { ...data, position: gpt.point(data.position) };
        } else {
          result[id] = { ...data, position: gpt.point(0, 0) };
        }
      } else {
        result[id] = { ...data, position: gpt.point(0, 0) };
      }
    }
    return result;
  }

  function updatePage(page) {
    return d.updateWhen(page, 'comment-thread-positions', fixThreadPositions);
  }

  let result = { ...data };
  if (result.pages) {
    result.pages = result.pages.filter((p) => p != null);
  }
  result = d.updateWhen(result, 'pagesIndex', (pi) => {
    const cleaned = { ...pi };
    delete cleaned[null];
    return updateVals(cleaned, updatePage);
  });
  return result;
}

function migrateLegacy59(data) {
  function fixTouched(elem) {
    if (typeof elem === 'string') return elem;
    return elem;
  }

  function updateShape(shape) {
    return d.updateWhen(shape, 'touched', (touched) => {
      if (touched instanceof Set) {
        return new Set([...touched].map(fixTouched));
      }
      if (Array.isArray(touched)) {
        return new Set(touched.map(fixTouched));
      }
      return touched;
    });
  }

  return updateObjectsInDataAndComponents(data, updateShape);
}

function migrateLegacy62(data) {
  function removeCycles(objects) {
    const cycleIds = new Set(
      Object.values(objects)
        .filter((s) => s.id === s['shape-ref'])
        .map((s) => s.id)
    );

    if (cycleIds.size === 0) return objects;

    const toDetach = new Set();
    for (const cid of cycleIds) {
      const shape = objects[cid];
      if (shape == null) continue;
      const head = ctn.getHeadShape(objects, shape);
      if (head) {
        const children = ctn.getChildrenInInstance(objects, head.id);
        for (const child of children) {
          toDetach.add(child.id);
        }
      }
    }

    const result = { ...objects };
    for (const id of toDetach) {
      if (result[id]) {
        result[id] = ctk.detachShape(result[id]);
      }
    }
    return result;
  }

  return d.updateWhen(data, 'components', (components) =>
    updateVals(components, (component) =>
      d.updateWhen(component, 'objects', removeCycles)
    )
  );
}

function migrateLegacy65(data) {
  function updateObject(object) {
    return d.updateWhen(object, 'plugin-data', (pd) => d.withoutNils(pd));
  }

  function updatePage(page) {
    return updateObject(d.updateWhen(page, 'objects', (objects) => updateVals(objects, updateObject)));
  }

  let result = updateObject(data);
  result = d.updateWhen(result, 'pagesIndex', (pi) => updateVals(pi, updatePage));
  result = d.updateWhen(result, 'colors', (colors) => updateVals(colors, updateObject));
  result = d.updateWhen(result, 'typographies', (typographies) => updateVals(typographies, updateObject));
  result = d.updateWhen(result, 'components', (components) => updateVals(components, updateObject));
  return result;
}

function migrateLegacy66(data) {
  function updateObject(object) {
    if (object.rx != null) {
      return {
        ...object,
        r1: object.rx,
        r2: object.rx,
        r3: object.rx,
        r4: object.rx,
      };
    }
    return object;
  }

  return updateObjectsInDataAndComponents(data, updateObject);
}

function migrateLegacy67(data) {
  function updateObject(object) {
    return d.updateWhen(object, 'shadow', (shadow) =>
      Array.isArray(shadow) ? [...shadow].reverse() : shadow
    );
  }

  return updateObjectsInDataAndComponents(data, updateObject);
}

// Named format migrations (not legacy-NN)

function migrate0001(data) {
  function updateObject(object) {
    let result = object;
    if (object.type === 'group' && object['applied-tokens']?.fill != null) {
      result = { ...result, fills: [] };
    }
    if (object.type === 'group' && 'applied-tokens' in object) {
      const { 'applied-tokens': _, ...rest } = result;
      result = rest;
    }
    return result;
  }

  return updatePagesInData(data, (page) =>
    d.updateWhen(page, 'objects', (objects) => updateVals(objects, updateObject))
  );
}

function migrate0002Clean(data) {
  function updateObject(object) {
    return d.updateWhen(object, 'interactions', (interactions) =>
      interactions.filter(validInteractionQ)
    );
  }

  return updateObjectsInDataAndComponents(data, updateObject);
}

function migrate0002NormalizeBool(data) {
  function updateObject(object) {
    if (!cfh.boolShapeQ(object)) {
      const result = { ...object };
      delete result['bool-content'];
      delete result['bool-type'];
      return result;
    }
    if ('content' in object) {
      const result = { ...object };
      delete result['bool-content'];
      return result;
    }
    const content = object['bool-content'] ?? [];
    const result = { ...object, content };
    delete result['bool-content'];
    return result;
  }

  return updateObjectsInDataAndComponents(data, updateObject);
}

function migrate0003FixRoot(data) {
  function updateObject(shape) {
    if (shape.id === uuid.zero) {
      let result = { ...shape };
      result['parent-id'] = uuid.zero;
      result['frame-id'] = uuid.zero;
      delete result.selrect;
      delete result.points;
      return cts.setupShape(result);
    }
    return shape;
  }

  let result = d.updateWhen(data, 'pagesIndex', (pi) =>
    updateVals(pi, (page) =>
      d.updateWhen(page, 'objects', (objects) => updateVals(objects, updateObject))
    )
  );
  result = d.updateWhen(result, 'components', (components) =>
    updateVals(components, (component) =>
      d.updateWhen(component, 'objects', (objects) => updateVals(objects, updateObject))
    )
  );
  return d.withoutNils(result);
}

function migrate0003ConvertPath(data) {
  function updateObject(object) {
    if (cfh.boolShapeQ(object) || cfh.pathShapeQ(object)) {
      let content = object.content;
      if (path.contentQ(content)) {
        // Already in new format
      } else if (content == null) {
        content = path.content([]);
      } else if (Array.isArray(content)) {
        content = path.content(content);
      }
      return { ...object, content };
    }
    return object;
  }

  return updateObjectsInDataAndComponents(data, updateObject);
}

function migrate0005DeprecateImage(data) {
  function updateObject(object) {
    if (!cfh.imageShapeQ(object)) return object;
    const metadata = object.metadata;
    const fills = [{ 'fill-image': { ...metadata, 'keep-aspect-ratio': false }, opacity: 1 }, ...(object.fills ?? [])];
    let result = { ...object, fills, type: 'rect' };
    delete result.metadata;
    return result;
  }

  return updateObjectsInDataAndComponents(data, updateObject);
}

function migrate0006(data) {
  function fixFills(node) {
    const sanitizeUUID = (o) => (typeof o === 'string' && o.length > 0) ? o : null;
    if ((node.fills == null || node.fills.length === 0) &&
        (node['fill-color'] != null || node['fill-opacity'] != null || node['fill-color-gradient'] != null)) {
      const fill = d.withoutNils({
        'fill-color': node['fill-color'],
        'fill-color-gradient': node['fill-color-gradient'],
        'fill-color-ref-file': sanitizeUUID(node['fill-color-ref-file']),
        'fill-color-ref-id': sanitizeUUID(node['fill-color-ref-id']),
        'fill-opacity': node['fill-opacity'],
      });
      let result = { ...node, fills: [fill] };
      for (const attr of typesFills.FILL_ATTRS) {
        delete result[attr];
      }
      return result;
    }
    return node;
  }

  function updateObject(object) {
    if (cfh.textShapeQ(object)) {
      return {
        ...object,
        content: typesText.transformNodes(typesText.isContentNodeQ, fixFills, object.content),
      };
    }
    return object;
  }

  return updateObjectsInDataAndComponents(data, updateObject);
}

function migrate0008(data) {
  function clearColorOpacity(color) {
    if ('opacity' in color && color.opacity == null) {
      return { ...color, opacity: 1 };
    }
    return color;
  }

  function clearColor(color) {
    let result = d.selectKeys(color, [...typesColor.LIBRARY_COLOR_ATTRS]);
    result = clearColorOpacity(result);
    result = d.withoutNils(result);
    return result;
  }

  return d.updateWhen(data, 'colors', (colors) => updateVals(colors, clearColor));
}

function migrate0009Clean(data) {
  return d.updateWhen(data, 'colors', (colors) => {
    const result = {};
    for (const [id, color] of Object.entries(colors)) {
      if (validLibraryColorQ(color)) {
        result[id] = color;
      }
    }
    return result;
  });
}

function migrate0009Touched(data) {
  // Note: depends on ctf/findRefShape which is a stub. Partial implementation.
  function updateObject(page, object) {
    if (!cfh.textShapeQ(object) || !ctk.inComponentCopyQ(object)) return object;
    // Full implementation requires findRefShape — skip if unavailable
    return object;
  }

  return updatePagesInData(data, (page) =>
    d.updateWhen(page, 'objects', (objects) => {
      const result = {};
      for (const [id, obj] of Object.entries(objects)) {
        result[id] = updateObject(page, obj);
      }
      return result;
    })
  );
}

function migrate0010(data) {
  function fixShape(page, shape) {
    const swapSlot = ctk.getSwapSlot(shape);
    if (swapSlot != null) {
      // ctf/findRefIdForSwapped is currently stubbed — remove swap slot if we can't resolve
      return ctk.removeSwapSlot(shape);
    }
    return shape;
  }

  return updatePagesInData(data, (page) =>
    d.updateWhen(page, 'objects', (objects) => updateVals(objects, (shape) => fixShape(page, shape)))
  );
}

function migrate0011(data) {
  function fixShape(shape) {
    const touchedGroups = ctk.normalTouchedGroups(shape);
    if (touchedGroups == null) return shape;
    const contentTouched = touchedGroups.has('content-group');
    const textTouched = touchedGroups.has('text-content-text') ||
                        touchedGroups.has('text-content-attribute') ||
                        touchedGroups.has('text-content-structure');
    if (textTouched && !contentTouched) {
      return ctk.setTouchedGroup(shape, 'content-group');
    }
    return shape;
  }

  return updatePagesInData(data, (page) =>
    d.updateWhen(page, 'objects', (objects) => updateVals(objects, fixShape))
  );
}

function migrate0012(data) {
  function updateObject(object) {
    if (cfh.textShapeQ(object) && object['position-data']) {
      // Decode position-data to ensure proper format
      // The JS port stores position-data as plain arrays already
      return object;
    }
    return object;
  }

  return updateObjectsInDataAndComponents(data, updateObject);
}

function migrate0013FixPath(data) {
  return d.updateWhen(data, 'components', (components) =>
    updateVals(components, (component) =>
      d.updateWhen(component, 'path', (p) => d.nilv(p, ''))
    )
  );
}

function migrate0013ClearStrokesAndFills(data) {
  function clearColorImage(image) {
    return d.selectKeys(image, [...typesColor.IMAGE_ATTRS]);
  }

  function clearColorGradient(gradient) {
    return d.selectKeys(gradient, [...typesColor.GRADIENT_ATTRS]);
  }

  function clearStroke(stroke) {
    let result = d.selectKeys(stroke, [...cts.STROKE_ATTRS]);
    result = d.updateWhen(result, 'stroke-color-gradient', clearColorGradient);
    result = d.updateWhen(result, 'stroke-image', clearColorImage);
    result = d.updateWhen(result, 'stroke-style', (s) =>
      (s === 'svg' || s === 'none') ? 'solid' : s
    );
    return result;
  }

  function fixStrokes(strokes) {
    return strokes.map(clearStroke).filter((s) => s != null);
  }

  function removeNestedFills(fills) {
    if (fills.length === 1 && fills[0].fills != null) {
      return fills[0].fills;
    }
    return fills;
  }

  function clearFill(fill) {
    let result = d.selectKeys(fill, [...typesFills.FILL_ATTRS]);
    result = d.updateWhen(result, 'fill-image', clearColorImage);
    result = d.updateWhen(result, 'fill-color-gradient', clearColorGradient);
    return result;
  }

  function fixFills(fills) {
    const unnested = removeNestedFills(fills);
    return unnested.map(clearFill).filter(validFillQ);
  }

  function fixObject(object) {
    let result = d.updateWhen(object, 'strokes', fixStrokes);
    result = d.updateWhen(result, 'fills', fixFills);
    return result;
  }

  function fixTextContent(content) {
    content = typesText.transformNodes(typesText.isContentNodeQ, fixObject, content);
    content = typesText.transformNodes(typesText.isParagraphSetNodeQ, (node) => {
      const { fills, ...rest } = node;
      return rest;
    }, content);
    return content;
  }

  function updateShape(object) {
    let result = fixObject(object);
    result = d.updateWhen(result, 'position-data', (pd) =>
      Array.isArray(pd) ? pd.map(fixObject) : pd
    );

    if (cfh.textShapeQ(result)) {
      result = { ...result, content: fixTextContent(result.content) };
    }

    return result;
  }

  return updateObjectsInDataAndComponents(data, updateShape);
}

function migrate0014FixTokens(data) {
  if (ctob.fixDuplicateTokenSetIds) {
    return d.updateWhen(data, 'tokens-lib', ctob.fixDuplicateTokenSetIds);
  }
  return data;
}

function migrate0014ClearComponents(data) {
  return d.updateWhen(data, 'components', (components) =>
    updateVals(components, (component) => d.withoutNils(component))
  );
}

function migrate0015FixTextAttrs(data) {
  const textAttrs = ['font-family', 'font-size', 'font-style', 'font-weight', 'direction', 'text-decoration', 'text-transform'];

  function fixTextAttrs(node) {
    let result = node;
    for (const attr of textAttrs) {
      if (attr in result && blankOrEmptyQ(result[attr])) {
        const defaultVal = defaultTextAttrValue(attr);
        if (defaultVal != null) {
          result = { ...result, [attr]: defaultVal };
        } else {
          const { [attr]: _, ...rest } = result;
          result = rest;
        }
      }
    }
    return result;
  }

  function updateShape(object) {
    if (cfh.textShapeQ(object)) {
      let result = d.updateWhen(object, 'content', (content) =>
        typesText.transformNodes(typesText.isContentNodeQ, fixTextAttrs, content)
      );
      result = d.updateWhen(result, 'position-data', (pd) =>
        Array.isArray(pd) ? pd.map(fixTextAttrs) : pd
      );
      return result;
    }
    return object;
  }

  return updateObjectsInDataAndComponents(data, updateShape);
}

function migrate0015CleanShadow(data) {
  function cleanShadowColor(color) {
    if (color == null) return null;
    const refId = color.id;
    const refFile = color['file-id'];
    let result = d.withoutQualified(color);
    result = d.selectKeys(result, [...ctss.SHADOW_COLOR_ATTRS]);
    if (refId != null) result = { ...result, 'ref-id': refId };
    if (refFile != null) result = { ...result, 'ref-file': refFile };
    result = d.withoutNils(result);
    return result;
  }

  function cleanShadow(shadow) {
    if (shadow == null) return null;
    return { ...shadow, color: cleanShadowColor(shadow.color) };
  }

  function updateObject(object) {
    if (object.shadow == null) return object;
    const fixed = object.shadow.map(cleanShadow).filter(validShadowQ);
    return { ...object, shadow: fixed };
  }

  return updateObjectsInDataAndComponents(data, updateObject);
}

function migrate0016(data) {
  function getTextNodes(content) {
    if (content == null) return null;
    const nodes = [];
    typesText.transformNodes(typesText.isTextNodeQ, (node) => { nodes.push(node); return node; }, content);
    return nodes.length > 0 ? nodes : null;
  }

  function updateObject(object) {
    if (!cfh.textShapeQ(object)) return object;
    const content = object.content;
    const positionData = object['position-data'];
    const textNodes = getTextNodes(content);

    if (textNodes == null || textNodes.length === 0) return object;
    if (positionData == null || positionData.length === 0) return object;
    if (textNodes.length !== positionData.length) return object;

    const allNodesEmpty = textNodes.every((n) => n.fills == null || n.fills.length === 0);
    const allPositionHaveFills = positionData.every((pd) => pd.fills != null && pd.fills.length > 0);

    if (!allNodesEmpty || !allPositionHaveFills) return object;

    const fillsMap = new Map();
    for (let i = 0; i < textNodes.length; i++) {
      fillsMap.set(textNodes[i], positionData[i].fills);
    }

    const newContent = typesText.transformNodes(typesText.isTextNodeQ, (node) => {
      const fills = fillsMap.get(node);
      return fills ? { ...node, fills } : node;
    }, content);

    return { ...object, content: newContent };
  }

  return updateObjectsInDataAndComponents(data, updateObject);
}

function migrate0017(data) {
  function fixLayoutFlexDir(value) {
    return value === 'reverse-row' ? 'row-reverse' : value;
  }

  function updateObject(object) {
    return d.updateWhen(object, 'layout-flex-dir', fixLayoutFlexDir);
  }

  return updateObjectsInDataAndComponents(data, updateObject);
}

function migrate0018(data) {
  return cfcp.removeUnneededObjectsInComponents(data);
}

function migrate0019(data) {
  const libraries = data.libs ? data.libs : {};
  return cfcp.fixMissingSwapSlots(data, libraries);
}

function migrate0020(data) {
  const libraries = data.libs ? data.libs : {};
  return cfcp.syncComponentIdWithRefShape(data, libraries);
}

function migrate0021(data) {
  let result = data;
  if (ctob.fixConflictingTokenNames) {
    result = d.updateWhen(result, 'tokens-lib', ctob.fixConflictingTokenNames);
  }
  if (ctob.fixMissingSetsInThemes) {
    result = d.updateWhen(result, 'tokens-lib', ctob.fixMissingSetsInThemes);
  }
  return result;
}

// --- Migration registration ---

registerMigration('legacy-2', migrateLegacy2);
registerMigration('legacy-3', migrateLegacy3);
registerMigration('legacy-5', migrateLegacy5);
registerMigration('legacy-6', migrateLegacy6);
registerMigration('legacy-7', migrateLegacy7);
registerMigration('legacy-8', migrateLegacy8);
registerMigration('legacy-9', migrateLegacy9);
registerMigration('legacy-10', migrateLegacy10);
registerMigration('legacy-11', migrateLegacy11);
registerMigration('legacy-12', migrateLegacy12);
registerMigration('legacy-13', migrateLegacy13);
registerMigration('legacy-14', migrateLegacy14);
registerMigration('legacy-16', migrateLegacy16);
registerMigration('legacy-17', migrateLegacy17);
registerMigration('legacy-18', migrateLegacy18);
registerMigration('legacy-19', migrateLegacy19);
registerMigration('legacy-25', migrateLegacy25);
registerMigration('legacy-26', migrateLegacy26);
registerMigration('legacy-27', migrateLegacy27);
registerMigration('legacy-28', migrateLegacy28);
registerMigration('legacy-29', migrateLegacy29);
registerMigration('legacy-31', migrateLegacy31);
registerMigration('legacy-32', migrateLegacy32);
registerMigration('legacy-33', migrateLegacy33);
registerMigration('legacy-34', migrateLegacy34);
registerMigration('legacy-36', migrateLegacy36);
registerMigration('legacy-37', migrateLegacy37);
registerMigration('legacy-38', migrateLegacy38);
registerMigration('legacy-39', migrateLegacy39);
registerMigration('legacy-40', migrateLegacy40);
registerMigration('legacy-41', migrateLegacy41);
registerMigration('legacy-42', migrateLegacy42);
registerMigration('legacy-43', migrateLegacy43);
registerMigration('legacy-44', migrateLegacy44);
registerMigration('legacy-45', migrateLegacy45);
registerMigration('legacy-46', migrateLegacy46);
registerMigration('legacy-47', migrateLegacy47);
registerMigration('legacy-48', migrateLegacy48);
registerMigration('legacy-49', migrateLegacy49);
registerMigration('legacy-50', migrateLegacy50);
registerMigration('legacy-51', migrateLegacy51);
registerMigration('legacy-52', migrateLegacy52);
registerMigration('legacy-53', migrateLegacy53);
registerMigration('legacy-54', migrateLegacy54);
registerMigration('legacy-55', migrateLegacy55);
registerMigration('legacy-56', migrateLegacy56);
registerMigration('legacy-57', migrateLegacy57);
registerMigration('legacy-59', migrateLegacy59);
registerMigration('legacy-62', migrateLegacy62);
registerMigration('legacy-65', migrateLegacy65);
registerMigration('legacy-66', migrateLegacy66);
registerMigration('legacy-67', migrateLegacy67);
registerMigration('0001-remove-tokens-from-groups', migrate0001);
registerMigration('0002-clean-shape-interactions', migrate0002Clean);
registerMigration('0002-normalize-bool-content-v2', migrate0002NormalizeBool);
registerMigration('0003-fix-root-shape', migrate0003FixRoot);
registerMigration('0003-convert-path-content-v2', migrate0003ConvertPath);
registerMigration('0005-deprecate-image-type', migrate0005DeprecateImage);
registerMigration('0006-fix-old-texts-fills', migrate0006);
registerMigration('0008-fix-library-colors-v4', migrate0008);
registerMigration('0009-clean-library-colors', migrate0009Clean);
registerMigration('0009-add-partial-text-touched-flags', migrate0009Touched);
registerMigration('0010-fix-swap-slots-pointing-non-existent-shapes', migrate0010);
registerMigration('0011-fix-invalid-text-touched-flags', migrate0011);
registerMigration('0012-fix-position-data', migrate0012);
registerMigration('0013-fix-component-path', migrate0013FixPath);
registerMigration('0013-clear-invalid-strokes-and-fills', migrate0013ClearStrokesAndFills);
registerMigration('0014-fix-tokens-lib-duplicate-ids', migrate0014FixTokens);
registerMigration('0014-clear-components-nil-objects', migrate0014ClearComponents);
registerMigration('0015-fix-text-attrs-blank-strings', migrate0015FixTextAttrs);
registerMigration('0015-clean-shadow-color', migrate0015CleanShadow);
registerMigration('0016-copy-fills-from-position-data-to-text-node', migrate0016);
registerMigration('0017-fix-layout-flex-dir', migrate0017);
registerMigration('0018-remove-unneeded-objects-from-components', migrate0018);
registerMigration('0019-fix-missing-swap-slots', migrate0019);
registerMigration('0020-sync-component-id-with-near-main', migrate0020);
registerMigration('0021-repair-bad-tokens', migrate0021);

function collectNewFeatures(diff) {
  const features = new Set();
  if (diff.has('legacy-25') || diff.has('0003-fix-root-shape')) {
    features.add('fdata/shape-data-type');
  }
  if (diff.has('0003-convert-path-content-v2')) {
    features.add('fdata/path-data');
  }
  return features;
}

export function migrate(file, libs) {
  const diff = difference(availableMigrations, new Set(file.migrations ?? []));

  let data = { ...file.data, libs };

  for (const id of diff) {
    const migrationFn = migrationRegistry[id];
    if (migrationFn) {
      data = migrationFn(data, libs);
    }
  }

  const { libs: _libs, ...cleanData } = data;

  return {
    ...file,
    data: { ...cleanData, id: file.id },
    version: defaultVersion,
    migrations: union(new Set(file.migrations ?? []), diff),
  };
}

export function migrateFile(file, libs) {
  const version = file.version ?? file.data?.version;

  let result = {
    ...file,
    version: defaultVersion,
    migrations: file.migrations ?? generateMigrationsFromVersion(version),
  };

  result = { ...result, features: cfeat.migrateLegacyFeatures(result.features) };
  result = migrate(result, libs);

  const newFeatures = collectNewFeatures(result.migrations ?? new Set());
  result = { ...result, features: union(new Set(result.features ?? []), newFeatures) };

  if (!file.migrations) {
    result = { ...result, migrations: result.migrations };
  }

  return result;
}

export function generateMigrationsFromVersion(v) {
  const result = new Set();
  for (let i = 1; i <= defaultVersion; i++) {
    if (i <= v) {
      const id = `legacy-${i}`;
      if (availableMigrations.has(id)) {
        result.add(id);
      }
    }
  }
  return result;
}