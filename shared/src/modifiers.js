import { point, close as ptClose, transform as ptTransform, negate } from './geom/point.js';
import { close as mtClose, matrix, multiply as mtMultiply, translateMatrix, scaleMatrix, rotateMatrix, translate, scale } from './geom/matrix.js';
import { almostZero } from './math.js';
import { notEmpty, concatVec } from './data.js';

export class Modifiers {
  constructor(lastOrder = 0, geometryParent = [], geometryChild = [], structureParent = [], structureChild = []) {
    this.lastOrder = lastOrder;
    this.geometryParent = geometryParent;
    this.geometryChild = geometryChild;
    this.structureParent = structureParent;
    this.structureChild = structureChild;
  }
}

export class GeometricOperation {
  constructor(order, type, vector, origin, transform, transformInverse, rotation, center) {
    this.order = order;
    this.type = type;
    this.vector = vector;
    this.origin = origin;
    this.transform = transform;
    this.transformInverse = transformInverse;
    this.rotation = rotation;
    this.center = center;
  }
}

export class StructureOperation {
  constructor(type, property, value, index) {
    this.type = type;
    this.property = property;
    this.value = value;
    this.index = index;
  }
}

function moveOp(order, vector) {
  return new GeometricOperation(order, 'move', vector, null, null, null, null, null);
}

function resizeOp(order, vector, origin, transform, transformInverse) {
  return new GeometricOperation(order, 'resize', vector, origin, transform ?? null, transformInverse ?? null, null, null);
}

function rotationGeomOp(order, center, angle) {
  return new GeometricOperation(order, 'rotation', null, null, null, null, angle, center);
}

function rotationStructOp(angle) {
  return new StructureOperation('rotation', null, angle, null);
}

function removeChildrenOp(shapes) {
  return new StructureOperation('remove-children', null, shapes, null);
}

function addChildrenOp(shapes, index) {
  return new StructureOperation('add-children', null, shapes, index);
}

function reflowOp() {
  return new StructureOperation('reflow', null, null, null);
}

function scaleContentOp(value) {
  return new StructureOperation('scale-content', null, value, null);
}

function changePropertyOp(property, value) {
  return new StructureOperation('change-property', property, value, null);
}

function moveVecQ(vector) {
  return !almostZero(vector.x) || !almostZero(vector.y);
}

function resizeVecQ(vector) {
  return !almostZero(vector.x - 1) || !almostZero(vector.y - 1);
}

function validVectorQ(vector) {
  return typeof vector.x === 'number' && typeof vector.y === 'number';
}

function mergeableMoveQ(op1, op2) {
  return op1.type === 'move' && op2.type === 'move';
}

function mergeableResizeQ(op1, op2) {
  if (op1.type !== 'resize' || op2.type !== 'resize') return false;
  const tf1 = op1.transform ?? matrix();
  const tfi1 = op1.transformInverse ?? matrix();
  const tf2 = op2.transform ?? matrix();
  const tfi2 = op2.transformInverse ?? matrix();
  return ptClose(op1.origin, op2.origin) && mtClose(tf1, tf2) && mtClose(tfi1, tfi2);
}

function mergeMove(op1, op2) {
  return new GeometricOperation(op1.order, 'move', point(op1.vector.x + op2.vector.x, op1.vector.y + op2.vector.y), null, null, null, null, null);
}

function mergeResize(op1, op2) {
  return new GeometricOperation(op1.order, 'resize', point(op1.vector.x * op2.vector.x, op1.vector.y * op2.vector.y), op1.origin, op1.transform, op1.transformInverse, null, null);
}

function maybeAddMove(operations, op) {
  if (operations.length === 0) return [op];
  const head = operations[operations.length - 1];
  if (mergeableMoveQ(head, op)) {
    const item = mergeMove(head, op);
    const rest = operations.slice(0, -1);
    return moveVecQ(item.vector) ? [...rest, item] : rest;
  }
  return [...operations, op];
}

function maybeAddResize(operations, op, precise) {
  if (operations.length === 0) return [op];
  const head = operations[operations.length - 1];
  if (mergeableResizeQ(head, op)) {
    const item = mergeResize(head, op);
    const rest = operations.slice(0, -1);
    return (precise || resizeVecQ(item.vector)) ? [...rest, item] : rest;
  }
  return [...operations, op];
}

function ensureModifiers(modifiers) {
  return modifiers ?? empty();
}

export function empty() {
  return new Modifiers(0, [], [], [], []);
}

export function moveParent(modifiers, xOrVector, y) {
  const vector = y !== undefined ? point(xOrVector, y) : xOrVector;
  if (!validVectorQ(vector)) throw new Error(`Invalid move vector: ${vector.x},${vector.y}`);
  modifiers = ensureModifiers(modifiers);
  const order = modifiers.lastOrder + 1;
  let gp = modifiers.geometryParent;
  if (moveVecQ(vector)) {
    gp = maybeAddMove(gp, moveOp(order, vector));
  }
  return new Modifiers(order, gp, modifiers.geometryChild, modifiers.structureParent, modifiers.structureChild);
}

export function resizeParent(modifiers, vector, origin, transform, transformInverse) {
  if (!validVectorQ(vector)) throw new Error(`Invalid resize vector: ${vector.x},${vector.y}`);
  modifiers = ensureModifiers(modifiers);
  const order = modifiers.lastOrder + 1;
  let gp = modifiers.geometryParent;
  if (resizeVecQ(vector)) {
    gp = maybeAddResize(gp, resizeOp(order, vector, origin, transform, transformInverse));
  }
  return new Modifiers(order, gp, modifiers.geometryChild, modifiers.structureParent, modifiers.structureChild);
}

export function move(modifiers, xOrVector, y) {
  const vector = y !== undefined ? point(xOrVector, y) : xOrVector;
  if (!validVectorQ(vector)) throw new Error(`Invalid move vector: ${vector.x},${vector.y}`);
  modifiers = ensureModifiers(modifiers);
  const order = modifiers.lastOrder + 1;
  let gc = modifiers.geometryChild;
  if (moveVecQ(vector)) {
    gc = maybeAddMove(gc, moveOp(order, vector));
  }
  return new Modifiers(order, modifiers.geometryParent, gc, modifiers.structureParent, modifiers.structureChild);
}

export function resize(modifiers, vector, origin, transform, transformInverse, options) {
  if (!validVectorQ(vector)) throw new Error(`Invalid resize vector: ${vector.x},${vector.y}`);
  modifiers = ensureModifiers(modifiers);
  const order = modifiers.lastOrder + 1;
  let gc = modifiers.geometryChild;
  if (options?.precise || resizeVecQ(vector)) {
    gc = maybeAddResize(gc, resizeOp(order, vector, origin, transform, transformInverse), options?.precise);
  }
  return new Modifiers(order, modifiers.geometryParent, gc, modifiers.structureParent, modifiers.structureChild);
}

export function rotation(modifiers, center, angle) {
  modifiers = ensureModifiers(modifiers);
  const order = modifiers.lastOrder + 1;
  if (almostZero(angle)) return modifiers;
  return new Modifiers(
    order,
    modifiers.geometryParent,
    [...modifiers.geometryChild, rotationGeomOp(order, center, angle)],
    modifiers.structureParent,
    [...modifiers.structureChild, rotationStructOp(angle)]
  );
}

export function removeChildren(modifiers, shapes) {
  modifiers = ensureModifiers(modifiers);
  if (!notEmpty(shapes)) return modifiers;
  return new Modifiers(modifiers.lastOrder, modifiers.geometryParent, modifiers.geometryChild, [...modifiers.structureParent, removeChildrenOp(shapes)], modifiers.structureChild);
}

export function addChildren(modifiers, shapes, index) {
  modifiers = ensureModifiers(modifiers);
  if (!notEmpty(shapes)) return modifiers;
  return new Modifiers(modifiers.lastOrder, modifiers.geometryParent, modifiers.geometryChild, [...modifiers.structureParent, addChildrenOp(shapes, index)], modifiers.structureChild);
}

export function reflow(modifiers) {
  modifiers = ensureModifiers(modifiers);
  return new Modifiers(modifiers.lastOrder, modifiers.geometryParent, modifiers.geometryChild, [...modifiers.structureParent, reflowOp()], modifiers.structureChild);
}

export function scaleContent(modifiers, value) {
  modifiers = ensureModifiers(modifiers);
  return new Modifiers(modifiers.lastOrder, modifiers.geometryParent, modifiers.geometryChild, modifiers.structureParent, [...modifiers.structureChild, scaleContentOp(value)]);
}

export function changeProperty(modifiers, property, value) {
  modifiers = ensureModifiers(modifiers);
  return new Modifiers(modifiers.lastOrder, modifiers.geometryParent, modifiers.geometryChild, [...modifiers.structureParent, changePropertyOp(property, value)], modifiers.structureChild);
}

function concatGeometry(operations, other, merge) {
  if (operations.length === 0) return other;
  if (other.length === 0) return operations;
  let result = [...operations];
  for (const current of other) {
    if (merge && current.type === 'move') {
      result = maybeAddMove(result, current);
    } else if (merge && current.type === 'resize') {
      result = maybeAddResize(result, current);
    } else {
      result = [...result, current];
    }
  }
  return result;
}

function increaseOrder(operations, lastOrder) {
  return operations.map((op) => ({ ...op, order: op.order + lastOrder }));
}

export function addModifiers(modifiers, newModifiers) {
  modifiers = ensureModifiers(modifiers);
  newModifiers = ensureModifiers(newModifiers);

  const lastOrder = modifiers.lastOrder;
  const newLastOrder = newModifiers.lastOrder;

  const newGeomChild = increaseOrder(newModifiers.geometryChild, lastOrder);
  const newGeomParent = increaseOrder(newModifiers.geometryParent, lastOrder);

  const mergeChild = newModifiers.geometryParent.length === 0 && modifiers.geometryParent.length === 0;
  const mergeParent = newModifiers.geometryChild.length === 0 && modifiers.geometryChild.length === 0;

  return new Modifiers(
    lastOrder + newLastOrder,
    concatGeometry(modifiers.geometryParent, newGeomParent, mergeParent),
    concatGeometry(modifiers.geometryChild, newGeomChild, mergeChild),
    concatVec(modifiers.structureParent, newModifiers.structureParent),
    concatVec(modifiers.structureChild, newModifiers.structureChild)
  );
}

export function moveModifiers(xOrVector, y) {
  const vector = y !== undefined ? point(xOrVector, y) : xOrVector;
  return move(empty(), vector);
}

export function resizeModifiers(vector, origin, transform, transformInverse) {
  return resize(empty(), vector, origin, transform, transformInverse);
}

export function reflowModifiers() {
  return reflow(empty());
}

export function isEmpty(modifiers) {
  modifiers = ensureModifiers(modifiers);
  return modifiers.geometryChild.length === 0 &&
         modifiers.geometryParent.length === 0 &&
         modifiers.structureParent.length === 0 &&
         modifiers.structureChild.length === 0;
}

export function hasChildModifiers(modifiers) {
  modifiers = ensureModifiers(modifiers);
  return notEmpty(modifiers.geometryChild) || notEmpty(modifiers.structureChild);
}

export function hasGeometry(modifiers) {
  modifiers = ensureModifiers(modifiers);
  return notEmpty(modifiers.geometryParent) || notEmpty(modifiers.geometryChild);
}

export function hasStructure(modifiers) {
  modifiers = ensureModifiers(modifiers);
  return notEmpty(modifiers.structureParent) || notEmpty(modifiers.structureChild);
}

export function hasStructureChild(modifiers) {
  modifiers = ensureModifiers(modifiers);
  return notEmpty(modifiers.structureChild);
}

export function onlyMove(modifiers) {
  modifiers = ensureModifiers(modifiers);
  if (hasStructure(modifiers)) return false;
  const moveOpQ = (op) => op.type === 'move';
  return modifiers.geometryChild.every(moveOpQ) && modifiers.geometryParent.every(moveOpQ);
}

export function selectChild(modifiers) {
  modifiers = ensureModifiers(modifiers);
  return new Modifiers(modifiers.lastOrder, [], modifiers.geometryChild, [], modifiers.structureChild);
}

export function selectParent(modifiers) {
  modifiers = ensureModifiers(modifiers);
  return new Modifiers(modifiers.lastOrder, modifiers.geometryParent, [], modifiers.structureParent, []);
}

export function selectStructure(modifiers) {
  modifiers = ensureModifiers(modifiers);
  return new Modifiers(modifiers.lastOrder, [], [], modifiers.structureParent, modifiers.structureChild);
}

export function selectGeometry(modifiers) {
  modifiers = ensureModifiers(modifiers);
  return new Modifiers(modifiers.lastOrder, modifiers.geometryParent, modifiers.geometryChild, [], []);
}

export function selectChildStructureModifiers(modifiers) {
  return selectStructure(selectChild(modifiers));
}

export function addedChildrenFrames(modifTree) {
  const result = [];
  for (const [frameId, val] of Object.entries(modifTree)) {
    const structureParent = val?.modifiers?.structureParent;
    if (structureParent) {
      for (const op of structureParent) {
        if (op.type === 'add-children') {
          for (const id of op.value) {
            result.push({ frame: frameId, shape: id });
          }
        }
      }
    }
  }
  return result;
}

function transformMoveOp(m, modifier) {
  return mtMultiply(translateMatrix(modifier.vector), m);
}

function transformResizeOp(m, modifier) {
  let origin = modifier.origin;
  if (modifier.transformInverse) {
    origin = ptTransform(origin, modifier.transformInverse);
  }
  let result = matrix();
  if (modifier.transform) result = mtMultiply(modifier.transform, result);
  result = mtMultiply(translateMatrix(origin), result);
  result = mtMultiply(scaleMatrix(modifier.vector), result);
  result = mtMultiply(translateMatrix(negate(origin)), result);
  if (modifier.transformInverse) result = mtMultiply(modifier.transformInverse, result);
  return mtMultiply(result, m);
}

function transformRotateOp(m, modifier) {
  const center = modifier.center;
  const rot = modifier.rotation;
  return mtMultiply(
    mtMultiply(translateMatrix(center), rotateMatrix(rot)),
    mtMultiply(translateMatrix(negate(center)), m)
  );
}

const TRANSFORM_DISPATCH = new Map([
  ['move', transformMoveOp],
  ['resize', transformResizeOp],
  ['rotation', transformRotateOp],
]);

function transformOp(m, modifier) {
  const fn = TRANSFORM_DISPATCH.get(modifier.type);
  return fn ? fn(m, modifier) : m;
}

export function modifiersToTransform(modifiers) {
  modifiers = ensureModifiers(modifiers);
  const all = [...modifiers.geometryParent, ...modifiers.geometryChild]
    .sort((a, b) => a.order - b.order);
  return all.reduce((m, op) => transformOp(m, op), matrix());
}

const APPLY_MODIFIER_DISPATCH = new Map([
  ['rotation', (shape, op) => ({ ...shape, rotation: ((shape.rotation ?? 0) + op.value) % 360 })],
  ['add-children', (shape, op) => {
    const index = op.index;
    let shapes = shape.shapes ?? [];
    if (index != null) {
      shapes = [...shapes.slice(0, index), ...op.value, ...shapes.slice(index)];
    } else {
      shapes = [...shapes, ...op.value];
    }
    shapes = [...new Set(shapes)];
    return { ...shape, shapes };
  }],
  ['remove-children', (shape, op) => {
    const removeSet = new Set(op.value);
    return { ...shape, shapes: (shape.shapes ?? []).filter((id) => !removeSet.has(id)) };
  }],
  ['scale-content', (shape) => ({ ...shape })],
  ['change-property', (shape, op) => ({ ...shape, [op.property]: op.value })],
]);

export function applyModifier(shape, operation) {
  const fn = APPLY_MODIFIER_DISPATCH.get(operation.type);
  return fn ? fn(shape, operation) : shape;
}

export function applyStructureModifiers(shape, modifiers) {
  modifiers = ensureModifiers(modifiers);
  let result = shape;
  for (const op of modifiers.structureParent) {
    result = applyModifier(result, op);
  }
  for (const op of modifiers.structureChild) {
    result = applyModifier(result, op);
  }
  return result;
}