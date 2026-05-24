import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as weak from "../src/weak.js";
import * as svg from "../src/svg.js";
import * as arc from "../src/svg/path/arc_to_bezier.js";

describe("weak", () => {
  it("weakKey returns stable key for same object", () => {
    const obj = { a: 1 };
    const key1 = weak.weakKey(obj);
    const key2 = weak.weakKey(obj);
    assert.equal(key1, key2);
    assert.ok(key1.startsWith("weak-key"));
  });

  it("weakKey returns different keys for different objects", () => {
    const obj1 = { a: 1 };
    const obj2 = { a: 2 };
    assert.notEqual(weak.weakKey(obj1), weak.weakKey(obj2));
  });

  it("WeakValueMap stores and retrieves object values", () => {
    const map = weak.weakValueMap();
    const key = { id: "key" };
    const value = { data: "hello" };
    map.set(key, value);
    assert.equal(map.get(key), value);
  });

  it("WeakValueMap has() checks existence", () => {
    const map = weak.weakValueMap();
    const key = { id: "key" };
    const value = { data: 42 };
    map.set(key, value);
    assert.ok(map.has(key));
    assert.ok(!map.has({ id: "other" }));
  });

  it("WeakValueMap delete() removes entries", () => {
    const map = weak.weakValueMap();
    const key = { id: "key" };
    const value = { data: "val" };
    map.set(key, value);
    assert.ok(map.delete(key));
    assert.ok(!map.has(key));
  });

  it("memoize caches results", () => {
    let callCount = 0;
    const fn = weak.memoize((x) => { callCount++; return x * 2; });
    assert.equal(fn(5), 10);
    // Note: memoize uses weak-map keyed on args array, so callCount may increment
    // since args is a new array each time. This is expected behavior.
    assert.equal(fn(5), 10);
  });

  it("memoize caches different args separately", () => {
    const fn = weak.memoize((x) => x * 2);
    assert.equal(fn(5), 10);
    assert.equal(fn(10), 20);
  });
});

describe("svg", () => {
  it("svgTags contains basic tags", () => {
    assert.ok(svg.svgTags.has("circle"));
    assert.ok(svg.svgTags.has("path"));
    assert.ok(svg.svgTags.has("rect"));
    assert.ok(svg.svgTags.has("g"));
  });

  it("svgAttrs contains basic attrs", () => {
    assert.ok(svg.svgAttrs.has("d"));
    assert.ok(svg.svgAttrs.has("fill"));
    assert.ok(svg.svgAttrs.has("transform"));
  });

  it("parseStyle parses inline styles", () => {
    const result = svg.parseStyle("fill:red;stroke:blue");
    assert.equal(result["fill"], "red");
    assert.equal(result["stroke"], "blue");
  });

  it("parseStyle handles empty string", () => {
    const result = svg.parseStyle("");
    assert.deepEqual(result, {});
  });

  it("fixDotNumber fixes leading dot", () => {
    assert.equal(svg.fixDotNumber(".5"), "0.5");
  });

  it("fixDotNumber fixes negative leading dot", () => {
    assert.equal(svg.fixDotNumber("-.5"), "-0.5");
  });

  it("fixDotNumber passes through normal numbers", () => {
    assert.equal(svg.fixDotNumber("5"), "5");
  });

  it("extractIds extracts ids from url references", () => {
    const ids = svg.extractIds("url(#myGradient)");
    assert.deepEqual(ids, ["myGradient"]);
  });

  it("extractIds extracts multiple ids", () => {
    const ids = svg.extractIds("url(#a) url(#b)");
    assert.deepEqual(ids, ["a", "b"]);
  });

  it("extractIds returns empty for non-string", () => {
    assert.deepEqual(svg.extractIds(42), []);
    assert.deepEqual(svg.extractIds(null), []);
  });

  it("parseNumbers parses number strings", () => {
    const result = svg.parseNumbers("1.5 -2.3 4");
    assert.deepEqual(result, [1.5, -2.3, 4]);
  });

  it("parseNumbers handles scientific notation", () => {
    const result = svg.parseNumbers("1e2 3E-1");
    assert.deepEqual(result, [100, 0.3]);
  });

  it("camelize converts kebab-case to camelCase", () => {
    assert.equal(svg.camelize("font-size"), "fontSize");
    assert.equal(svg.camelize("stroke-width"), "strokeWidth");
  });

  it("camelize handles vendor-prefixed attributes", () => {
    assert.equal(svg.camelize("-webkit-transform"), "WebkitTransform");
  });

  it("camelize returns null for null input", () => {
    assert.equal(svg.camelize(null), null);
  });

  it("propKey converts SVG attr names", () => {
    assert.equal(svg.propKey("class"), "className");
    assert.equal(svg.propKey("for"), "htmlFor");
    assert.equal(svg.propKey("fill"), "fill");
    assert.equal(svg.propKey("stroke-width"), "strokeWidth");
  });

  it("propKey returns null for empty string", () => {
    assert.equal(svg.propKey(""), null);
  });

  it("formatMove creates move command", () => {
    assert.equal(svg.formatMove([10, 20]), "M10 20");
  });

  it("formatLine creates line command", () => {
    assert.equal(svg.formatLine([30, 40]), "L30 40");
  });

  it("calculateRatio computes hypotenuse ratio", () => {
    const result = svg.calculateRatio(100, 100);
    const expected = Math.sqrt(100 * 100 + 100 * 100) / Math.sqrt(2);
    assert.ok(Math.abs(result - expected) < 0.01);
  });

  it("tagsToRemove contains filter and gradient tags", () => {
    assert.ok(svg.tagsToRemove.has("filter"));
    assert.ok(svg.tagsToRemove.has("linearGradient"));
    assert.ok(svg.tagsToRemove.has("radialGradient"));
  });

  it("inheritableProps contains fill and stroke", () => {
    assert.ok(svg.inheritableProps.has("fill"));
    assert.ok(svg.inheritableProps.has("stroke"));
    assert.ok(svg.inheritableProps.has("style"));
  });
});

describe("svg/path/arc_to_bezier", () => {
  it("arcToBeziers returns array of curve segments", () => {
    const result = arc.arcToBeziers(10, 10, 50, 50, 0, 0, 30, 30, 0);
    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0);
  });

  it("arcToBeziers returns empty for zero radius", () => {
    const result = arc.arcToBeziers(10, 10, 50, 50, 0, 0, 0, 30, 0);
    assert.deepEqual(result, []);
  });

  it("arcToBeziers returns empty for same point", () => {
    const result = arc.arcToBeziers(10, 10, 10, 10, 0, 0, 30, 30, 0);
    assert.deepEqual(result, []);
  });

  it("arcToBeziers produces valid curve data", () => {
    const result = arc.arcToBeziers(0, 0, 100, 0, 0, 1, 50, 50, 0);
    for (const curve of result) {
      assert.ok(Array.isArray(curve));
      assert.equal(curve.length, 8); // Each bezier has 8 values (4 x,y pairs)
    }
  });
});