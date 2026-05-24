import { gray20 } from '../color.js';

export const defaultColor = gray20;

export const editableAttrs = {
  frame: new Set([
    'proportion-lock', 'width', 'height', 'x', 'y',
    'r1', 'r2', 'r3', 'r4', 'rotation', 'selrect', 'points',
    'show-content', 'hide-in-viewer',
    'applied-tokens', 'opacity', 'blend-mode', 'blocked', 'hidden',
    'shadow', 'blur',
    'fills', 'fill-color', 'fill-opacity', 'fill-color-ref-id', 'fill-color-ref-file',
    'fill-color-gradient', 'hide-fill-on-export',
    'strokes', 'stroke-style', 'stroke-alignment', 'stroke-width',
    'stroke-color', 'stroke-color-ref-id', 'stroke-color-ref-file',
    'stroke-opacity', 'stroke-color-gradient', 'stroke-cap-start', 'stroke-cap-end',
    'exports',
    'layout', 'layout-flex-dir', 'layout-gap', 'layout-gap-type',
    'layout-align-items', 'layout-justify-content', 'layout-align-content',
    'layout-wrap-type', 'layout-padding-type', 'layout-padding',
    'layout-grid-dir', 'layout-justify-items', 'layout-grid-columns', 'layout-grid-rows',
    'layout-item-margin', 'layout-item-margin-type', 'layout-item-h-sizing',
    'layout-item-v-sizing', 'layout-item-max-h', 'layout-item-min-h',
    'layout-item-max-w', 'layout-item-min-w', 'layout-item-align-self',
    'layout-item-absolute', 'layout-item-z-index'
  ]),

  group: new Set([
    'proportion-lock', 'width', 'height', 'x', 'y', 'rotation', 'selrect', 'points',
    'constraints-h', 'constraints-v', 'fixed-scroll', 'parent-id', 'frame-id',
    'applied-tokens', 'opacity', 'blend-mode', 'blocked', 'hidden',
    'shadow', 'blur', 'exports',
    'layout-item-margin', 'layout-item-margin-type', 'layout-item-h-sizing',
    'layout-item-v-sizing', 'layout-item-max-h', 'layout-item-min-h',
    'layout-item-max-w', 'layout-item-min-w', 'layout-item-align-self',
    'layout-item-absolute', 'layout-item-z-index'
  ]),

  rect: new Set([
    'proportion-lock', 'width', 'height', 'x', 'y', 'rotation',
    'r1', 'r2', 'r3', 'r4', 'selrect', 'points',
    'constraints-h', 'constraints-v', 'fixed-scroll', 'parent-id', 'frame-id',
    'opacity', 'blend-mode', 'blocked', 'hidden',
    'fills', 'fill-color', 'fill-opacity', 'fill-color-ref-id', 'fill-color-ref-file',
    'fill-color-gradient',
    'strokes', 'stroke-style', 'stroke-alignment', 'stroke-width',
    'stroke-color', 'stroke-color-ref-id', 'stroke-color-ref-file',
    'stroke-opacity', 'stroke-color-gradient', 'stroke-cap-start', 'stroke-cap-end',
    'shadow', 'blur', 'exports',
    'layout-item-margin', 'layout-item-margin-type', 'layout-item-h-sizing',
    'layout-item-v-sizing', 'layout-item-max-h', 'layout-item-min-h',
    'layout-item-max-w', 'layout-item-min-w', 'layout-item-align-self',
    'layout-item-absolute', 'layout-item-z-index'
  ]),

  circle: new Set([
    'proportion-lock', 'width', 'height', 'x', 'y', 'rotation', 'selrect', 'points',
    'constraints-h', 'constraints-v', 'fixed-scroll', 'parent-id', 'frame-id',
    'opacity', 'blend-mode', 'blocked', 'hidden',
    'fills', 'fill-color', 'fill-opacity', 'fill-color-ref-id', 'fill-color-ref-file',
    'fill-color-gradient',
    'strokes', 'stroke-style', 'stroke-alignment', 'stroke-width',
    'stroke-color', 'stroke-color-ref-id', 'stroke-color-ref-file',
    'stroke-opacity', 'stroke-color-gradient', 'stroke-cap-start', 'stroke-cap-end',
    'shadow', 'blur', 'exports',
    'layout-item-margin', 'layout-item-margin-type', 'layout-item-h-sizing',
    'layout-item-v-sizing', 'layout-item-max-h', 'layout-item-min-h',
    'layout-item-max-w', 'layout-item-min-w', 'layout-item-align-self',
    'layout-item-absolute', 'layout-item-z-index'
  ]),

  path: new Set([
    'proportion-lock', 'width', 'height', 'x', 'y', 'rotation', 'selrect', 'points',
    'constraints-h', 'constraints-v', 'fixed-scroll', 'parent-id', 'frame-id',
    'opacity', 'blend-mode', 'blocked', 'hidden',
    'fills', 'fill-color', 'fill-opacity', 'fill-color-ref-id', 'fill-color-ref-file',
    'fill-color-gradient',
    'strokes', 'stroke-style', 'stroke-alignment', 'stroke-width',
    'stroke-color', 'stroke-color-ref-id', 'stroke-color-ref-file',
    'stroke-opacity', 'stroke-color-gradient', 'stroke-cap-start', 'stroke-cap-end',
    'shadow', 'blur', 'exports',
    'layout-item-margin', 'layout-item-margin-type', 'layout-item-h-sizing',
    'layout-item-v-sizing', 'layout-item-max-h', 'layout-item-min-h',
    'layout-item-max-w', 'layout-item-min-w', 'layout-item-align-self',
    'layout-item-absolute', 'layout-item-z-index'
  ]),

  text: new Set([
    'proportion-lock', 'width', 'height', 'x', 'y', 'rotation', 'selrect', 'points',
    'constraints-h', 'constraints-v', 'fixed-scroll', 'parent-id', 'frame-id',
    'opacity', 'blend-mode', 'blocked', 'hidden',
    'fill-color', 'fill-opacity', 'fill-color-ref-id', 'fill-color-ref-file',
    'fill-color-gradient',
    'strokes', 'stroke-style', 'stroke-alignment', 'stroke-width',
    'stroke-color', 'stroke-color-ref-id', 'stroke-color-ref-file',
    'stroke-opacity', 'stroke-color-gradient', 'stroke-cap-start', 'stroke-cap-end',
    'shadow', 'blur',
    'typography-ref-id', 'typography-ref-file',
    'font-id', 'font-family', 'font-variant-id', 'font-size', 'font-weight', 'font-style',
    'text-align', 'text-direction', 'line-height', 'letter-spacing',
    'vertical-align', 'text-decoration', 'text-transform', 'grow-type',
    'exports',
    'layout-item-margin', 'layout-item-margin-type', 'layout-item-h-sizing',
    'layout-item-v-sizing', 'layout-item-max-h', 'layout-item-min-h',
    'layout-item-max-w', 'layout-item-min-w', 'layout-item-align-self',
    'layout-item-absolute', 'layout-item-z-index'
  ]),

  image: new Set([
    'proportion-lock', 'width', 'height', 'x', 'y', 'rotation',
    'r1', 'r2', 'r3', 'r4', 'selrect', 'points',
    'constraints-h', 'constraints-v', 'fixed-scroll', 'parent-id', 'frame-id',
    'opacity', 'blend-mode', 'blocked', 'hidden',
    'shadow', 'blur', 'exports',
    'layout-item-margin', 'layout-item-margin-type', 'layout-item-h-sizing',
    'layout-item-v-sizing', 'layout-item-max-h', 'layout-item-min-h',
    'layout-item-max-w', 'layout-item-min-w', 'layout-item-align-self',
    'layout-item-absolute', 'layout-item-z-index'
  ]),

  'svg-raw': new Set([
    'proportion-lock', 'width', 'height', 'x', 'y', 'rotation',
    'r1', 'r2', 'r3', 'r4', 'selrect', 'points',
    'constraints-h', 'constraints-v', 'fixed-scroll', 'parent-id', 'frame-id',
    'opacity', 'blend-mode', 'blocked', 'hidden',
    'fills', 'fill-color', 'fill-opacity', 'fill-color-ref-id', 'fill-color-ref-file',
    'fill-color-gradient',
    'strokes', 'stroke-style', 'stroke-alignment', 'stroke-width',
    'stroke-color', 'stroke-color-ref-id', 'stroke-color-ref-file',
    'stroke-opacity', 'stroke-color-gradient', 'stroke-cap-start', 'stroke-cap-end',
    'shadow', 'blur', 'exports',
    'layout-item-margin', 'layout-item-margin-type', 'layout-item-h-sizing',
    'layout-item-v-sizing', 'layout-item-max-h', 'layout-item-min-h',
    'layout-item-max-w', 'layout-item-min-w', 'layout-item-align-self',
    'layout-item-absolute', 'layout-item-z-index'
  ]),

  bool: new Set([
    'proportion-lock', 'width', 'height', 'x', 'y', 'rotation',
    'r1', 'r2', 'r3', 'r4', 'selrect', 'points',
    'constraints-h', 'constraints-v', 'fixed-scroll', 'parent-id', 'frame-id',
    'opacity', 'blend-mode', 'blocked', 'hidden',
    'fills', 'fill-color', 'fill-opacity', 'fill-color-ref-id', 'fill-color-ref-file',
    'fill-color-gradient',
    'stroke-style', 'stroke-alignment', 'stroke-width',
    'stroke-color', 'stroke-color-ref-id', 'stroke-color-ref-file',
    'stroke-opacity', 'stroke-color-gradient', 'stroke-cap-start', 'stroke-cap-end',
    'shadow', 'blur', 'exports',
    'layout-item-margin', 'layout-item-margin-type', 'layout-item-h-sizing',
    'layout-item-v-sizing', 'layout-item-max-h', 'layout-item-min-h',
    'layout-item-max-w', 'layout-item-min-w', 'layout-item-align-self',
    'layout-item-absolute', 'layout-item-z-index'
  ])
};