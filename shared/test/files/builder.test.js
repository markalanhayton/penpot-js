import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as b from "../../src/files/builder.js";
import * as uuid from "../../src/uuid.js";

describe("builder - createEmptyFile", () => {
  it("creates a file with valid structure", () => {
    const file = b.createEmptyFile("Test File");
    assert.ok(file.id, "file should have an id");
    assert.equal(file.name, "Test File");
    assert.equal(file.version, 67);
    assert.ok(file.data, "file should have data");
    assert.ok(file.data['pages-index'], "file should have pages-index");
    assert.ok(file.features instanceof Set, "features should be a Set");
    assert.ok(file.features.has("fdata/shape-data-type"));
  });

  it("creates a file with default name", () => {
    const file = b.createEmptyFile();
    assert.equal(file.name, "New File");
  });
});

describe("builder - createState / addFile / closeFile", () => {
  it("creates state and adds a file", () => {
    let state = b.createState();
    state = b.addFile(state, { name: "My File" });
    assert.ok(state['::current-file-id'], "should have current-file-id");
    const fileId = state['::current-file-id'];
    assert.ok(state['::files'][fileId], "should have file in files");
    assert.equal(state['::files'][fileId].name, "My File");
  });

  it("closes file and clears state", () => {
    let state = b.createState();
    state = b.addFile(state, {});
    state = b.closeFile(state);
    assert.equal(state['::current-file-id'], undefined);
  });
});

describe("builder - addPage / closePage", () => {
  it("adds a page and sets current page id", () => {
    let state = b.createState();
    state = b.addFile(state, {});
    state = b.addPage(state, { name: "Page 1" });
    assert.ok(state['::current-page-id'], "should have current-page-id");
  });

  it("closes page and clears state", () => {
    let state = b.createState();
    state = b.addFile(state, {});
    state = b.addPage(state, {});
    state = b.closePage(state);
    assert.equal(state['::current-page-id'], undefined);
  });
});

describe("builder - addBoard / closeBoard", () => {
  it("adds a board and sets frame id", () => {
    let state = b.createState();
    state = b.addFile(state, {});
    state = b.addPage(state, {});
    state = b.addBoard(state, { name: "Board 1" });
    assert.ok(state['::current-frame-id'], "should have current-frame-id");
    assert.ok(state['::last-id'], "should have last-id");
    const frameId = state['::current-frame-id'];
    assert.ok(frameId, "frame id should exist");

    const currentPage = b.getCurrentPage(state);
    assert.ok(currentPage.objects[frameId], "board should be in page objects");
  });

  it("closes board and resets frame id", () => {
    let state = b.createState();
    state = b.addFile(state, {});
    state = b.addPage(state, {});
    state = b.addBoard(state, {});
    state = b.closeBoard(state);
    assert.equal(state['::current-frame-id'], uuid.zero);
  });
});

describe("builder - addGroup / closeGroup", () => {
  it("adds a group with children", () => {
    let state = b.createState();
    state = b.addFile(state, {});
    state = b.addPage(state, {});
    state = b.addBoard(state, { name: "Board 1" });
    state = b.addGroup(state, { name: "Group 1" });
    const groupId = state['::last-id'];
    assert.ok(groupId, "group id should exist");

    state = b.addShape(state, { type: "rect", name: "Rect 1", x: 0, y: 0, width: 100, height: 50 });
    state = b.closeGroup(state);

    const page = b.getCurrentPage(state);
    assert.ok(page.objects[groupId], "group should exist in page objects");
  });
});

describe("builder - addShape", () => {
  it("adds a rectangle shape to the current page", () => {
    let state = b.createState();
    state = b.addFile(state, {});
    state = b.addPage(state, {});
    state = b.addBoard(state, { name: "Board 1" });
    state = b.addShape(state, { type: "rect", name: "My Rect", x: 10, y: 20, width: 100, height: 50 });

    const lastId = state['::last-id'];
    assert.ok(lastId, "should have last-id");

    const objects = b.getCurrentObjects(state);
    assert.ok(objects[lastId], "shape should be in objects");
    assert.equal(objects[lastId].type, "rect");
    assert.equal(objects[lastId].name, "My Rect");
  });
});

describe("builder - addLibraryColor", () => {
  it("adds a color to the file", () => {
    let state = b.createState();
    state = b.addFile(state, {});
    state = b.addPage(state, {});
    state = b.addLibraryColor(state, { color: "#ff0000", opacity: 1 });

    const lastId = state['::last-id'];
    assert.ok(lastId, "should have last-id");
  });
});

describe("builder - addLibraryTypography", () => {
  it("adds a typography to the file", () => {
    let state = b.createState();
    state = b.addFile(state, {});
    state = b.addPage(state, {});
    state = b.addLibraryTypography(state, {
      'font-family': 'Inter',
      'font-size': '16',
      'font-weight': '400',
      'font-style': 'normal',
    });

    const lastId = state['::last-id'];
    assert.ok(lastId, "should have last-id");
  });
});

describe("builder - addComponent", () => {
  it("adds a component from the current frame", () => {
    let state = b.createState();
    state = b.addFile(state, {});
    state = b.addPage(state, {});
    state = b.addBoard(state, { name: "Board 1" });
    state = b.addShape(state, { type: "rect", name: "Rect" });
    const frameId = state['::current-frame-id'];
    state = b.addComponent(state, { 'component-id': uuid.next(), 'frame-id': frameId });

    const fileId = state['::current-file-id'];
    const file = state['::files'][fileId];
    assert.ok(file, "file should exist");
  });
});

describe("builder - buildFile", () => {
  it("builds a file with custom page content", () => {
    const file = b.buildFile({
      name: "Test File",
      onPage: ({ data, pageId, fileId }) => {
        return data;
      },
    });
    assert.equal(file.name, "Test File");
    assert.ok(file.id, "file should have an id");
    assert.ok(file.data, "file should have data");
    assert.ok(file.data['pages-index'], "file should have pages-index");
  });

  it("builds a file without page callback", () => {
    const file = b.buildFile({ name: "Minimal" });
    assert.equal(file.name, "Minimal");
    assert.ok(file.data, "file should have data");
  });
});

describe("builder - getShape / getCurrentPage / getCurrentObjects", () => {
  it("retrieves shapes from state", () => {
    let state = b.createState();
    state = b.addFile(state, {});
    state = b.addPage(state, {});
    state = b.addBoard(state, { name: "Board 1" });
    state = b.addShape(state, { type: "rect", name: "Rect", x: 0, y: 0, width: 100, height: 50 });

    const lastId = state['::last-id'];
    const shape = b.getShape(state, lastId);
    assert.ok(shape, "shape should be found");
    assert.equal(shape.type, "rect");

    const page = b.getCurrentPage(state);
    assert.ok(page, "page should exist");
    assert.ok(page.id, "page should have id");

    const objects = b.getCurrentObjects(state);
    assert.ok(objects, "objects should exist");
    assert.ok(objects[uuid.zero], "root frame should exist");
  });
});

describe("builder - addGuide / deleteGuide / updateGuide", () => {
  it("adds, updates, and deletes a guide", () => {
    let state = b.createState();
    state = b.addFile(state, {});
    state = b.addPage(state, {});

    state = b.addGuide(state, { axis: "x", position: 100 });
    const guideId = state['::last-id'];
    assert.ok(guideId, "guide should have id");

    state = b.updateGuide(state, { id: guideId, axis: "x", position: 200 });

    state = b.deleteGuide(state, guideId);
  });
});