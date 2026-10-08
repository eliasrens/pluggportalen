// ============================================================================
// Slut-QA Läsresan 10 nivåer (#525): gemensamma hjälpare – BARA emulatorn.
// ----------------------------------------------------------------------------
// Rapportering (kontroll/rapport) och lagrings-/läshjälpare som delas av
// qa-lasresan-10-kontroll.mjs och qa-lasresan-10-gammal-klient.mjs. Appens
// dataväg (inloggning, nivåbyte, läsa en text) ligger i qa-lasresan-482-app.mjs.
// ============================================================================
import { collection, doc, getDoc, getDocs, setLogLevel } from "firebase/firestore";
import { normalizeAttempt } from "../src/lasresan/level-scale.js";
import { adb, BANK } from "./qa-lasresan-482-app.mjs";

setLogLevel("silent"); // nekade skrivningar är förväntade i behörighetskontrollerna

export const rapport = { fel: 0 };
export function kontroll(namn, ok, extra = "") {
  if (!ok) rapport.fel++;
  console.log(`  ${ok ? "✓" : "✗"} ${namn}${extra ? ` – ${extra}` : ""}`);
}
export async function utfall(fn) {
  try { await fn(); return "ok"; } catch (e) { return e.code || String(e); }
}
export const nekad = (r) => r === "permission-denied";
export const NOW = Date.UTC(2026, 9, 8, 8, 0, 0);
/** Första texten i banken på en nivå (1–10). */
export const forstaPa = (lvl) => BANK.find((t) => t.level === lvl);

/** Elevens lagrade data (admin): studentData + försök. */
export async function lagrat(uid) {
  const sd = (await adb.doc(`studentData/${uid}`).get()).data() || {};
  const at = await adb.collection(`studentData/${uid}/lasresaAttempts`).get();
  return { sd, attempts: at.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.id < b.id ? -1 : 1)) };
}
/** Allt som INTE är nivå/påbörjad text – ska vara identiskt före och efter migrering. */
export function resultat({ sd, attempts }) {
  const lr = { ...(sd.lasresa || {}) };
  for (const k of ["level", "level10", "pendingLevel", "pendingLevel10", "currentTextId", "currentStartedAt", "updatedAt", "levelScale"]) delete lr[k];
  const rest = { ...sd };
  delete rest.lasresa;
  return { lr, rest, attempts };
}
/** listAttempts (data-lasresan.js): subkollektion + fallback, normaliserade. */
export async function forsok(db, uid) {
  const sub = await getDocs(collection(db, "studentData", uid, "lasresaAttempts"));
  const out = sub.docs.map((d) => d.data());
  const fb = (await getDoc(doc(db, "studentData", uid))).data().lasresaAttemptsFallback;
  if (Array.isArray(fb)) out.push(...fb);
  return out.map(normalizeAttempt).sort((a, b) => b.completedAt - a.completedAt);
}

export async function seedKlass(id, name, studentIds, extra = {}) {
  await adb.doc(`classes/${id}`).set({ name, order: 9, createdAt: NOW, studentIds, ...extra });
}

