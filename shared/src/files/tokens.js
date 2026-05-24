const PARSEABLE_TOKEN_VALUE_REGEXP = /^\s*(-?[0-9]+\.?[0-9]*)(px|%)?\s*$/;

export function parseTokenValue(value) {
  if (typeof value === 'number') return { value };
  if (typeof value === 'string') {
    const match = value.match(PARSEABLE_TOKEN_VALUE_REGEXP);
    if (match) {
      const parsedValue = parseFloat(match[1]);
      if (!isNaN(parsedValue)) {
        return { value: parsedValue, unit: match[2] || '' };
      }
    }
  }
  return undefined;
}

export function attributesMap(attributes, token) {
  const result = {};
  for (const attr of attributes) {
    result[attr] = token.name;
  }
  return result;
}

export function removeAttributesForToken(attributes, tokenName, appliedTokens) {
  const attrSet = new Set(attributes);
  const result = {};
  for (const [k, v] of Object.entries(appliedTokens || {})) {
    if (!(attrSet.has(k) && v === tokenName)) {
      result[k] = v;
    }
  }
  return result;
}

export function tokenAttributeAppliedQ(token, shape, tokenAttribute) {
  const id = shape?.appliedTokens?.[tokenAttribute] ?? shape?.['applied-tokens']?.[tokenAttribute];
  if (!id) return false;
  return token.name === id;
}

export function tokenAppliedQ(token, shape, tokenAttributes) {
  return tokenAttributes.some(attr => tokenAttributeAppliedQ(token, shape, attr));
}

export function shapesTokenAppliedQ(token, shapes, tokenAttributes) {
  return shapes.some(shape => tokenAppliedQ(token, shape, tokenAttributes));
}

export function shapesIdsByAppliedAttributes(token, shapes, tokenAttributes) {
  const result = {};
  for (const shape of shapes) {
    const shapeId = shape.id;
    for (const attr of tokenAttributes) {
      if (tokenAttributeAppliedQ(token, shape, attr)) {
        if (!result[attr]) result[attr] = new Set();
        result[attr].add(shapeId);
      }
    }
  }
  return result;
}

export function shapesAppliedAllQ(idsByAttributes, shapeIds, attributes) {
  return attributes.every(attr => {
    const ids = idsByAttributes[attr];
    if (!ids) return false;
    return shapeIds.every(id => ids.has(id));
  });
}

export function colorTokenQ(token) {
  return token?.type === 'color';
}

export function isReferenceQ(token) {
  return typeof token?.value === 'string' && token.value.includes('{');
}