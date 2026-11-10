"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { parseJsonObject, sanitizeSummary, sanitizeTopics, clip } = require("./lib");

test("parseJsonObject handles code fences and prose", () => {
  assert.deepStrictEqual(parseJsonObject('Sure!\n```json\n{"a":1}\n```'), { a: 1 });
  assert.throws(() => parseJsonObject("no json here"));
});

test("sanitizeSummary clips and requires overview", () => {
  const s = sanitizeSummary({ overview: " hi ", keyPoints: ["a", 5, "", "b"], extra: "x" });
  assert.deepStrictEqual(s, { overview: "hi", keyPoints: ["a", "b"], disagreements: [], openQuestions: [] });
  assert.throws(() => sanitizeSummary({}));
});

test("sanitizeTopics drops unknown post ids and caps topics", () => {
  const posts = { p1: { title: "One" } };
  const raw = {
    topics: [
      { title: "T", why: "w", questions: ["q"], postIds: ["p1", "p1", "nope", 3] },
      { title: "" },
      ...Array.from({ length: 10 }, (_, i) => ({ title: `T${i}`, postIds: [] })),
    ],
  };
  const out = sanitizeTopics(raw, posts);
  assert.ok(out.length <= 5);
  assert.deepStrictEqual(out[0].posts, [{ id: "p1", title: "One" }]);
  assert.throws(() => sanitizeTopics({ topics: [] }, posts));
});

test("clip truncates", () => {
  assert.strictEqual(clip("abcdef", 4), "abc…");
  assert.strictEqual(clip(null, 4), "");
});
