// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) KALEIDOS INC

import * as transit from "./transit.js";

const STYLE_SEPARATOR = "$$$";
const PENPOT_PREFIX = "PENPOT";

export function encodeStyleValue(v) {
  return transit.encodeStr(v);
}

export function decodeStyleValue(v) {
  return transit.decodeStr(v);
}

export function encodeStyle(key, val) {
  const k = typeof key === "string" ? key : key.name || String(key);
  const v = encodeStyleValue(val);
  return `${PENPOT_PREFIX}${STYLE_SEPARATOR}${k}${STYLE_SEPARATOR}${v}`;
}

export function decodeStyle(style) {
  const parts = style.split(STYLE_SEPARATOR);
  if (parts.length >= 3) {
    return [parts[1], decodeStyleValue(parts[2])];
  }
  return [null, null];
}

export function attrsToStyles(attrs) {
  const result = new Set();
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== null && v !== undefined) {
      result.add(encodeStyle(k, v));
    }
  }
  return result;
}

export function stylesToAttrs(styles) {
  const result = {};
  for (const style of styles) {
    if (style.startsWith(PENPOT_PREFIX)) {
      if (style === "PENPOT_SELECTION") {
        result["penpot-selection"] = true;
      } else {
        const [k, v] = decodeStyle(style);
        if (k !== null) {
          result[k] = v;
        }
      }
    }
  }
  return result;
}

function parseDraftStyles(styles) {
  return styles
    .filter((item) => item.style && item.style.startsWith(`${PENPOT_PREFIX}${STYLE_SEPARATOR}`))
    .map((item) => {
      const [k, v] = decodeStyle(item.style);
      return {
        key: k,
        val: v,
        offset: item.offset,
        length: item.length,
      };
    });
}

function buildStyleIndex(length, ranges) {
  const result = new Array(length).fill(null).map(() => ({}));
  for (const item of ranges) {
    for (let i = item.offset; i < item.offset + item.length && i < length; i++) {
      result[i][item.key] = item.val;
    }
  }
  return result;
}

function textToCodePoints(text) {
  return Array.from(text);
}

function codePointsToText(cpoints, start, end) {
  return cpoints.slice(start, end).join("");
}

function fixGradients(data) {
  if (data && data.fills) {
    data = {
      ...data,
      fills: data.fills.map((fill) => {
        if (fill && fill.fillColorGradient && typeof fill.fillColorGradient.type === "string") {
          return { ...fill, fillColorGradient: { ...fill.fillColorGradient, type: fill.fillColorGradient.type } };
        }
        return fill;
      }),
    };
  }
  return data;
}

export function convertFromDraft(content) {
  function extractText(cpoints, part) {
    const start = part[0][1].offset;
    const end = part[part.length - 1].offset + 1;
    const text = codePointsToText(cpoints, start, end);
    const attrs = { ...part[0][1] };
    const fixedData = fixGradients(attrs);
    return { ...fixedData, text };
  }

  function splitTexts(text, styles, data) {
    const cpoints = textToCodePoints(text);
    const parsed = parseDraftStyles(styles);
    const styleIndex = buildStyleIndex(cpoints.length, parsed);
    const groups = [];
    let current = null;
    let prevKey = null;

    for (let i = 0; i < styleIndex.length; i++) {
      const key = JSON.stringify(styleIndex[i]);
      if (key !== prevKey) {
        if (current) groups.push(current);
        current = { start: i, attrs: styleIndex[i] };
        prevKey = key;
      }
    }
    if (current) groups.push(current);

    const children = groups.map((group) => {
      const text = cpoints.slice(group.start, groups.indexOf(group) < groups.length - 1 ? groups[groups.indexOf(group) + 1].start : cpoints.length).join("");
      const fixedData = fixGradients(group.attrs);
      return { ...fixedData, text };
    });

    if (children.length === 0) {
      children.push({ ...data, text: "" });
    }
    return children;
  }

  function buildParagraph(block) {
    const key = block.key;
    const text = block.text;
    const styles = block.inlineStyleRanges || [];
    const data = fixGradients(block.data || {});
    return {
      ...data,
      key,
      type: "paragraph",
      children: splitTexts(text, styles, data),
    };
  }

  return {
    type: "root",
    children: [
      {
        type: "paragraph-set",
        children: (content.blocks || []).map(buildParagraph),
      },
    ],
  };
}

export function convertToDraft(root) {
  function processAttr(children, ranges, kv) {
    const [k, v] = kv;
    let start = null;
    let offset = 0;

    for (const item of children) {
      const cpoints = textToCodePoints(item.text);
      if (v !== undefined && item[k] === v) {
        if (start === null) start = offset;
        offset += cpoints.length;
      } else {
        if (start !== null) {
          ranges.push({ offset: start, length: offset - start, style: encodeStyle(k, v) });
          start = null;
        }
        offset += cpoints.length;
      }
    }
    if (start !== null) {
      ranges.push({ offset: start, length: offset - start, style: encodeStyle(k, v) });
    }
    return ranges;
  }

  function calcRanges(paragraph) {
    const attrs = Object.entries(paragraph)
      .filter(([k]) => k !== "key" && k !== "children" && k !== "type" && k !== "text")
      .filter(([, v]) => v !== undefined && v !== null && Object.keys(v || {}).length > 0);

    const styles = [];
    for (const [k, v] of attrs) {
      processAttr(paragraph.children, styles, [k, v]);
    }
    return styles;
  }

  function buildBlock(paragraph) {
    return {
      key: paragraph.key,
      depth: 0,
      text: paragraph.children.map((c) => c.text).join(""),
      data: Object.fromEntries(Object.entries(paragraph).filter(([k]) => k !== "key" && k !== "children" && k !== "type" && k !== "text")),
      type: "unstyled",
      entityRanges: [],
      inlineStyleRanges: calcRanges(paragraph),
    };
  }

  function* nodeSeq(pred, node) {
    if (pred(node)) yield node;
    if (node.children) {
      for (const child of node.children) {
        yield* nodeSeq(pred, child);
      }
    }
  }

  const paragraphs = [...nodeSeq((n) => n.type === "paragraph", root)];
  return {
    blocks: paragraphs.map(buildBlock),
    entityMap: {},
  };
}

export const TEXT_ALL_ATTRS = [
  "fontId",
  "fontVariantId",
  "fontSize",
  "fontStyle",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "textDecoration",
  "textTransform",
  "fillColor",
  "fillOpacity",
];

export function contentToTextWithStyles(node) {
  function recStyleTextMap(acc, node, style) {
    const nodeStyle = { ...style };
    for (const attr of TEXT_ALL_ATTRS) {
      if (node[attr] !== undefined) {
        nodeStyle[attr] = node[attr];
      }
    }
    const head = acc[0] || [{}, ""];
    const [headStyle, headText] = head;

    let newAcc;
    if (node.type !== "paragraph-set" && node.type !== "paragraph" && node.type !== "root") {
      if (node.text !== undefined && node.text !== null) {
        if (JSON.stringify(headStyle) !== JSON.stringify(nodeStyle)) {
          newAcc = [[nodeStyle, node.text || ""], ...acc];
        } else {
          newAcc = [[headStyle, headText + (node.text || "")], ...acc.slice(1)];
        }
      } else {
        newAcc = acc;
      }
    } else {
      newAcc = acc;
    }

    if (node.children) {
      for (const child of node.children) {
        newAcc = recStyleTextMap(newAcc, child, nodeStyle);
      }
    }

    if (node.type === "paragraph") {
      const [hs, ht] = newAcc[0] || [{}, ""];
      newAcc = [[hs, ht + "\n"], ...newAcc.slice(1)];
    }

    return newAcc;
  }

  return recStyleTextMap([], node, {}).reverse();
}

export function indexContent(content, path, index) {
  const curPath = path ? `${path}-` : "";
  const curPath2 = `${curPath}${content.type || "text"}-${index}`;
  const result = {
    ...content,
    $id: curPath2,
  };
  if (content.children) {
    result.children = content.children.map((child, idx) => indexContent(child, curPath2, idx));
  }
  return result;
}