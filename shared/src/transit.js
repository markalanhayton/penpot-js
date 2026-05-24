export class Pointer {
  constructor(id, metadata) {
    this.id = id;
    this.metadata = metadata || null;
  }

  deref() {
    return this.id;
  }

  valueOf() {
    return this.id;
  }
}

export function pointer(o) {
  if (o instanceof Pointer) return o;
  if (typeof o === 'string') return new Pointer(o);
  if (Array.isArray(o)) return new Pointer(o[0], o[1]);
  return new Pointer(o);
}

export function isPointer(o) {
  return o instanceof Pointer;
}

const writeHandlers = new Map();
const readHandlers = new Map();

export function addHandlers(handlers) {
  for (const h of handlers) {
    if (h.write) {
      writeHandlers.set(h.tag, h.write);
    }
    if (h.read) {
      readHandlers.set(h.tag, h.read);
    }
  }
}

addHandlers([
  {
    tag: 'm',
    write: (date) => String(date.getTime()),
    read: (v) => new Date(typeof v === 'string' ? parseInt(v, 10) : v),
  },
  {
    tag: 'u',
    write: (uuid) => uuid,
    read: (v) => v,
  },
  {
    tag: 'n',
    write: (n) => String(n),
    read: (v) => typeof v === 'string' ? parseInt(v, 10) : v,
  },
  {
    tag: 'penpot/pointer',
    write: (p) => [p.id, p.metadata],
    read: (v) => {
      const [id, meta] = Array.isArray(v) ? v : [v, null];
      return new Pointer(id, meta);
    },
  },
  {
    tag: 'uri',
    write: (uri) => String(uri),
    read: (v) => String(v),
  },
]);

export function encodeStr(data, opts = {}) {
  const encoded = encodeValue(data, opts, new WeakSet());
  return JSON.stringify(encoded);
}

export function decodeStr(data, opts = {}) {
  if (!data || typeof data !== 'string') return data;
  return decodeValue(JSON.parse(data));
}

export function isTransit(v) {
  try {
    if (typeof v !== 'string') return false;
    decodeStr(v);
    return true;
  } catch {
    return false;
  }
}

function encodeValue(val, opts, seen) {
  if (val === null || val === undefined) return null;

  if (typeof val === 'object' && seen.has(val)) return null;
  if (typeof val === 'object') seen.add(val);

  if (typeof val === 'string') {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
      return `~u${val}`;
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(val)) {
      const ms = new Date(val).getTime();
      if (!Number.isNaN(ms)) return `~m${ms}`;
    }
    if (val.startsWith(':')) return `~:${val.slice(1)}`;
    if (val.startsWith('~')) return `~${val}`;
    return val;
  }

  if (typeof val === 'number' || typeof val === 'boolean') return val;

  if (val instanceof Date) return `~m${val.getTime()}`;

  if (Array.isArray(val)) {
    return val.map((v) => encodeValue(v, opts, seen));
  }

  if (val instanceof Set) {
    return ['~#set', [...val].map((v) => encodeValue(v, opts, seen))];
  }

  if (val instanceof Map) {
    const entries = [];
    for (const [key, value] of val) {
      entries.push(encodeKey(key), encodeValue(value, opts, seen));
    }
    return ['^ ', ...entries];
  }

  if (isPointer(val)) {
    const handler = writeHandlers.get('penpot/pointer');
    if (handler) {
      const payload = handler(val);
      return ['^ penpot/pointer', ...payload.map((v) => encodeValue(v, opts, seen))];
    }
  }

  if (typeof val === 'object') {
    if (val.__type) {
      const { __type, ...rest } = val;
      const encoded = {};
      for (const [key, value] of Object.entries(rest)) {
        encoded[key] = encodeValue(value, opts, seen);
      }
      return [`^ ${__type}`, ...Object.entries(encoded).flat()];
    }

    const entries = [];
    for (const [key, value] of Object.entries(val)) {
      entries.push(encodeKey(key), encodeValue(value, opts, seen));
    }
    return ['^ ', ...entries];
  }

  return val;
}

function encodeKey(key) {
  if (typeof key === 'string') {
    if (/^[a-zA-Z][a-zA-Z0-9-]*$/.test(key) && key.includes('-')) {
      return `~:${key}`;
    }
    return key;
  }
  return encodeValue(key, {}, new WeakSet());
}

function decodeValue(val) {
  if (val === null || val === undefined) return val;

  if (typeof val === 'string') {
    if (val.startsWith('~:')) return val.slice(2);
    if (val.startsWith('~u')) return val.slice(2);
    if (val.startsWith('~m')) {
      const ms = parseInt(val.slice(2), 10);
      return new Date(ms);
    }
    if (val.startsWith('~$')) return val.slice(2);
    if (val.startsWith('~~')) return val.slice(1);
    return val;
  }

  if (Array.isArray(val)) {
    if (val.length === 0) return [];

    if (val[0] && typeof val[0] === 'string' && val[0].startsWith('^')) {
      const tag = val[0].slice(2);
      return decodeTaggedMap(tag, val.slice(1));
    }

    if (val[0] === '~#set') {
      return new Set(decodeValue(val[1]));
    }

    if (val[0] === '~#list') {
      return decodeValue(val[1]);
    }

    if (val[0] === '^ ') {
      const result = {};
      for (let i = 1; i < val.length; i += 2) {
        const key = typeof val[i] === 'string' && val[i].startsWith('~:')
          ? val[i].slice(2)
          : decodeValue(val[i]);
        result[key] = decodeValue(val[i + 1]);
      }
      return result;
    }

    return val.map(decodeValue);
  }

  if (typeof val === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(val)) {
      const decodedKey = key.startsWith('~:') ? key.slice(2) : key;
      result[decodedKey] = decodeValue(value);
    }
    return result;
  }

  return val;
}

function decodeTaggedMap(tag, items) {
  const obj = {};
  for (let i = 0; i < items.length; i += 2) {
    const key = typeof items[i] === 'string' && items[i].startsWith('~:')
      ? items[i].slice(2)
      : decodeValue(items[i]);
    obj[key] = decodeValue(items[i + 1]);
  }

  if (tag === '' || tag === ' ') return obj;

  const handler = readHandlers.get(tag);
  if (handler) return handler(obj);

  switch (tag) {
    case 'penpot/pointer':
      return new Pointer(obj.id || obj[0], obj.metadata || obj[1]);
    default:
      return { __type: tag, ...obj };
  }
}