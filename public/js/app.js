// Shared setup: Firebase init, auth, header, small DOM helpers.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-functions.js";
import { firebaseConfig } from "./firebase-config.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const functions = getFunctions(app, "us-central1");

export const callable = (name) => httpsCallable(functions, name);

/** Create an element. Children may be nodes or strings (always inserted as text, never HTML). */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function timeAgo(ts) {
  if (!ts || !ts.toMillis) return "just now";
  const s = Math.max(0, Math.round((Date.now() - ts.toMillis()) / 1000));
  if (s < 60) return "just now";
  const units = [
    ["d", 86400],
    ["h", 3600],
    ["m", 60],
  ];
  for (const [label, size] of units) {
    if (s >= size) return `${Math.floor(s / size)}${label} ago`;
  }
  return "just now";
}

export function displayName(user) {
  return user.displayName || (user.email ? user.email.split("@")[0] : "Student");
}

export function avatar(name, photo) {
  if (photo && /^https:\/\//.test(photo)) {
    return el("img", { class: "avatar", src: photo, alt: "", referrerpolicy: "no-referrer", loading: "lazy" });
  }
  return el("span", { class: "avatar avatar-fallback", "aria-hidden": "true" }, (name || "?")[0].toUpperCase());
}

export function friendlyError(err) {
  if (err && err.code === "functions/resource-exhausted") return err.message;
  if (err && err.message) return err.message.replace(/^.*?: /, "");
  return "Something went wrong. Please try again.";
}

const provider = new GoogleAuthProvider();

function mountHeader(active) {
  const header = document.getElementById("site-header");
  if (!header) return;
  const link = (href, label, key) =>
    el("a", { href, class: key === active ? "active" : null, "aria-current": key === active ? "page" : null }, label);
  const userBox = el("div", { class: "user-box" });
  header.replaceChildren(
    el(
      "div",
      { class: "wrap header-inner" },
      el("a", { class: "brand", href: "index.html" }, "AI Newsboard"),
      el("nav", {}, link("index.html", "News", "feed"), link("topics.html", "Next class", "topics")),
      userBox
    )
  );

  onAuthStateChanged(auth, (user) => {
    userBox.replaceChildren();
    if (user) {
      userBox.append(
        avatar(displayName(user), user.photoURL),
        el("span", { class: "user-name" }, displayName(user)),
        el("button", { class: "btn btn-ghost", type: "button", onclick: () => signOut(auth) }, "Sign out")
      );
    }
  });
}

/**
 * Wire up a page. `onUser(user | null)` runs on every auth change. The #content element is
 * shown only for signed-in users; #signed-out (with a sign-in button) otherwise.
 */
export function initPage(active, onUser) {
  mountHeader(active);
  const content = document.getElementById("content");
  const signedOut = document.getElementById("signed-out");
  const signInBtn = document.getElementById("sign-in");
  const authError = document.getElementById("auth-error");
  if (signInBtn) {
    signInBtn.addEventListener("click", async () => {
      authError.textContent = "";
      try {
        await signInWithPopup(auth, provider);
      } catch (err) {
        if (err.code !== "auth/popup-closed-by-user" && err.code !== "auth/cancelled-popup-request") {
          authError.textContent = "Sign-in failed: " + friendlyError(err);
        }
      }
    });
  }
  onAuthStateChanged(auth, (user) => {
    if (content) content.hidden = !user;
    if (signedOut) signedOut.hidden = !!user;
    onUser(user);
  });
}
