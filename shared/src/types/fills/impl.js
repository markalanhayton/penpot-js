import * as buf from '../buffer.js';
import * as math from '../math.js';

const writeInt32 = buf.writeInt;
const readInt32 = buf.readInt;
const writeInt16 = buf.writeShort;
const readInt16 = buf.readShort;
const writeFloat32 = buf.writeFloat;
const readFloat32 = buf.readFloat;

export const MAX_GRADIENT_STOPS = 16;
export const MAX_FILLS = 8;

export const GRADIENT_STOP_U8_SIZE = 8;
export const GRADIENT_U8_SIZE = 156;
export const SOLID_U8_SIZE = 4;
export const IMAGE_U8_SIZE = 36;
export const METADATA_U8_SIZE = 36;
export const FILL_U8_SIZE = 4 + Math.max(GRADIENT_U8_SIZE, IMAGE_U8_SIZE, SOLID_U8_SIZE);

function hexToRgb(hex) {
  const h = hex.slice(1);
  return parseInt(h, 16);
}

function rgbToRgba(n, alpha) {
  const result = Math.floor(alpha * 0xff);
  return (result << 24) | n;
}

function getColorHex(n) {
  const v = n & 0x00ffffff;
  return '#' + v.toString(16).padStart(6, '0');
}

function getColorAlpha(rgb) {
  const n = (rgb >>> 24) & 0xff;
  return math.precision(n / 0xff, 2);
}

export function writeSolidFill(offset, buffer, opacity, color) {
  buf.writeByte(buffer, offset + 0, 0x00);
  writeInt32(buffer, offset + 4, rgbToRgba(hexToRgb(color), opacity));
  return offset + FILL_U8_SIZE;
}

export function writeGradientFill(offset, buffer, opacity, gradient) {
  const startX = gradient['start-x'];
  const startY = gradient['start-y'];
  const endX = gradient['end-x'];
  const endY = gradient['end-y'];
  const alpha = Math.floor(opacity * 0xff);
  const width = gradient.width ?? 0;
  const stops = gradient.stops.slice(0, MAX_GRADIENT_STOPS);
  const type = gradient.type === 'linear' ? 0x01 : 0x02;

  buf.writeByte(buffer, offset + 0, type);
  writeFloat32(buffer, offset + 4, startX);
  writeFloat32(buffer, offset + 8, startY);
  writeFloat32(buffer, offset + 12, endX);
  writeFloat32(buffer, offset + 16, endY);
  buf.writeByte(buffer, offset + 20, alpha);
  writeFloat32(buffer, offset + 24, width);
  buf.writeByte(buffer, offset + 28, stops.length);

  let offsetP = offset + 32;
  for (const stop of stops) {
    const color = rgbToRgba(hexToRgb(stop.color), stop.opacity ?? 1);
    writeInt32(buffer, offsetP + 0, color);
    writeFloat32(buffer, offsetP + 4, stop.offset);
    offsetP += GRADIENT_STOP_U8_SIZE;
  }
  return offset + FILL_U8_SIZE;
}

export function writeImageFill(offset, buffer, opacity, image) {
  const imageId = image.id;
  const imageWidth = image.width;
  const imageHeight = image.height;
  const alpha = Math.floor(opacity * 0xff);
  const keepAspectRatio = image['keep-aspect-ratio'] ? 0x01 : 0x00;
  const flags = keepAspectRatio | 0x00;

  buf.writeByte(buffer, offset + 0, 0x03);
  buf.writeUUID(buffer, offset + 4, imageId);
  buf.writeByte(buffer, offset + 20, alpha);
  buf.writeByte(buffer, offset + 21, flags);
  writeInt16(buffer, offset + 22, 0);
  writeInt32(buffer, offset + 24, imageWidth);
  writeInt32(buffer, offset + 28, imageHeight);
  return offset + FILL_U8_SIZE;
}

function readStop(buffer, offset) {
  const rgba = readInt32(buffer, offset + 0);
  const stopOffset = readFloat32(buffer, offset + 4);
  return {
    color: getColorHex(rgba),
    opacity: getColorAlpha(rgba),
    offset: math.precision(stopOffset, 2),
  };
}

function readFill(dbuffer, mbuffer, index) {
  const doffset = 4 + index * FILL_U8_SIZE;
  const moffset = index * METADATA_U8_SIZE;
  const type = buf.readByte(dbuffer, doffset);
  const refsQ = buf.readBool(mbuffer, moffset + 0);

  let fill;
  switch (type) {
    case 0: {
      const rgba = readInt32(dbuffer, doffset + 4);
      fill = { 'fill-color': getColorHex(rgba), 'fill-opacity': getColorAlpha(rgba) };
      break;
    }
    case 1:
    case 2: {
      const startX = readFloat32(dbuffer, doffset + 4);
      const startY = readFloat32(dbuffer, doffset + 8);
      const endX = readFloat32(dbuffer, doffset + 12);
      const endY = readFloat32(dbuffer, doffset + 16);
      const alpha = buf.readUnsignedByte(dbuffer, doffset + 20);
      const width = readFloat32(dbuffer, doffset + 24);
      const stopCount = buf.readByte(dbuffer, doffset + 28);
      const opacity = math.precision(alpha / 0xff, 2);
      const gradientType = type === 1 ? 'linear' : 'radial';
      const stops = [];
      for (let i = 0; i < stopCount; i++) {
        stops.push(readStop(dbuffer, doffset + 32 + i * GRADIENT_STOP_U8_SIZE));
      }
      fill = {
        'fill-opacity': opacity,
        'fill-color-gradient': {
          'start-x': startX, 'start-y': startY,
          'end-x': endX, 'end-y': endY,
          width, stops, type: gradientType,
        },
      };
      break;
    }
    case 3: {
      const id = buf.readUUID(dbuffer, doffset + 4);
      const alpha = buf.readUnsignedByte(dbuffer, doffset + 20);
      const opacity = math.precision(alpha / 0xff, 2);
      const flags = buf.readUnsignedByte(dbuffer, doffset + 21);
      const keepAspectRatio = Boolean(flags & 0x01);
      const imageWidth = readInt32(dbuffer, doffset + 24);
      const imageHeight = readInt32(dbuffer, doffset + 28);
      const mtypeCode = readInt16(mbuffer, moffset + 2);
      const mtype = { 1: 'image/jpeg', 2: 'image/png', 3: 'image/gif', 4: 'image/webp', 5: 'image/svg+xml' }[mtypeCode];
      fill = {
        'fill-opacity': opacity,
        'fill-image': { id, width: imageWidth, height: imageHeight, mtype, 'keep-aspect-ratio': keepAspectRatio, name: 'sample' },
      };
      break;
    }
    default: fill = {}; break;
  }

  if (refsQ) {
    const refFile = buf.readUUID(mbuffer, moffset + 4);
    const refId = buf.readUUID(mbuffer, moffset + 20);
    fill['fill-color-ref-file'] = refFile;
    fill['fill-color-ref-id'] = refId;
  }
  return fill;
}

export function fromPlain(fills) {
  const fillsArr = fills.slice(0, MAX_FILLS);
  const total = fillsArr.length;
  const dbuffer = buf.allocate(4 + MAX_FILLS * FILL_U8_SIZE);
  const mbuffer = buf.allocate(total * METADATA_U8_SIZE);
  const imageIds = new Set();

  buf.writeByte(dbuffer, 0, total);

  for (let index = 0; index < total; index++) {
    const fill = fillsArr[index];
    const doffset = 4 + index * FILL_U8_SIZE;
    const moffset = index * METADATA_U8_SIZE;
    const opacity = fill['fill-opacity'] ?? 1;

    if (fill['fill-color']) {
      writeSolidFill(doffset, dbuffer, opacity, fill['fill-color']);
      writeMetadata(moffset, mbuffer, fill);
    } else if (fill['fill-color-gradient']) {
      writeGradientFill(doffset, dbuffer, opacity, fill['fill-color-gradient']);
      writeMetadata(moffset, mbuffer, fill);
    } else if (fill['fill-image']) {
      writeImageFill(doffset, dbuffer, opacity, fill['fill-image']);
      writeMetadata(moffset, mbuffer, fill);
      imageIds.add(fill['fill-image'].id);
    }
  }

  return { size: total, dbuffer, mbuffer, imageIds };
}

function writeMetadata(offset, buffer, fill) {
  const refId = fill['fill-color-ref-id'];
  const refFile = fill['fill-color-ref-file'];
  const mtype = fill['fill-image']?.mtype;

  if (mtype) {
    const val = { 'image/jpeg': 0x01, 'image/png': 0x02, 'image/gif': 0x03, 'image/webp': 0x04, 'image/svg+xml': 0x05 }[mtype];
    if (val != null) writeInt16(buffer, offset + 2, val);
  }

  if (refFile != null && refId != null) {
    buf.writeBool(buffer, offset + 0, true);
    buf.writeUUID(buffer, offset + 4, refFile);
    buf.writeUUID(buffer, offset + 20, refId);
  } else {
    buf.writeBool(buffer, offset + 0, false);
  }
}

export function fillsFromPlain(fillsArr) {
  if (!fillsArr || fillsArr.length === 0) return fromPlain([]);
  return fromPlain(fillsArr);
}

export function fillsToPlain(fillsData) {
  if (!fillsData || !fillsData.dbuffer) return [];
  const { size, dbuffer, mbuffer } = fillsData;
  const result = [];
  for (let i = 0; i < size; i++) {
    result.push(readFill(dbuffer, mbuffer, i));
  }
  return result;
}

export function fillsQ(o) {
  return o != null && typeof o === 'object' && o.dbuffer != null;
}