import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as uri from "../src/uri.js";
import * as spec from "../src/spec.js";
import * as thumbnails from "../src/thumbnails.js";
import * as record from "../src/record.js";
import * as undoStack from "../src/data/undo_stack.js";
import * as macros from "../src/data/macros.js";

describe("uri", () => {
  it("uri parses a string URL", () => {
    const result = uri.uri("https://example.com/path?q=1");
    assert.ok(result instanceof URL);
    assert.equal(result.hostname, "example.com");
  });

  it("uri returns null for null input", () => {
    assert.equal(uri.uri(null), null);
  });

  it("isURI checks URL instance", () => {
    assert.ok(uri.isURI(new URL("https://example.com")));
    assert.ok(!uri.isURI("https://example.com"));
  });

  it("queryStringToMap parses query string", () => {
    const result = uri.queryStringToMap("a=1&b=2");
    assert.equal(result.a, "1");
    assert.equal(result.b, "2");
  });

  it("getDomain returns host and port", () => {
    const url = new URL("https://example.com:8080/path");
    assert.equal(uri.getDomain(url), "example.com:8080");
  });

  it("getDomain returns just host when no port", () => {
    const url = new URL("https://example.com/path");
    assert.equal(uri.getDomain(url), "example.com");
  });

  it("mapToQueryString encodes params", () => {
    const result = uri.mapToQueryString({ a: "1", b: "2" });
    assert.ok(result.includes("a=1"));
    assert.ok(result.includes("b=2"));
  });

  it("mapToQueryString filters null values", () => {
    const result = uri.mapToQueryString({ a: "1", b: null });
    assert.ok(result.includes("a=1"));
    assert.ok(!result.includes("b=") || result === "a=1");
  });

  it("percentEncode encodes special chars", () => {
    assert.equal(uri.percentEncode("hello world"), "hello%20world");
  });
});

describe("spec", () => {
  it("isUUID validates UUID strings", () => {
    assert.ok(spec.isUUID("12345678-1234-1234-1234-123456789abc"));
    assert.ok(!spec.isUUID("not-a-uuid"));
    assert.ok(!spec.isUUID(123));
  });

  it("isBoolean validates and conforms", () => {
    assert.ok(spec.isBoolean(true));
    assert.ok(spec.isBoolean(false));
    assert.ok(spec.isBoolean("true"));
    assert.ok(!spec.isBoolean("maybe"));
  });

  it("conformBoolean converts strings", () => {
    assert.equal(spec.conformBoolean("true"), true);
    assert.equal(spec.conformBoolean("false"), false);
    assert.equal(spec.conformBoolean("t"), true);
    assert.equal(spec.conformBoolean("f"), false);
    assert.equal(spec.conformBoolean(42), null);
  });

  it("isNumber validates numbers", () => {
    assert.ok(spec.isNumber(42));
    assert.ok(spec.isNumber(3.14));
    assert.ok(!spec.isNumber("42"));
    assert.ok(!spec.isNumber(NaN));
  });

  it("conformNumber converts strings", () => {
    assert.equal(spec.conformNumber("42"), 42);
    assert.equal(spec.conformNumber("3.14"), 3.14);
    assert.equal(spec.conformNumber("not a number"), null);
    assert.equal(spec.conformNumber(42), 42);
  });

  it("isInteger validates integers", () => {
    assert.ok(spec.isInteger(42));
    assert.ok(!spec.isInteger(3.14));
    assert.ok(!spec.isInteger("42"));
  });

  it("conformInteger converts strings", () => {
    assert.equal(spec.conformInteger("42"), 42);
    assert.equal(spec.conformInteger("-1"), -1);
    assert.equal(spec.conformInteger("3.14"), null);
    assert.equal(spec.conformInteger("abc"), null);
  });

  it("isSafeNumber validates in safe int range", () => {
    assert.ok(spec.isSafeNumber(0));
    assert.ok(spec.isSafeNumber(2147483647));
    assert.ok(spec.isSafeNumber(-2147483648));
    assert.ok(!spec.isSafeNumber(2147483648));
  });

  it("isSafeInt validates safe integers", () => {
    assert.ok(spec.isSafeInt(0));
    assert.ok(spec.isSafeInt(42));
    assert.ok(!spec.isSafeInt(3.14));
    assert.ok(!spec.isSafeInt(2147483648));
  });

  it("parseEmail extracts valid email", () => {
    assert.equal(spec.parseEmail("user@example.com"), "user@example.com");
    assert.equal(spec.parseEmail("invalid"), null);
  });

  it("isEmail validates email strings", () => {
    assert.ok(spec.isEmail("user@example.com"));
    assert.ok(!spec.isEmail("invalid"));
  });

  it("isRGBColorStr validates hex color strings", () => {
    assert.ok(spec.isRGBColorStr("#fff"));
    assert.ok(spec.isRGBColorStr("#ffffff"));
    assert.ok(!spec.isRGBColorStr("fff"));
    assert.ok(!spec.isRGBColorStr("#ffff"));
  });

  it("isBytes checks Uint8Array and ArrayBuffer", () => {
    assert.ok(spec.isBytes(new Uint8Array(4)));
    assert.ok(spec.isBytes(new ArrayBuffer(4)));
    assert.ok(!spec.isBytes(null));
    assert.ok(!spec.isBytes({}));
  });

  it("valid checks spec predicates", () => {
    assert.ok(spec.valid("uuid", "12345678-1234-1234-1234-123456789abc"));
    assert.ok(!spec.valid("uuid", "not-uuid"));
    assert.ok(spec.valid("boolean", true));
    assert.ok(spec.valid("number", 42));
    assert.ok(spec.valid("string", "hello"));
    assert.ok(spec.valid("some", 42));
    assert.ok(!spec.valid("some", null));
  });

  it("conform converts and validates", () => {
    assert.equal(spec.conform("boolean", "true"), true);
    assert.equal(spec.conform("integer", "42"), 42);
    assert.throws(() => spec.conform("uuid", "invalid"));
  });

  it("assert throws on invalid", () => {
    assert.throws(() => spec.assertSpec("uuid", "invalid"));
  });

  it("conformSetOfKeywords converts strings", () => {
    const result = spec.conformSetOfKeywords("a b c");
    assert.ok(result instanceof Set);
    assert.ok(result.has(":a") || result.has(":a b c"));
  });

  it("conformSetOfStrings converts strings", () => {
    const result = spec.conformSetOfStrings("a, b, c");
    assert.ok(result instanceof Set);
    assert.ok(result.has("a"));
  });

  it("conformSetOfValidEmails extracts emails", () => {
    const result = spec.conformSetOfValidEmails("user@example.com other@test.org");
    assert.ok(result instanceof Set);
    assert.ok(result.has("user@example.com"));
  });
});

describe("thumbnails", () => {
  it("fmtObjectIdParts formats object ID", () => {
    const result = thumbnails.fmtObjectIdParts("file1", "page1", "frame1", "tag1");
    assert.equal(result, "file1/page1/frame1/tag1");
  });

  it("fmtObjectId formats from object", () => {
    const result = thumbnails.fmtObjectId({ fileId: "f", pageId: "p", frameId: "fr", tag: "t" });
    assert.equal(result, "f/p/fr/t");
  });

  it("isFileId checks prefix", () => {
    assert.ok(thumbnails.isFileId("abc123/def456/ghi789/tag", "abc123"));
    assert.ok(!thumbnails.isFileId("abc123/def456", "xyz"));
  });

  it("parseObjectId parses object ID string", () => {
    const uuid = "12345678-1234-1234-1234-123456789abc";
    const result = thumbnails.parseObjectId(`${uuid}/${uuid}/${uuid}/tag1`);
    assert.equal(result.tag, "tag1");
    assert.equal(result.fileId, uuid);
  });

  it("getFileId extracts file ID", () => {
    const result = thumbnails.getFileId("abc123/rest");
    assert.ok(result !== null);
  });
});

describe("record", () => {
  it("defineRecord creates a record factory", () => {
    const Point = record.defineRecord("Point", ["x", "y"]);
    const p = Point.create({ x: 1, y: 2 });
    assert.equal(p.x, 1);
    assert.equal(p.y, 2);
  });

  it("createFromMap creates from partial object", () => {
    const Point = record.defineRecord("Point", ["x", "y"]);
    const p = Point.createFromMap({ x: 10 });
    assert.equal(p.x, 10);
    assert.equal(p.y, null);
  });

  it("set returns new frozen object", () => {
    const Point = record.defineRecord("Point", ["x", "y"]);
    const p1 = Point.create({ x: 1, y: 2 });
    const p2 = Point.set(p1, "x", 10);
    assert.equal(p1.x, 1);
    assert.equal(p2.x, 10);
    assert.equal(p2.y, 2);
  });

  it("get retrieves values", () => {
    const Point = record.defineRecord("Point", ["x", "y"]);
    const p = Point.create({ x: 5, y: 10 });
    assert.equal(Point.get(p, "x"), 5);
    assert.equal(Point.get(p, "missing", "default"), "default");
  });

  it("equiv compares two records", () => {
    const Point = record.defineRecord("Point", ["x", "y"]);
    const p1 = Point.create({ x: 1, y: 2 });
    const p2 = Point.create({ x: 1, y: 2 });
    assert.ok(Point.equiv(p1, p2));
  });

  it("equiv respects exceptions", () => {
    const Point = record.defineRecord("Point", ["x", "y"]);
    const p1 = Point.create({ x: 1, y: 2 });
    const p2 = Point.create({ x: 1, y: 99 });
    assert.ok(Point.equiv(p1, p2, ["y"]));
  });

  it("clone creates a shallow copy", () => {
    const Point = record.defineRecord("Point", ["x", "y"]);
    const p1 = Point.create({ x: 1, y: 2 });
    const p2 = Point.clone(p1);
    assert.deepEqual({ ...p2 }, { ...p1 });
  });

  it("toMap converts to plain object", () => {
    const Point = record.defineRecord("Point", ["x", "y"]);
    const p = Point.create({ x: 3, y: 4 });
    const m = Point.toMap(p);
    assert.equal(m.x, 3);
    assert.equal(m.y, 4);
  });

  it("count returns number of keys", () => {
    const Point = record.defineRecord("Point", ["x", "y"]);
    const p = Point.create({ x: 1, y: 2 });
    assert.equal(Point.count(p), 2);
  });

  it("dissoc removes extension keys", () => {
    const Point = record.defineRecord("Point", ["x", "y"]);
    const p1 = Point.create({ x: 1, y: 2 });
    const p2 = Point.set(p1, "z", 99);
    assert.equal(Point.get(p2, "z"), 99);
    const p3 = Point.dissoc(p2, "z");
    assert.equal(Point.get(p3, "z"), undefined);
  });
});

describe("undo_stack", () => {
  it("makeStack creates empty stack", () => {
    const s = undoStack.makeStack();
    assert.equal(s.index, -1);
    assert.deepEqual(s.items, []);
  });

  it("peek returns null for empty stack", () => {
    const s = undoStack.makeStack();
    assert.equal(undoStack.peek(s), null);
  });

  it("append adds value and returns new stack", () => {
    const s1 = undoStack.makeStack();
    const s2 = undoStack.append(s1, "a");
    assert.equal(undoStack.peek(s2), "a");
    assert.equal(s2.index, 0);
  });

  it("append skips duplicate values", () => {
    const s1 = undoStack.makeStack();
    const s2 = undoStack.append(s1, "a");
    const s3 = undoStack.append(s2, "a");
    assert.equal(undoStack.peek(s3), "a");
    assert.equal(s3.index, 0);
  });

  it("undo moves index back", () => {
    const s1 = undoStack.makeStack();
    const s2 = undoStack.append(s1, "a");
    const s3 = undoStack.append(s2, "b");
    const s4 = undoStack.undo(s3);
    assert.equal(undoStack.peek(s4), "a");
  });

  it("redo moves index forward", () => {
    const s1 = undoStack.makeStack();
    const s2 = undoStack.append(s1, "a");
    const s3 = undoStack.append(s2, "b");
    const s4 = undoStack.undo(s3);
    const s5 = undoStack.redo(s4);
    assert.equal(undoStack.peek(s5), "b");
  });

  it("size returns current index + 1", () => {
    const s1 = undoStack.makeStack();
    assert.equal(undoStack.size(s1), 0);
    const s2 = undoStack.append(s1, "a");
    assert.equal(undoStack.size(s2), 1);
  });

  it("fixup replaces current value", () => {
    const s1 = undoStack.makeStack();
    const s2 = undoStack.append(s1, "a");
    const s3 = undoStack.fixup(s2, "b");
    assert.equal(undoStack.peek(s3), "b");
  });

  it("stack respects MAX_UNDO_SIZE", () => {
    let s = undoStack.makeStack();
    for (let i = 0; i < 150; i++) {
      s = undoStack.append(s, `item${i}`);
    }
    assert.ok(s.items.length <= 100);
  });
});

describe("data/macros", () => {
  it("selectKeys picks specified keys", () => {
    const result = macros.selectKeys({ a: 1, b: 2, c: 3 }, ["a", "c"]);
    assert.deepEqual(result, { a: 1, c: 3 });
  });

  it("selectKeys handles missing keys", () => {
    const result = macros.selectKeys({ a: 1 }, ["a", "b"]);
    assert.deepEqual(result, { a: 1 });
  });

  it("getIn traverses nested objects", () => {
    const obj = { a: { b: { c: 42 } } };
    assert.equal(macros.getIn(obj, ["a", "b", "c"]), 42);
  });

  it("getIn returns default for missing path", () => {
    const obj = { a: { b: 1 } };
    assert.equal(macros.getIn(obj, ["a", "x"], "default"), "default");
  });

  it("getIn returns default for null intermediate", () => {
    assert.equal(macros.getIn({ a: null }, ["a", "b"], "default"), "default");
  });

  it("truncate truncates strings", () => {
    assert.equal(macros.truncate("hello world", 5), "hello");
    assert.equal(macros.truncate("hi", 10), "hi");
  });

  it("fmt formats strings with percent placeholders", () => {
    assert.equal(macros.fmt("hello %1, welcome to %2", "Alice", "Wonderland"), "hello Alice, welcome to Wonderland");
  });
});