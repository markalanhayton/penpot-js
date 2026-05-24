import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as attrs from '../src/attrs.js';

describe('attrs', () => {
  it('getAttrsMulti simple shapes same attrs', () => {
    const shapes = [
      { 'stroke-color': '#ff0000', 'stroke-width': 3 },
      { 'stroke-color': '#ff0000', 'stroke-width': 3 },
    ];
    const result = attrs.getAttrsMulti(shapes, ['stroke-color', 'stroke-width']);
    assert.equal(result['stroke-color'], '#ff0000');
    assert.equal(result['stroke-width'], 3);
  });

  it('getAttrsMulti different attrs returns multiple', () => {
    const shapes = [
      { 'stroke-color': '#ff0000', 'stroke-width': 3 },
      { 'stroke-color': '#ff0000', 'stroke-width': 5 },
    ];
    const result = attrs.getAttrsMulti(shapes, ['stroke-color', 'stroke-width']);
    assert.equal(result['stroke-color'], '#ff0000');
    assert.equal(result['stroke-width'], 'multiple');
  });

  it('getAttrsMulti missing attr not included', () => {
    const shapes = [
      { 'stroke-color': '#ff0000' },
    ];
    const result = attrs.getAttrsMulti(shapes, ['stroke-color', 'r1']);
    assert.equal(result['stroke-color'], '#ff0000');
    assert.ok(!('r1' in result));
  });

  it('getAttrsMulti width from selrect', () => {
    const shapes = [
      { selrect: { x: 0, y: 0, width: 100, height: 50 } },
    ];
    const result = attrs.getAttrsMulti(shapes, ['width', 'height']);
    assert.equal(result.width, 100);
    assert.equal(result.height, 50);
  });

  it('getAttrsMulti ox/oy from points', () => {
    const shapes = [
      {
        points: [
          { x: 10, y: 20 },
          { x: 30, y: 20 },
          { x: 30, y: 40 },
          { x: 10, y: 40 },
        ],
      },
    ];
    const result = attrs.getAttrsMulti(shapes, ['ox', 'oy']);
    assert.equal(result.ox, 10);
    assert.equal(result.oy, 20);
  });

  it('getAttrsMulti numeric close values treated equal', () => {
    const shapes = [
      { x: 10.0001 },
      { x: 10.0002 },
    ];
    const result = attrs.getAttrsMulti(shapes, ['x']);
    assert.equal(result.x, 10.0001);
  });

  it('getTextAttrsMulti extracts text attrs', () => {
    const content = {
      type: 'root',
      children: [{
        type: 'paragraph-set',
        children: [{
          type: 'paragraph',
          'text-align': 'left',
          children: [{ text: 'Hello', 'font-size': '14' }],
        }],
      }],
    };
    const result = attrs.getTextAttrsMulti({ content }, {}, [
      'text-align', 'font-size', 'vertical-align',
    ]);
    assert.equal(result['text-align'], 'left');
    assert.equal(result['font-size'], '14');
  });
});