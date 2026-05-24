import {
  getSet, getSets, setPathExistsQ, getTheme, makeHiddenTheme,
  getSetsAtPath, walkSetsTreeSeq, getSetTree, setGroupPathExistsQ,
  getThemePath, enableSet, disableSet, toggleSet, enableSets, disableSets,
  activateTheme, deactivateTheme, toggleThemeActive,
  getActiveThemesSetNames, getHiddenTheme, HIDDEN_THEME_PATH,
  setsAtPathAllActiveQ, getActiveThemePaths,
} from '../types/tokens_lib.js';
import * as pcb from '../files/changes_builder.js';

export function vecStartsWithQ(v1, v2) {
  const len = Math.min(v1.length, v2.length);
  for (let i = 0; i < len; i++) {
    if (v1[i] !== v2[i]) return false;
  }
  return true;
}

function generateUpdateActiveSets(changes, tokensLib, updateThemeFn) {
  const activeSetNames = getActiveThemesSetNames(tokensLib);
  const hiddenTheme = getHiddenTheme(tokensLib);
  const updatedHiddenTheme = updateThemeFn(hiddenTheme != null ? hiddenTheme : makeHiddenTheme());

  changes = pcb.setActiveTokenThemes(changes, new Set([getThemePath(updatedHiddenTheme)]));
  changes = pcb.setTokenTheme(changes, hiddenTheme ? hiddenTheme.id : updatedHiddenTheme.id, updatedHiddenTheme);

  return changes;
}

export function generateSetEnabledTokenSet(changes, tokensLib, setName, enabled) {
  if (enabled) {
    return generateUpdateActiveSets(changes, tokensLib, (theme) => enableSet(theme, setName));
  }
  return generateUpdateActiveSets(changes, tokensLib, (theme) => disableSet(theme, setName));
}

export function generateToggleTokenSet(changes, tokensLib, setName) {
  return generateUpdateActiveSets(changes, tokensLib, (theme) => toggleSet(theme, setName));
}

function generateUpdateActiveTokenTheme(changes, tokensLib, updateFn) {
  const updatedLib = updateFn(tokensLib);
  const activePaths = getActiveThemePaths(updatedLib);

  if (activePaths.size === 1 && activePaths.has(HIDDEN_THEME_PATH.join(' / '))) {
    return pcb.setActiveTokenThemes(changes, activePaths);
  }

  const filteredPaths = new Set(activePaths);
  filteredPaths.delete(HIDDEN_THEME_PATH.join(' / '));

  return pcb.setActiveTokenThemes(changes, filteredPaths);
}

export function generateSetActiveTokenTheme(changes, tokensLib, id, active) {
  if (active) {
    return generateUpdateActiveTokenTheme(changes, tokensLib, (lib) => activateTheme(lib, id));
  }
  return generateUpdateActiveTokenTheme(changes, tokensLib, (lib) => deactivateTheme(lib, id));
}

export function generateToggleTokenTheme(changes, tokensLib, id) {
  return generateUpdateActiveTokenTheme(changes, tokensLib, (lib) => toggleThemeActive(lib, id));
}

export function toggleTokenSetGroup(groupPath, tokensLib, tokensLibTheme) {
  const deactivate = setsAtPathAllActiveQ(tokensLib, groupPath) === 'all' ||
                     setsAtPathAllActiveQ(tokensLib, groupPath) === 'partial';
  const setsAtGroup = getSetsAtPath(tokensLib, groupPath);
  const setNames = new Set(setsAtGroup.map((s) => s.name));

  if (deactivate) {
    return disableSets(tokensLibTheme, setNames);
  }
  return enableSets(tokensLibTheme, setNames);
}

export function generateToggleTokenSetGroup(changes, tokensLib, groupPath) {
  return generateUpdateActiveSets(changes, tokensLib, (theme) => toggleTokenSetGroup(groupPath, tokensLib, theme));
}

function calculateMoveTokenSetOrSetGroup(tokensLib, { fromIndex, toIndex, position, collapsedPaths }) {
  const tree = [...walkSetsTreeSeq(getSetTree(tokensLib), {
    skipChildrenPred: collapsedPaths ? (path) => collapsedPaths.has(path.join(' / ')) : undefined,
  })];

  if (fromIndex >= tree.length || toIndex >= tree.length) return null;

  const from = tree[fromIndex];
  const to = tree[toIndex];
  const before = position === 'top' ? to : position === 'bot' ? tree[toIndex + 1] ?? null : null;

  const fromPath = from.path;
  const toParentPath = position === 'center' || (position === 'bot' && to.groupQ && !collapsedPaths?.has(to.path?.join(' / ')))
    ? to.path
    : to.path.slice(0, -1);
  const toPath = [...toParentPath, fromPath[fromPath.length - 1]];

  const identical = fromIndex === toIndex ||
    (fromPath.join(' / ') === toPath.join(' / ') &&
     (position === 'top' ? fromIndex === toIndex - 1 : fromIndex === toIndex));

  const prevBefore = from.groupQ
    ? tree.slice(fromIndex + 1).find((el) => el.depth <= from.depth) ?? null
    : tree[fromIndex + 1] ?? null;

  const toExists = from.parentPath?.join(' / ') !== toParentPath?.join(' / ') &&
    (from.groupQ ? setGroupPathExistsQ(tokensLib, toPath) : setPathExistsQ(tokensLib, toPath.join(' / ')));

  const parentToChildDrop = from.groupQ &&
    fromPath.join(' / ') !== toPath.join(' / ') &&
    vecStartsWithQ(toPath, fromPath);

  if (identical) return null;
  if (toExists) {
    throw Object.assign(new Error('move token set error: path exists'), { error: 'path-exists', path: toPath });
  }
  if (parentToChildDrop) {
    throw Object.assign(new Error('move token set error: parent-to-child'), { error: 'parent-to-child', fromPath, toPath });
  }

  const result = { fromPath, toPath, beforePath: null, beforeGroupQ: null };
  if (before) {
    result.beforePath = before.path;
    result.beforeGroupQ = before.groupQ;
  }
  if (prevBefore) {
    result.prevBeforePath = prevBefore.path;
    result.prevBeforeGroupQ = prevBefore.groupQ;
  }
  return result;
}

export function generateMoveTokenSet(changes, tokensLib, params) {
  const moveParams = calculateMoveTokenSetOrSetGroup(tokensLib, params);
  if (moveParams) {
    return pcb.moveTokenSet(changes, moveParams);
  }
  return changes;
}

export function generateMoveTokenSetGroup(changes, tokensLib, params) {
  const moveParams = calculateMoveTokenSetOrSetGroup(tokensLib, params);
  if (moveParams) {
    return pcb.moveTokenSetGroup(changes, moveParams);
  }
  return changes;
}

export function generateDeleteTokenSetGroup(changes, tokensLib, path) {
  const sets = getSetsAtPath(tokensLib, path);
  let result = changes;
  for (const set of sets) {
    result = pcb.setTokenSet(result, set.id, null);
  }
  return result;
}