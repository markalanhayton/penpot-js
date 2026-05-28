/**
 * Canonical system font list.
 *
 * Each entry: { id: string, label: string, family: string }
 *   - id:     unique identifier (e.g. 'font-sans-serif')
 *   - label:  human-readable display name (e.g. 'Sans Serif')
 *   - family: CSS font-family value, may include fallback stack (e.g. 'Arial, sans-serif')
 *
 * Consumer derivation patterns:
 *   - Text toolbar:  { ...f, value: f.family, isTeam: false }
 *   - Rich text:     uses f.family and f.label directly
 *   - Asset panel:   uses f.label (fallback f.name for team fonts), f.family, f.id
 */
export const SYSTEM_FONTS = [
  { id: 'font-sans-serif', label: 'Sans Serif', family: 'sans-serif' },
  { id: 'font-serif', label: 'Serif', family: 'serif' },
  { id: 'font-monospace', label: 'Monospace', family: 'monospace' },
  { id: 'font-arial', label: 'Arial', family: 'Arial, sans-serif' },
  { id: 'font-helvetica', label: 'Helvetica', family: 'Helvetica, sans-serif' },
  { id: 'font-times-new-roman', label: 'Times New Roman', family: "'Times New Roman', serif" },
  { id: 'font-courier-new', label: 'Courier New', family: "'Courier New', monospace" },
  { id: 'font-georgia', label: 'Georgia', family: 'Georgia, serif' },
  { id: 'font-verdana', label: 'Verdana', family: 'Verdana, sans-serif' },
  { id: 'font-trebuchet-ms', label: 'Trebuchet MS', family: "'Trebuchet MS', sans-serif" },
  { id: 'font-impact', label: 'Impact', family: 'Impact, sans-serif' },
  { id: 'font-inter', label: 'Inter', family: 'Inter, sans-serif' },
  { id: 'font-roboto', label: 'Roboto', family: 'Roboto, sans-serif' },
  { id: 'font-open-sans', label: 'Open Sans', family: 'Open Sans, sans-serif' },
  { id: 'font-lato', label: 'Lato', family: 'Lato, sans-serif' },
  { id: 'font-montserrat', label: 'Montserrat', family: 'Montserrat, sans-serif' },
  { id: 'font-source-code-pro', label: 'Source Code Pro', family: "'Source Code Pro', monospace" },
];

export const SYSTEM_FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72];