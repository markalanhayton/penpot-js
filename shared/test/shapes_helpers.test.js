import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as sh from "../src/files/shapes_helpers.js";
import * as pcb from "../src/files/changes_builder.js";
import * as uuid from "../src/uuid.js";

function makeTestPage(objects) {
  const pageId = uuid.next();
  return {
    id: pageId,
    name: "Test Page",
    objects: objects || {},
  };
}

function makeTestFrame(id, parentId, frameId, shapes = []) {
  return {
    id,
    type: "frame",
    name: "Frame",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    "parent-id": parentId ?? uuid.zero,
    "frame-id": frameId ?? uuid.zero,
    shapes,
    selrect: { x: 0, y: 0, width: 100, height: 100, x1: 0, y1: 0, x2: 100, y2: 100 },
    points: [],
    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    "transform-inverse": { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  };
}

function makeTestRect(id, parentId, frameId) {
  return {
    id,
    type: "rect",
    name: "Rect",
    x: 10,
    y: 10,
    width: 50,
    height: 50,
    "parent-id": parentId ?? uuid.zero,
    "frame-id": frameId ?? uuid.zero,
    selrect: { x: 10, y: 10, width: 50, height: 50, x1: 10, y1: 10, x2: 60, y2: 60 },
    points: [],
    transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    "transform-inverse": { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
  };
}

describe("shapes_helpers - prepareAddShape", () => {
  it("adds a shape to empty objects", () => {
    const frameId = uuid.next();
    const shape = makeTestRect(uuid.next(), uuid.zero, uuid.zero);
    shape["parent-id"] = uuid.zero;
    shape["frame-id"] = uuid.zero;
    const objects = {
      [uuid.zero]: makeTestFrame(uuid.zero, null, uuid.zero),
    };
    objects[uuid.zero].shapes = [];

    const page = makeTestPage(objects);
    let changes = pcb.emptyChanges();
    changes = pcb.withPage(changes, page);
    changes = pcb.withObjects(changes, objects);

    const [resultShape, resultChanges] = sh.prepareAddShape(changes, shape, objects);
    assert.equal(resultShape.id, shape.id);
    assert.ok(resultChanges != null);
  });
});

describe("shapes_helpers - prepareMoveShapesIntoFrame", () => {
  it("moves shapes into a frame", () => {
    const frameId = uuid.next();
    const rect1Id = uuid.next();
    const rect2Id = uuid.next();

    const objects = {
      [uuid.zero]: makeTestFrame(uuid.zero, null, uuid.zero, [rect1Id, rect2Id]),
      [frameId]: makeTestFrame(frameId, uuid.zero, uuid.zero, []),
      [rect1Id]: makeTestRect(rect1Id, uuid.zero, uuid.zero),
      [rect2Id]: makeTestRect(rect2Id, uuid.zero, uuid.zero),
    };

    const page = makeTestPage(objects);
    let changes = pcb.emptyChanges();
    changes = pcb.withPage(changes, page);
    changes = pcb.withObjects(changes, objects);

    const result = sh.prepareMoveShapesIntoFrame(changes, frameId, [rect1Id, rect2Id], objects, false);
    assert.ok(result != null);
  });

  it("returns unchanged changes for empty shape list", () => {
    const objects = {
      [uuid.zero]: makeTestFrame(uuid.zero, null, uuid.zero, []),
    };
    const page = makeTestPage(objects);
    let changes = pcb.emptyChanges();
    changes = pcb.withPage(changes, page);
    changes = pcb.withObjects(changes, objects);

    const result = sh.prepareMoveShapesIntoFrame(changes, uuid.zero, [], objects, false);
    assert.equal(result, changes);
  });
});

describe("shapes_helpers - prepareCreateArtboardFromSelection", () => {
  it("returns null for empty selection", () => {
    const objects = {
      [uuid.zero]: makeTestFrame(uuid.zero, null, uuid.zero, []),
    };
    const page = makeTestPage(objects);
    let changes = pcb.emptyChanges();
    changes = pcb.withPage(changes, page);
    changes = pcb.withObjects(changes, objects);

    const [shape, result] = sh.prepareCreateArtboardFromSelection(changes, null, null, objects, [], 0, "Test", false);
    assert.equal(shape, null);
  });
});

describe("shapes_helpers - prepareCreateEmptyArtboard", () => {
  it("creates an empty artboard with minimal attrs", () => {
    const objects = {
      [uuid.zero]: makeTestFrame(uuid.zero, null, uuid.zero, []),
    };
    const page = makeTestPage(objects);
    let changes = pcb.emptyChanges();
    changes = pcb.withPage(changes, page);
    changes = pcb.withObjects(changes, objects);

    const frameId = uuid.next();
    const [shape, result] = sh.prepareCreateEmptyArtboard(changes, frameId, uuid.zero, objects, 0, "Empty", false, null);
    assert.equal(shape.id, frameId);
    assert.equal(shape.type, "frame");
    assert.equal(shape.name, "Empty");
    assert.equal(shape["parent-id"], uuid.zero);
  });
});