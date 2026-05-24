import { getIn } from '../data.js';
import { isVariantQ } from '../types/component.js';
import { getComponent } from '../types/components_list.js';
import { validVariantComponentQ, propertiesToName } from '../types/variant.js';

export function findVariantComponents(data, objects, variantId) {
  if (!objects) {
    const pageId = Object.values(data.components ?? {})
      .filter((c) => c['variant-id'] === variantId)
      .shift()?.['main-instance-page'];
    objects = getIn(data, ['pages-index', pageId, 'objects']);
  }

  if (!objects || !objects[variantId]) return [];

  const shapes = objects[variantId].shapes ?? [];
  const result = [];
  for (let i = shapes.length - 1; i >= 0; i--) {
    const componentId = getIn(objects, [shapes[i], 'component-id']);
    const comp = getComponent(data, componentId, true);
    if (comp) result.push(comp);
  }
  return result;
}

export function extractPropertiesNames(shape, data) {
  const comp = getComponent(data, shape['component-id'], true);
  if (!comp) return [];
  return (comp['variant-properties'] ?? []).map((p) => p.name);
}

export function extractPropertiesValues(data, objects, variantId) {
  const comps = findVariantComponents(data, objects, variantId);
  const grouped = {};
  for (const comp of comps) {
    for (const prop of comp['variant-properties'] ?? []) {
      if (!grouped[prop.name]) grouped[prop.name] = [];
      grouped[prop.name].push(prop);
    }
  }

  return Object.entries(grouped).map(([name, props]) => {
    const mdata = props.reduce((acc, p) => ({ ...acc, ...p.metadata }), {});
    return {
      name,
      value: [...new Set(props.map((p) => p.value))],
      ...mdata,
    };
  });
}

export function getVariantMains(component, data) {
  if (!validVariantComponentQ(component)) return undefined;
  const variantId = component['variant-id'];
  if (!variantId) return undefined;

  const pageId = component['main-instance-page'];
  const objects = getIn(data, ['pages-index', pageId, 'objects']);
  return objects?.[variantId]?.shapes;
}

export function isSecondaryVariantQ(component, data) {
  const shapes = getVariantMains(component, data);
  return shapes && shapes.length > 0 && shapes[shapes.length - 1] !== component['main-instance-id'];
}

export function getPrimaryVariant(data, component) {
  const pageId = component['main-instance-page'];
  const objects = getIn(data, ['pages-index', pageId, 'objects']);
  const variantId = component['variant-id'];
  const shapes = getIn(objects, [variantId, 'shapes']);
  if (!shapes || shapes.length === 0) return undefined;
  return objects?.[shapes[0]];
}

export function getPrimaryComponent(data, componentId) {
  const component = getComponent(data, componentId);
  if (!component) return undefined;

  if (isVariantQ(component)) {
    const primary = getPrimaryVariant(data, component);
    return primary ? getComponent(data, primary['component-id']) : undefined;
  }
  return component;
}