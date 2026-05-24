import { renderBitmap } from './bitmap.js';
import { renderSvg } from './svg.js';
import { renderPdf } from './pdf.js';
import { DEFAULTS } from '../config.js';
import { logger } from '../util.js';

export async function render(params, config) {
  const { type } = params;

  if (!DEFAULTS.VALID_TYPES.includes(type)) {
    throw new Error(`Invalid export type: ${type}. Valid types: ${DEFAULTS.VALID_TYPES.join(', ')}`);
  }

  logger.info('Starting render', { type, objectCount: params.objects?.length || 0, scale: params.scale });

  switch (type) {
    case 'png':
    case 'jpeg':
    case 'webp':
      return renderBitmap(params, config);
    case 'svg':
      return renderSvg(params, config);
    case 'pdf':
      return renderPdf(params, config);
    default:
      throw new Error(`Unsupported type: ${type}`);
  }
}