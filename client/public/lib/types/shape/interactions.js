'use strict';
export const eventTypes = new Set([
  'click', 'mouse-press', 'mouse-over', 'mouse-enter', 'mouse-leave', 'after-delay',
]);

export const actionTypes = new Set([
  'navigate', 'open-overlay', 'toggle-overlay', 'close-overlay', 'prev-screen', 'open-url',
]);

export const overlayPositioningTypes = new Set([
  'manual', 'center', 'top-left', 'top-right', 'top-center',
  'bottom-left', 'bottom-right', 'bottom-center',
]);

export const easingTypes = new Set(['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out']);

export const directionTypes = new Set(['right', 'left', 'up', 'down']);

export const wayTypes = new Set(['in', 'out']);

export const animationTypes = new Set(['dissolve', 'slide', 'push']);

export const defaultInteraction = {
  'event-type': 'click',
  'action-type': 'navigate',
  destination: null,
  'position-relative-to': null,
  'preserve-scroll': false,
};

export const defaultDelay = 600;

export function makeDissolveAnimation(duration, easing) {
  return { 'animation-type': 'dissolve', duration: duration ?? 300, easing: easing ?? 'ease' };
}

export function makeSlideAnimation(duration, easing, way, direction, offsetEffect) {
  return {
    'animation-type': 'slide',
    duration: duration ?? 300,
    easing: easing ?? 'ease',
    way: way ?? 'in',
    direction: direction ?? 'right',
    'offset-effect': offsetEffect ?? false,
  };
}

export function makePushAnimation(duration, easing, direction) {
  return {
    'animation-type': 'push',
    duration: duration ?? 300,
    easing: easing ?? 'ease',
    direction: direction ?? 'right',
  };
}

export function hasDelayQ(interaction) {
  return interaction?.['event-type'] === 'after-delay';
}

export function hasDestinationQ(interaction) {
  return ['navigate', 'open-overlay', 'toggle-overlay', 'close-overlay'].includes(interaction?.['action-type']);
}

export function hasOverlayPositionQ(interaction) {
  return ['open-overlay', 'toggle-overlay'].includes(interaction?.['action-type']);
}

export function hasUrlQ(interaction) {
  return interaction?.['action-type'] === 'open-url';
}

export function hasAnimationQ(interaction) {
  return interaction?.animation != null;
}

export function allowedAnimationQ(interaction, animation) {
  if (!animation) return true;
  const actionType = interaction?.['action-type'];
  if (actionType === 'prev-screen') return false;
  return true;
}

export function setEventType(interaction, eventType, shape) {
  if (!eventTypes.has(eventType)) throw new Error(`Invalid event type: ${eventType}`);
  if (interaction['event-type'] === eventType) return interaction;

  if (eventType === 'after-delay') {
    return { ...interaction, 'event-type': eventType, delay: interaction.delay ?? defaultDelay };
  }
  return { ...interaction, 'event-type': eventType };
}

export function setActionType(interaction, actionType) {
  if (!actionTypes.has(actionType)) throw new Error(`Invalid action type: ${actionType}`);
  if (interaction['action-type'] === actionType) return interaction;

  switch (actionType) {
    case 'navigate':
      return {
        ...interaction,
        'action-type': actionType,
        destination: interaction.destination ?? null,
        'preserve-scroll': interaction['preserve-scroll'] ?? false,
      };
    case 'open-overlay':
    case 'toggle-overlay':
      return {
        ...interaction,
        'action-type': actionType,
        'overlay-pos-type': interaction['overlay-pos-type'] ?? 'center',
        'overlay-position': interaction['overlay-position'] ?? { x: 0, y: 0 },
      };
    case 'close-overlay':
      return { ...interaction, 'action-type': actionType, destination: interaction.destination };
    case 'prev-screen':
      return { ...interaction, 'action-type': actionType };
    case 'open-url':
      return { ...interaction, 'action-type': actionType, url: interaction.url ?? '' };
    default:
      return { ...interaction, 'action-type': actionType };
  }
}

export function setDestination(interaction, destination) {
  return { ...interaction, destination };
}

export function setOverlayPosition(interaction, position) {
  return { ...interaction, 'overlay-position': position };
}

export function setOverlayPosType(interaction, posType) {
  return { ...interaction, 'overlay-pos-type': posType };
}

export function setCloseClickOutside(interaction, value) {
  return { ...interaction, 'close-click-outside': value };
}

export function setBackgroundOverlay(interaction, value) {
  return { ...interaction, 'background-overlay': value };
}

export function setPreserveScroll(interaction, value) {
  return { ...interaction, 'preserve-scroll': value };
}

export function setPositionRelativeTo(interaction, id) {
  return { ...interaction, 'position-relative-to': id };
}

export function setUrl(interaction, url) {
  return { ...interaction, url };
}

export function setDelay(interaction, delay) {
  return { ...interaction, delay };
}

export function setAnimation(interaction, animation) {
  if (!allowedAnimationQ(interaction, animation)) return interaction;
  return { ...interaction, animation };
}

export function removeAnimation(interaction) {
  const { animation, ...rest } = interaction;
  return rest;
}

export function removeDestination(interaction) {
  const { destination, ...rest } = interaction;
  return rest;
}

export function removeDelay(interaction) {
  const { delay, ...rest } = interaction;
  return rest;
}

export function makeInteraction(attrs = {}) {
  return { ...defaultInteraction, ...attrs };
}

export function interactionEq(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return a['event-type'] === b['event-type']
    && a['action-type'] === b['action-type']
    && a.destination === b.destination
    && a.url === b.url;
}

export function calcOverlayPosInitial(frame, shape, positionType, positionRelativeTo, objects) {
  const frameRect = frame.selrect ?? frame;
  const shapeRect = shape.selrect ?? shape;
  const parentRect = positionRelativeTo && objects?.[positionRelativeTo]
    ? objects[positionRelativeTo].selrect ?? objects[positionRelativeTo]
    : frameRect;

  switch (positionType) {
    case 'top-left':
      return { x: parentRect.x, y: parentRect.y };
    case 'top-center':
      return { x: parentRect.x + parentRect.width / 2 - shapeRect.width / 2, y: parentRect.y };
    case 'top-right':
      return { x: parentRect.x + parentRect.width - shapeRect.width, y: parentRect.y };
    case 'bottom-left':
      return { x: parentRect.x, y: parentRect.y + parentRect.height - shapeRect.height };
    case 'bottom-center':
      return { x: parentRect.x + parentRect.width / 2 - shapeRect.width / 2, y: parentRect.y + parentRect.height - shapeRect.height };
    case 'bottom-right':
      return { x: parentRect.x + parentRect.width - shapeRect.width, y: parentRect.y + parentRect.height - shapeRect.height };
    case 'center':
      return { x: parentRect.x + parentRect.width / 2 - shapeRect.width / 2, y: parentRect.y + parentRect.height / 2 - shapeRect.height / 2 };
    case 'manual':
    default:
      return shapeRect;
  }
}

export function validateInteraction(interaction) {
  if (!interaction) return null;
  const errors = [];
  if (!eventTypes.has(interaction['event-type'])) errors.push('Invalid event type');
  if (!actionTypes.has(interaction['action-type'])) errors.push('Invalid action type');
  if (interaction.animation && !animationTypes.has(interaction.animation['animation-type'])) {
    errors.push('Invalid animation type');
  }
  return errors.length > 0 ? errors : null;
}

export function isValidInteractionQ(interaction) {
  return !validateInteraction(interaction);
}