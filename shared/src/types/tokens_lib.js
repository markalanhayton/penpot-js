import { next } from '../uuid.js';
import { now as timeNow } from '../time.js';

export class Token {
  constructor(attrs = {}) {
    this.id = attrs.id ?? next();
    this.name = attrs.name ?? '';
    this.type = attrs.type ?? 'other';
    this.value = attrs.value ?? '';
    this.description = attrs.description ?? '';
    this['modified-at'] = attrs['modified-at'] ?? timeNow();
  }
}

export function isToken(o) {
  return o instanceof Token;
}

export function makeToken(attrs = {}) {
  return new Token({
    ...attrs,
    id: attrs.id ?? next(),
    'modified-at': attrs['modified-at'] ?? timeNow(),
    description: attrs.description ?? '',
  });
}

export function tokenGetId(token) {
  return token?.id;
}

export function tokenGetName(token) {
  return token?.name;
}

export function tokenGetDescription(token) {
  return token?.description;
}

export function tokenGetModifiedAt(token) {
  return token?.['modified-at'];
}

export function tokenRename(token, newName) {
  return new Token({ ...token, name: newName, 'modified-at': timeNow() });
}

export function tokenReid(token, newId) {
  return new Token({ ...token, id: newId, 'modified-at': timeNow() });
}

export function tokenSetDescription(token, desc) {
  return new Token({ ...token, description: desc, 'modified-at': timeNow() });
}

export function getTokenPath(token) {
  return token?.name?.split('.') ?? [];
}

export function groupByType(tokens) {
  const arr = Array.isArray(tokens)
    ? tokens
    : typeof tokens === 'object' && tokens !== null
      ? Object.values(tokens)
      : [];
  const result = {};
  for (const t of arr) {
    const type = t.type ?? 'other';
    if (!result[type]) result[type] = [];
    result[type].push(t);
  }
  return result;
}

export class TokenSet {
  constructor(attrs = {}) {
    this.id = attrs.id ?? next();
    this.name = attrs.name ?? '';
    this.description = attrs.description ?? '';
    this['modified-at'] = attrs['modified-at'] ?? timeNow();
    this.tokens = attrs.tokens ?? [];
    this.path = attrs.path ?? this.name;
    this.group = attrs.group ?? null;
  }
}

export function isTokenSet(o) {
  return o instanceof TokenSet;
}

export function makeTokenSet(attrs = {}) {
  return new TokenSet({
    ...attrs,
    id: attrs.id ?? next(),
    'modified-at': attrs['modified-at'] ?? timeNow(),
  });
}

export function tokenSetAddToken(set, token) {
  return new TokenSet({ ...set, tokens: [...set.tokens, token.id], 'modified-at': timeNow() });
}

export function tokenSetUpdateToken(set, tokenId, f) {
  return new TokenSet({ ...set, 'modified-at': timeNow() });
}

export function tokenSetDeleteToken(set, tokenId) {
  return new TokenSet({
    ...set,
    tokens: set.tokens.filter((id) => id !== tokenId),
    'modified-at': timeNow(),
  });
}

export function tokenSetGetToken(set, tokensMap, tokenId) {
  return tokensMap?.[tokenId];
}

export function tokenSetGetTokenByName(set, tokensMap, name) {
  for (const id of set.tokens) {
    const t = tokensMap?.[id];
    if (t && t.name === name) return t;
  }
  return undefined;
}

export function tokenSetGetTokens(set, tokensMap) {
  return set.tokens.map((id) => tokensMap?.[id]).filter(Boolean);
}

export class TokenTheme {
  constructor(attrs = {}) {
    this.id = attrs.id ?? next();
    this.name = attrs.name ?? '';
    this.description = attrs.description ?? '';
    this['modified-at'] = attrs['modified-at'] ?? timeNow();
    this.sets = attrs.sets ?? [];
    this.group = attrs.group ?? null;
    this.isChanged = attrs.isChanged ?? false;
  }
}

export function isTokenTheme(o) {
  return o instanceof TokenTheme;
}

export function makeTokenTheme(attrs = {}) {
  return new TokenTheme({
    ...attrs,
    id: attrs.id ?? next(),
    'modified-at': attrs['modified-at'] ?? timeNow(),
  });
}

export const HIDDEN_THEME_ID = '00000000-0000-0000-0000-000000000001';
export const HIDDEN_THEME_GROUP = '$$hidden$$';
export const HIDDEN_THEME_NAME = '$$hidden$$';
export const HIDDEN_THEME_PATH = [HIDDEN_THEME_GROUP, HIDDEN_THEME_NAME];

export function makeHiddenTheme() {
  return makeTokenTheme({
    id: HIDDEN_THEME_ID,
    name: HIDDEN_THEME_NAME,
    group: HIDDEN_THEME_GROUP,
  });
}

export class TokensLib {
  constructor(attrs = {}) {
    this.sets = attrs.sets ?? {};
    this.themes = attrs.themes ?? {};
    this.tokens = attrs.tokens ?? {};
  }
}

export function isTokensLib(o) {
  return o instanceof TokensLib;
}

export function makeTokensLib(attrs = {}) {
  return new TokensLib(attrs);
}

export function ensureTokensLib(lib) {
  if (isTokensLib(lib)) return lib;
  return makeTokensLib(lib);
}

export function emptyLibQ(lib) {
  if (!lib) return true;
  return Object.keys(lib.sets ?? {}).length === 0 &&
         Object.keys(lib.themes ?? {}).length === 0 &&
         Object.keys(lib.tokens ?? {}).length === 0;
}

export function setPathExistsQ(lib, path) {
  const sets = lib.sets ?? {};
  for (const set of Object.values(sets)) {
    if (set.name === path || set.path === path) return true;
  }
  return false;
}

export function addTokenToLib(lib, token) {
  const t = isToken(token) ? token : makeToken(token);
  const sets = lib.sets ?? {};
  return new TokensLib({
    ...lib,
    tokens: { ...(lib.tokens ?? {}), [t.id]: t },
  });
}

export function getTokenFromLib(lib, tokenId) {
  return lib.tokens?.[tokenId];
}

export function getTokenByName(lib, name) {
  for (const t of Object.values(lib.tokens ?? {})) {
    if (t.name === name) return t;
  }
  return undefined;
}

export function updateTokenInLib(lib, tokenId, f) {
  const tokens = lib.tokens ?? {};
  const token = tokens[tokenId];
  if (!token) return lib;
  return new TokensLib({
    ...lib,
    tokens: { ...tokens, [tokenId]: f(token) },
  });
}

export function deleteTokenFromLib(lib, tokenId) {
  const { [tokenId]: _, ...rest } = lib.tokens ?? {};
  return new TokensLib({ ...lib, tokens: rest });
}

export function addSet(lib, set) {
  const s = isTokenSet(set) ? set : makeTokenSet(set);
  return new TokensLib({
    ...lib,
    sets: { ...(lib.sets ?? {}), [s.id]: s },
  });
}

export function deleteSet(lib, setId) {
  const { [setId]: _, ...rest } = lib.sets ?? {};
  return new TokensLib({ ...lib, sets: rest });
}

export function getSet(lib, setId) {
  return lib.sets?.[setId];
}

export function getSetByName(lib, name) {
  for (const s of Object.values(lib.sets ?? {})) {
    if (s.name === name) return s;
  }
  return undefined;
}

export function getSets(lib) {
  return Object.values(lib.sets ?? {});
}

export function getSetNames(lib) {
  return Object.values(lib.sets ?? {}).map((s) => s.name);
}

export function setCount(lib) {
  return Object.keys(lib.sets ?? {}).length;
}

export function addTheme(lib, theme) {
  const t = isTokenTheme(theme) ? theme : makeTokenTheme(theme);
  return new TokensLib({
    ...lib,
    themes: { ...(lib.themes ?? {}), [t.id]: t },
  });
}

export function deleteTheme(lib, themeId) {
  const { [themeId]: _, ...rest } = lib.themes ?? {};
  return new TokensLib({ ...lib, themes: rest });
}

export function getTheme(lib, themeId) {
  return lib.themes?.[themeId];
}

export function getThemeByName(lib, name) {
  for (const t of Object.values(lib.themes ?? {})) {
    if (t.name === name) return t;
  }
  return undefined;
}

export function getThemes(lib) {
  return Object.values(lib.themes ?? {});
}

export function themeCount(lib) {
  return Object.keys(lib.themes ?? {}).length;
}

export function getAllTokens(lib) {
  return Object.values(lib.tokens ?? {});
}

export function getAllTokensMap(lib) {
  return { ...(lib.tokens ?? {}) };
}

export function getTokensInActiveSets(lib) {
  const activeThemes = getThemes(lib).filter((t) => !t.isChanged && t.id !== HIDDEN_THEME_ID);
  const activeSetIds = new Set();
  for (const theme of activeThemes) {
    for (const setId of theme.sets ?? []) {
      activeSetIds.add(setId);
    }
  }
  const result = [];
  for (const setId of activeSetIds) {
    const set = lib.sets?.[setId];
    if (set) {
      for (const tokenId of set.tokens ?? []) {
        const token = lib.tokens?.[tokenId];
        if (token) result.push(token);
      }
    }
  }
  return result;
}

export function topLevelThemeGroupQ(group) {
  return group == null || group === '';
}

export function splitSetName(name) {
  if (name == null) return [];
  return name.split(' / ');
}

export function joinSetPath(parts) {
  return parts.join(' / ');
}

export function normalizeSetName(name) {
  if (name == null) return '';
  return name.trim();
}

// --- Theme activation/deactivation ---

export function enableSet(theme, setName) {
  const sets = new Set(theme.sets ?? []);
  sets.add(setName);
  return new TokenTheme({ ...theme, sets: [...sets] });
}

export function disableSet(theme, setName) {
  const sets = (theme.sets ?? []).filter((s) => s !== setName);
  return new TokenTheme({ ...theme, sets });
}

export function toggleSet(theme, setName) {
  const sets = theme.sets ?? [];
  if (sets.includes(setName)) {
    return disableSet(theme, setName);
  }
  return enableSet(theme, setName);
}

export function enableSets(theme, setNames) {
  const currentSet = new Set(theme.sets ?? []);
  for (const name of setNames) {
    currentSet.add(name);
  }
  return new TokenTheme({ ...theme, sets: [...currentSet] });
}

export function disableSets(theme, setNames) {
  const nameSet = new Set(setNames);
  const sets = (theme.sets ?? []).filter((s) => !nameSet.has(s));
  return new TokenTheme({ ...theme, sets });
}

export function activateTheme(lib, id) {
  const theme = getTheme(lib, id);
  if (!theme) return lib;

  const group = theme.group;
  const groupThemePaths = [];
  for (const [tid, t] of Object.entries(lib.themes ?? {})) {
    if (t.group === group) {
      groupThemePaths.push(getThemePath(t));
    }
  }

  const activeThemePaths = new Set(lib['active-themes'] ?? []);
  for (const path of groupThemePaths) {
    activeThemePaths.delete(path);
  }
  activeThemePaths.add(getThemePath(theme));

  return new TokensLib({ ...lib, 'active-themes': activeThemePaths });
}

export function deactivateTheme(lib, id) {
  const theme = getTheme(lib, id);
  if (!theme) return lib;

  const activeThemePaths = new Set(lib['active-themes'] ?? []);
  activeThemePaths.delete(getThemePath(theme));

  return new TokensLib({ ...lib, 'active-themes': activeThemePaths });
}

export function toggleThemeActive(lib, id) {
  if (themeActiveQ(lib, id)) {
    return deactivateTheme(lib, id);
  }
  return activateTheme(lib, id);
}

export function getActiveThemePaths(lib) {
  return lib['active-themes'] ?? new Set();
}

export function getActiveThemesSetNames(lib) {
  const activePaths = getActiveThemePaths(lib);
  const result = new Set();
  for (const path of activePaths) {
    const themes = lib.themes ?? {};
    for (const theme of Object.values(themes)) {
      const themePath = getThemePath(theme);
      if (activePaths.has(themePath)) {
        for (const setName of theme.sets ?? []) {
          result.add(setName);
        }
      }
    }
  }
  return result;
}

export function themeActiveQ(lib, id) {
  const theme = getTheme(lib, id);
  if (!theme) return false;
  const activePaths = getActiveThemePaths(lib);
  return activePaths.has(getThemePath(theme));
}

export function getHiddenTheme(lib) {
  return getTheme(lib, HIDDEN_THEME_ID);
}

export function getThemePath(theme) {
  if (!theme) return [];
  const group = theme.group ?? '';
  const name = theme.name ?? '';
  if (!group) return ['', name];
  return [group, name];
}

// --- Sets-at-path and tree operations ---

const SET_GROUP_PREFIX = 'G-';
const SET_ITEM_PREFIX = 'S-';

function addSetPathGroupPrefix(path) {
  if (Array.isArray(path)) {
    return path.map((segment, i) => {
      const isLast = i === path.length - 1;
      return isLast ? `${SET_ITEM_PREFIX}${segment}` : `${SET_GROUP_PREFIX}${segment}`;
    });
  }
  return path;
}

function splitSetStrPathPrefix(key) {
  if (key.startsWith(SET_GROUP_PREFIX)) {
    return key.slice(SET_GROUP_PREFIX.length);
  }
  if (key.startsWith(SET_ITEM_PREFIX)) {
    return key.slice(SET_ITEM_PREFIX.length);
  }
  return key;
}

function setGroupPathToSetGroupPrefixedPath(path) {
  if (Array.isArray(path)) {
    return path.map((segment, i) => {
      const isLast = i === path.length - 1;
      return isLast ? `${SET_ITEM_PREFIX}${segment}` : `${SET_GROUP_PREFIX}${segment}`;
    });
  }
  return path;
}

export function getSetsAtPath(lib, path) {
  const prefixedPath = addSetPathGroupPrefix(path);
  let current = lib.sets ?? {};
  for (const key of prefixedPath) {
    if (current == null || typeof current !== 'object') return [];
    current = current[key];
  }
  if (current == null) return [];

  const result = [];
  function walk(node) {
    if (node == null) return;
    if (isTokenSet(node)) {
      result.push(node);
      return;
    }
    if (typeof node === 'object') {
      for (const value of Object.values(node)) {
        walk(value);
      }
    }
  }
  walk(current);
  return result;
}

export function setsAtPathAllActiveQ(lib, groupPath) {
  const activeSetNames = getActiveThemesSetNames(lib);
  const setsAtGroup = getSetsAtPath(lib, groupPath);
  const SetNamesAtGroup = new Set(setsAtGroup.map((s) => s.name));

  if (activeSetNames.size === 0) return 'none';

  let allActive = true;
  let anyActive = false;

  for (const name of SetNamesAtGroup) {
    if (activeSetNames.has(name)) {
      anyActive = true;
    } else {
      allActive = false;
    }
  }

  if (allActive) return 'all';
  if (anyActive) return 'partial';
  return 'none';
}

export function walkSetsTreeSeq(nodes, options = {}) {
  const { skipChildrenPred, newEditingSetPath } = options;

  const result = [];

  function walk(node, parentPath = [], depth = 0) {
    if (node == null) return;

    if (isTokenSet(node)) {
      result.push({
        groupQ: false,
        path: splitSetName(node.name),
        parentPath,
        depth,
        set: node,
      });
      return;
    }

    for (const [key, value] of Object.entries(node)) {
      if (key === 'new?') {
        result.push({ newQ: true, groupQ: false, parentPath, depth });
        continue;
      }

      if (value && typeof value === 'object' && !isTokenSet(value)) {
        const unprefixedPath = splitSetStrPathPrefix(key);
        const currentPath = [...parentPath, unprefixedPath];
        const isGroup = true;

        if (skipChildrenPred && skipChildrenPred(currentPath)) {
          result.push({ groupQ: isGroup, path: currentPath, parentPath, depth });
          continue;
        }

        const childValue = newEditingSetPath && currentPath.join(' / ') === newEditingSetPath.join(' / ')
          ? { ...value, 'new?': true }
          : value;

        result.push({ groupQ: isGroup, path: currentPath, parentPath, depth });

        walk(childValue, currentPath, depth + 1);
      } else if (isTokenSet(value)) {
        result.push({
          groupQ: false,
          path: [...parentPath, splitSetName(value.name)],
          parentPath,
          depth,
          set: value,
        });
      }
    }
  }

  walk(nodes || {});
  return result;
}

export function getSetTree(lib) {
  return lib.sets ?? {};
}

export function setGroupPathExistsQ(lib, path) {
  const prefixedPath = setGroupPathToSetGroupPrefixedPath(path);
  let current = lib.sets;
  for (const key of prefixedPath) {
    if (current == null || typeof current !== 'object') return false;
    current = current[key];
  }
  return current != null;
}

// --- Theme set management via hidden theme ---

export function setThemeSets(theme, sets) {
  return new TokenTheme({ ...theme, sets: [...sets] });
}

export function getActiveTheme(lib) {
  const activePaths = getActiveThemePaths(lib);
  const themes = lib.themes ?? {};
  for (const theme of Object.values(themes)) {
    if (activePaths.has(getThemePath(theme))) {
      return theme;
    }
  }
  return null;
}