"use strict";

/** Pure helpers (no Firebase / network) so they can be unit tested. */

function clip(value, max) {
  const s = typeof value === "string" ? value.trim() : "";
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/** Extract the first JSON object from a model reply (tolerates code fences / prose). */
function parseJsonObject(text) {
  if (typeof text !== "string") throw new Error("Empty model reply");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in model reply");
  return JSON.parse(text.slice(start, end + 1));
}

function stringList(value, maxItems, maxLen) {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => clip(v, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function sanitizeSummary(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  const out = {
    overview: clip(o.overview, 1200),
    keyPoints: stringList(o.keyPoints, 6, 300),
    disagreements: stringList(o.disagreements, 4, 300),
    openQuestions: stringList(o.openQuestions, 4, 300),
  };
  if (!out.overview) throw new Error("Summary missing overview");
  return out;
}

/** Keep only topics whose postIds exist in `validIds`; attach post titles. */
function sanitizeTopics(raw, postsById) {
  const list = raw && Array.isArray(raw.topics) ? raw.topics : [];
  const topics = [];
  for (const t of list.slice(0, 5)) {
    if (!t || typeof t !== "object") continue;
    const title = clip(t.title, 150);
    if (!title) continue;
    const ids = Array.isArray(t.postIds) ? t.postIds : [];
    const posts = [];
    for (const id of ids) {
      if (typeof id === "string" && postsById[id] && !posts.some((p) => p.id === id)) {
        posts.push({ id, title: postsById[id].title });
      }
    }
    topics.push({
      title,
      why: clip(t.why, 500),
      questions: stringList(t.questions, 4, 250),
      posts,
    });
  }
  if (topics.length === 0) throw new Error("No usable topics in model reply");
  return topics;
}

module.exports = { clip, parseJsonObject, stringList, sanitizeSummary, sanitizeTopics };
