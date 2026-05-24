import { parseSvgPath } from './svg_parser.js';

const SEGMENT_U8_SIZE = 28;
const MAX_SAFE_INT = 2147483647;
const MIN_SAFE_INT = -2147483648;

function normalizeCoord(v) {
  if (v > MAX_SAFE_INT) return MAX_SAFE_INT;
  if (v < MIN_SAFE_INT) return MIN_SAFE_INT;
  return v;
}

export function pathDataQ(o) {
  return o instanceof PathData;
}

export function fromPlain(segments) {
  return new PathData(segments.map(normalizeSegment));
}

export function fromString(s) {
  return fromPlain(parseSvgPath(s));
}

export function fromBytes(buffer) {
  if (buffer instanceof ArrayBuffer) {
    return fromDataView(new DataView(buffer));
  }
  if (buffer instanceof DataView) {
    return fromDataView(buffer);
  }
  if (ArrayBuffer.isView(buffer)) {
    return fromDataView(new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength));
  }
  throw new Error('invalid data provided');
}

function fromDataView(dv) {
  const size = dv.byteLength;
  const count = Math.floor(size / SEGMENT_U8_SIZE);
  const segments = [];
  for (let i = 0; i < count; i++) {
    const offset = i * SEGMENT_U8_SIZE;
    const type = dv.getInt8(offset, true);
    const c1x = normalizeCoord(dv.getFloat32(offset + 4, true));
    const c1y = normalizeCoord(dv.getFloat32(offset + 8, true));
    const c2x = normalizeCoord(dv.getFloat32(offset + 12, true));
    const c2y = normalizeCoord(dv.getFloat32(offset + 16, true));
    const x = normalizeCoord(dv.getFloat32(offset + 20, true));
    const y = normalizeCoord(dv.getFloat32(offset + 24, true));
    segments.push(readSegmentFromFields(type, c1x, c1y, c2x, c2y, x, y));
  }
  return new PathData(segments.filter(s => s !== null));
}

function readSegmentFromFields(type, c1x, c1y, c2x, c2y, x, y) {
  switch (type) {
    case 1: return { command: 'move-to', params: { x, y } };
    case 2: return { command: 'line-to', params: { x, y } };
    case 3: return { command: 'curve-to', params: { x, y, c1x, c1y, c2x, c2y } };
    case 4: return { command: 'close-path', params: {} };
    default: return null;
  }
}

function normalizeSegment(segment) {
  const params = { ...segment.params };
  if (params.x !== undefined) params.x = normalizeCoord(params.x);
  if (params.y !== undefined) params.y = normalizeCoord(params.y);
  if (params.c1x !== undefined) params.c1x = normalizeCoord(params.c1x);
  if (params.c1y !== undefined) params.c1y = normalizeCoord(params.c1y);
  if (params.c2x !== undefined) params.c2x = normalizeCoord(params.c2x);
  if (params.c2y !== undefined) params.c2y = normalizeCoord(params.c2y);
  return { command: segment.command, params };
}

export function pathData(data) {
  if (pathDataQ(data)) return data;
  if (data === null || data === undefined) return fromPlain([]);
  if (Array.isArray(data)) return fromPlain(data);
  throw new Error('unexpected data');
}

export function checkSegment(segment) {
  const validCommands = ['move-to', 'line-to', 'curve-to', 'close-path'];
  if (!segment || !validCommands.includes(segment.command)) {
    throw new Error(`invalid segment: ${JSON.stringify(segment)}`);
  }
  return segment;
}

function getSegmentTypeCode(command) {
  switch (command) {
    case 'move-to': return 1;
    case 'line-to': return 2;
    case 'curve-to': return 3;
    case 'close-path': return 4;
    default: return 0;
  }
}

class PathData {
  constructor(segments) {
    this._segments = segments;
    this._cache = new Map();
  }

  get length() {
    return this._segments.length;
  }

  [Symbol.iterator]() {
    return this._segments[Symbol.iterator]();
  }

  get(index) {
    return this._segments[index];
  }

  slice(start, end) {
    return this._segments.slice(start, end);
  }

  indexOf(segment) {
    return this._segments.indexOf(segment);
  }

  map(fn) {
    return this._segments.map(fn);
  }

  filter(fn) {
    return this._segments.filter(fn);
  }

  reduce(fn, initial) {
    return this._segments.reduce(fn, initial);
  }

  every(fn) {
    return this._segments.every(fn);
  }

  some(fn) {
    return this._segments.some(fn);
  }

  forEach(fn) {
    this._segments.forEach(fn);
  }

  concat(other) {
    if (pathDataQ(other)) {
      return new PathData([...this._segments, ...other._segments]);
    }
    return new PathData([...this._segments, ...other]);
  }

  transform(m) {
    const { a, b, c, d, e, f } = m;
    const newSegments = this._segments.map(seg => {
      const params = { ...seg.params };
      if (params.x !== undefined && params.y !== undefined) {
        const x = params.x, y = params.y;
        params.x = x * a + y * c + e;
        params.y = x * b + y * d + f;
      }
      if (params.c1x !== undefined && params.c1y !== undefined) {
        const c1x = params.c1x, c1y = params.c1y;
        params.c1x = c1x * a + c1y * c + e;
        params.c1y = c1x * b + c1y * d + f;
      }
      if (params.c2x !== undefined && params.c2y !== undefined) {
        const c2x = params.c2x, c2y = params.c2y;
        params.c2x = c2x * a + c2y * c + e;
        params.c2y = c2x * b + c2y * d + f;
      }
      return { command: seg.command, params };
    });
    return new PathData(newSegments);
  }

  walk(fn, initial) {
    let result = [...initial];
    for (let i = 0; i < this._segments.length; i++) {
      const seg = this._segments[i];
      const { command, params } = seg;
      const c1x = params.c1x ?? 0;
      const c1y = params.c1y ?? 0;
      const c2x = params.c2x ?? 0;
      const c2y = params.c2y ?? 0;
      const x = params.x ?? 0;
      const y = params.y ?? 0;
      const res = fn(command, c1x, c1y, c2x, c2y, x, y);
      if (res !== undefined) result.push(res);
    }
    return result;
  }

  reduceInternal(fn, initial) {
    let result = initial;
    for (let i = 0; i < this._segments.length; i++) {
      const seg = this._segments[i];
      const { command, params } = seg;
      const c1x = params.c1x ?? 0;
      const c1y = params.c1y ?? 0;
      const c2x = params.c2x ?? 0;
      const c2y = params.c2y ?? 0;
      const x = params.x ?? 0;
      const y = params.y ?? 0;
      result = fn(result, i, command, c1x, c1y, c2x, c2y, x, y);
    }
    return result;
  }

  lookup(index, fn) {
    if (index < 0 || index >= this._segments.length) return undefined;
    const seg = this._segments[index];
    const { command, params } = seg;
    const c1x = params.c1x ?? 0;
    const c1y = params.c1y ?? 0;
    const c2x = params.c2x ?? 0;
    const c2y = params.c2y ?? 0;
    const x = params.x ?? 0;
    const y = params.y ?? 0;
    return fn(command, c1x, c1y, c2x, c2y, x, y);
  }

  getByteSize() {
    return this._segments.length * SEGMENT_U8_SIZE;
  }

  writeTo(buffer, offset) {
    const view = new DataView(buffer, offset, this._segments.length * SEGMENT_U8_SIZE);
    for (let i = 0; i < this._segments.length; i++) {
      const seg = this._segments[i];
      const o = i * SEGMENT_U8_SIZE;
      const params = seg.params;
      view.setFloat32(o + 4, params.c1x ?? 0, true);
      view.setFloat32(o + 8, params.c1y ?? 0, true);
      view.setFloat32(o + 12, params.c2x ?? 0, true);
      view.setFloat32(o + 16, params.c2y ?? 0, true);
      view.setFloat32(o + 20, params.x ?? 0, true);
      view.setFloat32(o + 24, params.y ?? 0, true);
      view.setInt8(o, getSegmentTypeCode(seg.command));
    }
  }

  toString() {
    return this._segments.map(seg => {
      const p = seg.params;
      switch (seg.command) {
        case 'move-to': return `M${p.x},${p.y}`;
        case 'line-to': return `L${p.x},${p.y}`;
        case 'curve-to': return `C${p.c1x},${p.c1y},${p.c2x},${p.c2y},${p.x},${p.y}`;
        case 'close-path': return 'Z';
        default: return '';
      }
    }).join('');
  }

  toJSON() {
    return this.toString();
  }

  equals(other) {
    if (!(other instanceof PathData)) return false;
    if (this._segments.length !== other._segments.length) return false;
    return this._segments.every((seg, i) => {
      const o = other._segments[i];
      return seg.command === o.command && JSON.stringify(seg.params) === JSON.stringify(o.params);
    });
  }
}

export function decodeSegments(segments) {
  return segments.map(seg => {
    if (typeof seg.command === 'string') return seg;
    return { command: seg.command, params: { ...seg.params } };
  });
}