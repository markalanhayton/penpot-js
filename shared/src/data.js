const SENTINEL = Symbol('sentinel');

export function pick(obj, keys) {
  const result = {};
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

export function selectKeys(obj, keys) {
  if (!obj) return {};
  const result = {};
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

export function equal(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return a === b;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!equal(a[key], b[key])) return false;
  }
  return true;
}

export function getIn(obj, path, defaultValue) {
  let current = obj;
  for (const key of path) {
    if (current == null) return defaultValue;
    current = current[key];
  }
  if (current === undefined) return defaultValue;
  return current;
}

export function setIn(obj, path, value) {
  if (path.length === 0) return value;

  const key = path[0];
  const rest = path.slice(1);

  if (rest.length === 0) {
    return { ...obj, [key]: value };
  }

  const current = obj?.[key];
  return { ...obj, [key]: setIn(current ?? {}, rest, value) };
}

export function nilv(v, fallback) {
  return v == null ? fallback : v;
}

export function formatNumber(num, precision) {
  const factor = Math.pow(10, precision);
  return Math.round(num * factor) / factor;
}

export function dissocIn(m, path) {
  const [key, ...ks] = path;
  if (ks.length > 0) {
    const nextMap = m?.[key];
    if (nextMap == null) return m;
    const newMap = dissocIn(nextMap, ks);
    if (Object.keys(newMap).length === 0) {
      const { [key]: _, ...rest } = m;
      return rest;
    }
    return { ...m, [key]: newMap };
  }
  const { [key]: _, ...rest } = m;
  return rest;
}

export function deepMerge(a, b) {
  if (a == null) return b;
  if (b == null) return a;
  if (typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const result = { ...a };
    for (const key of Object.keys(b)) {
      result[key] = deepMerge(a[key], b[key]);
    }
    return result;
  }
  return b;
}

export function withoutNils(data) {
  if (data == null) return data;
  const result = {};
  for (const [k, v] of Object.entries(data)) {
    if (v != null) {
      result[k] = v;
    }
  }
  return result;
}

export function patchObject(object, changes) {
  if (object == null) return withoutNils(changes);
  let result = { ...object };
  for (const [key, value] of Object.entries(changes)) {
    if (value != null && typeof value === 'object' && !Array.isArray(value) && typeof result[key] === 'object' && result[key] !== null) {
      result[key] = patchObject(result[key], value);
    } else if (value == null) {
      delete result[key];
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function indexBy(coll, keyFn, valueFn) {
  const result = {};
  for (const item of coll) {
    result[keyFn(item)] = valueFn ? valueFn(item) : item;
  }
  return result;
}

export function groupBy(coll, keyFn, valueFn) {
  const result = {};
  for (const item of coll) {
    const key = keyFn(item);
    if (!result[key]) result[key] = [];
    result[key].push(valueFn ? valueFn(item) : item);
  }
  return result;
}

export function seek(pred, coll, defaultValue = null) {
  for (const item of coll) {
    if (pred(item)) return item;
  }
  return defaultValue;
}

export function indexOf(coll, v) {
  for (let i = 0; i < coll.length; i++) {
    if (coll[i] === v) return i;
  }
  return -1;
}

export function indexOfPred(coll, pred) {
  for (let i = 0; i < coll.length; i++) {
    if (pred(coll[i])) return i;
  }
  return -1;
}

export function removeAtIndex(arr, index) {
  return [...arr.slice(0, index), ...arr.slice(index + 1)];
}

export function replaceById(coll, item) {
  return coll.map((existing) =>
    existing.id === item.id ? item : existing
  );
}

export function withoutObj(coll, obj) {
  return coll.filter((item) => item !== obj);
}

export function enumerate(items, start = 0) {
  const result = [];
  for (let i = 0; i < items.length; i++) {
    result.push([start + i, items[i]]);
  }
  return result;
}

export function concatVec(...colls) {
  const result = [];
  for (const coll of colls) {
    if (Array.isArray(coll)) {
      result.push(...coll);
    } else {
      for (const item of coll) result.push(item);
    }
  }
  return result;
}

export function concatSet(...colls) {
  const result = new Set();
  for (const coll of colls) {
    if (coll instanceof Set) {
      for (const item of coll) result.add(item);
    } else {
      for (const item of coll) result.add(item);
    }
  }
  return result;
}

export function zip(col1, col2) {
  const len = Math.min(col1.length, col2.length);
  const result = [];
  for (let i = 0; i < len; i++) {
    result.push([col1[i], col2[i]]);
  }
  return result;
}

export function zipAll(col1, col2) {
  const len = Math.max(col1.length, col2.length);
  const result = [];
  for (let i = 0; i < len; i++) {
    result.push([col1[i], col2[i]]);
  }
  return result;
}

export function mapMap(mfn, coll) {
  if (coll == null) return coll;
  const result = {};
  for (const [k, v] of Object.entries(coll)) {
    result[k] = mfn(k, v);
  }
  return result;
}

export function filterMap(pred, coll) {
  const result = {};
  for (const [k, v] of Object.entries(coll)) {
    if (pred([k, v])) result[k] = v;
  }
  return result;
}

export function removeMap(pred, coll) {
  const result = {};
  for (const [k, v] of Object.entries(coll)) {
    if (!pred([k, v])) result[k] = v;
  }
  return result;
}

export function updateVals(m, f) {
  const result = {};
  for (const [k, v] of Object.entries(m)) {
    result[k] = f(v);
  }
  return result;
}

export function updateWhen(m, key, f, ...args) {
  const found = m[key];
  if (found === undefined) return m;
  return { ...m, [key]: f(found, ...args) };
}

export function assocWhen(m, key, value) {
  const found = m[key];
  if (found === undefined) return m;
  return { ...m, [key]: value };
}

export function updateInWhen(m, keySeq, f, ...args) {
  const found = getIn(m, keySeq);
  if (found === undefined) return m;
  return setIn(m, keySeq, f(found, ...args));
}

export function inRange(size, i) {
  return i >= 0 && i < size;
}

export function notEmpty(coll) {
  if (Array.isArray(coll)) return coll.length > 0;
  if (coll instanceof Set || coll instanceof Map) return coll.size > 0;
  if (typeof coll === 'object') return Object.keys(coll).length > 0;
  return false;
}

export function vecWithoutNils(coll) {
  return coll.filter((x) => x != null);
}

export function withNext(coll) {
  const result = [];
  for (let i = 0; i < coll.length; i++) {
    result.push([coll[i], coll[i + 1] ?? null]);
  }
  return result;
}

export function withPrev(coll) {
  const result = [];
  for (let i = 0; i < coll.length; i++) {
    result.push([coll[i], coll[i - 1] ?? null]);
  }
  return result;
}

export function withPrevNext(coll) {
  const result = [];
  for (let i = 0; i < coll.length; i++) {
    result.push([coll[i], coll[i - 1] ?? null, coll[i + 1] ?? null]);
  }
  return result;
}

export function distinctBy(f) {
  const seen = new Set();
  return (item) => {
    const key = f(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  };
}

export function truncate(s, maxLength) {
  if (typeof s !== 'string') return s;
  return s.slice(0, Math.min(maxLength, s.length));
}

export function obfuscateString(s, enabled = true) {
  if (!enabled || typeof s !== 'string') return s;
  if (s.length <= 2) return '*'.repeat(s.length);
  return s[0] + '*'.repeat(s.length - 2) + s[s.length - 1];
}

export function assert(hint, fn) {
  if (!fn()) {
    throw new Error(hint || 'assertion failed');
  }
}

export function withoutKeys(obj, keys) {
  const keySet = new Set(keys);
  const result = { ...obj };
  for (const key of keySet) delete result[key];
  return result;
}

export function getf(objects) {
  return (id) => objects[id];
}

export function insertAtIndex(arr, index, items) {
  return [...arr.slice(0, index), ...items, ...arr.slice(index)];
}

export function unstableSort(comp, items) {
  return [...items].sort(comp);
}

export { SENTINEL as sentinel };