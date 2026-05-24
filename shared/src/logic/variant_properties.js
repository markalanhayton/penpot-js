import { updateInWhen, removeAtIndex, nilv } from '../data.js';
import { propertiesToName, updateNumberInRepeatedItem, nextPropertyNumber, PROPERTY_PREFIX, VALUE_PREFIX, addNewProp, mergeProperties, addNewProps, pathToProperties, removePrefix } from '../types/variant.js';
import { splitGroupName, mergePathItem } from '../path_names.js';
import { isVariantQ, isVariantContainerQ } from '../types/component.js';
import { getComponent } from '../types/components_list.js';
import { findVariantComponents } from '../files/variant.js';

export function generateUpdatePropertyName(changes, variantId, pos, newName) {
  const data = changes['library-data'] ?? changes?.data;
  const objects = changes['objects'] ?? data?.objects ?? {};
  const relatedComponents = findVariantComponents(data, objects, variantId);

  if (relatedComponents.length === 0) return changes;

  const props = relatedComponents[relatedComponents.length - 1]?.['variant-properties'] ?? [];
  const propNames = props.map((p) => p.name);
  const newPropNames = [...propNames.slice(0, pos), ...propNames.slice(pos + 1)];
  const finalName = updateNumberInRepeatedItem(newPropNames, newName);

  let result = { ...changes };
  for (const component of relatedComponents) {
    const id = component.id;
    const updatedProps = component['variant-properties']?.map((p, i) =>
      i === pos ? { ...p, name: finalName } : p
    );
    result = updateComponent(result, id, (c) => ({
      ...c,
      'variant-properties': updatedProps,
    }));
  }
  return result;
}

export function generateRemoveProperty(changes, variantId, pos) {
  const data = changes['library-data'] ?? changes?.data;
  const objects = changes['objects'] ?? data?.objects ?? {};
  const relatedComponents = findVariantComponents(data, objects, variantId);

  if (relatedComponents.length === 0) return changes;

  const props = relatedComponents[0]?.['variant-properties'] ?? [];
  if (props.length === 0 || pos < 0 || pos >= props.length) return changes;

  let result = { ...changes };
  for (const component of relatedComponents) {
    const cProps = component['variant-properties'] ?? [];
    const newProps = removeAtIndex(cProps, pos);
    const name = propertiesToName(newProps);
    const mainId = component['main-instance-id'];

    result = updateComponent(result, component.id, (c) => ({
      ...c,
      'variant-properties': newProps,
    }));

    if (mainId && result['shapes']) {
      result['shapes'] = result['shapes'].map((s) =>
        s.id === mainId ? { ...s, 'variant-name': name } : s
      );
    }
  }
  return result;
}

export function generateUpdatePropertyValue(changes, componentId, pos, value) {
  const data = changes['library-data'] ?? changes?.data;
  const component = getComponent(data, componentId, true);
  if (!component) return changes;

  const mainId = component['main-instance-id'];
  const props = (component['variant-properties'] ?? []).map((p, i) =>
    i === pos ? { ...p, value } : p
  );
  const name = propertiesToName(props);

  let result = { ...changes };
  result = updateComponent(result, componentId, (c) => ({
    ...c,
    'variant-properties': props,
    [`variant-properties.${pos}.value`]: value,
  }));

  if (mainId && result['shapes']) {
    result['shapes'] = result['shapes'].map((s) =>
      s.id === mainId ? { ...s, 'variant-name': name } : s
    );
  }
  return result;
}

export function generateSetVariantError(changes, componentId, value) {
  const data = changes['library-data'] ?? changes?.data;
  const component = getComponent(data, componentId, true);
  if (!component) return changes;

  const mainId = component['main-instance-id'];
  if (!mainId) return changes;

  const result = { ...changes };
  if (result['shapes']) {
    result['shapes'] = result['shapes'].map((s) => {
      if (s.id !== mainId) return s;
      return value == null
        ? (() => { const { 'variant-error': _, ...rest } = s; return rest; })()
        : { ...s, 'variant-error': value };
    });
  }
  return result;
}

export function generateReorderVariantProperties(changes, variantId, fromPos, toPos) {
  const data = changes['library-data'] ?? changes?.data;
  const objects = changes['objects'] ?? data?.objects ?? {};
  const relatedComponents = findVariantComponents(data, objects, variantId);

  let result = { ...changes };
  for (const component of relatedComponents) {
    const props = [...(component['variant-properties'] ?? [])];
    const [moved] = props.splice(fromPos, 1);
    props.splice(toPos, 0, moved);

    const mainId = component['main-instance-id'];
    const name = propertiesToName(props);

    result = updateComponent(result, component.id, (c) => ({
      ...c,
      'variant-properties': props,
    }));

    if (mainId && result['shapes']) {
      result['shapes'] = result['shapes'].map((s) =>
        s.id === mainId ? { ...s, 'variant-name': name } : s
      );
    }
  }
  return result;
}

export function generateAddNewProperty(changes, variantId, options = {}) {
  const { fillValues = false, editing = false, propertyName, propertyValue } = options;
  const data = changes['library-data'] ?? changes?.data;
  const objects = changes['objects'] ?? data?.objects ?? {};
  const relatedComponents = findVariantComponents(data, objects, variantId);

  if (relatedComponents.length === 0) return changes;

  const props = relatedComponents[relatedComponents.length - 1]?.['variant-properties'] ?? [];
  const nextNum = nextPropertyNumber(props);
  const name = propertyName ?? `${PROPERTY_PREFIX}${nextNum}`;

  const propNames = props.map((p) => p.name);
  const finalName = updateNumberInRepeatedItem(propNames, name);

  let num = 1;
  let result = { ...changes };
  for (const component of relatedComponents) {
    const mainId = component['main-instance-id'];
    const newProp = {
      name: finalName,
      value: fillValues ? `${VALUE_PREFIX}${num}` : (propertyValue ?? ''),
    };

    const existingProps = component['variant-properties'] ?? [];
    const updatedProps = [...existingProps, newProp];

    result = updateComponent(result, component.id, (c) => ({
      ...c,
      'variant-properties': updatedProps,
    }));

    if (mainId) {
      const currentName = component['variant-name'] ?? '';
      let updatedName = currentName;
      if (fillValues) {
        updatedName = currentName === '' ? `${VALUE_PREFIX}${num}` : `${currentName}, ${VALUE_PREFIX}${num}`;
      } else if (propertyValue) {
        updatedName = currentName === '' ? propertyValue : `${currentName}, ${propertyValue}`;
      }

      if (result['shapes']) {
        result['shapes'] = result['shapes'].map((s) =>
          s.id === mainId ? { ...s, 'variant-name': updatedName } : s
        );
      }
    }
    num++;
  }
  return result;
}

export function generateMakeShapesNoVariant(changes, shapes) {
  let result = { ...changes };
  for (const shape of shapes) {
    result = generateMakeShapeNoVariant(result, shape);
  }
  return result;
}

function generateMakeShapeNoVariant(changes, shape) {
  const name = variantNameToName(shape);
  const [cpath, cname] = splitGroupName(name);

  let result = { ...changes };
  result = updateComponent(result, shape['component-id'], (c) => {
    const { 'variant-id': _, 'variant-properties': __, ...rest } = c;
    return { ...rest, name: cname, path: cpath };
  });

  if (result['shapes']) {
    result['shapes'] = result['shapes'].map((s) => {
      if (s.id !== shape.id) return s;
      const { 'variant-id': _, 'variant-name': __, ...rest } = s;
      return { ...rest, name };
    });
  }
  return result;
}

function variantNameToName(shape) {
  const variantName = shape['variant-name'] ?? '';
  return variantName.replace(/, /g, ' / ');
}

function createNewPropertiesFromVariant(shape, minProps, data, containerName, baseProperties) {
  const component = getComponent(data, shape['component-id'], true);
  const componentFullName = mergePathItem(component.path, component.name);
  const addName = componentFullName !== containerName;
  let props = mergeProperties(baseProperties, component['variant-properties']);
  const newPropsCount = minProps - (props.length + (addName ? 1 : 0));
  props = addNewProps(props, Array(newPropsCount).fill(''));
  if (addName) {
    props = addNewProp(props, component.name);
  }
  return props;
}

function createNewPropertiesFromNonVariant(shape, minProps, containerName, baseProperties) {
  const shapeName = removePrefix(shape.name, containerName);
  return pathToProperties(shapeName, baseProperties, minProps);
}

export function generateMakeShapesVariant(changes, shapes, variantContainer) {
  const data = changes['library-data'] ?? changes?.data;
  const objects = changes['objects'] ?? data?.objects ?? {};
  const variantId = variantContainer.id;

  const numShapes = variantContainer.shapes ? variantContainer.shapes.length : 0;

  const firstCompId = variantContainer.shapes?.[0]
    ? objects[variantContainer.shapes[0]]?.['component-id']
    : null;

  const baseProps = firstCompId
    ? (data?.components?.[firstCompId]?.['variant-properties'] ?? []).map(p => ({ ...p, value: '' }))
    : [];

  const numBaseProps = baseProps.length;
  const [cpath, cname] = splitGroupName(variantContainer.name ?? '');
  const containerName = variantContainer.name;

  const createNewProperties = (shape, minProps) => {
    if (isVariantQ(shape)) {
      return createNewPropertiesFromVariant(shape, minProps, data, containerName, baseProps);
    }
    return createNewPropertiesFromNonVariant(shape, minProps, containerName, baseProps);
  };

  const totalProps = shapes.reduce((max, shape) => {
    return Math.max(max, createNewProperties(shape, numBaseProps).length);
  }, 0);

  const numNewProps = (numShapes === 0 || totalProps < numBaseProps)
    ? 0
    : totalProps - numBaseProps;

  let currentChanges = changes;
  for (let i = 0; i < numNewProps; i++) {
    currentChanges = generateAddNewProperty(currentChanges, variantId);
  }

  currentChanges = updateShapes(currentChanges, shapes.map(s => s.id), (s) => ({
    ...s,
    'variant-id': variantId,
    name: containerName,
  }));

  for (const shape of shapes) {
    const component = getComponent(data, shape['component-id'], true);
    if (numShapes === 0) continue;
    if (variantId === shape['variant-id'] && !component?.deleted) continue;

    const props = createNewProperties(shape, totalProps);
    const variantName = propertiesToName(props);
    currentChanges = updateComponent(currentChanges, shape['component-id'], (c) => ({
      ...c,
      'variant-id': variantId,
      'variant-properties': props,
      name: cname,
      path: cpath,
    }));
    currentChanges = updateShapes(currentChanges, [shape.id], (s) => ({
      ...s,
      'variant-name': variantName,
    }));
  }

  return currentChanges;
}

function updateShapes(changes, shapeIds, f) {
  if (!changes['shapes']) return { ...changes, shapes: [] };
  const shapeIdSet = new Set(shapeIds);
  return {
    ...changes,
    shapes: changes['shapes'].map((s) =>
      shapeIdSet.has(s.id) ? f(s) : s
    ),
  };
}

function updateComponent(changes, componentId, f) {
  const data = changes['library-data'] ?? changes?.data;
  if (!data) return changes;

  const comps = data.components ?? {};
  const comp = comps[componentId];
  if (!comp) return changes;

  const updated = f(comp);
  const newData = {
    ...data,
    components: { ...comps, [componentId]: updated },
  };

  return { ...changes, 'library-data': newData, data: newData };
}