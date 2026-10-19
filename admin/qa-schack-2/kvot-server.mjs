#!/usr/bin/env node
// ============================================================================
// Schack slut-QA Etapp 2 (#782): SERVERNS Firestore-läsningar och -skrivningar
// för ett helt parti med 40 drag per spelare (80 halvdrag) och klocka – samma
// kärnfunktioner som callables kör (functions/schack-lobby.js, schack-parti.js),
// mot emulatorn, med räknare på Admin-SDK:ts Transaction/DocumentReference/Query.
// Klientens lyssnarläsningar mäts i webbläsaren (räknande proxy, qa.mjs kvot).
//
//   source /tmp/qa-schack-2/env && node admin/qa-schack-2/kvot-server.mjs
// Skapar egna elever (kvot-a/kvot-b) i en egen klass (kvot) – rör inte QA-datan.
// ============================================================================
import { createRequire } from "node:module";
const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const fsmod = require("@google-cloud/firestore");
const { Chess } = await import("../../src/schack/vendor/chess.js");
const lobby = await import("../../functions/schack-lobby.js");
const parti = await import("../../functions/schack-parti.js");

if (!process.env.FIRESTORE_EMULATOR_HOST) { console.error("✗ bara mot emulatorn"); process.exit(1); }
initializeApp({ projectId: process.env.GCLOUD_PROJECT || "pluggportalen-so-2026" });
const db = getFirestore();

const rakna = { las: 0, skriv: 0, perSamling: {} };
const samling = (path) => path.split("/").filter((_, i) => i % 2 === 0).join("/");
const notera = (typ, path, n = 1) => {
  rakna[typ] += n;
  const k = `${typ} ${samling(path)}`;
  rakna.perSamling[k] = (rakna.perSamling[k] || 0) + n;
};
const T = fsmod.Transaction.prototype;
for (const m of ["set", "update", "delete", "create"]) {
  const o = T[m];
  T[m] = function (ref, ...a) { notera("skriv", ref.path); return o.call(this, ref, ...a); };
}
const og = T.get;
T.get = async function (ref, ...a) {
  const r = await og.call(this, ref, ...a);
  if (r?.docs) notera("las", ref._queryOptions?.collectionId || "query", Math.max(1, r.docs.length));
  else notera("las", ref.path);
  return r;
};
const D = fsmod.DocumentReference.prototype;
const dg = D.get;
D.get = async function (...a) { notera("las", this.path); return dg.apply(this, a); };
for (const m of ["set", "update", "delete", "create"]) {
  const o = D[m];
  D[m] = function (...a) { notera("skriv", this.path); return o.apply(this, a); };
}
const Q = fsmod.Query.prototype;
const qg = Q.get;
Q.get = async function (...a) { const r = await qg.apply(this, a); notera("las", this._queryOptions?.collectionId || "query", Math.max(1, r.docs.length)); return r; };

// Egen klass + två elever (Admin-SDK direkt – räknas inte, nollas nedan).
const A = "kvot-a", B = "kvot-b", K = "kvot";
await db.doc(`classes/${K}`).set({ name: "Kvot", studentIds: [A, B], enabledModules: ["schack"] });
await db.doc(`classProjections/${K}`).set({ members: { [A]: { namn: "Anna" }, [B]: { namn: "Bo" } } });
for (const u of [A, B]) await db.doc(`studentData/${u}`).set({ coins: 0 });
await db.doc(`schackKlass/${K}`).delete();
const nolla = () => { rakna.las = 0; rakna.skriv = 0; rakna.perSamling = {}; };
const deps = { db, FieldValue, now: Date.now };
const steg = [];
const mat = (namn) => { steg.push({ namn, las: rakna.las, skriv: rakna.skriv, detalj: { ...rakna.perSamling } }); nolla(); };

nolla();
await lobby.vanta(deps, A, { classId: K, klocka: 10 });
mat("A väntar (schackVanta)");
const { partiId } = await lobby.gaMed(deps, B, { classId: K, motstandare: A });
mat("B går med (schackGaMed) – partiet startar");

const p0 = (await db.doc(`schackPartier/${partiId}`).get()).data();
nolla();
const ch = new Chess();
let seed = 7;
const slump = () => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed / 2 ** 31; };
for (let i = 0; i < 80; i++) {
  const drag = ch.moves({ verbose: true }).filter((d) => {
    const c = new Chess(ch.fen()); c.move(d); return !c.isGameOver();
  });
  const d = drag[Math.floor(slump() * drag.length)];
  const vem = ch.turn() === "w" ? p0.vit : p0.svart;
  const r = await parti.drag(deps, vem, { partiId, from: d.from, to: d.to, promotion: d.promotion });
  if (!r.gjort || r.slut) throw new Error("partiet tog slut i förtid: " + JSON.stringify(r.slut));
  ch.move(d);
}
mat("80 halvdrag (schackDrag × 80)");
await parti.geUpp(deps, p0.vit, { partiId });
mat("vit ger upp (schackGeUpp) – partiet slutar, tabellen i samma transaktion");

let las = 0, skriv = 0;
console.log("| Steg | Läsningar | Skrivningar | Per samling |\n| --- | --- | --- | --- |");
for (const s of steg) {
  las += s.las; skriv += s.skriv;
  console.log(`| ${s.namn} | ${s.las} | ${s.skriv} | ${Object.entries(s.detalj).map(([k, v]) => `${k}: ${v}`).join(", ")} |`);
}
console.log(`| **Summa servern** | **${las}** | **${skriv}** | |`);
const slut = (await db.doc(`schackPartier/${partiId}`).get()).data();
console.log(`\nPartiet: ${slut.drag.length} halvdrag, status ${slut.status}, ${slut.resultat} (${slut.orsak}); klocka vit ${slut.klocka.vitMs} ms, svart ${slut.klocka.svartMs} ms`);
process.exit(0);
