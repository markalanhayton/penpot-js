import { info, defaultLayout } from './color.js';

export const COLUMN_TYPES = new Set(['stretch', 'left', 'center', 'right']);

export const GRID_TYPES = new Set(['column', 'row', 'square']);

export const defaultGridParams = {
  square: { size: 16, color: { color: info, opacity: 0.4 } },
  column: { size: 12, type: 'stretch', 'item-length': null, gutter: 8, margin: 0, color: { color: defaultLayout, opacity: 0.1 } },
  row:    { size: 12, type: 'stretch', 'item-length': null, gutter: 8, margin: 0, color: { color: defaultLayout, opacity: 0.1 } }
};