import { COLOR_ATTRS } from '../color.js';

export const SHADOW_STYLES = new Set(['drop-shadow', 'inner-shadow']);

export const SHADOW_COLOR_ATTRS = new Set([...COLOR_ATTRS, 'color']);

export function validShadow(shadow) {
  return shadow != null &&
    typeof shadow['offset-x'] === 'number' &&
    typeof shadow['offset-y'] === 'number' &&
    typeof shadow.blur === 'number' &&
    typeof shadow.spread === 'number' &&
    typeof shadow.hidden === 'boolean' &&
    SHADOW_STYLES.has(shadow.style);
}