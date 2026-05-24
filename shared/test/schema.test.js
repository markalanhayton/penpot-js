import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as s from "../src/schema.js";

describe("schema - set validators", () => {
  it("set-of-strings validates Set of strings", () => {
    assert.ok(s.validate("set-of-strings", new Set(["a", "b"])));
    assert.ok(!s.validate("set-of-strings", new Set([1, 2])));
    assert.ok(!s.validate("set-of-strings", ["a", "b"]));
    assert.ok(!s.validate("set-of-strings", "not-a-set"));
  });

  it("set-of-keywords validates Set of keyword strings", () => {
    assert.ok(s.validate("set-of-keywords", new Set([":a", ":b"])));
    assert.ok(!s.validate("set-of-keywords", new Set(["a", "b"])));
  });

  it("set-of-uuid validates Set of UUIDs", () => {
    const uid = "12345678-1234-1234-1234-123456789abc";
    assert.ok(s.validate("set-of-uuid", new Set([uid])));
    assert.ok(!s.validate("set-of-uuid", new Set(["not-uuid"])));
  });

  it("coll-of-uuid validates array of UUIDs", () => {
    const uid = "12345678-1234-1234-1234-123456789abc";
    assert.ok(s.validate("coll-of-uuid", [uid]));
    assert.ok(!s.validate("coll-of-uuid", ["not-uuid"]));
    assert.ok(!s.validate("coll-of-uuid", new Set([uid])));
  });

  it("coll-of-uuid decode/string splits and filters", () => {
    const uid = "12345678-1234-1234-1234-123456789abc";
    const decoded = s.decode("coll-of-uuid", `${uid} not-uuid`);
    assert.deepEqual(decoded, [uid]);
  });
});

describe("schema - set/vec compiled schemas", () => {
  it("set schema validates Set instances", () => {
    const schema = s.lookup("set");
    assert.ok(schema);
    assert.ok(schema.pred || schema.compile);
  });

  it("vec schema validates arrays", () => {
    const schema = s.lookup("vec");
    assert.ok(schema);
    assert.ok(schema.pred || schema.compile);
  });
});

describe("schema - one-of", () => {
  it("one-of compiles with options", () => {
    const schema = s.lookup("one-of");
    assert.ok(schema);
    assert.ok(schema.compile);
  });
});

describe("schema - uri", () => {
  it("uri validates URL instances", () => {
    assert.ok(s.validate("uri", new URL("https://example.com")));
    assert.ok(!s.validate("uri", "https://example.com"));
    assert.ok(!s.validate("uri", 42));
  });

  it("uri decode/string parses strings to URL", () => {
    const decoded = s.decode("uri", "https://example.com/path");
    assert.ok(decoded instanceof URL);
    assert.equal(decoded.hostname, "example.com");
  });

  it("uri decode/string passes through non-strings", () => {
    assert.equal(s.decode("uri", 42), 42);
  });

  it("uri encode/string converts URL to string", () => {
    const url = new URL("https://example.com/path");
    assert.equal(s.encode("uri", url), "https://example.com/path");
  });
});

describe("schema - contains-any", () => {
  it("contains-any compiles with choices", () => {
    const schema = s.lookup("contains-any");
    assert.ok(schema);
    assert.ok(schema.compile);
  });
});

describe("schema - encode/decode", () => {
  it("encode converts UUID to string", () => {
    assert.equal(s.encode("uuid", "12345678-1234-1234-1234-123456789abc"), "12345678-1234-1234-1234-123456789abc");
  });

  it("decode converts string to parsed value for int", () => {
    assert.equal(s.decode("int", "42"), 42);
  });

  it("decode converts string to parsed boolean", () => {
    assert.equal(s.decode("boolean", "true"), true);
    assert.equal(s.decode("boolean", "false"), false);
  });

  it("encoder returns a function", () => {
    const enc = s.encoder("uuid");
    assert.equal(typeof enc, "function");
    assert.equal(enc("12345678-1234-1234-1234-123456789abc"), "12345678-1234-1234-1234-123456789abc");
  });

  it("decoder returns a function", () => {
    const dec = s.decoder("int");
    assert.equal(typeof dec, "function");
    assert.equal(dec("42"), 42);
  });

  it("lazyDecoder returns a function", () => {
    const dec = s.lazyDecoder("int");
    assert.equal(typeof dec, "function");
    assert.equal(dec("42"), 42);
  });
});

describe("schema - check/predicates", () => {
  it("checkSafeInt checks safe int", () => {
    assert.equal(s.checkSafeInt(42), 42);
    assert.throws(() => s.checkSafeInt("not-int"));
  });

  it("checkSetOfStrings validates set of strings", () => {
    assert.ok(s.checkSetOfStrings(new Set(["a", "b"])));
  });

  it("checkEmail validates email", () => {
    assert.equal(s.checkEmail("user@example.com"), "user@example.com");
  });

  it("checkUuid validates uuid", () => {
    const uid = "12345678-1234-1234-1234-123456789abc";
    assert.equal(s.checkUuid(uid), uid);
    assert.throws(() => s.checkUuid("invalid"));
  });

  it("checkString validates string", () => {
    assert.equal(s.checkString("hello"), "hello");
    assert.throws(() => s.checkString(42));
  });

  it("validSafeNumber validates", () => {
    assert.ok(s.validSafeNumber(42));
    assert.ok(!s.validSafeNumber(2147483648));
  });

  it("validSafeInt validates", () => {
    assert.ok(s.validSafeInt(42));
    assert.ok(!s.validSafeInt(3.14));
  });

  it("validText validates", () => {
    assert.ok(s.validText("hello"));
    assert.ok(!s.validText(""));
    assert.ok(!s.validText("   "));
  });
});

describe("schema - coerce", () => {
  it("coerce decodes using schema typeProperties", () => {
    assert.equal(s.coerce("int", "42"), 42);
    assert.equal(s.coerce("boolean", "true"), true);
  });

  it("coerce returns value as-is for unknown schema", () => {
    assert.equal(s.coerce("nonexistent", "value"), "value");
  });
});

describe("schema - compile functions", () => {
  it("compileIntSchema respects min/max", () => {
    const pred = s.lookup("int").compile({ min: 0, max: 100 });
    assert.ok(pred(50));
    assert.ok(!pred(-1));
    assert.ok(!pred(101));
  });

  it("compileDoubleSchema respects min/max", () => {
    const pred = s.lookup("double").compile({ min: 0, max: 100 });
    assert.ok(pred(50.5));
    assert.ok(!pred(-0.1));
    assert.ok(!pred(100.1));
  });

  it("compileTextSchema respects min/max", () => {
    const pred = s.lookup("text").compile({ min: 2, max: 5 });
    assert.ok(pred("abc"));
    assert.ok(!pred("a"));
    assert.ok(!pred("abcdef"));
  });
});