import {
  collection, query, orderBy, limit, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { db, initPage, el, timeAgo, displayName, avatar, friendlyError } from "./app.js";

const feed = document.getElementById("feed");
const form = document.getElementById("post-form");
const errorEl = document.getElementById("post-error");
let unsubscribe = null;
let currentUser = null;

function parseHttpUrl(raw) {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "http:" || u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

function renderPost(snap) {
  const p = snap.data();
  const safe = parseHttpUrl(p.url);
  const title = safe
    ? el("a", { class: "card-title", href: safe.href, target: "_blank", rel: "noopener noreferrer" }, p.title)
    : el("span", { class: "card-title" }, p.title);
  const n = p.commentCount || 0;
  return el(
    "article",
    { class: "card" },
    title,
    el(
      "div", { class: "meta" },
      avatar(p.authorName, p.authorPhoto),
      el("span", {}, p.authorName),
      "·", el("span", {}, timeAgo(p.createdAt)),
      "·", el("span", {}, p.domain)
    ),
    p.description ? el("p", { class: "desc" }, p.description) : null,
    el(
      "div", { class: "card-actions" },
      el("a", { class: "btn btn-ghost", href: `post.html?id=${encodeURIComponent(snap.id)}` },
        `Discuss (${n} comment${n === 1 ? "" : "s"})`),
      currentUser && currentUser.uid === p.authorUid
        ? el("button", {
            class: "btn-link", type: "button",
            onclick: async () => {
              if (!confirm("Delete this post and its comments?")) return;
              try { await deleteDoc(doc(db, "posts", snap.id)); } catch (e) { alert(friendlyError(e)); }
            },
          }, "Delete")
        : null
    )
  );
}

function start() {
  const q = query(collection(db, "posts"), orderBy("lastActivityAt", "desc"), limit(50));
  unsubscribe = onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        feed.replaceChildren(el("p", { class: "empty" }, "No posts yet — be the first to share something!"));
        return;
      }
      feed.replaceChildren(...snap.docs.map(renderPost));
    },
    (err) => feed.replaceChildren(el("p", { class: "error" }, "Could not load posts: " + friendlyError(err)))
  );
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.textContent = "";
  if (!currentUser) return;
  const data = new FormData(form);
  const url = parseHttpUrl(String(data.get("url")));
  if (!url) { errorEl.textContent = "Please enter a valid http(s) link."; return; }
  const btn = form.querySelector("button[type=submit]");
  btn.disabled = true;
  try {
    await addDoc(collection(db, "posts"), {
      url: url.href,
      title: String(data.get("title")).trim(),
      description: String(data.get("description")).trim(),
      domain: url.hostname.replace(/^www\./, ""),
      authorUid: currentUser.uid,
      authorName: displayName(currentUser),
      authorPhoto: currentUser.photoURL || null,
      createdAt: serverTimestamp(),
      lastActivityAt: serverTimestamp(),
      commentCount: 0,
    });
    form.reset();
    document.getElementById("new-post").open = false;
  } catch (err) {
    errorEl.textContent = "Could not post: " + friendlyError(err);
  } finally {
    btn.disabled = false;
  }
});

initPage("feed", (user) => {
  currentUser = user;
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  feed.replaceChildren();
  if (user) start();
});
