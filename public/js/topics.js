import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { db, callable, initPage, el, timeAgo, friendlyError } from "./app.js";

const topicsEl = document.getElementById("topics");
const btn = document.getElementById("generate");
const status = document.getElementById("gen-status");
const errorEl = document.getElementById("topics-error");
const suggest = callable("suggestTopics");
let unsub = null;

function render(snap) {
  if (!snap.exists()) {
    topicsEl.replaceChildren(el("p", { class: "empty" }, "No topics yet. Generate some from recent posts."));
    status.textContent = "";
    return;
  }
  const { items = [], generatedAt, postCount } = snap.data();
  status.textContent = `Generated ${timeAgo(generatedAt)} from ${postCount ?? "?"} recent posts`;
  topicsEl.replaceChildren(...items.map((t, i) =>
    el("article", { class: "card topic" },
      el("h2", {}, `${i + 1}. ${t.title}`),
      el("p", { style: "margin:0" }, t.why),
      t.questions && t.questions.length ? [el("h3", { style: "font-size:.9rem;margin:10px 0 0" }, "Questions to discuss"),
        el("ul", {}, t.questions.map((q) => el("li", {}, q)))] : null,
      t.posts && t.posts.length
        ? el("div", { class: "posts meta" }, "Related:", t.posts.map((p) =>
            el("a", { href: `post.html?id=${encodeURIComponent(p.id)}` }, p.title)))
        : null)));
}

btn.addEventListener("click", async () => {
  errorEl.textContent = "";
  btn.disabled = true;
  btn.textContent = "Generating…";
  try { await suggest({ force: true }); }
  catch (err) { errorEl.textContent = friendlyError(err); }
  finally { btn.disabled = false; btn.textContent = "Generate topics"; }
});

initPage("topics", (user) => {
  if (unsub) { unsub(); unsub = null; }
  topicsEl.replaceChildren();
  if (!user) return;
  unsub = onSnapshot(doc(db, "topics", "current"), render,
    (err) => { errorEl.textContent = "Could not load topics: " + friendlyError(err); });
});
