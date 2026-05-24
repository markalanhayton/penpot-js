import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as variants from "../src/logic/variants.js";

describe("variants - SHAPE_TYPE_CLASSIFICATION", () => {
  it("classifies frame as container", () => {
    assert.equal(variants.SHAPE_TYPE_CLASSIFICATION.frame, "container");
  });

  it("classifies group as container", () => {
    assert.equal(variants.SHAPE_TYPE_CLASSIFICATION.group, "container");
  });

  it("classifies rect as shape", () => {
    assert.equal(variants.SHAPE_TYPE_CLASSIFICATION.rect, "shape");
  });

  it("classifies circle as shape", () => {
    assert.equal(variants.SHAPE_TYPE_CLASSIFICATION.circle, "shape");
  });

  it("classifies bool as shape", () => {
    assert.equal(variants.SHAPE_TYPE_CLASSIFICATION.bool, "shape");
  });

  it("classifies path as shape", () => {
    assert.equal(variants.SHAPE_TYPE_CLASSIFICATION.path, "shape");
  });
});

describe("variants - changeShowInViewer", () => {
  it("sets hide-in-viewer to true", () => {
    const shape = { id: "1", name: "Test" };
    const result = variants.changeShowInViewer(shape, true);
    assert.equal(result["hide-in-viewer"], true);
    assert.equal(result.id, "1");
  });

  it("sets hide-in-viewer to false", () => {
    const shape = { id: "1", name: "Test", "hide-in-viewer": true };
    const result = variants.changeShowInViewer(shape, false);
    assert.equal(result["hide-in-viewer"], false);
  });

  it("does not mutate original shape", () => {
    const shape = { id: "1", name: "Test" };
    const result = variants.changeShowInViewer(shape, true);
    assert.equal(shape["hide-in-viewer"], undefined);
    assert.equal(result["hide-in-viewer"], true);
  });
});

describe("variants - addNewInteraction", () => {
  it("adds interaction to shape with no interactions", () => {
    const shape = { id: "1" };
    const interaction = { type: "navigate" };
    const result = variants.addNewInteraction(shape, interaction);
    assert.deepEqual(result.interactions, [interaction]);
  });

  it("appends interaction to existing interactions", () => {
    const shape = { id: "1", interactions: [{ type: "navigate" }] };
    const interaction = { type: "open-url" };
    const result = variants.addNewInteraction(shape, interaction);
    assert.equal(result.interactions.length, 2);
    assert.deepEqual(result.interactions[1], interaction);
  });

  it("does not mutate original shape", () => {
    const shape = { id: "1", interactions: [] };
    variants.addNewInteraction(shape, { type: "navigate" });
    assert.equal(shape.interactions.length, 0);
  });
});

describe("variants - showInViewer", () => {
  it("removes hide-in-viewer key", () => {
    const shape = { id: "1", name: "Test", "hide-in-viewer": true };
    const result = variants.showInViewer(shape);
    assert.equal(result["hide-in-viewer"], undefined);
    assert.equal(result.id, "1");
    assert.equal(result.name, "Test");
  });

  it("returns shape unchanged if no hide-in-viewer", () => {
    const shape = { id: "1", name: "Test" };
    const result = variants.showInViewer(shape);
    assert.equal(result["hide-in-viewer"], undefined);
  });
});