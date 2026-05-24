export const NODE_TYPES = new Set(['root', 'paragraph-set', 'paragraph']);

export function validContent(content) {
  return content != null &&
    typeof content === 'object' &&
    content.type === 'root';
}