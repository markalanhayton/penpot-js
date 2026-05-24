import * as pcb from './changes_builder.js';
import * as uuid from '../uuid.js';
import * as ctk from '../types/component.js';
import * as cts from '../types/shape.js';

const repairHandlers = {};

export function registerRepairHandler(code, handler) {
  repairHandlers[code] = handler;
}

registerRepairHandler('invalid-geometry', (_code, error, fileData, _libraries) => {
  const { shape, 'page-id': pageId } = error;

  function repairShape(s) {
    return {
      ...s,
      x: 0,
      y: 0,
      width: 0.01,
      height: 0.01,
      selrect: { x: 0, y: 0, width: 0.01, height: 0.01, x1: 0, y1: 0, x2: 0.01, y2: 0.01 },
      points: [
        { x: 0, y: 0 },
        { x: 0.01, y: 0 },
        { x: 0.01, y: 0.01 },
        { x: 0, y: 0.01 },
      ],
    };
  }

  return pcb.updateShapes(
    pcb.withFileData(pcb.emptyChanges(null, pageId), fileData),
    [shape.id],
    repairShape,
  );
});

registerRepairHandler('parent-not-found', (_code, error, fileData, _libraries) => {
  const { shape, 'page-id': pageId } = error;

  function repairShape(s) {
    return { ...s, 'parent-id': uuid.zero };
  }

  return pcb.updateShapes(
    pcb.withFileData(pcb.emptyChanges(null, pageId), fileData),
    [shape.id],
    repairShape,
  );
});

registerRepairHandler('child-not-in-parent', (_code, error, fileData, _libraries) => {
  const { shape, 'page-id': pageId } = error;

  function repairShape(parent) {
    const shapes = parent.shapes ?? [];
    if (shapes.includes(shape.id)) return parent;
    return { ...parent, shapes: [...shapes, shape.id] };
  }

  return pcb.updateShapes(
    pcb.withFileData(pcb.emptyChanges(null, pageId), fileData),
    [shape['parent-id']],
    repairShape,
  );
});

registerRepairHandler('duplicated-children', (_code, error, fileData, _libraries) => {
  const { shape, 'page-id': pageId } = error;

  function repairShape(s) {
    const shapes = s.shapes ?? [];
    return { ...s, shapes: [...new Set(shapes)] };
  }

  return pcb.updateShapes(
    pcb.withFileData(pcb.emptyChanges(null, pageId), fileData),
    [shape.id],
    repairShape,
  );
});

registerRepairHandler('child-not-found', (_code, error, fileData, _libraries) => {
  const { shape, 'page-id': pageId, args } = error;

  function repairShape(parent) {
    const shapes = parent.shapes ?? [];
    return { ...parent, shapes: shapes.filter(id => id !== args['child-id']) };
  }

  return pcb.updateShapes(
    pcb.withFileData(pcb.emptyChanges(null, pageId), fileData),
    [shape.id],
    repairShape,
  );
});

registerRepairHandler('invalid-parent', (_code, error, fileData, _libraries) => {
  const { shape, 'page-id': pageId, args } = error;
  return pcb.changeParent(
    pcb.withFileData(pcb.emptyChanges(null, pageId), fileData),
    args['parent-id'],
    [shape],
    null,
    { 'allow-altering-copies': true },
  );
});

registerRepairHandler('frame-not-found', (_code, error, fileData, _libraries) => {
  const { shape, 'page-id': pageId } = error;

  function repairShape(s) {
    return { ...s, 'frame-id': uuid.zero };
  }

  return pcb.updateShapes(
    pcb.withFileData(pcb.emptyChanges(null, pageId), fileData),
    [shape.id],
    repairShape,
  );
});

registerRepairHandler('invalid-frame', (_code, error, fileData, _libraries) => {
  const { shape, 'page-id': pageId } = error;

  function repairShape(s) {
    return { ...s, 'frame-id': uuid.zero };
  }

  return pcb.updateShapes(
    pcb.withFileData(pcb.emptyChanges(null, pageId), fileData),
    [shape.id],
    repairShape,
  );
});

registerRepairHandler('component-not-main', (_code, error, fileData, _libraries) => {
  const { shape, 'page-id': pageId } = error;

  function repairShape(s) {
    const { 'component-id': _, 'component-root': __, 'main-instance-id': ___, ...rest } = s;
    return rest;
  }

  return pcb.updateShapes(
    pcb.withFileData(pcb.emptyChanges(null, pageId), fileData),
    [shape.id],
    repairShape,
  );
});

registerRepairHandler('component-main-external', (_code, error, fileData, _libraries) => {
  const { shape, 'page-id': pageId } = error;

  function repairShape(s) {
    const { 'component-id': _, 'component-root': __, 'main-instance-id': ___, ...rest } = s;
    return rest;
  }

  return pcb.updateShapes(
    pcb.withFileData(pcb.emptyChanges(null, pageId), fileData),
    [shape.id],
    repairShape,
  );
});

registerRepairHandler('component-not-found', (_code, error, fileData, _libraries) => {
  const { shape, 'page-id': pageId } = error;

  function repairShape(s) {
    const { 'component-id': _, 'component-root': __, ...rest } = s;
    return rest;
  }

  return pcb.updateShapes(
    pcb.withFileData(pcb.emptyChanges(null, pageId), fileData),
    [shape.id],
    repairShape,
  );
});

registerRepairHandler('invalid-main-instance-id', (_code, error, fileData, _libraries) => {
  const { shape, 'page-id': pageId } = error;

  function repairShape(s) {
    const { 'main-instance-id': _, ...rest } = s;
    return rest;
  }

  return pcb.updateShapes(
    pcb.withFileData(pcb.emptyChanges(null, pageId), fileData),
    [shape.id],
    repairShape,
  );
});

registerRepairHandler('invalid-text-touched', (_code, error, fileData, _libraries) => {
  const { shape, 'page-id': pageId } = error;

  function repairShape(s) {
    const { 'touched': _, ...rest } = s;
    return rest;
  }

  return pcb.updateShapes(
    pcb.withFileData(pcb.emptyChanges(null, pageId), fileData),
    [shape.id],
    repairShape,
  );
});

registerRepairHandler('default', (_code, error, _fileData, _libraries) => {
  return null;
});

export function repairError(code, error, fileData, libraries) {
  const handler = repairHandlers[code] ?? repairHandlers['default'];
  return handler(code, error, fileData, libraries);
}

export function repairFile(fileData, libraries, errors) {
  if (!errors || errors.length === 0) {
    return { changes: null, hasChanges: false };
  }

  let changes = pcb.emptyChanges(null);

  for (const error of errors) {
    const repairChanges = repairError(error.code, error, fileData, libraries);
    if (repairChanges) {
      changes = pcb.concatChanges(changes, repairChanges);
    }
  }

  const redoChanges = changes['redo-changes'] ?? [];
  return {
    changes: redoChanges.length > 0 ? changes : null,
    hasChanges: redoChanges.length > 0,
  };
}