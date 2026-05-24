// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) KALEIDOS INC

const BASE_KEYS = Symbol("baseKeys");
const META_KEY = Symbol("meta");

export function defineRecord(name, baseFields) {
  const fieldNames = Object.freeze([...baseFields]);

  function create(values = {}) {
    const obj = {};
    for (const key of baseFields) {
      obj[key] = values[key] !== undefined ? values[key] : null;
    }
    obj[META_KEY] = null;
    return obj;
  }

  function createFromMap(params) {
    const obj = {};
    for (const key of baseFields) {
      obj[key] = params[key] !== undefined ? params[key] : null;
    }
    obj[META_KEY] = null;
    return Object.freeze(obj);
  }

  function get(obj, key, notFound) {
    if (baseFields.includes(key)) {
      return obj[key] !== undefined ? obj[key] : notFound;
    }
    if (obj[META_KEY] && key in obj[META_KEY]) {
      return obj[META_KEY][key];
    }
    return notFound;
  }

  function set(obj, key, value) {
    if (baseFields.includes(key)) {
      return Object.freeze({ ...obj, [key]: value, [META_KEY]: obj[META_KEY] });
    }
    return Object.freeze({ ...obj, [META_KEY]: { ...(obj[META_KEY] || {}), [key]: value } });
  }

  function equiv(obj, other, exceptions = []) {
    if (obj === other) return true;
    if (!other || typeof other !== "object") return false;
    for (const key of baseFields) {
      if (exceptions.includes(key)) continue;
      if (obj[key] !== other[key]) return false;
    }
    const objExtmap = obj[META_KEY] || {};
    const otherExtmap = other[META_KEY] || {};
    const allKeys = new Set([...Object.keys(objExtmap), ...Object.keys(otherExtmap)]);
    for (const key of allKeys) {
      if (exceptions.includes(key)) continue;
      if (objExtmap[key] !== otherExtmap[key]) return false;
    }
    return true;
  }

  function count(obj) {
    return baseFields.length + Object.keys(obj[META_KEY] || {}).length;
  }

  function toMap(obj) {
    const result = {};
    for (const key of baseFields) {
      result[key] = obj[key];
    }
    if (obj[META_KEY]) {
      Object.assign(result, obj[META_KEY]);
    }
    return result;
  }

  function containsKey(obj, key) {
    if (baseFields.includes(key)) return true;
    if (obj[META_KEY] && key in obj[META_KEY]) return true;
    return false;
  }

  function dissoc(obj, key) {
    if (baseFields.includes(key)) {
      return set(obj, key, null);
    }
    const extmap = { ...(obj[META_KEY] || {}) };
    delete extmap[key];
    return Object.freeze({ ...obj, [META_KEY]: Object.keys(extmap).length > 0 ? extmap : null });
  }

  function clone(obj) {
    return Object.freeze({ ...obj, [META_KEY]: obj[META_KEY] ? { ...obj[META_KEY] } : null });
  }

  function assocBang(obj, key, value) {
    if (baseFields.includes(key)) {
      obj[key] = value;
    } else {
      if (!obj[META_KEY]) {
        obj[META_KEY] = {};
      }
      obj[META_KEY][key] = value;
    }
    return obj;
  }

  function defineProperties(obj, properties) {
    for (const { name: propName, get: getFn, set: setFn } of properties) {
      const descriptor = {
        enumerable: true,
        configurable: true,
      };
      if (getFn) {
        descriptor.get = function () {
          return getFn(obj);
        };
      }
      if (setFn) {
        descriptor.set = function (value) {
          setFn(obj, value);
        };
      }
      Object.defineProperty(obj, propName, descriptor);
    }
    return obj;
  }

  return {
    name,
    fields: fieldNames,
    create,
    createFromMap,
    get,
    set,
    equiv,
    count,
    toMap,
    containsKey,
    dissoc,
    clone,
    assocBang,
    defineProperties,
  };
}