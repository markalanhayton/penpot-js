'use strict';
/**
 * @module fix-deleted-fonts
 * @description Detects and auto-fixes text shapes and typographies that reference
 * fonts no longer available in the team's font library.
 *
 * Port of app.main.data.workspace.fix-deleted-fonts (ClojureScript, 124 lines).
 *
 * When a document references a custom font that has been deleted from the team
 * (e.g. after file import or team font cleanup), this module:
 * 1. Detects text shapes with invalid font-id references
 * 2. Attempts to substitute a valid font-id with the same font-family
 * 3. Commits the fixes without adding to undo history
 * 4. Returns info about which fonts were missing for UI notification
 */

import { nodeSeq, isTextNodeQ, transformNodes } from '@penpot/shared/types/text.js';
import { SYSTEM_FONTS } from '@penpot/shared/constants';

const SYSTEM_FONT_IDS = new Set(SYSTEM_FONTS.map(f => f.id));
const SYSTEM_FONT_FAMILIES = new Set(SYSTEM_FONTS.map(f => f.family.toLowerCase()));

function isSystemFontId(fontId) {
  if (!fontId) return true;
  return SYSTEM_FONT_IDS.has(fontId) || SYSTEM_FONT_FAMILIES.has(String(fontId).toLowerCase());
}

function isSystemFontFamily(fontFamily) {
  if (!fontFamily) return true;
  const lower = fontFamily.toLowerCase().split(',')[0].trim();
  return SYSTEM_FONT_FAMILIES.has(lower);
}

function buildFontRegistry(teamFonts) {
  const registry = new Map();
  if (Array.isArray(teamFonts)) {
    for (const family of teamFonts) {
      for (const variant of (family.variants || [])) {
        const vid = variant.id || variant.variantId;
        if (vid) {
          registry.set(vid, {
            id: vid,
            fontFamily: family.fontFamily,
            fontWeight: variant.fontWeight || variant.font_weight,
            fontStyle: variant.fontStyle || variant.font_style,
          });
        }
      }
    }
  }
  return registry;
}

function findAlternativeFontId(fontFamily, teamFonts, fontRegistry) {
  if (!fontFamily) return null;

  const lower = fontFamily.toLowerCase().split(',')[0].trim();
  for (const [id, entry] of fontRegistry) {
    if (entry.fontFamily && entry.fontFamily.toLowerCase().split(',')[0].trim() === lower) {
      return id;
    }
  }

  for (const family of (teamFonts || [])) {
    if (family.fontFamily && family.fontFamily.toLowerCase().split(',')[0].trim() === lower) {
      const variant = family.variants && family.variants[0];
      if (variant) return variant.id || variant.variantId;
    }
  }

  return null;
}

function hasInvalidFontFamily(node, fontRegistry) {
  const fontFamily = node['font-family'] || node.fontFamily;
  if (!fontFamily) return false;
  const fontId = node['font-id'] || node.fontId;
  if (isSystemFontId(fontId)) return false;
  if (isSystemFontFamily(fontFamily)) return false;
  return !fontRegistry.has(fontId);
}

function shapeHasInvalidFontFamily(shape, fontRegistry) {
  if (shape.type !== 'text' || !shape.content) return false;
  const nodes = nodeSeq(shape.content, (node) => hasInvalidFontFamily(node, fontRegistry));
  return nodes && nodes.length > 0;
}

function fixDeletedFont(node, teamFonts, fontRegistry) {
  const fontFamily = node['font-family'] || node.fontFamily;
  const alternativeId = findAlternativeFontId(fontFamily, teamFonts, fontRegistry);
  if (alternativeId) {
    return { ...node, 'font-id': alternativeId };
  }
  return node;
}

function fixShapeContent(shape, teamFonts, fontRegistry) {
  if (!shape.content) return shape.content;
  return transformNodes(
    shape.content,
    (node) => hasInvalidFontFamily(node, fontRegistry),
    (node) => fixDeletedFont(node, teamFonts, fontRegistry)
  );
}

function fixTypography(typography, teamFonts, fontRegistry) {
  const newId = findAlternativeFontId(
    typography['font-family'] || typography.fontFamily,
    teamFonts,
    fontRegistry
  );
  if (newId) {
    return { ...typography, 'font-id': newId };
  }
  return typography;
}

export function generatePageChanges(page, teamFonts, fontRegistry) {
  const changes = [];
  if (!page || !page.objects) return changes;

  for (const [shapeId, shape] of Object.entries(page.objects)) {
    if (shapeHasInvalidFontFamily(shape, fontRegistry)) {
      const fixedContent = fixShapeContent(shape, teamFonts, fontRegistry);
      changes.push({
        type: 'mod-obj',
        id: shapeId,
        pageId: page.id,
        operations: [
          { type: 'set', attr: 'content', val: fixedContent },
          { type: 'set', attr: 'position-data', val: null },
        ],
      });
    }
  }

  return changes;
}

export function generateLibraryChanges(fileData, teamFonts, fontRegistry) {
  const changes = [];
  if (!fileData || !fileData.typographies) return changes;

  const typographies = Array.isArray(fileData.typographies)
    ? Object.fromEntries(fileData.typographies.map(t => [t.id, t]))
    : fileData.typographies;

  for (const [id, typography] of Object.entries(typographies)) {
    if (hasInvalidFontFamily(typography, fontRegistry)) {
      changes.push({
        type: 'mod-typography',
        typography: fixTypography(typography, teamFonts, fontRegistry),
      });
    }
  }

  return changes;
}

export function findMissingFonts(shapes, fontRegistry) {
  const missing = new Map();

  const shapeList = Array.isArray(shapes)
    ? shapes
    : shapes && shapes.objects
      ? Object.values(shapes.objects)
      : [];

  for (const shape of shapeList) {
    if (shape.type !== 'text' || !shape.content) continue;
    const textNodes = nodeSeq(shape.content, isTextNodeQ);
    if (!textNodes) continue;

    for (const node of textNodes) {
      const fontId = node['font-id'] || node.fontId;
      const fontFamily = node['font-family'] || node.fontFamily;
      if (!fontId || isSystemFontId(fontId) || isSystemFontFamily(fontFamily)) continue;
      if (!fontRegistry.has(fontId) && !missing.has(fontId)) {
        missing.set(fontId, fontFamily);
      }
    }
  }

  return [...missing.entries()].map(([id, family]) => ({ fontId: id, fontFamily: family }));
}

export function fixDeletedFontsForPage(fileData, page, teamFonts) {
  const fontRegistry = buildFontRegistry(teamFonts);
  const changes = generatePageChanges(page, teamFonts, fontRegistry);
  const missingFonts = findMissingFonts(page, fontRegistry);

  return { changes, missingFonts };
}

export function fixDeletedFontsForLibrary(fileData, teamFonts) {
  const fontRegistry = buildFontRegistry(teamFonts);
  const changes = generateLibraryChanges(fileData, teamFonts, fontRegistry);
  return changes;
}