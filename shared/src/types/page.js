import * as d from '../data.js';
import { next as uuidNext, zero as uuidZero } from '../uuid.js';

export const ROOT_ID = uuidZero;

export function makeEmptyPage(opts = {}) {
  return {
    id: opts.id || uuidNext(),
    name: opts.name || 'Page 1',
    objects: {
      [ROOT_ID]: setupRootFrame()
    },
    ...(opts.background ? { background: opts.background } : {})
  };
}

function setupRootFrame() {
  return {
    id: ROOT_ID,
    type: 'frame',
    name: 'Root Frame',
    'parent-id': ROOT_ID,
    'frame-id': ROOT_ID,
    x: 0, y: 0,
    width: 0.01, height: 0.01
  };
}

export function getFrameFlow(flows, frameId) {
  if (!flows) return undefined;
  for (const flow of Object.values(flows)) {
    if (flow['starting-frame'] === frameId) return flow;
  }
  return undefined;
}

export function isPageEmpty(page) {
  const objects = page.objects || {};
  return Object.keys(objects).length <= 1;
}