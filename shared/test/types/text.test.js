import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as txt from '../../src/types/text.js';
import * as d from '../../src/data.js';

describe('types/text/attrs', () => {
  it('textAllAttrs is a Set', () => {
    assert.ok(txt.textAllAttrs instanceof Set);
  });

  it('defaultTextAttrs has expected keys', () => {
    assert.equal(txt.defaultTextAttrs['font-id'], 'sourcesanspro');
    assert.equal(txt.defaultTextAttrs['font-size'], '14');
    assert.equal(txt.defaultTextAttrs['font-weight'], '400');
  });

  it('defaultTypography has name', () => {
    assert.equal(txt.defaultTypography.name, 'Source Sans Pro Regular');
    assert.equal(txt.defaultTypography['font-id'], 'sourcesanspro');
  });

  it('getDefaultTextAttrs includes fills', () => {
    const attrs = txt.getDefaultTextAttrs();
    assert.ok(attrs.fills);
    assert.ok(Array.isArray(attrs.fills));
  });

  it('textTypographyAttrs has expected entries', () => {
    assert.ok(txt.textTypographyAttrs.includes('typography-ref-id'));
    assert.ok(txt.textTypographyAttrs.includes('typography-ref-file'));
  });

  it('textFontAttrs has expected entries', () => {
    assert.ok(txt.textFontAttrs.includes('font-id'));
    assert.ok(txt.textFontAttrs.includes('font-size'));
    assert.ok(txt.textFontAttrs.includes('font-weight'));
  });
});

describe('types/text/nodes', () => {
  const rootContent = {
    type: 'root',
    children: [
      { type: 'paragraph-set', children: [
        { type: 'paragraph', children: [
          { text: 'Hello' },
          { text: ' World' },
        ]},
      ]},
    ],
  };

  it('isTextNodeQ identifies text nodes', () => {
    assert.equal(txt.isTextNodeQ({ text: 'Hello' }), true);
    assert.equal(txt.isTextNodeQ({ type: 'paragraph' }), false);
  });

  it('isParagraphNodeQ identifies paragraph nodes', () => {
    assert.equal(txt.isParagraphNodeQ({ type: 'paragraph' }), true);
    assert.equal(txt.isParagraphNodeQ({ type: 'root' }), false);
  });

  it('isRootNodeQ identifies root nodes', () => {
    assert.equal(txt.isRootNodeQ({ type: 'root' }), true);
  });

  it('isParagraphSetNodeQ identifies paragraph-set nodes', () => {
    assert.equal(txt.isParagraphSetNodeQ({ type: 'paragraph-set' }), true);
  });

  it('isNodeQ identifies all node types', () => {
    assert.equal(txt.isNodeQ({ text: 'Hello' }), true);
    assert.equal(txt.isNodeQ({ type: 'paragraph' }), true);
    assert.equal(txt.isNodeQ({ type: 'root' }), true);
    assert.equal(txt.isNodeQ({ type: 'paragraph-set' }), true);
    assert.equal(txt.isNodeQ({ type: 'unknown' }), false);
  });

  it('isContentNodeQ excludes paragraph-set', () => {
    assert.equal(txt.isContentNodeQ({ text: 'Hello' }), true);
    assert.equal(txt.isContentNodeQ({ type: 'paragraph' }), true);
    assert.equal(txt.isContentNodeQ({ type: 'root' }), true);
    assert.equal(txt.isContentNodeQ({ type: 'paragraph-set' }), false);
  });

  it('nodeSeq returns all nodes', () => {
    const nodes = txt.nodeSeq(rootContent);
    assert.ok(nodes.length >= 5);
  });

  it('nodeSeq with filter returns matching nodes', () => {
    const nodes = txt.nodeSeq(rootContent, txt.isTextNodeQ);
    assert.equal(nodes.length, 2);
  });

  it('nodeSeq with no matches returns undefined', () => {
    const result = txt.nodeSeq({ type: 'root', children: [] }, txt.isTextNodeQ);
    assert.equal(result, undefined);
  });
});

describe('types/text/transform', () => {
  const content = {
    type: 'root',
    children: [{ type: 'paragraph', children: [{ text: 'Hello' }] }],
  };

  it('transformNodes transforms matching nodes', () => {
    const result = txt.transformNodes(content, txt.isTextNodeQ, (node) => ({
      ...node, text: node.text.toUpperCase(),
    }));
    assert.equal(result.children[0].children[0].text, 'HELLO');
  });

  it('transformNodes without pred transforms all nodes', () => {
    const result = txt.transformNodes(content, (node) => ({ ...node, touched: true }));
    assert.ok(result.touched);
    assert.ok(result.children[0].touched);
  });
});

describe('types/text/generate-name', () => {
  it('generateShapeName truncates at 280', () => {
    const long = 'a'.repeat(500);
    assert.equal(txt.generateShapeName(long).length, 280);
  });

  it('generateShapeName keeps short text', () => {
    assert.equal(txt.generateShapeName('Hello'), 'Hello');
  });
});

describe('types/text/content-to-text', () => {
  it('contentToText extracts text', () => {
    const content = {
      type: 'root',
      children: [
        { type: 'paragraph-set', children: [
          { type: 'paragraph', children: [
            { text: 'Hello' },
            { text: ' World' },
          ]},
          { type: 'paragraph', children: [
            { text: 'Second' },
          ]},
        ]},
      ],
    };
    assert.equal(txt.contentToText(content), 'Hello World\nSecond');
  });
});

describe('types/text/search', () => {
  it('contentHasTextQ finds text case-insensitive', () => {
    const content = {
      type: 'root', children: [{ type: 'paragraph', children: [{ text: 'Hello World' }] }],
    };
    assert.equal(txt.contentHasTextQ(content, 'hello'), true);
    assert.equal(txt.contentHasTextQ(content, 'WORLD'), true);
    assert.equal(txt.contentHasTextQ(content, 'xyz'), false);
  });
});

describe('types/text/replace', () => {
  it('replaceTextInContent replaces text', () => {
    const content = {
      type: 'root', children: [{ type: 'paragraph', children: [{ text: 'Hello World' }] }],
    };
    const result = txt.replaceTextInContent(content, 'World', 'Penpot');
    assert.equal(result.children[0].children[0].text, 'Hello Penpot');
  });
});

describe('types/text/diff', () => {
  it('equalStructureQ same structure', () => {
    const a = { type: 'root', children: [{ type: 'paragraph', children: [{ text: 'A' }] }] };
    const b = { type: 'root', children: [{ type: 'paragraph', children: [{ text: 'B' }] }] };
    assert.equal(txt.equalStructureQ(a, b), true);
  });

  it('equalStructureQ different structure', () => {
    const a = { type: 'root', children: [{ type: 'paragraph', children: [{ text: 'A' }] }] };
    const b = { type: 'root', children: [
      { type: 'paragraph', children: [{ text: 'A' }] },
      { type: 'paragraph', children: [{ text: 'B' }] },
    ]};
    assert.equal(txt.equalStructureQ(a, b), false);
  });

  it('getDiffType detects text change', () => {
    const a = { type: 'root', children: [{ type: 'paragraph', children: [{ text: 'A' }] }] };
    const b = { type: 'root', children: [{ type: 'paragraph', children: [{ text: 'B' }] }] };
    const diff = txt.getDiffType(a, b);
    assert.ok(diff.has('text-content-text'));
  });

  it('getDiffType same content returns empty set', () => {
    const a = { type: 'root', children: [{ type: 'paragraph', children: [{ text: 'A' }] }] };
    const diff = txt.getDiffType(a, a);
    assert.equal(diff.size, 0);
  });
});

describe('types/text/copy', () => {
  it('copyTextKeys copies text from origin', () => {
    const origin = { type: 'root', children: [{ type: 'paragraph', children: [{ text: 'From' }] }] };
    const destiny = { type: 'root', children: [{ type: 'paragraph', children: [{ text: 'To' }] }] };
    const result = txt.copyTextKeys(origin, destiny);
    assert.equal(result.children[0].children[0].text, 'From');
  });

  it('copyAttrsKeys copies attrs', () => {
    const content = { type: 'root', 'font-size': '12', children: [] };
    const attrs = { 'font-size': '16' };
    const result = txt.copyAttrsKeys(content, attrs);
    assert.equal(result['font-size'], '16');
  });
});

describe('types/text/change-text', () => {
  it('changeText replaces content text', () => {
    const content = {
      type: 'root',
      children: [{
        type: 'paragraph-set',
        children: [{ type: 'paragraph', children: [{ text: 'Old' }] }],
      }],
    };
    const result = txt.changeText(content, 'New line1\nNew line2');
    assert.ok(result.children);
    assert.ok(result.children[0].children);
    assert.equal(result.children[0].children.length, 2);
    assert.equal(result.children[0].children[0].children[0].text, 'New line1');
    assert.equal(result.children[0].children[1].children[0].text, 'New line2');
  });
});