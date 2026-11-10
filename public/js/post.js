import {
  collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { db, callable, initPage, el, timeAgo, displayName, avatar, friendlyError } from "./app.js";

const postId = new URLSearchParams(location.search).get("id");
const postEl = document.getElementById("post");
const summaryEl = document.getElementById("summary");
const commentsEl = document.getElementById("comments");
const form = document.getElementById("comment-form");
const errorEl = document.getElementById("comment-error");
const heading = document.getElementById("comments-heading");
const summarize = callable("summarizeDiscussion");

let currentUser = null;
let unsubs = [];
let generating = false;
let lastPost = null;

function safeHref(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch { return null; }
}

function list(title, items) {
  if (!items || !items.length) return null;
  return [el("h3", {}, title), el("ul", {}, items.map((t) => el("li", {}, t)))];
}

function renderSummary() {
  const p = lastPost;
  if (!p) return;
  const s = p.aiSummary;
  const stale = s && s.commentCountAtGen !== (p.commentCount || 0);
  const btn = el("button", {
    class: "btn", type: "button", disabled: generating || (s && !stale) || !(p.commentCount > 0),
    onclick: async () => {
      generating = true; renderSummary();
      try { await summarize({ postId }); }
      catch (err) { summaryEl.prepend(el("p", { class: "error", role: "alert" }, friendlyError(err))); }
      finally { generating = false; renderSummary(); }
    },
  }, generating ? "Summarizing…" : s ? (stale ? "Update summary" : "Summary up to date") : "Summarize discussion");

  summaryEl.replaceChildren(
    el("div", { class: "ai-box" },
      el("h2", {}, "AI discussion summary", el("span", { class: "badge" }, "Claude")),
      s ? el("p", { style: "margin:0" }, s.overview) : el("p", { class: "meta" },
        p.commentCount > 0 ? "No summary yet." : "Summaries become available once there are comments."),
      s ? list("Key points", s.keyPoints) : null,
      s ? list("Disagreements", s.disagreements) : null,
      s ? list("Open questions", s.openQuestions) : null,
      s && stale ? el("p", { class: "meta" }, "New comments have been added since this summary was written.") : null,
      el("div", { class: "card-actions" }, btn)
    )
  );
}

function renderPost(snap) {
  if (!snap.exists()) {
    lastPost = null;
    postEl.replaceChildren(el("p", { class: "empty" }, "This post no longer exists."));
    summaryEl.replaceChildren();
    return;
  }
  const p = snap.data();
  lastPost = p;
  const href = safeHref(p.url);
  postEl.replaceChildren(
    el("article", { class: "card" },
      el("h1", {}, href ? el("a", { href, target: "_blank", rel: "noopener noreferrer" }, p.title) : p.title),
      el("div", { class: "meta" }, avatar(p.authorName, p.authorPhoto), el("span", {}, p.authorName),
        "·", el("span", {}, timeAgo(p.createdAt)), "·", el("span", {}, p.domain)),
      p.description ? el("p", { class: "desc" }, p.description) : null)
  );
  document.title = `${p.title} · AI Newsboard`;
  heading.textContent = `Discussion (${p.commentCount || 0})`;
  renderSummary();
}

function renderComment(snap) {
  const c = snap.data();
  return el("div", { class: "comment" },
    avatar(c.authorName, c.authorPhoto),
    el("div", {},
      el("div", { class: "meta", style: "margin:0" }, el("strong", {}, c.authorName), "·", timeAgo(c.createdAt),
        currentUser && currentUser.uid === c.authorUid
          ? el("button", { class: "btn-link", type: "button", onclick: async () => {
              if (!confirm("Delete this comment?")) return;
              try { await deleteDoc(doc(db, "posts", postId, "comments", snap.id)); } catch (e) { alert(friendlyError(e)); }
            } }, "Delete")
          : null),
      el("p", {}, c.text)));
}

function start() {
  unsubs.push(onSnapshot(doc(db, "posts", postId), renderPost,
    (err) => postEl.replaceChildren(el("p", { class: "error" }, "Could not load post: " + friendlyError(err)))));
  unsubs.push(onSnapshot(query(collection(db, "posts", postId, "comments"), orderBy("createdAt", "asc")),
    (snap) => {
      commentsEl.replaceChildren(...(snap.empty
        ? [el("p", { class: "meta" }, "No comments yet — start the conversation.")]
        : snap.docs.map(renderComment)));
    },
    (err) => commentsEl.replaceChildren(el("p", { class: "error" }, friendlyError(err)))));
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.textContent = "";
  const text = new FormData(form).get("text").toString().trim();
  if (!text || !currentUser) return;
  const btn = form.querySelector("button[type=submit]");
  btn.disabled = true;
  try {
    await addDoc(collection(db, "posts", postId, "comments"), {
      text,
      authorUid: currentUser.uid,
      authorName: displayName(currentUser),
      authorPhoto: currentUser.photoURL || null,
      createdAt: serverTimestamp(),
    });
    form.reset();
  } catch (err) {
    errorEl.textContent = "Could not comment: " + friendlyError(err);
  } finally {
    btn.disabled = false;
  }
});

initPage("feed", (user) => {
  currentUser = user;
  unsubs.forEach((u) => u());
  unsubs = [];
  if (!user) return;
  if (!postId) { postEl.replaceChildren(el("p", { class: "empty" }, "No post selected.")); return; }
  start();
});
