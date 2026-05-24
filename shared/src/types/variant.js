import { ceil, sqrt, pow } from '../math.js';

export const PROPERTY_PREFIX = 'Property ';
export const PROPERTY_REGEX = new RegExp(`${PROPERTY_PREFIX}(\\d+)`);
export const PROPERTY_MAX_LENGTH = 60;
export const VALUE_PREFIX = 'Value ';

export function propertiesToName(properties) {
  return properties
    .map((p) => p.value)
    .filter((v) => v !== '')
    .join(', ');
}

export function nextPropertyNumber(properties) {
  let maxNum = 0;
  for (const p of properties) {
    const match = p.name.match(PROPERTY_REGEX);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return Math.max(maxNum, properties.length) + 1;
}

export function addNewProp(props, value) {
  return [...props, { name: `${PROPERTY_PREFIX}${nextPropertyNumber(props)}`, value }];
}

export function addNewProps(props, values) {
  const nextNum = nextPropertyNumber(props);
  const newProps = values.map((v, i) => ({
    name: `${PROPERTY_PREFIX}${nextNum + i}`,
    value: v,
  }));
  return [...props, ...newProps];
}

export function pathToProperties(path, properties, minProps = 0) {
  const cpath = splitPath(path);
  const totalProps = Math.max(cpath.length, minProps);
  const assigned = properties.map((p, i) => ({
    ...p,
    value: cpath[i] ?? '',
  }));
  const remaining = cpath.slice(properties.length);
  while (assigned.length < totalProps) {
    assigned.push({ name: '', value: '' });
  }
  return addNewProps(assigned, remaining);
}

function splitPath(path) {
  return path.split(' / ');
}

export function propertiesMapToFormula(properties) {
  return properties
    .filter((p) => p.value && p.value.trim() !== '')
    .map((p) => `${p.name}=${p.value}`)
    .join(', ');
}

export function propertiesFormulaToMap(s) {
  return s
    .split(',')
    .map((part) => part.split('=').map((x) => x.trim()))
    .filter(([k, v]) => v && v.trim() !== '')
    .map(([k, v]) => ({ name: k, value: v }));
}

export function validPropertiesFormulaQ(s) {
  const parts = s.split(',');
  return parts.every((part) => {
    const kv = part.split('=');
    if (kv.length !== 2) return false;
    const k = kv[0].trim();
    const v = kv[1].trim();
    return k.length > 0 && k.length < PROPERTY_MAX_LENGTH && v.length > 0 && v.length < PROPERTY_MAX_LENGTH;
  });
}

export function findPropertiesToRemove(prevProps, updProps) {
  const updNames = new Set(updProps.map((p) => p.name));
  return prevProps.filter((p) => !updNames.has(p.name));
}

export function findPropertiesToUpdate(prevProps, updProps) {
  return updProps.filter((upd) =>
    prevProps.some((prev) => prev.name === upd.name && prev.value !== upd.value)
  );
}

export function findPropertiesToAdd(prevProps, updProps) {
  const prevNames = new Set(prevProps.map((p) => p.name));
  return updProps.filter((p) => !prevNames.has(p.name));
}

function splitBaseNameAndNumber(item) {
  const pattern = /^(.+?)\s*\((\d+)\)\s*$/;
  const match = item.match(pattern);
  if (match) return [match[1].trim(), parseInt(match[2], 10)];
  return [item.trim(), 0];
}

function groupNumbersByBaseName(items) {
  const result = {};
  for (const item of items) {
    const [base, num] = splitBaseNameAndNumber(item);
    if (!result[base]) result[base] = new Set();
    result[base].add(num);
  }
  return result;
}

export function updateNumberInRepeatedItem(items, item) {
  const names = groupNumbersByBaseName(items);
  const [base, num] = splitBaseNameAndNumber(item);
  const numsTaken = names[base] ?? new Set();
  let n = num;
  while (numsTaken.has(n)) n++;
  return n > 0 ? `${base} (${n})` : base;
}

export function updateNumberInRepeatedPropNames(props) {
  const result = [];
  for (const prop of props) {
    result.push({
      name: updateNumberInRepeatedItem(result.map((p) => p.name), prop.name),
      value: prop.value,
    });
  }
  return result;
}

export function findIndexForPropertyName(props, name) {
  for (let i = 0; i < props.length; i++) {
    if (props[i].name === name) return i;
  }
  return null;
}

export function removePrefix(name, prefix) {
  const longName = `${prefix} / `;
  if (name.startsWith(longName)) return name.slice(longName.length);
  if (name.startsWith(prefix)) return name.slice(prefix.length);
  return name;
}

function matchingIndices(props1, props2) {
  const namesInP2 = new Set(props2.map((p) => p.name));
  const result = new Set();
  props1.forEach((p, idx) => {
    if (namesInP2.has(p.name)) result.add(idx);
  });
  return result;
}

function findPosition(name, props, usedPos) {
  const idx = findIndexForPropertyName(props, name);
  if (idx != null) return idx;
  let p = 0;
  while (usedPos.has(p)) p++;
  return p;
}

export function mergeProperties(props1, props2) {
  const filtered = props2.filter((p) => p.value !== '');
  let currentProps = [...props1];
  let usedPos = matchingIndices(props1, props2);

  for (const prop of filtered) {
    const pos = findPosition(prop.name, currentProps, usedPos);
    usedPos = new Set(usedPos);
    usedPos.add(pos);

    if (pos < currentProps.length) {
      currentProps = currentProps.map((p, i) => i === pos ? { ...p, value: prop.value } : p);
    } else {
      currentProps = addNewProp(currentProps, prop.value);
    }
  }
  return currentProps;
}

export function compareProperties(propsList, distinctMark) {
  const grouped = {};
  for (const props of propsList) {
    for (const p of props) {
      if (!grouped[p.name]) grouped[p.name] = [];
      grouped[p.name].push(p);
    }
  }
  return Object.entries(grouped).map(([name, values]) => {
    const vals = values.map((v) => v.value);
    const allEqual = vals.every((v) => v === vals[0]);
    return { name, value: allEqual ? vals[0] : distinctMark };
  });
}

export function sameVariantQ(components) {
  const variantIds = [...new Set(components.map((c) => c['variant-id']))];
  return variantIds.length === 1 && variantIds[0] != null && variantIds[0] !== '';
}

export function distance(props1, props2) {
  const total = Math.max(props1.length, props2.length);
  let result = 0;
  for (let i = 0; i < total; i++) {
    const p1 = props1[i];
    const p2 = props2[i];
    if (!p1 || !p2 || p1.value !== p2.value) {
      result += pow(2, total - i);
    }
  }
  return result;
}

export function variantNameToName(variant) {
  const namePart = variant['variant-name']?.replace(/, /g, ' / ') ?? '';
  return namePart ? `${variant.name} / ${namePart}` : variant.name;
}

const BOOLEAN_PAIRS = [
  ['on', 'off'],
  ['yes', 'no'],
  ['true', 'false'],
];

export function validVariantComponentQ(component) {
  return component != null && component['variant-id'] != null;
}

export function findBooleanPair(arr) {
  if (arr.length !== 2) return null;
  const a = String(arr[0]).trim().toLowerCase();
  const b = String(arr[1]).trim().toLowerCase();
  for (const [t, f] of BOOLEAN_PAIRS) {
    if (a === t && b === f) return { [arr[0]]: true, [arr[1]]: false };
    if (b === t && a === f) return { [arr[1]]: true, [arr[0]]: false };
  }
  return null;
}