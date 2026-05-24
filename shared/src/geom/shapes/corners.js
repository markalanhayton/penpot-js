import * as mth from '../../math.js';

function zeroDiv(a, b) {
  if (mth.almostZero(b)) return Infinity;
  return a / b;
}

export function fixRadius(width, height, r1, r2, r3, r4) {
  if (r2 === undefined) {
    const r = r1;
    const f = Math.min(1, zeroDiv(width, 2 * r), zeroDiv(height, 2 * r));
    return f < 1 ? r * f : r;
  }
  const f = Math.min(
    1,
    zeroDiv(width, r1 + r2),
    zeroDiv(height, r2 + r3),
    zeroDiv(width, r3 + r4),
    zeroDiv(height, r4 + r1)
  );
  if (f < 1) return [r1 * f, r2 * f, r3 * f, r4 * f];
  return [r1, r2, r3, r4];
}

export function shapeCorners1(shape) {
  const { width, height, r1 } = shape;
  if (r1 != null && !mth.almostZero(r1)) {
    return fixRadius(width, height, r1);
  }
  return 0;
}

export function shapeCorners4(shape) {
  const { width, height, r1, r2, r3, r4 } = shape;
  if (r1 != null && r2 != null && r3 != null && r4 != null) {
    return fixRadius(width, height, r1, r2, r3, r4);
  }
  return [r1, r2, r3, r4];
}

export function updateCornersScale(shape, scale) {
  return {
    ...shape,
    r1: (shape.r1 ?? 0) * scale,
    r2: (shape.r2 ?? 0) * scale,
    r3: (shape.r3 ?? 0) * scale,
    r4: (shape.r4 ?? 0) * scale,
  };
}