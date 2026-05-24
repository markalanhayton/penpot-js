// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) KALEIDOS INC

import * as uuid from "./uuid.js";

export function readByte(target, offset) {
  return target.getInt8(offset, true);
}

export function readUnsignedByte(target, offset) {
  return target.getUint8(offset, true);
}

export function readBool(target, offset) {
  return readByte(target, offset) === 1;
}

export function readShort(target, offset) {
  return target.getInt16(offset, true);
}

export function readInt(target, offset) {
  return target.getInt32(offset, true);
}

export function readLong(target, offset) {
  return target.getBigInt64(offset, true);
}

export function readFloat(target, offset) {
  return target.getFloat32(offset, true);
}

export function readUuid(target, offset) {
  const a = target.getUint32(offset, true);
  const b = target.getUint32(offset + 4, true);
  const c = target.getUint32(offset + 8, true);
  const d = target.getUint32(offset + 12, true);
  return uuid.fromUnsignedParts(a, b, c, d);
}

export function readBytes(target, offset, size) {
  return new Uint8Array(target.buffer, target.byteOffset + offset, size);
}

export function writeByte(target, offset, value) {
  target.setInt8(offset, value, true);
}

export function writeU8(target, offset, value) {
  target.setUint8(offset, value, true);
}

export function writeBool(target, offset, value) {
  target.setInt8(offset, value ? 0x01 : 0x00, true);
}

export function writeShort(target, offset, value) {
  target.setInt16(offset, value, true);
}

export function writeInt(target, offset, value) {
  target.setInt32(offset, value, true);
}

export function writeU32(target, offset, value) {
  target.setUint32(offset, value, true);
}

export function writeI32(target, offset, value) {
  return writeInt(target, offset, value);
}

export function writeFloat(target, offset, value) {
  target.setFloat32(offset, value, true);
}

export function writeF32(target, offset, value) {
  return writeFloat(target, offset, value);
}

export function writeUuid(target, offset, value) {
  const barray = uuid.getUnsignedParts(value);
  target.setUint32(offset, barray[0], true);
  target.setUint32(offset + 4, barray[1], true);
  target.setUint32(offset + 8, barray[2], true);
  target.setUint32(offset + 12, barray[3], true);
}

export function wrap(data) {
  if (data instanceof DataView) {
    return data;
  }
  return new DataView(data.buffer, data.byteOffset, data.byteLength);
}

export function allocate(size) {
  return new DataView(new ArrayBuffer(size));
}

export function clone(buffer) {
  const srcOff = buffer.byteOffset;
  const srcLen = buffer.byteLength;
  const srcView = new Uint8Array(buffer.buffer, srcOff, srcLen);
  const dstBuffer = new ArrayBuffer(srcLen);
  const dstView = new Uint8Array(dstBuffer);
  dstView.set(srcView);
  return new DataView(dstBuffer);
}

export function equals(bufferA, bufferB) {
  const lenA = bufferA.byteLength;
  const lenB = bufferB.byteLength;
  if (lenA !== lenB) {
    return false;
  }
  const a = new Uint8Array(bufferA.buffer, bufferA.byteOffset, lenA);
  const b = new Uint8Array(bufferB.buffer, bufferB.byteOffset, lenB);
  for (let i = 0; i < lenA; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

export function isBuffer(o) {
  return o instanceof DataView;
}

export function slice(buffer, offset, size) {
  const newOffset = buffer.byteOffset + offset;
  return new DataView(buffer.buffer, newOffset, size);
}

export function size(o) {
  return o.byteLength;
}