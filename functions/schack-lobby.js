// ============================================================================
// Schack på SERVERN – lobbyn (functions/schack-lobby.js, #779; spec §6–§7.1)
// ----------------------------------------------------------------------------
// Allt i schackKlass/{classId} skrivs här, i EN transaktion per anrop med
// klassdokumentet som lås: "bara ett parti åt gången per elev" håller även
// när två anrop (gaMed/svara) kommer samtidigt – det andra ser partiet och
// nekas. Över klasser (en elev i två klasser med schack, F2) håller spärren
// studentData/{uid}.schack.aktivtParti, som läses i samma transaktion innan
// partiet skapas och sätts när det skapas (avslutaParti tar bort den).
// Varje skrivning rensar utgångna poster (väntan 10 min, utmaning 2 min –
// rensaLobby) och avbryter gamla partier (24 h utan drag, stadaGamla); ett
// anrop som inte ändrar något skriver inte (varje skrivning = en läsning per
// öppen lobby). Inga skrivningar per sekund, ingen närvaro-ping, ingen
// schemalagd funktion. Alla uppslag med klientstyrd nyckel går via post() (F1).
//
//   vanta       { classId, klocka: null|5|10|15 } → { klocka }
//               tar bort egen gammal väntan och egna utmaningar först
//   slutaVanta  { classId? } → { borttagen }  (utan classId: alla elevens klasser)
//   gaMed       { classId, motstandare } → { partiId, farg }   motståndaren väntar
//   utmana      { classId, till, klocka } → { utmaningId }     en utmaning i taget
//   svara       { utmaningId, ja, classId? } → { partiId, farg } | { partiId: null }
// Färgen slumpas (crypto). Namnen tas ur classProjections (EN läsning).
// ============================================================================

import {
  SchackFel, KLASS_COLL, PARTI_COLL, ctx, idEller, klassData, hamtaKlassForElev, klassIdsForElev, namnFor, nyttParti,
  aktivtPartiFor, post,
} from "./schack-state.js";
import { arGammalt, normaliseraKlocka, partiFor, rensaLobby } from "./schack/schack-server-delat.js";
import { avslutaParti } from "./schack-parti.js";

export { SchackFel };

const lika = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Transaktionen runt ett lobbyanrop: grinden (klassmedlem, modul, fokus) läses
 * först, sedan klassdokumentet i transaktionen; utgångna poster rensas, gamla
 * partier avbryts och spärren aktivtParti läses för `spelare` – allt FÖRE
 * skrivningarna. `fn(st)` ändrar st.klass och får göra tx.set på nya dokument;
 * till sist skrivs klassdokumentet om det ändrats.
 */
async function lobbyTx(c, uid, classId, spelare, fn) {
  const klassInfo = await hamtaKlassForElev(c.db, uid, classId, c.now());
  const ref = c.db.collection(KLASS_COLL).doc(classId);
  return c.db.runTransaction(async (tx) => {
    const fore = klassData(await tx.get(ref));
    const nu = c.now();
    const lobby = rensaLobby(fore, nu);
    const st = { tx, ref, classId, klassInfo, nu, uid, klass: { ...fore, vantar: lobby.vantar, utmaningar: lobby.utmaningar }, aktivt: {} };
    const gamla = await lasGamla(c, st);
    for (const s of spelare) st.aktivt[s] = await aktivtPartiFor(c.db, s, (r) => tx.get(r));
    stadaGamla(c, st, gamla);
    const res = await fn(st);
    if (!lika(st.klass, fore)) tx.set(ref, st.klass);
    return res;
  });
}

/** 24 h-städningen, läsdelen: partier vars start ligger > 24 h tillbaka (sällan några). */
async function lasGamla(c, st) {
  const gamla = Object.entries(st.klass.partier).filter(([, p]) => p && arGammalt(Number(p.start) || 0, st.nu));
  const snaps = await Promise.all(gamla.map(([id]) => st.tx.get(c.db.collection(PARTI_COLL).doc(id))));
  return gamla.map(([id], i) => [id, snaps[i]]);
}

/**
 * 24 h-städningen (§7.3, valet i docs/SCHACK.md): ett gammalt parti utan drag på
 * 24 h avbryts (ingen tabell); en post utan dokument eller med slutat parti tas bort.
 */
function stadaGamla(c, st, gamla) {
  for (const [partiId, snap] of gamla) {
    const parti = snap.exists ? snap.data() : null;
    if (parti && parti.status === "pagar" && !arGammalt(parti.senastDragAt, st.nu)) continue;
    const partier = { ...st.klass.partier };
    delete partier[partiId];
    st.klass = { ...st.klass, partier };
    if (parti && parti.status === "pagar") {
      avslutaParti(st.tx, { db: c.db, partiRef: snap.ref, parti, klassRef: st.ref, klass: st.klass, resultat: null, orsak: "avbrutet", nu: st.nu });
    }
  }
}

/** "Ett parti åt gången": i den här klassen (partier-mappen) och över klasser (aktivtParti). */
function kravIngetParti(st, uid, vem = "Du") {
  if (partiFor(st.klass.partier, uid) || st.aktivt[uid]) {
    throw new SchackFel("failed-precondition", `${vem} spelar redan ett parti.`);
  }
}

const utanEgna = (utmaningar, uid) => Object.fromEntries(Object.entries(utmaningar).filter(([, u]) => u.fran !== uid));
const utanSpelare = (utmaningar, a, b) =>
  Object.fromEntries(Object.entries(utmaningar).filter(([, u]) => ![a, b].includes(u.fran) && ![a, b].includes(u.till)));

/** Starta ett parti mellan a och b i transaktionen: färg slumpas, båda lämnar lobbyn, spärren sätts. */
function startaParti(c, st, a, b, klocka, namn) {
  const partiId = c.rid(20);
  const vit = c.rng() < 0.5 ? a : b;
  const svart = vit === a ? b : a;
  const { doc, post: p } = nyttParti({ classId: st.classId, vit, svart, namn, klocka, nu: st.nu });
  st.tx.set(c.db.collection(PARTI_COLL).doc(partiId), doc);
  for (const s of [a, b]) st.tx.set(c.db.collection("studentData").doc(s), { schack: { aktivtParti: partiId } }, { merge: true });
  const vantar = { ...st.klass.vantar };
  delete vantar[a];
  delete vantar[b];
  st.klass = {
    ...st.klass, vantar, utmaningar: utanSpelare(st.klass.utmaningar, a, b), partier: { ...st.klass.partier, [partiId]: p },
  };
  return { partiId, farg: vit === st.uid ? "w" : "b", vit, svart };
}

function klockaEller(v) {
  const k = normaliseraKlocka(v);
  if (k === undefined) throw new SchackFel("invalid-argument", "Klockan måste vara ingen, 5, 10 eller 15 minuter.");
  return k;
}

export async function vanta(deps, uid, data = {}) {
  const c = ctx(deps);
  const klocka = klockaEller(data.klocka);
  const classId = idEller(data.classId, "klass-id");
  const namn = await namnFor(c.db, classId, [uid]);
  return lobbyTx(c, uid, classId, [uid], (st) => {
    kravIngetParti(st, uid);
    st.klass = {
      ...st.klass,
      vantar: { ...st.klass.vantar, [uid]: { namn: namn[uid], klocka, sedan: st.nu } },
      utmaningar: utanEgna(st.klass.utmaningar, uid),
    };
    return { klocka };
  });
}

export async function slutaVanta(deps, uid, data = {}) {
  const c = ctx(deps);
  const classIds = data.classId != null ? [idEller(data.classId, "klass-id")] : await klassIdsForElev(c.db, uid);
  let borttagen = false;
  for (const classId of classIds) {
    const r = await lobbyTx(c, uid, classId, [], (st) => {
      const fanns = Boolean(post(st.klass.vantar, uid));
      const vantar = { ...st.klass.vantar };
      delete vantar[uid];
      st.klass = { ...st.klass, vantar, utmaningar: utanEgna(st.klass.utmaningar, uid) };
      return fanns;
    }).catch((e) => {
      // Utan classId: en klass utan schack eller med fokusläge hoppas över.
      if (data.classId == null && e instanceof SchackFel) return false;
      throw e;
    });
    borttagen = borttagen || r;
  }
  return { borttagen };
}

export async function gaMed(deps, uid, data = {}) {
  const c = ctx(deps);
  const classId = idEller(data.classId, "klass-id");
  const motst = idEller(data.motstandare, "motståndar-id");
  if (motst === uid) throw new SchackFel("invalid-argument", "Du kan inte spela mot dig själv.");
  const namn = await namnFor(c.db, classId, [uid, motst]);
  return lobbyTx(c, uid, classId, [uid, motst], (st) => {
    const v = post(st.klass.vantar, motst);
    if (!v || !st.klassInfo.studentIds.includes(motst)) throw new SchackFel("failed-precondition", "Den kompisen väntar inte längre.");
    kravIngetParti(st, uid);
    kravIngetParti(st, motst, "Kompisen");
    const { partiId, farg } = startaParti(c, st, motst, uid, normaliseraKlocka(v.klocka) ?? null, namn);
    return { partiId, farg };
  });
}

export async function utmana(deps, uid, data = {}) {
  const c = ctx(deps);
  const classId = idEller(data.classId, "klass-id");
  const till = idEller(data.till, "mottagar-id");
  const klocka = klockaEller(data.klocka);
  if (till === uid) throw new SchackFel("invalid-argument", "Du kan inte utmana dig själv.");
  const namn = await namnFor(c.db, classId, [uid]);
  return lobbyTx(c, uid, classId, [uid, till], (st) => {
    if (!st.klassInfo.studentIds.includes(till)) throw new SchackFel("invalid-argument", "Kompisen går inte i klassen.");
    kravIngetParti(st, uid);
    kravIngetParti(st, till, "Kompisen");
    const utmaningId = c.rid(12);
    st.klass = {
      ...st.klass,
      utmaningar: { ...utanEgna(st.klass.utmaningar, uid), [utmaningId]: { fran: uid, franNamn: namn[uid], till, klocka, sedan: st.nu } },
    };
    return { utmaningId };
  });
}

/** Klassen där utmaningen ligger – ur data.classId eller elevens klasser. */
async function klassForUtmaning(c, uid, data, utmaningId) {
  if (data.classId != null) return idEller(data.classId, "klass-id");
  for (const classId of await klassIdsForElev(c.db, uid)) {
    const snap = await c.db.collection(KLASS_COLL).doc(classId).get();
    if (snap.exists && post(snap.data().utmaningar, utmaningId)) return classId;
  }
  throw new SchackFel("not-found", "Utmaningen finns inte längre.");
}

export async function svara(deps, uid, data = {}) {
  const c = ctx(deps);
  const utmaningId = idEller(data.utmaningId, "utmanings-id");
  const ja = data.ja === true;
  const classId = await klassForUtmaning(c, uid, data, utmaningId);
  const fore = await c.db.collection(KLASS_COLL).doc(classId).get();
  const u0 = fore.exists ? post(fore.data().utmaningar, utmaningId) : null;
  const fran = typeof u0?.fran === "string" ? u0.fran : null;
  if (!fran || u0.till !== uid) throw new SchackFel("not-found", "Utmaningen finns inte längre.");
  const namn = ja ? await namnFor(c.db, classId, [uid, fran]) : {};
  return lobbyTx(c, uid, classId, ja ? [uid, fran] : [], (st) => {
    const u = post(st.klass.utmaningar, utmaningId);
    if (!u || u.till !== uid) throw new SchackFel("not-found", "Utmaningen finns inte längre.");
    if (u.fran !== fran) throw new SchackFel("aborted", "Utmaningen ändrades – försök igen.");
    const utmaningar = { ...st.klass.utmaningar };
    delete utmaningar[utmaningId];
    st.klass = { ...st.klass, utmaningar };
    if (!ja) return { partiId: null, farg: null };
    kravIngetParti(st, uid);
    kravIngetParti(st, fran, "Kompisen");
    const { partiId, farg } = startaParti(c, st, fran, uid, normaliseraKlocka(u.klocka) ?? null, namn);
    return { partiId, farg };
  });
}
