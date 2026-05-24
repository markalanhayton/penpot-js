// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) KALEIDOS INC

import * as uuid from "./uuid.js";

export function fmtObjectId(object) {
  return fmtObjectIdParts(object.fileId, object.pageId, object.frameId, object.tag);
}

export function fmtObjectIdParts(fileId, pageId, frameId, tag) {
  return `${fileId}/${pageId}/${frameId}/${tag}`;
}

export function isFileId(objectId, fileId) {
  return objectId.startsWith(`${fileId}/`);
}

export function parseObjectId(objectId) {
  const [fileId, pageId, frameId, tag] = objectId.split("/");
  return {
    fileId: uuid.parse(fileId),
    pageId: uuid.parse(pageId),
    frameId: uuid.parse(frameId),
    tag,
  };
}

export function getFileId(objectId) {
  const idx = objectId.indexOf("/");
  if (idx < 0) return null;
  return uuid.uuid(objectId.slice(0, idx));
}