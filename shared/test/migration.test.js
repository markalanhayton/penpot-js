import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as i18n from "../src/i18n.js";
import * as version from "../src/version.js";
import * as pathNames from "../src/path_names.js";
import * as buffer from "../src/buffer.js";
import * as perf from "../src/perf.js";
import * as pprint from "../src/pprint.js";
import * as schema from "../src/schema.js";

describe("i18n", () => {
  it("tr returns the key", () => {
    assert.equal(i18n.tr("hello"), "hello");
  });

  it("tr ignores extra args", () => {
    assert.equal(i18n.tr("hello", "arg1", "arg2"), "hello");
  });

  it("c returns the value unchanged", () => {
    assert.equal(i18n.c(42), 42);
    assert.equal(i18n.c("test"), "test");
  });
});

describe("version", () => {
  it("parse returns null for non-string", () => {
    assert.equal(version.parse(123), null);
  });

  it("parse returns develop for 'develop'", () => {
    const result = version.parse("develop");
    assert.equal(result.full, "develop");
    assert.equal(result.branch, "develop");
    assert.equal(result.base, "0.0.0");
    assert.equal(result.major, "0");
  });

  it("parse returns develop for % prefix", () => {
    const result = version.parse("%something");
    assert.equal(result.full, "develop");
  });

  it("parse handles semver version", () => {
    const result = version.parse("2.1.3");
    assert.equal(result.major, "2");
    assert.equal(result.minor, "1");
    assert.equal(result.patch, "3");
    assert.equal(result.base, "2.1.3");
    assert.equal(result.main, "2.1");
  });

  it("parse handles version with branch prefix", () => {
    const result = version.parse("release-2.1.3");
    assert.equal(result.branch, "release");
    assert.equal(result.major, "2");
  });

  it("parse handles version with modifier", () => {
    const result = version.parse("2.1.3-RC1");
    assert.equal(result.modifier, "RC1");
  });

  it("parse handles version with commit hash", () => {
    const result = version.parse("2.1.3-gabc123");
    assert.equal(result.commitHash, "abc123");
  });

  it("parse returns null for invalid input", () => {
    assert.equal(version.parse(""), null);
  });
});

describe("path_names", () => {
  it("splitPath splits by default separator", () => {
    assert.deepEqual(pathNames.splitPath("one / two / three"), ["one", "two", "three"]);
  });

  it("splitPath trims whitespace", () => {
    assert.deepEqual(pathNames.splitPath(" one /  two "), ["one", "two"]);
  });

  it("joinPath joins with spaces by default", () => {
    assert.equal(pathNames.joinPath(["one", "two", "three"]), "one / two / three");
  });

  it("joinPath joins without spaces", () => {
    assert.equal(pathNames.joinPath(["one", "two"], "/", false), "one/two");
  });

  it("splitGroupName splits group and name", () => {
    const [group, name] = pathNames.splitGroupName("group / subgroup / name");
    assert.equal(group, "group / subgroup");
    assert.equal(name, "name");
  });

  it("splitGroupName handles single name", () => {
    const [group, name] = pathNames.splitGroupName("name");
    assert.equal(group, "");
    assert.equal(name, "name");
  });

  it("joinPathWithDot joins with bullet", () => {
    assert.equal(pathNames.joinPathWithDot(["one", "two"]), "one\u00A0\u2022\u00A0two");
  });

  it("cleanPath splits and re-joins", () => {
    assert.equal(pathNames.cleanPath("one / two / three"), "one / two / three");
  });

  it("mergePathItem merges path and name", () => {
    assert.equal(pathNames.mergePathItem("one", "two"), "one / two");
  });

  it("mergePathItem returns path when name is empty", () => {
    assert.equal(pathNames.mergePathItem("one", ""), "one");
  });

  it("mergePathItem returns name when path is empty", () => {
    assert.equal(pathNames.mergePathItem("", "two"), "two");
  });

  it("insidePath checks if child is inside parent", () => {
    assert.ok(pathNames.insidePath("one / two / three", "one / two"));
    assert.ok(!pathNames.insidePath("one / two", "one / two / three"));
  });

  it("splitByLastPeriod splits on last period", () => {
    assert.deepEqual(pathNames.splitByLastPeriod("a.b.c"), ["a.b.", "c"]);
  });

  it("splitByLastPeriod handles no period", () => {
    assert.deepEqual(pathNames.splitByLastPeriod("abc"), ["abc", ""]);
  });

  it("butlastPath removes last segment", () => {
    assert.equal(pathNames.butlastPath("one / two / three"), "one / two");
  });

  it("butlastPath handles single segment", () => {
    assert.equal(pathNames.butlastPath("name"), "");
  });

  it("lastPath returns last segment", () => {
    assert.equal(pathNames.lastPath("one / two / three"), "three");
  });
});

describe("buffer", () => {
  it("allocates and reads/writes bytes", () => {
    const buf = buffer.allocate(16);
    buffer.writeByte(buf, 0, 42);
    assert.equal(buffer.readByte(buf, 0), 42);
  });

  it("allocates and reads/writes unsigned bytes", () => {
    const buf = buffer.allocate(16);
    buffer.writeU8(buf, 0, 200);
    assert.equal(buffer.readUnsignedByte(buf, 0), 200);
  });

  it("allocates and reads/writes bools", () => {
    const buf = buffer.allocate(16);
    buffer.writeBool(buf, 0, true);
    buffer.writeBool(buf, 1, false);
    assert.equal(buffer.readBool(buf, 0), true);
    assert.equal(buffer.readBool(buf, 1), false);
  });

  it("allocates and reads/writes shorts", () => {
    const buf = buffer.allocate(16);
    buffer.writeShort(buf, 0, -1234);
    assert.equal(buffer.readShort(buf, 0), -1234);
  });

  it("allocates and reads/writes ints", () => {
    const buf = buffer.allocate(16);
    buffer.writeInt(buf, 0, -100000);
    assert.equal(buffer.readInt(buf, 0), -100000);
  });

  it("allocates and reads/writes floats", () => {
    const buf = buffer.allocate(16);
    buffer.writeFloat(buf, 0, 3.14);
    assert.ok(Math.abs(buffer.readFloat(buf, 0) - 3.14) < 0.01);
  });

  it("size returns byteLength", () => {
    const buf = buffer.allocate(64);
    assert.equal(buffer.size(buf), 64);
  });

  it("clone creates a copy", () => {
    const buf = buffer.allocate(8);
    buffer.writeInt(buf, 0, 12345);
    const cloned = buffer.clone(buf);
    assert.equal(buffer.readInt(cloned, 0), 12345);
    buffer.writeInt(cloned, 0, 99999);
    assert.equal(buffer.readInt(buf, 0), 12345);
  });

  it("equals compares buffers", () => {
    const buf1 = buffer.allocate(4);
    const buf2 = buffer.allocate(4);
    buffer.writeInt(buf1, 0, 42);
    buffer.writeInt(buf2, 0, 42);
    assert.ok(buffer.equals(buf1, buf2));
  });

  it("equals detects different buffers", () => {
    const buf1 = buffer.allocate(4);
    const buf2 = buffer.allocate(4);
    buffer.writeInt(buf1, 0, 42);
    buffer.writeInt(buf2, 0, 43);
    assert.ok(!buffer.equals(buf1, buf2));
  });

  it("isBuffer checks DataView", () => {
    const buf = buffer.allocate(4);
    assert.ok(buffer.isBuffer(buf));
    assert.ok(!buffer.isBuffer({}));
  });

  it("slice returns a view", () => {
    const buf = buffer.allocate(12);
    buffer.writeInt(buf, 0, 1);
    buffer.writeInt(buf, 4, 2);
    buffer.writeInt(buf, 8, 3);
    const sliced = buffer.slice(buf, 4, 4);
    assert.equal(buffer.readInt(sliced, 0), 2);
  });

  it("wrap creates DataView from Uint8Array", () => {
    const arr = new Uint8Array([1, 2, 3, 4]);
    const view = buffer.wrap(arr);
    assert.ok(buffer.isBuffer(view));
    assert.equal(buffer.size(view), 4);
  });
});

describe("perf", () => {
  it("timestamp returns a number", () => {
    const t = perf.timestamp();
    assert.equal(typeof t, "number");
  });

  it("start and measure return elapsed time", () => {
    const key = perf.start();
    const elapsed = perf.measure(key);
    assert.equal(typeof elapsed, "number");
    assert.ok(elapsed >= 0);
  });

  it("scaleTime returns correct units", () => {
    assert.deepEqual(perf.scaleTime(0.0005), [1e6, "ns"]);
    assert.deepEqual(perf.scaleTime(0.5), [1e3, "\u00B5s"]);
    assert.deepEqual(perf.scaleTime(50), [1, "ms"]);
    assert.deepEqual(perf.scaleTime(2000), [1 / 1000, "sec"]);
  });

  it("formatTime formats correctly", () => {
    const result = perf.formatTime(0.5);
    assert.ok(result.includes("ms") || result.includes("500"));
  });
});

describe("pprint", () => {
  it("pprintStr formats strings", () => {
    assert.equal(pprint.pprintStr("hello"), '"hello"');
  });

  it("pprintStr formats numbers", () => {
    assert.equal(pprint.pprintStr(42), "42");
  });

  it("pprintStr formats null", () => {
    assert.equal(pprint.pprintStr(null), "null");
  });

  it("pprintStr formats arrays", () => {
    assert.equal(pprint.pprintStr([1, 2, 3]), "[1, 2, 3]");
  });

  it("pprintStr formats objects", () => {
    const result = pprint.pprintStr({ a: 1 });
    assert.ok(result.includes("a"));
    assert.ok(result.includes("1"));
  });

  it("pprintStr formats empty objects", () => {
    assert.equal(pprint.pprintStr({}), "{}");
  });

  it("pprintStr formats empty arrays", () => {
    assert.equal(pprint.pprintStr([]), "[]");
  });
});

describe("schema", () => {
  it("validates string type", () => {
    assert.ok(schema.validate("string", "hello"));
    assert.ok(!schema.validate("string", 123));
  });

  it("validates int type", () => {
    assert.ok(schema.validate("int", 42));
    assert.ok(!schema.validate("int", "not an int"));
    assert.ok(!schema.validate("int", 3.14));
  });

  it("validates number type", () => {
    assert.ok(schema.validate("number", 42));
    assert.ok(schema.validate("number", 3.14));
    assert.ok(!schema.validate("number", "not a number"));
  });

  it("validates boolean type", () => {
    assert.ok(schema.validate("boolean", true));
    assert.ok(schema.validate("boolean", false));
    assert.ok(!schema.validate("boolean", "true"));
  });

  it("validates text type", () => {
    assert.ok(schema.validate("text", "hello"));
    assert.ok(!schema.validate("text", ""));
    assert.ok(!schema.validate("text", "   "));
    assert.ok(!schema.validate("text", 123));
  });

  it("validates password type", () => {
    assert.ok(schema.validate("password", "12345678"));
    assert.ok(!schema.validate("password", "short"));
    assert.ok(!schema.validate("password", "     "));
  });

  it("validates email type", () => {
    assert.ok(schema.validate("email", "test@example.com"));
    assert.ok(!schema.validate("email", "not-an-email"));
  });

  it("validates fn type", () => {
    assert.ok(schema.validate("fn", () => {}));
    assert.ok(!schema.validate("fn", "not a fn"));
  });

  it("validates any type", () => {
    assert.ok(schema.validate("any", null));
    assert.ok(schema.validate("any", 42));
    assert.ok(schema.validate("any", "anything"));
  });

  it("check throws on validation failure", () => {
    assert.throws(() => schema.check("int", "not an int"), { message: "check error" });
  });

  it("checkFn returns a check function", () => {
    const checkInt = schema.checkFn("int");
    assert.equal(checkInt(42), 42);
    assert.throws(() => checkInt("not an int"));
  });

  it("parseLong parses string to number", () => {
    assert.equal(schema.parseLong("42"), 42);
    assert.equal(schema.parseLong("not a number"), "not a number");
    assert.equal(schema.parseLong(42), 42);
  });

  it("parseDouble parses string to number", () => {
    assert.equal(schema.parseDouble("3.14"), 3.14);
    assert.equal(schema.parseDouble("not a number"), "not a number");
  });

  it("parseBoolean parses string to boolean", () => {
    assert.equal(schema.parseBoolean("true"), true);
    assert.equal(schema.parseBoolean("false"), false);
    assert.equal(schema.parseBoolean("t"), true);
    assert.equal(schema.parseBoolean("f"), false);
    assert.equal(schema.parseBoolean("1"), true);
    assert.equal(schema.parseBoolean("0"), false);
    assert.equal(schema.parseBoolean(true), true);
  });

  it("parseEmail extracts email", () => {
    assert.equal(schema.parseEmail("user@example.com"), "user@example.com");
    assert.equal(schema.parseEmail("not an email"), null);
  });

  it("safe-int validates range", () => {
    assert.ok(schema.validate("safe-int", 0));
    assert.ok(schema.validate("safe-int", 2147483647));
    assert.ok(!schema.validate("safe-int", "not an int"));
  });

  it("explan returns errors for invalid data", () => {
    const errors = schema.explain("int", "not an int");
    assert.ok(errors !== null);
    assert.ok(errors.length > 0);
  });

  it("explan returns null for valid data", () => {
    const errors = schema.explain("int", 42);
    assert.equal(errors, null);
  });

  it("coerce applies decode transform", () => {
    const result = schema.coerce("int", "42");
    assert.equal(result, 42);
  });

  it("coercer creates a transform-validate function", () => {
    const coerceInt = schema.coercer("int");
    assert.equal(coerceInt("42"), 42);
    assert.throws(() => coerceInt("not an int"));
  });

  it("register and lookup custom schema", () => {
    schema.register("test-custom", {
      pred: (v) => v === "custom",
      typeProperties: { title: "custom" },
    });
    assert.ok(schema.validate("test-custom", "custom"));
    assert.ok(!schema.validate("test-custom", "other"));
  });
});