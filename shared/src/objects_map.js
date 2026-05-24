const SENTINEL = Symbol('objects-map');

export function isObjectsMap(o) {
  return o != null && o[SENTINEL] === true;
}

export function create(data) {
  const map = new Map();
  if (data) {
    if (data instanceof Map) {
      for (const [k, v] of data) map.set(k, v);
    } else if (typeof data === 'object') {
      for (const [k, v] of Object.entries(data)) {
        map.set(k, v);
      }
    }
  }
  map[SENTINEL] = true;
  return map;
}

export function wrap(objects) {
  if (isObjectsMap(objects)) return objects;
  const map = create();
  if (objects) {
    if (objects instanceof Map) {
      for (const [k, v] of objects) map.set(k, v);
    } else if (typeof objects === 'object') {
      for (const [k, v] of Object.entries(objects)) {
        map.set(k, v);
      }
    }
  }
  return map;
}

export function count(omap) {
  return omap.size;
}

export function get(omap, key, notFound) {
  if (omap.has(key)) return omap.get(key);
  return notFound;
}

export function has(omap, key) {
  return omap.has(key);
}

export function set(omap, key, value) {
  const result = create(omap);
  result.set(key, value);
  return result;
}

export function del(omap, key) {
  const result = create(omap);
  result.delete(key);
  return result;
}

export function keys(omap) {
  return [...omap.keys()];
}

export function vals(omap) {
  return [...omap.values()];
}

export function entries(omap) {
  return [...omap.entries()];
}

export function toObject(omap) {
  const result = {};
  for (const [k, v] of omap) {
    result[k] = v;
  }
  return result;
}

export function fromObject(obj) {
  return create(obj);
}

export function reduceKv(omap, f, init) {
  let result = init;
  for (const [k, v] of omap) {
    result = f(result, k, v);
  }
  return result;
}

export function mapKv(omap, f) {
  const result = new Map();
  for (const [k, v] of omap) {
    const [nk, nv] = f(k, v);
    result.set(nk, nv);
  }
  result[SENTINEL] = true;
  return result;
}

export function filterKv(omap, pred) {
  const result = new Map();
  for (const [k, v] of omap) {
    if (pred(k, v)) result.set(k, v);
  }
  result[SENTINEL] = true;
  return result;
}