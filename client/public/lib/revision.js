'use strict';
let fileRev = 0;
let fileVern = 0;

export function initRevision(revn, vern) {
  fileRev = revn || 0;
  fileVern = vern || 0;
}

export function getRevision() { return fileRev; }
export function getVern() { return fileVern; }

export function setRevision(revn) {
  fileRev = revn;
}

export function incrementRevision() {
  fileRev++;
}