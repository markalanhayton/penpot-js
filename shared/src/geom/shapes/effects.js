export function updateShadowScale(shadow, scale) {
  return {
    ...shadow,
    offsetX: (shadow.offsetX ?? shadow['offset-x'] ?? 0) * scale,
    offsetY: (shadow.offsetY ?? shadow['offset-y'] ?? 0) * scale,
    spread: (shadow.spread ?? 0) * scale,
    blur: (shadow.blur ?? 0) * scale,
  };
}

export function updateShadowsScale(shape, scale) {
  if (!shape.shadow) return shape;
  return { ...shape, shadow: shape.shadow.map(s => updateShadowScale(s, scale)) };
}

export function updateBlurScale(shape, scale) {
  if (!shape.blur) return shape;
  return { ...shape, blur: { ...shape.blur, value: shape.blur.value * scale } };
}