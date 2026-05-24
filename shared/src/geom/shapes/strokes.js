export function updateStrokeWidth(stroke, scale) {
  return { ...stroke, strokeWidth: (stroke.strokeWidth ?? stroke['stroke-width'] ?? 0) * scale };
}

export function updateStrokesWidth(shape, scale) {
  if (!shape.strokes) return shape;
  return { ...shape, strokes: shape.strokes.map(s => updateStrokeWidth(s, scale)) };
}