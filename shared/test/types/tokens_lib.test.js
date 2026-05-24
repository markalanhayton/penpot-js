import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Token, TokenSet, TokenTheme, TokensLib, isToken, isTokenSet, isTokenTheme, isTokensLib, makeToken, makeTokenSet, makeTokenTheme, makeTokensLib, addTokenToLib, getTokenFromLib, getTokenByName, updateTokenInLib, deleteTokenFromLib, addSet, deleteSet, getSet, getSetByName, getSets, getSetNames, setCount, addTheme, deleteTheme, getTheme, getThemeByName, getThemes, themeCount, getAllTokens, emptyLibQ, groupByType, HIDDEN_THEME_ID, makeHiddenTheme, splitSetName, joinSetPath, normalizeSetName, tokenRename, tokenReid, tokenSetDescription } from '../../src/types/tokens_lib.js';

describe('tokens-lib', () => {
  it('Token class', () => {
    const t = makeToken({ name: 'colors.primary', type: 'color', value: '#000' });
    assert.ok(isToken(t));
    assert.equal(t.name, 'colors.primary');
    assert.equal(t.type, 'color');
    assert.equal(t.value, '#000');
    assert.ok(t.id);
  });

  it('Token defaults', () => {
    const t = makeToken();
    assert.equal(t.type, 'other');
    assert.equal(t.description, '');
    assert.equal(t.value, '');
  });

  it('Token rename', () => {
    const t = makeToken({ name: 'a' });
    const r = tokenRename(t, 'b');
    assert.equal(r.name, 'b');
    assert.ok(isToken(r));
  });

  it('TokenSet class', () => {
    const s = makeTokenSet({ name: 'Global / Light' });
    assert.ok(isTokenSet(s));
    assert.equal(s.name, 'Global / Light');
  });

  it('TokenTheme class', () => {
    const th = makeTokenTheme({ name: 'Light' });
    assert.ok(isTokenTheme(th));
    assert.equal(th.name, 'Light');
  });

  it('TokensLib class', () => {
    const lib = makeTokensLib();
    assert.ok(isTokensLib(lib));
    assert.ok(emptyLibQ(lib));
  });

  it('addTokenToLib / getTokenFromLib', () => {
    const lib = addTokenToLib(makeTokensLib(), { name: 'primary', type: 'color', value: '#333' });
    const tokens = getAllTokens(lib);
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].name, 'primary');
  });

  it('getTokenByName', () => {
    const lib = addTokenToLib(makeTokensLib(), { name: 'spacing.md', type: 'dimension', value: '16' });
    const t = getTokenByName(lib, 'spacing.md');
    assert.ok(t);
    assert.equal(getTokenByName(lib, 'missing'), undefined);
  });

  it('updateTokenInLib', () => {
    let lib = addTokenToLib(makeTokensLib(), { name: 'a', type: 'color', value: '#000' });
    const tokenId = getAllTokens(lib)[0].id;
    lib = updateTokenInLib(lib, tokenId, (t) => ({ ...t, value: '#fff' }));
    assert.equal(getTokenFromLib(lib, tokenId).value, '#fff');
  });

  it('deleteTokenFromLib', () => {
    let lib = addTokenToLib(makeTokensLib(), { name: 'a', type: 'color', value: '#000' });
    const tokenId = getAllTokens(lib)[0].id;
    lib = deleteTokenFromLib(lib, tokenId);
    assert.equal(getAllTokens(lib).length, 0);
  });

  it('addSet / getSet / deleteSet', () => {
    let lib = addSet(makeTokensLib(), { name: 'Light', path: 'Light' });
    assert.equal(setCount(lib), 1);
    const setId = getSets(lib)[0].id;
    assert.ok(getSet(lib, setId));
    assert.ok(getSetByName(lib, 'Light'));
    lib = deleteSet(lib, setId);
    assert.equal(setCount(lib), 0);
  });

  it('addTheme / getTheme / deleteTheme', () => {
    let lib = addTheme(makeTokensLib(), { name: 'Dark' });
    assert.equal(themeCount(lib), 1);
    const themeId = getThemes(lib)[0].id;
    assert.ok(getTheme(lib, themeId));
    assert.ok(getThemeByName(lib, 'Dark'));
    lib = deleteTheme(lib, themeId);
    assert.equal(themeCount(lib), 0);
  });

  it('makeHiddenTheme', () => {
    const th = makeHiddenTheme();
    assert.equal(th.id, HIDDEN_THEME_ID);
    assert.equal(th.name, '$$hidden$$');
  });

  it('groupByType', () => {
    const tokens = [
      makeToken({ name: 'a', type: 'color', value: '#000' }),
      makeToken({ name: 'b', type: 'color', value: '#fff' }),
      makeToken({ name: 'c', type: 'dimension', value: '16' }),
    ];
    const groups = groupByType(tokens);
    assert.equal(groups.color.length, 2);
    assert.equal(groups.dimension.length, 1);
  });

  it('splitSetName / joinSetPath', () => {
    assert.deepEqual(splitSetName('Global / Light'), ['Global', 'Light']);
    assert.equal(joinSetPath(['Global', 'Light']), 'Global / Light');
  });

  it('normalizeSetName', () => {
    assert.equal(normalizeSetName('  Light  '), 'Light');
    assert.equal(normalizeSetName(null), '');
  });

  it('non-TokensLib emptyLibQ returns true', () => {
    assert.equal(emptyLibQ(null), true);
    assert.equal(emptyLibQ(undefined), true);
  });

  it('getSetNames', () => {
    let lib = addSet(makeTokensLib(), { name: 'Light' });
    lib = addSet(lib, { name: 'Dark' });
    assert.deepEqual(getSetNames(lib).sort(), ['Dark', 'Light']);
  });

  it('tokenReid', () => {
    const t = makeToken({ name: 'a' });
    const r = tokenReid(t, 'new-id');
    assert.equal(r.id, 'new-id');
  });

  it('tokenSetDescription', () => {
    const t = makeToken({ name: 'a' });
    const r = tokenSetDescription(t, 'desc');
    assert.equal(r.description, 'desc');
  });
});