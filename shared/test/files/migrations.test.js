import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as m from "../../src/files/migrations.js";
import * as uuid from "../../src/uuid.js";
import * as cts from "../../src/types/shape_type.js";

function makeFile(overrides = {}) {
  return {
    id: uuid.random(),
    version: 67,
    data: {
      id: uuid.random(),
      pagesIndex: {},
      ...overrides.data,
    },
    migrations: new Set(),
    ...overrides,
  };
}

function makePage(objects = {}, options = {}) {
  return { id: uuid.random(), objects, options, ...options };
}

function makeShape(type, props = {}) {
  return cts.setupShape({ type, id: uuid.random(), ...props });
}

describe("migrations - availableMigrations", () => {
  it("has all expected migrations registered", () => {
    assert.ok(m.availableMigrations.size >= 73, `expected at least 73, got ${m.availableMigrations.size}`);
    assert.ok(m.availableMigrations.has("legacy-2"));
    assert.ok(m.availableMigrations.has("legacy-67"));
    assert.ok(m.availableMigrations.has("0001-remove-tokens-from-groups"));
    assert.ok(m.availableMigrations.has("0021-repair-bad-tokens"));
  });
});

describe("migrations - version", () => {
  it("version equals defaults.version", () => {
    assert.equal(m.version, 67);
  });
});

describe("migrations - needMigrationQ", () => {
  it("returns true when file version is null", () => {
    assert.ok(m.needMigrationQ({ version: null }));
  });

  it("returns true when file version differs", () => {
    assert.ok(m.needMigrationQ({ version: 60, migrations: new Set() }));
  });

  it("returns false when file is up to date with all migrations", () => {
    assert.ok(!m.needMigrationQ({ version: 67, migrations: new Set(m.availableMigrations) }));
  });
});

describe("migrations - generateMigrationsFromVersion", () => {
  it("generates legacy migrations for low version numbers", () => {
    const result = m.generateMigrationsFromVersion(5);
    assert.ok(result.has("legacy-2"));
    assert.ok(result.has("legacy-3"));
    assert.ok(result.has("legacy-5"));
    assert.ok(!result.has("legacy-6"));
  });

  it("generates many legacy migrations for high version", () => {
    const result = m.generateMigrationsFromVersion(67);
    assert.ok(result.has("legacy-2"));
    assert.ok(result.has("legacy-67"));
    assert.ok(result.size > 0);
  });
});

describe("migrations - migrateFile", () => {
  it("migrates file from version 0 with all migrations", () => {
    const rootId = uuid.zero;
    const pageId = uuid.random();
    const file = makeFile({
      version: 0,
      data: {
        pagesIndex: {
          [pageId]: makePage({
            [rootId]: makeShape("frame", { id: rootId }),
          }),
        },
      },
    });
    const result = m.migrateFile(file, []);
    assert.equal(result.version, 67);
    assert.ok(result.migrations.size > 0);
  });
});

describe("migrations - legacy-27", () => {
  it("converts boolean keys to non-boolean keys", () => {
    const pageId = uuid.random();
    const shapeId = uuid.random();
    const file = makeFile({
      data: {
        pagesIndex: {
          [pageId]: makePage({
            [shapeId]: { id: shapeId, type: "rect", "main-instance?": true, "component-root?": false },
          }),
        },
      },
    });
    const result = m.migrate(file, []);
    const shape = result.data.pagesIndex[pageId].objects[shapeId];
    assert.equal(shape["main-instance"], true);
    assert.equal(shape["main-instance?"], undefined);
    assert.equal(shape["component-root"], false);
    assert.equal(shape["component-root?"], undefined);
  });
});

describe("migrations - legacy-26", () => {
  it("adds default transform and transform-inverse to shapes missing them", () => {
    const pageId = uuid.random();
    const shapeId = uuid.random();
    const file = makeFile({
      data: {
        pagesIndex: {
          [pageId]: makePage({
            [shapeId]: { id: shapeId, type: "rect", x: 10, y: 20, width: 100, height: 50 },
          }),
        },
      },
    });
    const result = m.migrate(file, []);
    const shape = result.data.pagesIndex[pageId].objects[shapeId];
    assert.ok(shape.transform != null);
    assert.ok(shape["transform-inverse"] != null);
  });
});

describe("migrations - legacy-34", () => {
  it("removes x/y/width/height from path and bool shapes", () => {
    const pageId = uuid.random();
    const pathId = uuid.random();
    const boolId = uuid.random();
    const rectId = uuid.random();
    const file = makeFile({
      data: {
        pagesIndex: {
          [pageId]: makePage({
            [pathId]: { id: pathId, type: "path", x: 10, y: 20, width: 100, height: 50, content: [] },
            [boolId]: { id: boolId, type: "bool", x: 30, y: 40, width: 200, height: 100, content: [] },
            [rectId]: { id: rectId, type: "rect", x: 50, y: 60, width: 150, height: 80 },
          }),
        },
      },
    });
    const result = m.migrate(file, []);
    const pathShape = result.data.pagesIndex[pageId].objects[pathId];
    const boolShape = result.data.pagesIndex[pageId].objects[boolId];
    const rectShape = result.data.pagesIndex[pageId].objects[rectId];
    assert.equal(pathShape.x, undefined);
    assert.equal(pathShape.y, undefined);
    assert.equal(boolShape.x, undefined);
    assert.equal(boolShape.y, undefined);
    assert.equal(rectShape.x, 50);
    assert.equal(rectShape.y, 60);
  });
});

describe("migrations - legacy-46", () => {
  it("removes thumbnail from shapes", () => {
    const pageId = uuid.random();
    const shapeId = uuid.random();
    const file = makeFile({
      data: {
        pagesIndex: {
          [pageId]: makePage({
            [shapeId]: { id: shapeId, type: "rect", thumbnail: "abc123", x: 0, y: 0 },
          }),
        },
      },
    });
    const result = m.migrate(file, []);
    const shape = result.data.pagesIndex[pageId].objects[shapeId];
    assert.equal(shape.thumbnail, undefined);
  });
});

describe("migrations - legacy-66", () => {
  it("converts rx to per-corner radius r1/r2/r3/r4 when r1 is not set", () => {
    const pageId = uuid.random();
    const shapeId = uuid.random();
    // Create a file with only migration legacy-66 pending (version 65)
    // This avoids earlier migrations transforming the shape
    const file = makeFile({
      version: 65,
      data: {
        pagesIndex: {
          [pageId]: makePage({
            [shapeId]: { id: shapeId, type: "rect", rx: 8, x: 0, y: 0, width: 100, height: 50 },
          }),
        },
      },
      migrations: new Set(),
    });
    const result = m.migrate(file, []);
    const shape = result.data.pagesIndex[pageId].objects[shapeId];
    // legacy-66 should set r1/r2/r3/r4 from rx=8
    assert.equal(shape.r1, 8);
    assert.equal(shape.r2, 8);
    assert.equal(shape.r3, 8);
    assert.equal(shape.r4, 8);
  });
});

describe("migrations - legacy-67", () => {
  it("reverses shadow array order", () => {
    const pageId = uuid.random();
    const shapeId = uuid.random();
    const file = makeFile({
      data: {
        pagesIndex: {
          [pageId]: makePage({
            [shapeId]: {
              id: shapeId,
              type: "rect",
              shadow: [
                { style: "drop-shadow", color: { color: "#000", opacity: 0.1 }, "offset-x": 1, "offset-y": 1, blur: 2, spread: 0 },
                { style: "drop-shadow", color: { color: "#000", opacity: 0.2 }, "offset-x": 2, "offset-y": 2, blur: 4, spread: 0 },
              ],
            },
          }),
        },
      },
    });
    const result = m.migrate(file, []);
    const shape = result.data.pagesIndex[pageId].objects[shapeId];
    assert.equal(shape.shadow[0]["offset-x"], 2);
    assert.equal(shape.shadow[1]["offset-x"], 1);
  });
});

describe("migrations - migrate preserves data structure", () => {
  it("does not mutate original file", () => {
    const pageId = uuid.random();
    const shapeId = uuid.random();
    const originalFile = makeFile({
      data: {
        pagesIndex: {
          [pageId]: makePage({
            [shapeId]: { id: shapeId, type: "rect", "main-instance?": true },
          }),
        },
      },
    });
    const originalVersion = originalFile.version;
    m.migrate(originalFile, []);
    assert.equal(originalFile.version, originalVersion);
  });
});