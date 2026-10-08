// ============================================================================
// Klasscentret – pokalregistret (#494, epic #474). REN logik, inga DOM-/
// Firebase-importer → testas i Node (test/kc-pokal-typer.test.js). Firestore-
// sidan (dynamisk) är kc-pokal-data.js; reglerna firestore.rules "Pokaler".
// ----------------------------------------------------------------------------
// Pokaler delas ut AUTOMATISKT när klassen vinner/klarar en utmaning (spec §6)
// och bor i classCenters/{classId}/trophies/{typ}-{kallaId}. Id:t är
// DETERMINISTISKT → samma vinst = samma dokument (create-only) → idempotent,
// hur många lärarklienter som än delar ut samtidigt.
//
// En pokaltyp = {
//   id        "mm-klasskamp" – blir dokument-id:ts prefix ({id}-{kallaId})
//   kalla     "mattematchen" | "live" – vilken källsamling kallaId pekar på
//             (mathCompetitions/{kallaId} resp. liveSessions/{kallaId})
//   titel     kort rubrik (≤ 80 tecken), sparas i dokumentet
//   text      tooltipens brödtext
//   art       rit-nyckel för konsten (sub-issue C/D)
//   tooltip(detalj) → string   valfri; standard = text
//   vinnare(kallaDoc) → classId[]  vilka klasser som förtjänat pokalen enligt
//             källans `result` – SAMMA villkor som reglerna kontrollerar med
//             getAfter() (ändras det ena måste det andra ändras)
//   detaljFran(kallaDoc) → string  valfri; standard = källans `name`
// }
// ⚠️ Ny typ = registreraPokaltyp här + en gren i kcPokalVerifierad och typen
// i KC_POKAL_TYPER i firestore.rules (+ rules-deploy). test/kc-pokal-typer.
// test.js failar om listorna glider isär.
//
// API
//   registreraPokaltyp(typ)            lägg till/ersätt en typ
//   pokaltyp(id) → typ|null            harPokaltyp(id)   listaPokaltyper()
//   pokalId(typ, kallaId) → string|null   "<typ>-<kallaId>" (null = ogiltigt)
//   giltigtKallaId(id) → bool          1–100 tecken [A-Za-z0-9_-]
//   verifieraPokal(typ, kallaDoc, classId) → bool  förtjänade klassen pokalen?
//   pokalerUrKalla(kalla, kallaId, kallaDoc)
//       → [{ classId, typ, kallaId, id, detalj }]  alla pokaler källan ger
//   planPokal({ typ, kallaId, detalj, uid, fv }) → { ok, id, data } | Fel
//   korPokalUtdelning(sdk, db, { classId, typ, kallaId, detalj, uid })
//       → Promise<{ ok:true, id, ny:bool } | Fel>   EN transaktion: finns
//         dokumentet → ny:false och inget skrivs, annars create
//   normaliseraPokal(id, data) / normaliseraPokaler(docs) → Pokal[] nyast först
//   pokalTooltip(pokal) → { rubrik, text, detalj, datum }
//   Pokal = { id, typ, kallaId, titel, detalj, wonAt (ms|null), awardedBy, art, kand }
//   Fel   = { ok:false, kod: "okand-typ"|"ogiltigt-id"|"saknar-uid", error }
// ============================================================================

/** Rubrikens och detaljens maxlängd (samma gränser som reglerna). */
export const POKAL_TITEL_MAX = 80;
export const POKAL_DETALJ_MAX = 120;

const KALLA_ID = /^[A-Za-z0-9_-]{1,100}$/;
const TYPER = new Map();

function fel(kod, error) {
  return { ok: false, kod, error };
}

function text(v, max) {
  return String(v == null ? "" : v).trim().slice(0, max);
}

/** Lägg till (eller ersätt) en pokaltyp. */
export function registreraPokaltyp(typ) {
  const t = typ || {};
  if (!t.id || !/^[a-z0-9-]{1,30}$/.test(t.id)) throw new Error("registreraPokaltyp: ogiltigt id");
  if (!t.titel) throw new Error(`registreraPokaltyp(${t.id}): titel saknas`);
  if (!["mattematchen", "live"].includes(t.kalla)) throw new Error(`registreraPokaltyp(${t.id}): okänd kalla`);
  if (typeof t.vinnare !== "function") throw new Error(`registreraPokaltyp(${t.id}): vinnare() saknas`);
  TYPER.set(t.id, Object.freeze({ text: "", art: "pokal", ...t, titel: text(t.titel, POKAL_TITEL_MAX) }));
}

export function pokaltyp(id) {
  return TYPER.get(id) || null;
}

export function harPokaltyp(id) {
  return TYPER.has(id);
}

export function listaPokaltyper() {
  return [...TYPER.values()];
}

export function giltigtKallaId(id) {
  return typeof id === "string" && KALLA_ID.test(id);
}

/** Dokument-id:t i trophies/: "<typ>-<kallaId>" (null om typ/källa är ogiltig). */
export function pokalId(typ, kallaId) {
  if (!harPokaltyp(typ) || !giltigtKallaId(kallaId)) return null;
  return `${typ}-${kallaId}`;
}

/** Har klassen förtjänat pokalen enligt källdokumentet (klientens spegel av reglerna)? */
export function verifieraPokal(typ, kallaDoc, classId) {
  const t = pokaltyp(typ);
  return !!(t && kallaDoc && classId && (t.vinnare(kallaDoc) || []).includes(classId));
}

/**
 * Alla pokaler en avslutad källa ger. kallaDoc = källdokumentets data
 * (mathCompetitions/{cid} resp. liveSessions/{sid}) MED `result`.
 */
export function pokalerUrKalla(kalla, kallaId, kallaDoc) {
  if (!giltigtKallaId(kallaId) || !kallaDoc || typeof kallaDoc !== "object") return [];
  const ut = [];
  for (const t of TYPER.values()) {
    if (t.kalla !== kalla) continue;
    const detalj = text(t.detaljFran ? t.detaljFran(kallaDoc) : kallaDoc.name, POKAL_DETALJ_MAX);
    for (const classId of new Set(t.vinnare(kallaDoc) || [])) {
      if (typeof classId !== "string" || !classId) continue;
      ut.push({ classId, typ: t.id, kallaId, id: pokalId(t.id, kallaId), detalj });
    }
  }
  return ut;
}

/**
 * Pokaldokumentet att skapa. fv = { serverTimestamp } (SDK:ns FieldValue-
 * fabrik) – wonAt måste vara serverns tid (reglerna: == request.time).
 */
export function planPokal({ typ, kallaId, detalj, uid, fv } = {}) {
  const t = pokaltyp(typ);
  if (!t) return fel("okand-typ", "Okänd pokaltyp.");
  const id = pokalId(typ, kallaId);
  if (!id) return fel("ogiltigt-id", "Ogiltigt käll-id för pokalen.");
  if (!uid) return fel("saknar-uid", "Ingen inloggad lärare.");
  const data = { typ, kallaId, titel: t.titel, wonAt: fv.serverTimestamp(), awardedBy: uid };
  const d = text(detalj, POKAL_DETALJ_MAX);
  if (d) data.detalj = d;
  return { ok: true, id, data };
}

/**
 * Dela ut EN pokal: transaktion som läser pokaldokumentet och skapar det bara
 * om det saknas. Två samtidiga utdelare → den ena skapar, den andra körs om
 * av SDK:n, ser dokumentet och skriver inget (ny:false). Ett nej från reglerna
 * (ej lärare, klassen vann inte …) kastas vidare (permission-denied).
 * sdk = { runTransaction, doc, serverTimestamp }
 */
export async function korPokalUtdelning(sdk, db, { classId, typ, kallaId, detalj, uid } = {}) {
  const plan = planPokal({ typ, kallaId, detalj, uid, fv: { serverTimestamp: sdk.serverTimestamp } });
  if (!plan.ok) return plan;
  if (!classId) return fel("ogiltigt-id", "Klass saknas.");
  const ref = sdk.doc(db, "classCenters", classId, "trophies", plan.id);
  return sdk.runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) return { ok: true, id: plan.id, ny: false };
    tx.set(ref, plan.data);
    return { ok: true, id: plan.id, ny: true };
  });
}

function ms(t) {
  if (t && typeof t.toMillis === "function") return t.toMillis();
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Ett pokaldokument → visningsform. Okänd (framtida) typ visas med sparad titel. */
export function normaliseraPokal(id, data) {
  const d = data || {};
  const t = pokaltyp(d.typ);
  return {
    id: String(id || ""),
    typ: String(d.typ || ""),
    kallaId: String(d.kallaId || ""),
    titel: text(d.titel || t?.titel || "Pokal", POKAL_TITEL_MAX),
    detalj: text(d.detalj, POKAL_DETALJ_MAX),
    wonAt: ms(d.wonAt),
    awardedBy: String(d.awardedBy || ""),
    art: t?.art || "pokal",
    kand: !!t,
  };
}

/** Query-dokument (QueryDocumentSnapshot eller { id, data }) → Pokal[], nyast först. */
export function normaliseraPokaler(docs = []) {
  return [...docs]
    .map((s) => normaliseraPokal(s.id, typeof s.data === "function" ? s.data() : s.data))
    .sort((a, b) => (b.wonAt || 0) - (a.wonAt || 0) || a.id.localeCompare(b.id));
}

const DATUM = new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "long", year: "numeric" });

/** Hover-rutans innehåll (spec §6). */
export function pokalTooltip(pokal) {
  const p = pokal || {};
  const t = pokaltyp(p.typ);
  const brod = t ? (t.tooltip ? t.tooltip(p.detalj || "") : t.text) : "";
  return {
    rubrik: p.titel || t?.titel || "Pokal",
    text: brod || "",
    detalj: p.detalj || "",
    datum: p.wonAt ? DATUM.format(new Date(p.wonAt)) : "",
  };
}

// ---------------------------------------------------------------------------
// Inbyggda typer. vinnare() speglar kcPokalVerifierad i firestore.rules.
// ---------------------------------------------------------------------------

function avslutad(k) {
  return k?.status === "finished" && k.result && typeof k.result === "object";
}

// Klasskampen: result.winnerClass + result.winnerClasses (mm-teacher-core
// buildResult – klassen/klasserna med högst rätt/elev, tom om ingen svarat
// rätt). OAVGJORT (#495): delad förstaplats → ALLA delade vinnare får pokalen.
// Äldre result utan winnerClasses → bara winnerClass.
export function mmVinnare(k) {
  if (!avslutad(k)) return [];
  const delade = Array.isArray(k.result.winnerClasses) ? k.result.winnerClasses : [];
  return [...new Set([k.result.winnerClass, ...delade])].filter((c) => typeof c === "string" && c);
}

registreraPokaltyp({
  id: "mm-klasskamp",
  kalla: "mattematchen",
  titel: "Mattematchens mästare",
  text: "Vinnare av Mattematchen! Klassen kämpade stenhårt tillsammans.",
  art: "pokal-mm",
  vinnare: mmVinnare,
});

function liveSpelare(k, classId) {
  return Number(k?.result?.perClass?.[classId]?.players) || 0;
}
function liveDeltar(k, classId) {
  return Array.isArray(k?.participatingClassIds) && k.participatingClassIds.includes(classId) &&
    liveSpelare(k, classId) > 0;
}

// Live-vinst: TÄVLINGSLÄGEN – result.winner (live-core buildResult; "draw" =
// ingen vinnare). Ett kooperativt läge (result.cooperative) ger ingen vinst.
registreraPokaltyp({
  id: "live-vinst",
  kalla: "live",
  titel: "Live-segrare",
  text: "Klassen vann Live-matchen! Alla räknade för fullt – och det lönade sig.",
  art: "pokal-live",
  vinnare(k) {
    const w = avslutad(k) && k.result.cooperative !== true ? k.result.winner : null;
    return w && w !== "draw" && liveDeltar(k, w) ? [w] : [];
  },
});

// Liveläge avklarat: KOOPERATIVA lägen (GameMode.cooperative, #495) där målet
// nåddes (result.goalReached) → varje deltagande klass med minst en spelare.
// I dag finns bara tävlingslägen → delas inte ut förrän ett sådant läge finns.
registreraPokaltyp({
  id: "live-avklarat",
  kalla: "live",
  titel: "Liveläge avklarat",
  text: "Klassen klarade ett Liveläge tillsammans!",
  art: "pokal-live-klar",
  vinnare: (k) => (avslutad(k) && k.result.goalReached === true
    ? Object.keys(k.result.perClass || {}).filter((c) => liveDeltar(k, c)) : []),
});
