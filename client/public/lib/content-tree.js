'use strict';
import * as textTypes from '@penpot/shared/types/text.js';

const KEBAB_TO_CAMEL = {
  'font-id': 'fontId',
  'font-family': 'fontFamily',
  'font-variant-id': 'fontVariantId',
  'font-size': 'fontSize',
  'font-weight': 'fontWeight',
  'font-style': 'fontStyle',
  'line-height': 'lineHeight',
  'letter-spacing': 'letterSpacing',
  'text-decoration': 'textDecoration',
  'text-transform': 'textTransform',
  'text-align': 'textAlign',
  'text-direction': 'textDirection',
  'fill-color': 'fillColor',
  'fill-opacity': 'fillOpacity',
  'fill-color-ref-id': 'fillColorRefId',
  'fill-color-ref-file': 'fillColorRefFile',
  'fill-color-gradient': 'fillColorGradient',
  'typography-ref-id': 'typographyRefId',
  'typography-ref-file': 'typographyRefFile',
  'vertical-align': 'verticalAlign',
  'grow-type': 'growType',
};

const CAMEL_TO_KEBAB = Object.fromEntries(
  Object.entries(KEBAB_TO_CAMEL).map(([k, v]) => [v, k])
);

function toCamelCase(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    const camelKey = KEBAB_TO_CAMEL[k] || k;
    if (k === 'fills' && Array.isArray(v)) {
      result[camelKey] = v.map(f => {
        const fill = {};
        for (const [fk, fv] of Object.entries(f)) {
          fill[KEBAB_TO_CAMEL[fk] || fk] = fv;
        }
        return fill;
      });
    } else {
      result[camelKey] = v;
    }
  }
  return result;
}

function toKebabCase(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'text' || k === 'type' || k === 'key' || k === 'children') {
      result[k] = v;
      continue;
    }
    const kebabKey = CAMEL_TO_KEBAB[k] || k;
    if (k === 'fills' && Array.isArray(v)) {
      result[kebabKey] = v.map(f => {
        const fill = {};
        for (const [fk, fv] of Object.entries(f)) {
          fill[CAMEL_TO_KEBAB[fk] || fk] = fv;
        }
        return fill;
      });
    } else {
      result[kebabKey] = v;
    }
  }
  return result;
}

function fillToCSS(fill) {
  if (fill.type === 'solid' || (!fill.type && fill['fill-color'])) {
    return fill['fill-color'] || '#000000';
  }
  if (fill.type === 'linear-gradient' || fill['fill-color-gradient']) {
    const grad = fill['fill-color-gradient'];
    if (grad) {
      const stops = (grad.stops || [])
        .map(s => `${s.color || '#000000'} ${((s.offset || 0) * 100).toFixed(1)}%`)
        .join(', ');
      return `linear-gradient(${grad.angle || 0}deg, ${stops})`;
    }
  }
  return '#000000';
}

export function contentTreeToHTML(content) {
  if (typeof content === 'string') return escapeHTML(content);
  if (!textTypes.isContentTree(content)) return escapeHTML(String(content || ''));

  const paragraphs = textTypes.nodeSeq(content, textTypes.isParagraphNodeQ) ?? [];
  return paragraphs.map(paragraph => {
    const paraStyle = paragraphStyleToCSS(paragraph);
    const children = paragraph.children || [];
    const inner = children.map(textNodeToHTML).join('');
    return `<p style="${paraStyle}">${inner}</p>`;
  }).join('');
}

function paragraphStyleToCSS(paragraph) {
  const styles = [];
  if (paragraph['text-align']) styles.push(`text-align:${paragraph['text-align']}`);
  if (paragraph['text-direction']) styles.push(`direction:${paragraph['text-direction']}`);
  return styles.join(';');
}

function textNodeToHTML(node) {
  if (!textTypes.isTextNodeQ(node)) return '';
  const styles = [];
  const fills = node.fills;

  if (node['font-family']) styles.push(`font-family:${node['font-family']}`);
  if (node['font-size']) styles.push(`font-size:${node['font-size']}px`);
  if (node['font-weight'] && node['font-weight'] !== '400') styles.push(`font-weight:${node['font-weight']}`);
  if (node['font-style'] && node['font-style'] !== 'normal') styles.push(`font-style:${node['font-style']}`);
  if (node['line-height']) styles.push(`line-height:${node['line-height']}`);
  if (node['letter-spacing'] && node['letter-spacing'] !== '0') styles.push(`letter-spacing:${node['letter-spacing']}px`);

  const textDecoration = node['text-decoration'];
  if (textDecoration && textDecoration !== 'none') styles.push(`text-decoration:${textDecoration}`);

  const textTransform = node['text-transform'];
  if (textTransform && textTransform !== 'none') styles.push(`text-transform:${textTransform}`);

  let color = null;
  if (fills && fills.length > 0) {
    color = fillToCSS(fills[0]);
    styles.push(`color:${color}`);
    if (fills[0]['fill-opacity'] !== undefined && fills[0]['fill-opacity'] !== 1) {
      styles.push(`opacity:${fills[0]['fill-opacity']}`);
    }
  }

  const styleStr = styles.join(';');
  const text = escapeHTML(node.text || '');

  if (styleStr) {
    return `<span style="${styleStr}">${text}</span>`;
  }
  return text;
}

function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Parse contentEditable HTML output into a Penpot content tree.
 * @param {string} html - Inner HTML from a contentEditable div
 * @param {Object} [baseAttrs] - Default text style attributes for new text nodes.
 *   Accepts both kebab-case ('font-family', 'font-size') and camelCase
 *   (fontFamily, fontSize) property names; all are converted to kebab-case
 *   in the output tree to match shared/types/text.js conventions.
 */
export function htmlToContentTree(html, baseAttrs = {}) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const container = doc.body.firstChild;

  const baseFills = baseAttrs.fills || [{ 'fill-color': '#000000', 'fill-opacity': 1 }];
  const base = {
    'font-id': baseAttrs['font-id'] || baseAttrs.fontId || 'sourcesanspro',
    'font-family': baseAttrs['font-family'] || baseAttrs.fontFamily || 'sourcesanspro',
    'font-variant-id': baseAttrs['font-variant-id'] || baseAttrs.fontVariantId || 'regular',
    'font-size': baseAttrs['font-size'] || baseAttrs.fontSize || '14',
    'font-weight': String(baseAttrs['font-weight'] ?? baseAttrs.fontWeight ?? '400'),
    'font-style': baseAttrs['font-style'] || baseAttrs.fontStyle || 'normal',
    'line-height': String(baseAttrs['line-height'] ?? baseAttrs.lineHeight ?? '1.2'),
    'letter-spacing': String(baseAttrs['letter-spacing'] ?? baseAttrs.letterSpacing ?? '0'),
    'text-decoration': baseAttrs['text-decoration'] || baseAttrs.textDecoration || 'none',
    'text-transform': baseAttrs['text-transform'] || baseAttrs.textTransform || 'none',
    fills: baseFills,
  };

  const paragraphs = [];
  const blockElements = container ? Array.from(container.children) : [];

  if (blockElements.length === 0 && container) {
    const textNodes = collectInlineNodes(container, base);
    if (textNodes.length > 0) {
      paragraphs.push({
        type: 'paragraph',
        'text-align': baseAttrs['text-align'] || baseAttrs.textAlign || 'left',
        'text-direction': baseAttrs['text-direction'] || baseAttrs.textDirection || 'ltr',
        children: textNodes,
      });
    }
  } else {
    for (const block of blockElements) {
      const paraStyles = extractParagraphStyle(block);
      const children = collectInlineNodes(block, base);
      if (children.length > 0) {
        paragraphs.push({
          type: 'paragraph',
          'text-align': paraStyles.textAlign || baseAttrs['text-align'] || baseAttrs.textAlign || 'left',
          'text-direction': paraStyles.direction || baseAttrs['text-direction'] || baseAttrs.textDirection || 'ltr',
          children,
        });
      } else {
        paragraphs.push({
          type: 'paragraph',
          'text-align': paraStyles.textAlign || baseAttrs['text-align'] || baseAttrs.textAlign || 'left',
          'text-direction': paraStyles.direction || baseAttrs['text-direction'] || baseAttrs.textDirection || 'ltr',
          children: [{ text: '', ...base }],
        });
      }
    }
  }

  if (paragraphs.length === 0) {
    paragraphs.push({
      type: 'paragraph',
      'text-align': 'left',
      'text-direction': 'ltr',
      children: [{ text: '', ...base }],
    });
  }

  return {
    type: 'root',
    'vertical-align': baseAttrs['vertical-align'] || 'top',
    children: [{ type: 'paragraph-set', children: paragraphs }],
  };
}

function extractParagraphStyle(el) {
  const style = el.getAttribute('style') || '';
  const result = {};
  const alignMatch = style.match(/text-align\s*:\s*(left|center|right|justify)/i);
  if (alignMatch) result.textAlign = alignMatch[1];
  const dirMatch = style.match(/direction\s*:\s*(ltr|rtl)/i);
  if (dirMatch) result.direction = dirMatch[1];
  if (el.getAttribute('dir')) result.direction = el.getAttribute('dir');
  const tag = el.tagName.toLowerCase();
  if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
    result.textAlign = result.textAlign || 'left';
  }
  return result;
}

function collectInlineNodes(el, base) {
  const result = [];
  const children = el.childNodes;

  for (const child of children) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent;
      if (text) {
        result.push({ text, ...base });
      }
      continue;
    }

    if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = child.tagName.toLowerCase();
      const style = child.getAttribute('style') || '';
      const nodeAttrs = { ...base };

      if (tag === 'b' || tag === 'strong' || /font-weight\s*:\s*(700|bold)/i.test(style)) {
        nodeAttrs['font-weight'] = '700';
      }
      if (tag === 'i' || tag === 'em' || /font-style\s*:\s*italic/i.test(style)) {
        nodeAttrs['font-style'] = 'italic';
      }
      if (tag === 'u' || /text-decoration\s*:.*underline/i.test(style)) {
        nodeAttrs['text-decoration'] = 'underline';
      }
      if (tag === 's' || tag === 'del' || tag === 'strike' || /text-decoration\s*:.*line-through/i.test(style)) {
        const existing = nodeAttrs['text-decoration'];
        if (existing === 'underline') {
          nodeAttrs['text-decoration'] = 'underline line-through';
        } else {
          nodeAttrs['text-decoration'] = 'line-through';
        }
      }
      if (tag === 'sub') {
        nodeAttrs['font-size'] = String(Math.round(parseInt(nodeAttrs['font-size'] || '14') * 0.7));
      }
      if (tag === 'sup') {
        nodeAttrs['font-size'] = String(Math.round(parseInt(nodeAttrs['font-size'] || '14') * 0.7));
      }

      const fontFamilyMatch = style.match(/font-family\s*:\s*([^;]+)/i);
      if (fontFamilyMatch) {
        nodeAttrs['font-family'] = fontFamilyMatch[1].trim().replace(/['"]/g, '');
      }

      const fontSizeMatch = style.match(/font-size\s*:\s*([^;]+)/i);
      if (fontSizeMatch) {
        const sizeVal = fontSizeMatch[1].trim();
        const pxMatch = sizeVal.match(/^(\d+(?:\.\d+)?)(px)?$/);
        if (pxMatch) nodeAttrs['font-size'] = String(Math.round(parseFloat(pxMatch[1])));
      }

      const fontWeightMatch = style.match(/font-weight\s*:\s*([^;]+)/i);
      if (fontWeightMatch) {
        const w = fontWeightMatch[1].trim();
        if (w === 'bold') nodeAttrs['font-weight'] = '700';
        else if (/^\d+$/.test(w)) nodeAttrs['font-weight'] = w;
      }

      const fontStyleMatch = style.match(/font-style\s*:\s*([^;]+)/i);
      if (fontStyleMatch) nodeAttrs['font-style'] = fontStyleMatch[1].trim();

      const lineHeightMatch = style.match(/line-height\s*:\s*([^;]+)/i);
      if (lineHeightMatch) nodeAttrs['line-height'] = lineHeightMatch[1].trim();

      const letterSpacingMatch = style.match(/letter-spacing\s*:\s*([^;]+)/i);
      if (letterSpacingMatch) {
        const val = letterSpacingMatch[1].trim().replace(/px$/i, '');
        nodeAttrs['letter-spacing'] = val;
      }

      const colorMatch = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
      if (colorMatch) {
        const colorVal = colorMatch[1].trim();
        nodeAttrs.fills = [{ 'fill-color': colorVal, 'fill-opacity': 1 }];
      }

      if (child.childNodes.length === 0) {
        const text = child.textContent || '';
        if (text || tag === 'br') {
          result.push({ text: tag === 'br' ? '' : text, ...nodeAttrs });
        }
      } else {
        const nested = collectInlineNodes(child, nodeAttrs);
        result.push(...nested);
      }
    }
  }

  if (result.length === 0) {
    return [];
  }

  return mergeAdjacentNodes(result);
}

function mergeAdjacentNodes(nodes) {
  if (nodes.length <= 1) return nodes;
  const result = [nodes[0]];
  for (let i = 1; i < nodes.length; i++) {
    const prev = result[result.length - 1];
    const curr = nodes[i];
    const prevStyle = { ...prev };
    const currStyle = { ...curr };
    delete prevStyle.text;
    delete currStyle.text;

    if (JSON.stringify(prevStyle) === JSON.stringify(currStyle)) {
      result[result.length - 1] = { ...prev, text: prev.text + curr.text };
    } else {
      result.push(curr);
    }
  }
  return result;
}

export function extractSelectionStyles() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;

  let node = sel.anchorNode;
  if (node && node.nodeType === Node.TEXT_NODE) node = node.parentNode;

  if (!node || !node.style) return null;

  const styles = {};
  const computed = window.getComputedStyle(node);
  const fontWeight = computed.fontWeight;
  if (fontWeight === 'bold' || parseInt(fontWeight) >= 700) {
    styles['font-weight'] = '700';
  } else {
    styles['font-weight'] = fontWeight;
  }

  styles['font-style'] = computed.fontStyle === 'italic' ? 'italic' : 'normal';
  styles['font-family'] = computed.fontFamily.replace(/['"]/g, '');
  styles['font-size'] = String(Math.round(parseFloat(computed.fontSize)));

  const textDecoration = [];
  if (computed.textDecorationLine.includes('underline')) textDecoration.push('underline');
  if (computed.textDecorationLine.includes('line-through')) textDecoration.push('line-through');
  styles['text-decoration'] = textDecoration.length > 0 ? textDecoration.join(' ') : 'none';

  styles['line-height'] = computed.lineHeight;
  styles['letter-spacing'] = computed.letterSpacing;
  styles['text-align'] = computed.textAlign;
  styles['text-direction'] = computed.direction === 'rtl' ? 'rtl' : 'ltr';
  styles['text-transform'] = computed.textTransform || 'none';

  const color = computed.color;
  styles.fills = [{ 'fill-color': color, 'fill-opacity': 1 }];

  return styles;
}

export { toCamelCase, toKebabCase };