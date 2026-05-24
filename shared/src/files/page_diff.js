import * as d from '../data.js';

export function calculatePageDiff(oldPage, page, checkAttrs) {
  const oldObjects = oldPage.objects || {};
  const oldGuides = oldPage.guides || {};
  const newObjects = page.objects || {};
  const newGuides = page.guides || {};

  const allObjectKeys = new Set([...Object.keys(oldObjects), ...Object.keys(newObjects)]);
  const allGuideKeys = new Set([...Object.keys(oldGuides), ...Object.keys(newGuides)]);

  function changedObjectQ(id) {
    const oldv = oldObjects[id];
    const newv = newObjects[id];
    if (oldv === newv) return false;
    const oldSelected = d.selectKeys(oldv, checkAttrs);
    const newSelected = d.selectKeys(newv, checkAttrs);
    return !d.equal(oldSelected, newSelected);
  }

  function frameQ(id) {
    return newObjects[id]?.type === 'frame' || oldObjects[id]?.type === 'frame';
  }

  function changedGuideQ(id) {
    return !d.equal(oldGuides[id], newGuides[id]);
  }

  function deletedObjectQ(id) {
    return id in oldObjects && !(id in newObjects);
  }

  function deletedGuideQ(id) {
    return id in oldGuides && !(id in newGuides);
  }

  function newObjectQ(id) {
    return !(id in oldObjects) && id in newObjects;
  }

  function newGuideQ(id) {
    return !(id in oldGuides) && id in newGuides;
  }

  function changedFrameObjectQ(id) {
    return id in newObjects && id in oldObjects &&
      oldObjects[id]?.frameId !== newObjects[id]?.frameId;
  }

  function changedFrameGuideQ(id) {
    return id in newGuides && id in oldGuides &&
      oldObjects[id]?.frameId !== newObjects[id]?.frameId;
  }

  function changedAttrsObjectQ(id) {
    return id in newObjects && id in oldObjects &&
      oldObjects[id]?.frameId === newObjects[id]?.frameId;
  }

  function changedAttrsGuideQ(id) {
    return id in newGuides && id in oldGuides &&
      oldObjects[id]?.frameId === newObjects[id]?.frameId;
  }

  const changedObjectIds = [...allObjectKeys].filter(changedObjectQ);
  const changedGuideIds = [...allGuideKeys].filter(changedGuideQ);

  const getDiffObject = (id) => [oldObjects[id], newObjects[id]];
  const getDiffGuide = (id) => [oldGuides[id], newGuides[id]];

  return {
    changeFrameShapes: changedObjectIds.filter(id => changedFrameObjectQ(id)).map(getDiffObject),
    changeFrameGuides: changedGuideIds.filter(id => changedFrameGuideQ(id)).map(getDiffGuide),
    removedFrames: changedObjectIds.filter(id => frameQ(id) && deletedObjectQ(id)).map(id => oldObjects[id]),
    removedShapes: changedObjectIds.filter(id => !frameQ(id) && deletedObjectQ(id)).map(id => oldObjects[id]),
    removedGuides: changedGuideIds.filter(deletedGuideQ).map(id => oldGuides[id]),
    updatedFrames: changedObjectIds.filter(id => frameQ(id) && changedAttrsObjectQ(id)).map(getDiffObject),
    updatedShapes: changedObjectIds.filter(id => !frameQ(id) && changedAttrsObjectQ(id)).map(getDiffObject),
    updatedGuides: changedGuideIds.filter(changedAttrsGuideQ).map(getDiffGuide),
    newFrames: changedObjectIds.filter(id => frameQ(id) && newObjectQ(id)).map(id => newObjects[id]),
    newShapes: changedObjectIds.filter(id => !frameQ(id) && newObjectQ(id)).map(id => newObjects[id]),
    newGuides: changedGuideIds.filter(newGuideQ).map(id => newGuides[id]),
  };
}