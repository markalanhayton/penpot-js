// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) KALEIDOS INC

import { WeakEqMap } from "./weak/impl_weak_map.js";
import { WeakValueMap } from "./weak/impl_weak_value_map.js";

export { WeakEqMap, WeakValueMap };

const state = new WeakMap();
let globalCounter = 0;

export function weakValueMap() {
  return new WeakValueMap();
}

export function weakMap() {
  return new WeakEqMap({ hash: (v) => {
    if (typeof v === "string") return v;
    if (typeof v === "number") return `n:${v}`;
    return v;
  }, equals: (a, b) => a === b });
}

export function weakKey(o) {
  let key = state.get(o);
  if (key !== undefined) {
    return key;
  }
  key = `weak-key${++globalCounter}`;
  state.set(o, key);
  return key;
}

export function memoize(fn) {
  const mem = weakMap();
  return function (...args) {
    const v = mem.get(args);
    if (v !== undefined) {
      return v;
    }
    const ret = fn.apply(this, args);
    mem.set(args, ret);
    return ret;
  };
}