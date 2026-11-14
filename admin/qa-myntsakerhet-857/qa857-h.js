// QA-hjälpare #857 i sidan: const h = await import('/qa857-h.js?v=' + Date.now())
import { db, auth } from "/src/firebase-config.js";
import {
  doc, getDoc, getDocFromServer, updateDoc, setDoc, deleteDoc, increment, arrayUnion, collection, getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const fs = { doc, getDoc, getDocFromServer, updateDoc, setDoc, deleteDoc, increment, arrayUnion, collection, getDocs, db };

export async function loggaIn(u, larare = false) {
  const a = await import("/src/auth.js");
  try { await auth.signOut(); } catch {}
  if (larare) await a.signInTeacher(u, "lilla123");
  else await a.signInStudent(u, "lilla123", true);
  const d = await import("/src/data.js");
  d.clearStudentDataCache?.();
  return auth.currentUser?.uid;
}

export async function sd(uid = auth.currentUser?.uid) {
  const s = await getDocFromServer(doc(db, "studentData", uid));
  return s.exists() ? s.data() : null;
}
export async function saldo(uid) { const d = await sd(uid); return d ? { coins: d.coins, xp: d.xp } : null; }

/** Kör fn och returnera { fore, efter, delta, res, fel }. */
export async function matt(fn, uid = auth.currentUser?.uid) {
  const fore = await saldo(uid);
  let res, fel;
  try { res = await fn(); } catch (e) { fel = e?.code || String(e?.message || e); }
  const efter = await saldo(uid);
  return { fore, efter, dCoins: (efter?.coins ?? 0) - (fore?.coins ?? 0), dXp: (efter?.xp ?? 0) - (fore?.xp ?? 0), res: kort(res), fel };
}
function kort(r) {
  try { const s = JSON.stringify(r); return s && s.length > 600 ? s.slice(0, 600) + "…" : r; } catch { return String(r); }
}

/** Övning (E1) – produktionsanroparen game-shared.js awardExercise. */
export async function ovning(area = "vikingatiden", mode = "quiz", baseCoins = 30, stars = 3) {
  const gs = await import("/src/game-shared.js");
  return matt(() => gs.awardExercise(area, mode, { stars, bestScore: 10, baseCoins, catStats: {} }));
}

/** Läsresan (E2) – nextTextFor (startText) + completeText med exakt `ratt` rätta svar. */
export async function lasresan(ratt = 4) {
  const L = await import("/src/data-lasresan.js");
  const P = await import("/src/lasresan/page-lasresan.js");
  const text = await P.nextTextFor(await L.getLasresa());
  const answers = text.questions.map((q, i) => ({ qid: q.id, chosen: i < ratt ? q.answerIndex : (q.answerIndex + 1) % q.options.length }));
  const m = await matt(() => L.completeText({ text, answers }));
  return { text: text.id, fragor: text.questions.length, ...m };
}

/** Gårdens gåva (E5). */
export async function gava(uid) {
  const F = await import("/src/data-farm.js");
  const m = await matt(() => F.claimFarmAnimalGift(uid));
  return m;
}

/** Lärarens Ge mynt (E10) – data.addCoins(n, elevId) som teacher-class-accounts.js. */
export async function geMynt(elev, n = 25) {
  const d = await import("/src/data.js");
  return matt(() => d.addCoins(n, elev), elev);
}

/** Live (E8) – historikvyns settleLiveRewards(sid, session). */
export async function live(sid, elev) {
  const R = await import("/src/live/live-rewards-data.js");
  const s = (await getDocFromServer(doc(db, "liveSessions", sid))).data();
  return matt(() => R.settleLiveRewards(sid, s), elev);
}

const vanta = (ms) => new Promise((r) => setTimeout(r, ms));
export const nolla = async () => { await fetch("/__qa/rakna?nollstall"); await fetch("/qa-rest?nollstall"); };
export const las = async () => {
  const a = await (await fetch("/__qa/rakna")).json(); const b = await (await fetch("/qa-rest")).json();
  return { listenDok: a.summaLasningar, mal: a.fragor, writeStream: a.summaSkrivningar, ...b };
};

/** Köp i butikens UI (#/elev/shop måste vara öppen): flik-text + varans data-id. */
export async function shopKop(flik, id) {
  document.querySelectorAll("dialog button").forEach((b) => { if (/Stäng|Toppen/.test(b.textContent)) b.click(); });
  const tab = [...document.querySelectorAll("button")].find((b) => b.textContent.trim().includes(flik));
  tab?.click(); await vanta(1200);
  const btn = document.querySelector(`button.buy-btn[data-id="${id}"]`);
  if (!btn) return { fel: "ingen knapp " + id, knappar: [...document.querySelectorAll("button.buy-btn")].map((b) => (b.dataset.id || "-") + ":" + b.textContent.trim().replace(/\s+/g, " ")).join(" | ") };
  const fore = await saldo();
  await nolla();
  btn.click();
  for (let i = 0; i < 40; i++) { await vanta(300); if (![...document.querySelectorAll("button.buy-btn")].some((b) => b.textContent.includes("Köper"))) break; }
  await vanta(1500);
  const kvot = await las();
  const efter = await saldo();
  const synligt = [...document.querySelectorAll(".flash, .toast, [role=alert], [role=status], dialog")].map((e) => e.textContent.trim().replace(/\s+/g, " ").slice(0, 200)).filter(Boolean).join(" || ");
  return { id, fore, efter, dCoins: (efter?.coins ?? 0) - (fore?.coins ?? 0), synligt, kvot };
}

/** Mattematchen i UI:t (#/elev/mattematchen öppen): n rätt, sedan `fel` fel. */
export async function mm(n, fel = 0) {
  document.querySelectorAll("dialog button").forEach((b) => { if (/Stäng|Toppen/.test(b.textContent)) b.click(); });
  const fore = await saldo();
  await nolla();
  for (let i = 0; i < n + fel; i++) {
    const q = document.querySelector("main form [aria-live=polite]").textContent;
    const m = q.match(/(\d+)\s*×\s*(\d+)/);
    const inp = document.querySelector("main form input");
    inp.value = String(m[1] * m[2] + (i >= n ? 1 : 0));
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    inp.form.requestSubmit();
    await vanta(1500);
  }
  await vanta(2500);
  const kvot = await las();
  const efter = await saldo();
  return { fore, efter, dCoins: efter.coins - fore.coins, rad: document.querySelector("main").innerText.replace(/\s+/g, " ").slice(0, 160), kvot };
}

/** XHR-logg av REST-anrop (commit/batchGet/callable) för kvotmätningen. */
export function xhrLogg() {
  if (window.__qaLogg) return window.__qaLogg;
  const logg = (window.__qaLogg = []);
  const open = XMLHttpRequest.prototype.open, send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, url, ...r) { this.__u = String(url); return open.call(this, m, url, ...r); };
  XMLHttpRequest.prototype.send = function (body) {
    const u = this.__u || "";
    const op = (u.match(/documents:([a-zA-Z]+)/) || [])[1] || (u.match(/\/(butikKop)\b/) || [])[1];
    if (op && op !== "Listen" && op !== "Write") {
      const post = { op, docs: [] };
      try { const j = JSON.parse(body); if (op === "commit") post.docs = (j.writes || []).map((w) => (w.update?.name || w.delete || w.transform?.document || "?").replace(/.*\/documents\//, "")); if (op === "batchGet") post.docs = (j.documents || []).map((d) => d.replace(/.*\/documents\//, "")); } catch {}
      this.addEventListener("loadend", () => { post.status = this.status; logg.push(post); });
    }
    return send.call(this, body);
  };
  const f = window.fetch;
  window.fetch = async (url, opt = {}) => {
    const u = String(url?.url || url);
    const op = (u.match(/\/(butikKop)\b/) || [])[1];
    const r = await f(url, opt);
    if (op) logg.push({ op, status: r.status });
    return r;
  };
  return logg;
}

/** Skoldagen (§5): 14 övningar, 4 Läsresan, 2 gåvor, 3 köp (butiken måste vara öppen). */
export async function skoldag() {
  const logg = xhrLogg(); logg.length = 0;
  await nolla();
  const gs = await import("/src/game-shared.js");
  const omr = [["vikingatiden", "quiz"], ["vikingatiden", "match"], ["vikingatiden", "jakt"], ["vikingatiden", "rakna"]];
  const ut = { ovning: [], las: [], gava: [], kop: [] };
  for (let i = 0; i < 14; i++) { const [a, m] = omr[i % omr.length]; const r = await gs.awardExercise(a, m, { stars: 3, bestScore: 10, baseCoins: 30, catStats: {} }); ut.ovning.push(r.coins); }
  const L = await import("/src/data-lasresan.js"); const P = await import("/src/lasresan/page-lasresan.js");
  for (let i = 0; i < 4; i++) { const text = await P.nextTextFor(await L.getLasresa()); const answers = text.questions.map((q) => ({ qid: q.id, chosen: q.answerIndex })); const r = await L.completeText({ text, answers }); ut.las.push(r.coins); }
  const F = await import("/src/data-farm.js");
  for (const u of ["animal_cow#k1", "animal_cow#k2"]) { const r = await F.claimFarmAnimalGift(u); ut.gava.push(r?.coins ?? r?.ok); }
  const efterTjana = { rest: [...logg], proxy: await las() };
  logg.length = 0; await nolla();
  for (const [flik, id] of [["Möbler", "stol"], ["Husdjur", "mystery-egg"], ["Mysterybox", "mysterybox-mini"]]) { const r = await shopKop(flik, id); ut.kop.push(r.dCoins); }
  const efterKop = { rest: [...logg], proxy: await las() };
  const sum = (l) => { const s = {}; for (const p of l) { s[p.op] = (s[p.op] || 0) + 1; s[p.op + "Dok"] = (s[p.op + "Dok"] || 0) + (p.docs?.length || 0); } return s; };
  const monster = (l) => { const s = {}; for (const p of l) for (const d of p.docs || []) { const k = p.op + " " + d.split("/").map((x, i) => (i % 2 ? "*" : x)).join("/"); s[k] = (s[k] || 0) + 1; } return s; };
  return { ut, tjana: { sum: sum(efterTjana.rest), monster: monster(efterTjana.rest), listenDok: efterTjana.proxy.listenDok, mal: efterTjana.proxy.mal, writeStream: efterTjana.proxy.writeStream },
    kop: { sum: sum(efterKop.rest), monster: monster(efterKop.rest), listenDok: efterKop.proxy.listenDok, writeStream: efterKop.proxy.writeStream } };
}
