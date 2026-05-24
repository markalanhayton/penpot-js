import * as d from '../data.js';
import * as dt from '../time.js';

export function getColors(fileData) {
  return fileData.colors ?? {};
}

export function getColor(fileData, colorId) {
  return fileData.colors?.[colorId];
}

export function getRefColor(libraryData, color) {
  if (color['ref-file'] === libraryData.id) {
    return getColor(libraryData, color['ref-id']);
  }
  return undefined;
}

function touch(color) {
  return { ...color, modifiedAt: dt.now() };
}

export function addColor(fileData, color) {
  return {
    ...fileData,
    colors: { ...(fileData.colors ?? {}), [color.id]: touch(color) },
  };
}

export function setColor(fileData, color) {
  const current = fileData.colors?.[color.id];
  if (current === undefined) return fileData;
  return {
    ...fileData,
    colors: { ...(fileData.colors ?? {}), [color.id]: touch(color) },
  };
}

export function updateColor(fileData, colorId, f, ...args) {
  return d.updateInWhen(fileData, ['colors', colorId], (c) => touch(f(c, ...args)));
}

export function deleteColor(fileData, colorId) {
  const { [colorId]: _, ...rest } = fileData.colors ?? {};
  return { ...fileData, colors: rest };
}

export function usedColorsChangedSince(shape, library, sinceDate) {
  const results = [];
  const allColors = getAllColors(shape);
  for (const color of allColors) {
    const refColor = getRefColor(library.data, color);
    if (refColor && refColor.modifiedAt && refColor.modifiedAt >= sinceDate) {
      results.push({ shapeId: shape.id, assetId: refColor.id, assetType: 'color' });
    }
  }
  return results;
}

function getAllColors(shape) {
  const colors = [];
  if (shape.fills) {
    for (const fill of shape.fills) {
      if (fill['fill-color-ref-id']) colors.push(fill);
    }
  }
  if (shape.strokes) {
    for (const stroke of shape.strokes) {
      if (stroke['stroke-color-ref-id']) colors.push(stroke);
    }
  }
  return colors;
}

export function syncColors(shape, libraryId, libraryColors) {
  let result = shape;

  if (result.fills) {
    result = {
      ...result,
      fills: result.fills.map((fill) => {
        if (fill['fill-color-ref-file'] === libraryId) {
          const libColor = libraryColors[fill['fill-color-ref-id']];
          if (libColor != null) {
            return {
              ...fill,
              'fill-color': libColor.color,
              'fill-opacity': libColor.opacity,
              'fill-color-gradient': libColor.gradient,
            };
          }
        }
        return fill;
      }),
    };
  }

  if (result.strokes) {
    result = {
      ...result,
      strokes: result.strokes.map((stroke) => {
        if (stroke['stroke-color-ref-file'] === libraryId) {
          const libColor = libraryColors[stroke['stroke-color-ref-id']];
          if (libColor != null) {
            return {
              ...stroke,
              'stroke-color': libColor.color,
              'stroke-opacity': libColor.opacity,
              'stroke-color-gradient': libColor.gradient,
            };
          }
        }
        return stroke;
      }),
    };
  }

  return result;
}