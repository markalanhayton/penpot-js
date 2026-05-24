const FONT_FAMILY_RE = /^[\p{L}\d _.-]+$/u;

export function validFontFamily(s) {
  if (typeof s !== 'string' || s.length > 250) return false;
  return FONT_FAMILY_RE.test(s);
}