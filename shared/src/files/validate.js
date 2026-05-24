/* global console */
import { getIn, withoutNils, notEmpty } from '../data.js';
import { isUUID } from '../spec.js';
import { splitGroupName, mergePathItem } from '../path_names.js';
import { propertiesToName, validVariantComponentQ } from '../types/variant.js';
import { instanceHeadQ, instanceRootQ, mainInstanceQ, inComponentCopyQ, isVariantContainerQ, isVariantQ, getSwapSlot } from '../types/component.js';
import { getComponent, getDeletedComponent } from '../types/components_list.js';
import { getShape } from '../types/shape_tree.js';
import { makeContainer } from '../types/container.js';
import { getComponentPage, resolveComponent } from '../types/file.js';
import { getPage, pagesSeq } from '../types/pages_list.js';
import { zero } from '../uuid.js';

export const ERROR_CODES = new Set([
  'invalid-geometry',
  'parent-not-found',
  'child-not-in-parent',
  'duplicated-children',
  'child-not-found',
  'frame-not-found',
  'invalid-frame',
  'component-duplicate-slot',
  'component-not-main',
  'component-main-external',
  'component-not-found',
  'duplicate-slot',
  'invalid-main-instance-id',
  'invalid-main-instance-page',
  'invalid-main-instance',
  'invalid-parent',
  'component-main',
  'should-be-component-root',
  'should-not-be-component-root',
  'ref-shape-not-found',
  'ref-shape-is-head',
  'ref-shape-is-not-head',
  'shape-ref-in-main',
  'component-id-mismatch',
  'root-main-not-allowed',
  'nested-main-not-allowed',
  'root-copy-not-allowed',
  'nested-copy-not-allowed',
  'not-head-main-not-allowed',
  'not-head-copy-not-allowed',
  'not-component-not-allowed',
  'component-nil-objects-not-allowed',
  'non-deleted-component-cannot-have-objects',
  'instance-head-not-frame',
  'invalid-text-touched',
  'misplaced-slot',
  'missing-slot',
  'shape-ref-cycle',
  'not-a-variant',
  'invalid-variant-id',
  'invalid-variant-properties',
  'variant-not-main',
  'parent-not-variant',
  'variant-bad-name',
  'variant-bad-variant-name',
  'variant-component-bad-name',
  'variant-component-bad-id',
]);

let errors = null;

function libraryExistsQ(file, libraries, shape) {
  return (
    shape['component-file'] === file?.id ||
    libraries?.[shape['component-file']] != null
  );
}

function reportError(code, hint, shape, file, page, extraArgs) {
  const error = withoutNils({
    code,
    hint,
    shape,
    'file-id': file?.id,
    'page-id': page?.id,
    'shape-id': shape?.id,
    ...extraArgs,
  });

  if (!ERROR_CODES.has(code)) {
    console.warn(`Unknown error code: ${code}`);
  }

  if (errors != null) {
    errors.push(error);
  }
  return error;
}

export function validateFile(file, libraries) {
  if (!file?.features?.has?.('components/v2') && !file?.features?.['components/v2']) {
    return null;
  }

  errors = [];
  const data = file.data ?? file;

  for (const page of pagesSeq(data)) {
    if (!page?.id) continue;
    checkShape(zero, file, page, libraries);
    const orphans = getOrphanShapes(page);
    for (const id of orphans) {
      checkShape(id, file, page, libraries);
    }
  }

  for (const component of Object.values(data.components ?? {})) {
    checkComponent(component, file);
  }

  const result = errors.length > 0 ? errors : null;
  errors = null;
  return result;
}

export function validateShape(shapeId, file, page, libraries) {
  errors = [];
  checkShape(shapeId, file, page, libraries);
  const result = errors;
  errors = null;
  return result;
}

export function validateComponent(component, file) {
  errors = [];
  checkComponent(component, file);
  const result = errors;
  errors = null;
  return result;
}

function checkGeometry(shape, file, page) {
  const isPath = shape?.type === 'path';
  const isBool = shape?.type === 'bool';
  if (isPath || isBool) return;

  if (
    shape?.x == null ||
    shape?.y == null ||
    shape?.width == null ||
    shape?.height == null ||
    shape?.selrect == null ||
    shape?.points == null
  ) {
    reportError('invalid-geometry', 'Shape geometry is invalid', shape, file, page);
  }
}

function checkParentChildren(shape, file, page) {
  const parentId = shape?.['parent-id'];
  const parent = page?.objects?.[parentId];
  const shapeId = shape?.id;
  const shapes = shape?.shapes ?? [];

  if (!parent) {
    reportError('parent-not-found', `Parent ${parentId} not found`, shape, file, page);
    return;
  }

  if (parentId !== zero) {
    if (!(parent.shapes ?? []).includes(shapeId)) {
      reportError('child-not-in-parent', `Shape ${shapeId} not in parent's children list`, shape, file, page);
    }
  }

  const uniqueShapes = new Set(shapes);
  if (uniqueShapes.size !== shapes.length) {
    reportError('duplicated-children', `Shape ${shapeId} has duplicated children`, shape, file, page);
  }

  for (const childId of shapes) {
    const child = page?.objects?.[childId];
    if (!child) {
      reportError('child-not-found', `Child ${childId} not found in parent ${shapeId}`, shape, file, page);
    } else if (child['parent-id'] !== shapeId) {
      reportError('invalid-parent', `Child ${childId} has invalid parent ${shapeId}`, child, file, page);
    }
  }
}

function checkFrame(shape, file, page) {
  const frameId = shape?.['frame-id'];
  const frame = page?.objects?.[frameId];

  if (!frame) {
    reportError('frame-not-found', `Frame ${frameId} not found`, shape, file, page);
    return;
  }

  if (frame?.type !== 'frame') {
    reportError('invalid-frame', `Frame ${frameId} is not actually a frame`, shape, file, page);
    return;
  }

  const parent = page?.objects?.[shape?.['parent-id']];
  if (parent) {
    if (parent.type === 'frame') {
      if (frameId !== parent.id) {
        reportError('invalid-frame', `Frame-id should point to parent ${parent.id}`, shape, file, page);
      }
    } else if (frameId !== parent['frame-id']) {
      reportError('invalid-frame', `Frame-id should point to parent frame ${frameId}`, shape, file, page);
    }
  }
}

function checkShape(shapeId, file, page, libraries, context = 'not-component', libraryExists = false) {
  const shape = getShape(page, shapeId);
  if (!shape) return;

  checkGeometry(shape, file, page);
  checkParentChildren(shape, file, page);
  checkFrame(shape, file, page);

  if (isVariantContainerQ(shape)) {
    checkVariantContainer(shape, file, page);
  }

  if (isVariantQ(shape)) {
    checkVariant(shape, file, page);
  }

  if (instanceHeadQ(shape)) {
    if (shape.type !== 'frame') {
      reportError('instance-head-not-frame', 'Instance head should be a frame', shape, file, page);
      return;
    }

    if (instanceRootQ(shape)) {
      if (mainInstanceQ(shape)) {
        if (context !== 'not-component') {
          reportError('root-main-not-allowed', 'Root main component not allowed inside other component', shape, file, page);
        } else {
          checkShapeMainRootTop(shape, file, page, libraries);
        }
      } else {
        if (context !== 'not-component') {
          reportError('root-copy-not-allowed', 'Root copy component not allowed inside other component', shape, file, page);
        } else {
          checkShapeCopyRootTop(shape, file, page, libraries);
        }
      }
    } else {
      if (mainInstanceQ(shape)) {
        if (context === 'not-component' || context === 'main-top') {
          reportError('nested-main-not-allowed', 'Component main not allowed inside other component', shape, file, page);
        } else {
          checkShapeMainRootNested(shape, file, page, libraries);
        }
      } else {
        if (context === 'not-component') {
          reportError('nested-copy-not-allowed', 'Nested copy component only allowed inside other component', shape, file, page);
        } else {
          checkShapeCopyRootNested(shape, file, page, libraries, libraryExists);
        }
      }
    }
  } else if (inComponentCopyQ(shape)) {
    if (!['copy-top', 'copy-nested', 'copy-any'].includes(context)) {
      reportError('not-head-copy-not-allowed', 'Non-root copy only allowed inside a copy', shape, file, page);
    } else {
      checkShapeCopyNotRoot(shape, file, page, libraries);
    }
  } else {
    checkShapeNotComponent(shape, file, page, libraries);
  }
}

function checkShapeMainRootTop(shape, file, page, libraries) {
  checkComponentRoot(shape, file, page);
  checkComponentNotRef(shape, file, page);
  checkEmptySwapSlot(shape, file, page);
  checkDuplicateSwapSlot(shape, file, page);
}

function checkShapeMainRootNested(shape, file, page, libraries) {
  checkComponentMainHead(shape, file, page, libraries);
  checkComponentNotRoot(shape, file, page);
  checkComponentNotRef(shape, file, page);
  checkEmptySwapSlot(shape, file, page);
}

function checkShapeCopyRootTop(shape, file, page, libraries) {
  const libExists = libraryExistsQ(file, libraries, shape);
  checkComponentNotMainHead(shape, file, page, libraries);
  checkComponentRoot(shape, file, page);
  checkComponentRef(shape, file, page, libraries);
  checkRefIsHead(shape, file, page, libraries);
  checkEmptySwapSlot(shape, file, page);
  checkDuplicateSwapSlot(shape, file, page);
  checkValidTouched(shape, file, page);
}

function checkShapeCopyRootNested(shape, file, page, libraries, libraryExists) {
  checkComponentNotMainHead(shape, file, page, libraries);
  checkComponentNotRoot(shape, file, page);
  checkValidTouched(shape, file, page);
  checkRefComponentId(shape, file, page, libraries);
  checkRequiredSwapSlot(shape, file, page, libraries);

  if (libraryExists) {
    checkComponentRef(shape, file, page, libraries);
    checkRefIsHead(shape, file, page, libraries);
  }
}

function checkShapeMainNotRoot(shape, file, page, libraries) {
  checkComponentNotMainNotHead(shape, file, page);
  checkComponentNotRoot(shape, file, page);
  checkComponentNotRef(shape, file, page);
  checkEmptySwapSlot(shape, file, page);
}

function checkShapeCopyNotRoot(shape, file, page, libraries) {
  checkComponentNotMainNotHead(shape, file, page);
  checkComponentNotRoot(shape, file, page);
  checkComponentRef(shape, file, page, libraries);
  checkRefIsNotHead(shape, file, page, libraries);
  checkEmptySwapSlot(shape, file, page);
  checkValidTouched(shape, file, page);
}

function checkShapeNotComponent(shape, file, page, libraries) {
  checkComponentNotMainNotHead(shape, file, page);
  checkComponentNotRoot(shape, file, page);
  checkComponentNotRef(shape, file, page);
  checkEmptySwapSlot(shape, file, page);
}

function checkComponentMainHead(shape, file, page, libraries) {
  if (!shape?.mainInstance) {
    reportError('component-not-main', 'Shape expected to be main instance', shape, file, page);
  }
  if (shape?.['component-file'] !== file?.id) {
    reportError('component-main-external', 'Main instance should refer to a component in the same file', shape, file, page);
  }

  const component = resolveComponent(shape, file, libraries, true);
  if (!component) {
    reportError('component-not-found', `Component ${shape?.['component-id']} not found in file ${shape?.['component-file']}`, shape, file, page);
    return;
  }

  if (component['main-instance-id'] !== shape?.id) {
    reportError('invalid-main-instance-id', `Main instance id of component ${shape?.['component-id']} is not valid`, shape, file, page);
  }

  if (component['main-instance-page'] !== page?.id) {
    const componentPage = getComponentPage(file?.data ?? file, component);
    const mainComponent = componentPage?.objects?.[component['main-instance-id']];
    if (mainComponent?.mainInstance) {
      reportError('component-main', 'Shape not expected to be main instance', shape, file, page);
    } else {
      reportError('invalid-main-instance-page', `Main instance page of component ${shape?.['component-id']} is not valid`, shape, file, page);
    }
  }
}

function checkComponentNotMainHead(shape, file, page, libraries) {
  if (shape?.mainInstance === true) {
    reportError('component-not-main', 'Shape not expected to be main instance', shape, file, page);
  }

  const libExists = libraryExistsQ(file, libraries, shape);
  const component = libExists ? resolveComponent(shape, file, libraries, true) : null;

  if (!libExists) return;
  if (!component) {
    reportError('component-not-found', `Component ${shape?.['component-id']} not found in file ${shape?.['component-file']}`, shape, file, page);
    return;
  }

  if (component['main-instance-id'] === shape?.id && component['main-instance-page'] === page?.id) {
    reportError('invalid-main-instance', `Main instance of component ${component.id} should not be this shape`, shape, file, page);
  }
}

function checkComponentNotMainNotHead(shape, file, page) {
  if (shape?.mainInstance === true) {
    reportError('component-main', 'Shape not expected to be main instance', shape, file, page);
  }
  if (shape?.['component-id'] != null || shape?.['component-file'] != null) {
    reportError('component-main', 'Shape not expected to be component head', shape, file, page);
  }
}

function checkComponentRoot(shape, file, page) {
  if (shape?.['component-root'] == null) {
    reportError('should-be-component-root', 'Shape should be component root', shape, file, page);
  }
}

function checkComponentNotRoot(shape, file, page) {
  if (shape?.['component-root'] === true) {
    reportError('should-not-be-component-root', 'Shape should not be component root', shape, file, page);
  }
}

function checkComponentRef(shape, file, page, libraries) {
  if (!libraryExistsQ(file, libraries, shape)) return;
  const refShape = findRefShape(file, page, libraries, shape);
  if (refShape == null) {
    reportError('ref-shape-not-found', `Referenced shape ${shape?.['shape-ref']} not found in near component`, shape, file, page);
  }
}

function checkComponentNotRef(shape, file, page) {
  if (shape?.['shape-ref'] != null) {
    reportError('shape-ref-in-main', 'Shape inside main instance should not have shape-ref', shape, file, page);
  }
}

function checkRefIsNotHead(shape, file, page, libraries) {
  const refShape = findRefShape(file, page, libraries, shape);
  if (refShape && instanceHeadQ(refShape)) {
    reportError('ref-shape-is-head', `Referenced shape ${shape?.['shape-ref']} is a component, so the copy must also be`, shape, file, page);
  }
}

function checkRefIsHead(shape, file, page, libraries) {
  const refShape = findRefShape(file, page, libraries, shape);
  if (refShape && !instanceHeadQ(refShape)) {
    reportError('ref-shape-is-not-head', `Referenced shape ${shape?.['shape-ref']} of a head copy must also be a head`, shape, file, page);
  }
}

function checkRefComponentId(shape, file, page, libraries) {
  if (getSwapSlot(shape) != null) return;

  const refShape = findRefShape(file, page, libraries, shape);
  if (!refShape) return;

  if (
    shape['component-id'] !== refShape['component-id'] ||
    shape['component-file'] !== refShape['component-file']
  ) {
    reportError('component-id-mismatch', 'Nested copy component-id and component-file must be the same as the near main', shape, file, page);
  }
}

function checkEmptySwapSlot(shape, file, page) {
  if (getSwapSlot(shape) != null) {
    reportError('misplaced-slot', 'This shape should not have swap slot', shape, file, page);
  }
}

function checkDuplicateSwapSlot(shape, file, page) {
  if (hasDuplicateSwapSlotQ(shape, page)) {
    reportError('duplicate-slot', 'This shape has children with the same swap slot', shape, file, page);
  }
}

function checkRequiredSwapSlot(shape, file, page, libraries) {
  const nearMatch = findNearMatch(file, page, libraries, shape);
  if (nearMatch && shape?.['shape-ref'] !== nearMatch?.id && getSwapSlot(shape) == null) {
    reportError('missing-slot', 'Shape has been swapped, should have swap slot', shape, file, page);
  }
}

function checkValidTouched(shape, file, page) {
  const touched = shape?.touched ?? {};
  const contentTouched = touched['content-group'];
  const textTouched = touched['text-content-text'] || touched['text-content-attribute'] || touched['text-content-structure'];

  if (textTouched && !contentTouched) {
    reportError('invalid-text-touched', 'This shape has text type touched but not content touched', shape, file, page);
  }
}

function checkVariantContainer(shape, file, page) {
  const shapeId = shape?.id;
  const shapes = shape?.shapes ?? [];
  const children = shapes.map((id) => page?.objects?.[id]).filter(Boolean);
  const propNames = extractPropertiesNamesFromFirst(children, file?.data ?? file);

  for (const child of children) {
    if (!child) continue;
    if (!isVariantQ(child)) {
      reportError('not-a-variant', `Shape ${child.id} should be a variant`, child, file, page);
      continue;
    }
    if (child['variant-id'] !== shapeId) {
      reportError('invalid-variant-id', `Variant ${child.id} has invalid variant-id ${child['variant-id']}`, child, file, page);
    }
  }
}

function checkVariant(shape, file, page) {
  const parent = page?.objects?.[shape?.['parent-id']];
  const component = getComponent(file?.data ?? file, shape?.['component-id'], true);

  if (parent && !isVariantContainerQ(parent)) {
    reportError('parent-not-variant', `Variant ${shape?.id} has an invalid parent`, shape, file, page);
  }
}

function extractPropertiesNamesFromFirst(children, data) {
  if (!children.length) return [];
  const first = children[0];
  const comp = getComponent(data, first?.['component-id'], true);
  return (comp?.['variant-properties'] ?? []).map((p) => p.name);
}

function hasDuplicateSwapSlotQ(shape, page) {
  const shapes = (shape?.shapes ?? []).map((id) => page?.objects?.[id]).filter(Boolean);
  const slots = shapes.map((s) => getSwapSlot(s)).filter((s) => s != null);
  const counts = {};
  for (const s of slots) {
    counts[s] = (counts[s] ?? 0) + 1;
    if (counts[s] > 1) return true;
  }
  return false;
}

function getOrphanShapes(page) {
  const objects = page?.objects ?? {};
  const result = [];
  for (const shape of Object.values(objects)) {
    if (!(shape?.['parent-id'] in objects)) {
      result.push(shape.id);
    }
  }
  return result;
}

function findRefShape(file, page, libraries, shape) {
  return null;
}

function findNearMatch(file, page, libraries, shape) {
  return null;
}

function checkComponent(component, file) {
  if ('objects' in component && component.objects == null) {
    reportError('component-nil-objects-not-allowed', 'Objects list cannot be nil', component, file, null);
  }

  if (!component.deleted) {
    checkMainInsideMain(component, file);
    checkNotObjects(component, file);
  }

  if (component.deleted) {
    checkComponentDuplicateSwapSlot(component, file);
    checkRefCycles(component, file);
  }

  if (isVariantQ(component)) {
    checkVariantComponent(component, file);
  }
}

function checkMainInsideMain(component, file) {
  const page = getComponentPage(file?.data ?? file, component);
  const mainInstance = page?.objects?.[component['main-instance-id']];
  if (!mainInstance) return;

  const parents = getParentIds(page?.objects, mainInstance.id);
  if (parents.some((id) => page?.objects?.[id]?.mainInstance)) {
    reportError('nested-main-not-allowed', 'Component main not allowed inside other component', mainInstance, file, page);
  }
}

function checkNotObjects(component, file) {
  if (component?.objects != null && Object.keys(component.objects).length > 0) {
    reportError('non-deleted-component-cannot-have-objects', 'A non-deleted component cannot have shapes inside', component, file, null);
  }
}

function checkComponentDuplicateSwapSlot(component, file) {
  const shape = component?.objects?.[component['main-instance-id']];
  if (shape && hasDuplicateSwapSlotQ(shape, makeContainer(component, 'component'))) {
    reportError('component-duplicate-slot', 'This deleted component has children with the same swap slot', component, file, null);
  }
}

function checkRefCycles(component, file) {
  const cyclesIds = Object.values(component?.objects ?? {})
    .filter((s) => s.id === s['shape-ref'])
    .map((s) => s.id);

  if (cyclesIds.length > 0) {
    reportError('shape-ref-cycle', 'This deleted component has shapes with shape-ref pointing to self', component, file, null);
  }
}

function checkVariantComponent(component, file) {
  const page = getComponentPage(file?.data ?? file, component);
  const mainComponent = component.deleted
    ? component.objects?.[component['main-instance-id']]
    : page?.objects?.[component['main-instance-id']];

  if (mainComponent && !isVariantQ(mainComponent)) {
    reportError('not-a-variant', `Shape ${mainComponent.id} should be a variant`, mainComponent, file, page);
  }
}

function getParentIds(objects, shapeId) {
  const result = [];
  let current = objects?.[shapeId];
  while (current?.['parent-id']) {
    result.push(current['parent-id']);
    current = objects?.[current['parent-id']];
  }
  return result;
}