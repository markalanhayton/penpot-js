export const PI = Math.PI;

export function nan(v) {
  return Number.isNaN(v);
}

export function isFinite(v) {
  return v != null && Number.isFinite(v);
}

export function finite(v, defaultValue) {
  return isFinite(v) ? v : defaultValue;
}

export function abs(v) {
  return Math.abs(v);
}

export function sin(v) {
  return Math.sin(v);
}

export function cos(v) {
  return Math.cos(v);
}

export function acos(v) {
  return Math.acos(v);
}

export function tan(v) {
  return Math.tan(v);
}

export function atan2(x, y) {
  return Math.atan2(x, y);
}

export function neg(v) {
  return -v;
}

export function sq(v) {
  return v * v;
}

export function pow(b, e) {
  return Math.pow(b, e);
}

export function sqrt(v) {
  return Math.sqrt(v);
}

export function cubicroot(v) {
  if (v >= 0) {
    return pow(v, 1 / 3);
  }
  return -(pow(-v, 1 / 3));
}

export function floor(v) {
  return Math.floor(v);
}

export function round(v, step) {
  if (step !== undefined) {
    return round(v / step) * step;
  }
  return Math.round(v);
}

export function ceil(v) {
  return Math.ceil(v);
}

export function precision(v, n) {
  if (typeof v !== 'number' || !Number.isInteger(n)) return undefined;
  const d = pow(10, n);
  return round(v * d) / d;
}

export function toFixed(v, n) {
  return v.toFixed(n);
}

export function radians(degrees) {
  return degrees * (PI / 180);
}

export function degrees(radians) {
  return radians * (180 / PI);
}

export function hypot(a, b) {
  return Math.hypot(a, b);
}

export function distance([x1, y1], [x2, y2]) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return precision(hypot(dx, dy), 2);
}

export function log10(x) {
  return Math.log10(x);
}

export function clamp(num, from, to) {
  if (num < from) return from;
  if (num > to) return to;
  return num;
}

export function almostZero(num) {
  return abs(num) < 1e-4;
}

export function roundToZero(num) {
  if (abs(num) < 1e-4) return 0;
  return num;
}

export const FLOAT_EQUAL_PRECISION = 0.001;

export function close(num1, num2, precision = FLOAT_EQUAL_PRECISION) {
  return abs(num1 - num2) <= precision;
}

export function lerp(v0, v1, t) {
  return (1 - t) * v0 + t * v1;
}

export function maxAbs(a, b) {
  return Math.max(abs(a), abs(b));
}

export function sign(n) {
  return n < 0 ? -1 : 1;
}