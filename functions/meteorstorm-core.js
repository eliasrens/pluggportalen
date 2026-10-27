// ============================================================================
// Pluggporten – METEORSTORMEN på SERVERN (functions/meteorstorm-core.js, #821)
// ----------------------------------------------------------------------------
// Servern avgör allt som påverkar stormen: rättningen, energin, handlingarna
// (med serverns tid) och slutresultatet. Klienten skriver ALDRIG i ms-samlingarna
// (firestore.rules). index.js kör funktionerna med Admin SDK:t injicerat, så
// kärnan testas direkt mot Firestore-emulatorn med styrd klocka.
// Kontraktet: docs/METEORSTORMEN.md §7–§9. Motorn: ./meteorstorm/ (kopia av
// src/live/formats/meteorstorm/delat/). Delarna: -sess.js (sessionen, minnet,
// länken), -ratta.js (rättningen, msRatta), -status.js (loggen, msPublic/status),
// -resultat.js (slutet), -mynt.js (pluggmynten).
//
// ANROPEN (Elias 2026-10-21: svar och handling i ETT anrop, EN skrivning)
//   agera   msAgera({ sid, attemptId, svar, typ, mal?, fel?, nr? })
//           svar = { k, factorA, factorB, answer, choiceIndex? } (multiplikation)
//                | { k, q, choiceIndex } | { k, q, year } (quiz) – k = elevens fråga nr k
//           typ  = "skold" | "laser" | "drag" | "spara"
//           Rätt svar → EN händelse msEvents/{uid}_{nr} med svaret, de buffrade
//           fel svaren (fel[]) och handlingen. Varje k mellan förra länkens k och
//           svarets måste finnas i fel[] (#821 F2). En nekad handling (väntetid,
//           dragstrålen inte redo, för lite energi) sparas som "spara" – energin
//           går aldrig förlorad. Fel svar (servern rättar om) skriver ingenting.
//           → { correct, nr, typ, energi, vinst, kostnad, handelse, effekt, k,
//               onskad?, nekad?, redoMs?, igen?, status }
//           Utan svar: msAgera({ sid, fel, nr? }) skickar bara felbufferten:
//             under matchen  minst MS_FEL_SKICKA fel svar i följd → en länk med
//                            typ "fel" i kedjan (ingen handling; #821 F3)
//             efter slutet   EN gång per elev → msPlayers/{uid}.fel (≤ MS_FEL_TAK)
//   ratta   msRatta – se meteorstorm-ratta.js (bara quiz, skriver ingenting)
//   lage    msLage({ sid }) → { nr, energi, k, status } – elevens läge efter omladdning
//   avsluta msAvsluta({ sid }) – lärare (när som helst; live → avslutas nu) eller
//           deltagare efter slutet. Kör motorn med HELA loggen, sparar result,
//           msPlayers-totalerna och sista msPublic/status. Idempotent.
//
// ENERGIN: varje händelse bär elevens energi EFTER handlingen. Händelserna
// bildar en kedja per elev (id {uid}_{nr}, nr = 1, 2 …): nästa handling läser
// bara föregående länk i transaktionen – ingen skrivning per svar i msPlayers.
// Två samtidiga anrop krockar på samma länk; den ena får nästa nr och kör om.
// Länken ger också spärren MS_MIN_GAP_MS och k-ordningen. Idempotens: samma
// attemptId igen → samma svar, även efter senare handlingar (k ≤ länkens k
// slås upp på attemptId, #821 F4).
//
// DRAGSTRÅLEN: kanAgera körs i SAMMA transaktion som händelsen skrivs, mot
// loggen + stationens låsdokument msLas/{classId} (senaste dragstrålen), som
// transaktionen läser och skriver. Två dragstrålar samtidigt från samma
// station krockar där – den andra ser den första och nekas ("armerad").
//
// deps = { db, FieldValue, Timestamp, now(), sleep?(ms), minne?, roll?(auth) }
// ============================================================================

import { KsError, yearOut } from "./kistspel-rattning.js";
import { matchWindow } from "./kistspel-core.js";
import { kanAgera, energiEffekt, effektPerTryck } from "./meteorstorm/ms-agera.js";
import { ENERGI_TAK, HANDLINGAR, RENDER_FORDROJNING_MS } from "./meteorstorm/ms-balans.js";
import {
  MS_MIN_GAP_MS, MS_EFTER_SLUT_MS, MS_AVSLUTA_VANTA_MS, MS_TYPER, MS_FEL_SKICKA, MS_FEL_TAK, MS_K_FONSTER,
  MS_K_TAKT_MS, MS_K_RUM, MS_K_START, MS_FEL_LANK_MS,
} from "./meteorstorm/ms-anrop.js";
import {
  refs, parseSid, parseAttempt, sessionFor, slutFor, assertLive, playerFor, quizFor,
  stationerFor, stationerOk, raknaStationer, cfgFor, bad, isInt, fel, senaste, minnsLank, QUIZ,
} from "./meteorstorm-sess.js";
import { rattaSvar, rattaFel, svarsFalt, ratta } from "./meteorstorm-ratta.js";
import { uppdateraLogg, laggTillLogg, somHandling, statusFran, statusUrMinnet, kanskeStatus } from "./meteorstorm-status.js";
import { byggResultat } from "./meteorstorm-resultat.js";

export { KsError, ratta };
export { nyttMinne } from "./meteorstorm-sess.js";

const OMSYNK = Symbol("omsynk");
const GAMMAL = Symbol("gammal");
const finnsRedan = (err) => err?.code === 6 || err?.code === "already-exists" || /ALREADY_EXISTS/.test(String(err?.message || ""));

function parseMal(v, s, egen) {
  if (v == null) return null;
  if (typeof v !== "string" || v === egen || !(s.participatingClassIds || []).includes(v)) throw bad("Ogiltigt mål för dragstrålen.");
  return v;
}

function utFran(h, extra = {}) {
  if (h.typ === "fel") return { ok: true, fel: (h.fel || []).length, nr: h.nr, k: h.k, ...extra };
  return {
    correct: true, nr: h.nr, typ: h.typ, energi: h.energi, vinst: h.vinst, kostnad: h.kostnad, handelse: h.handelse ?? null,
    ...(h.onskad ? { onskad: h.onskad, nekad: h.nekad } : {}),
    ...(h.redoMs != null ? { redoMs: h.redoMs } : {}),
    ...(Number.isInteger(h.k) ? { k: h.k } : {}),
    ...extra,
  };
}

/** Efter slutet: felbufferten EN gång per elev → msPlayers/{uid}.fel. */
async function felEfterSlut(deps, sid, s, uid, p, felLista) {
  const r = refs(deps.db, sid);
  if (!felLista.length) return { ok: true, fel: 0 };
  return deps.db.runTransaction(async (tx) => {
    const d = await tx.get(r.msPlayer(uid));
    if (d.exists) throw new KsError("already-exists", "Dina svar är redan skickade.");
    tx.set(r.msPlayer(uid), { uid, classId: p.classId, name: p.name, fel: felLista.slice(0, MS_FEL_TAK) });
    return { ok: true, fel: Math.min(felLista.length, MS_FEL_TAK) };
  });
}

/**
 * k-ordningen (#821 F2): svaret (eller bufferten) får ligga högst MS_K_FONSTER
 * efter länkens k, och varje överhoppat k måste vara ett fel svar i fel[].
 * → fel[] utan poster för redan besvarade k.
 */
function kontrolleraK(prevK, k, felLista) {
  if (k <= prevK) throw GAMMAL;
  if (k > prevK + MS_K_FONSTER) throw fel("failed-precondition", "Svara på frågorna i ordning.", { omsynk: true, k: prevK });
  const har = new Set(felLista.map((f) => f.k));
  for (let i = prevK + 1; i < k; i++) {
    if (!har.has(i)) throw fel("failed-precondition", "Svaren kom i fel ordning.", { omsynk: true, k: prevK });
  }
  return felLista.filter((f) => f.k > prevK && f.k < k);
}

/**
 * Takten (#821 N2/N3): hinken i länken fylls med en fråga per MS_K_TAKT_MS
 * (högst MS_K_RUM) och töms med k-steget. → kRum efter länken.
 */
function takt(s, prev, t, steg) {
  const fore = prev && Number.isFinite(prev.kRum)
    ? Math.min(MS_K_RUM, prev.kRum + (t - prev.t) / MS_K_TAKT_MS)
    : Math.min(MS_K_RUM, (t - (matchWindow(s)?.t0 ?? t)) / MS_K_TAKT_MS + MS_K_START);
  const kRum = fore - steg;
  if (kRum < 0) throw fel("resource-exhausted", "Lugn i stormen – ett svar i taget!", { vantaMs: Math.ceil(-kRum * MS_K_TAKT_MS) });
  return Math.round(kRum * 1000) / 1000;
}

/** Energi, väntetid, dragstråle → handlingens fält. */
function beslut({ cfg, t, prev, typ, mal, p, logg, senastDrag }) {
  const eff = energiEffekt(cfg, t);
  const fore = Number(prev?.energi) || 0;
  let kostnad = 0;
  let nekad = null;
  let redoMs = null;
  if (typ !== "spara") {
    let input = cfg;
    if (logg) {
      const lista = [...logg.lista.values()];
      if (senastDrag?.id && !logg.lista.has(senastDrag.id)) lista.push(somHandling(senastDrag.id, senastDrag));
      input = { ...cfg, handlingar: lista };
    }
    const ka = kanAgera(input, t, p.classId, typ);
    if (!ka.ok) {
      nekad = ka.orsak;
      redoMs = ka.redoMs ?? null;
    } else if (fore + eff.energi < ka.kostnad) {
      nekad = "energi";
    } else {
      kostnad = ka.kostnad;
    }
  }
  const utfort = nekad ? "spara" : typ;
  return {
    typ: utfort, energi: Math.min(ENERGI_TAK, fore + eff.energi - kostnad), vinst: eff.energi, kostnad, handelse: eff.handelse,
    ...(utfort === "drag" && mal ? { mal } : {}),
    ...(nekad ? { onskad: typ, nekad } : {}),
    ...(redoMs != null ? { redoMs } : {}),
  };
}

export async function agera(deps, uid, raw) {
  const sid = parseSid(raw);
  const s = await sessionFor(deps, sid);
  const p = await playerFor(deps, sid, uid, s);
  const nu = deps.now();
  const w = matchWindow(s);
  if (raw?.svar == null) {
    if (!w || nu < w.t0 || nu > slutFor(s) + MS_EFTER_SLUT_MS) throw new KsError("failed-precondition", "Matchen pågår inte.");
    const felLista = await rattaFel(deps, sid, s, uid, raw?.fel);
    if (s.status !== "live" || nu >= w.end) return felEfterSlut(deps, sid, s, uid, p, felLista);
    if (felLista.length < MS_FEL_SKICKA) throw new KsError("failed-precondition", "Skicka svaren tillsammans med nästa rätta svar.");
    return kedja(deps, sid, s, uid, p, raw, { felLista });
  }
  assertLive(s, nu);
  const typ = raw?.typ;
  if (!MS_TYPER.includes(typ)) throw bad("Välj sköld, laser, dragstråle eller spara.");
  const mal = typ === "drag" ? parseMal(raw?.mal, s, p.classId) : null;
  const attemptId = parseAttempt(raw);
  const { k, graded } = await rattaSvar(deps, sid, s, uid, raw.svar);
  if (!graded.isCorrect) {
    // Fel svar påverkar inte spelet och skrivs inte – klienten buffrar det.
    return { correct: false, correctAnswer: graded.correctAnswer, ...yearOut(graded), k };
  }
  const felLista = await rattaFel(deps, sid, s, uid, raw?.fel);
  return kedja(deps, sid, s, uid, p, raw, { felLista, k, graded, typ, mal, attemptId });
}

/** Nästa länk i elevens kedja: en handling (svar) eller en felbuffert (typ "fel"). */
async function kedja(deps, sid, s, uid, p, raw, { felLista, k = null, graded = null, typ = "fel", mal = null, attemptId = null }) {
  const { db, FieldValue } = deps;
  const arFel = typ === "fel";
  const kMax = arFel ? Math.max(...felLista.map((f) => f.k)) : k;
  const forsokId = attemptId || `fel-${kMax}`;
  await stationerFor(deps, sid, s);
  const cfg = cfgFor(s);
  const r = refs(db, sid);
  const logg = typ === "drag" ? await uppdateraLogg(deps, sid) : null;
  const statusNu = () => statusUrMinnet(deps, sid, cfg, deps.now());
  let nr = isInt(raw?.nr, 1, 1_000_000) ? raw.nr : null;
  let gissat = nr != null; // klientens nr – länken före kan vara en gammal
  for (let forsok = 0; forsok < 4; forsok++) {
    if (nr == null) {
      nr = ((await senaste(deps, sid, uid))?.nr || 0) + 1;
      gissat = false;
    }
    const id = `${uid}_${nr}`;
    const prevRef = nr > 1 ? r.ev(uid, nr - 1) : null;
    const lasRef = logg ? r.las(p.classId) : null;
    try {
      const ut = await db.runTransaction(async (tx) => {
        const las = [prevRef, lasRef].filter(Boolean);
        const snaps = las.length ? await tx.getAll(...las) : [];
        const prevSnap = prevRef ? snaps[0] : null;
        const lasSnap = lasRef ? snaps[snaps.length - 1] : null;
        if (prevRef && !prevSnap.exists) throw OMSYNK;
        const prev = prevSnap ? prevSnap.data() : null;
        if (prev && prev.attemptId === forsokId) return { igen: prev };
        const t = Number(deps.now());
        assertLive(s, t);
        if (prev && t - prev.t < MS_MIN_GAP_MS) {
          throw fel("resource-exhausted", "Lugn i stormen – ett svar i taget!", { vantaMs: MS_MIN_GAP_MS - (t - prev.t) });
        }
        const prevK = Number.isInteger(prev?.k) ? prev.k : -1;
        const felHar = arFel ? felLista.filter((f) => f.k > prevK) : kontrolleraK(prevK, k, felLista);
        if (arFel) {
          if (felHar.length < MS_FEL_SKICKA) throw new KsError("failed-precondition", "Skicka svaren tillsammans med nästa rätta svar.");
          kontrolleraK(prevK, kMax + 1, felHar);
          if (prev && t - prev.t < MS_FEL_LANK_MS) {
            throw fel("resource-exhausted", "Skicka svaren tillsammans med nästa rätta svar.", { vantaMs: MS_FEL_LANK_MS - (t - prev.t) });
          }
        }
        const kRum = takt(s, prev, t, kMax - prevK);
        const b = arFel
          ? { typ: "fel", energi: Number(prev?.energi) || 0, vinst: 0, kostnad: 0, handelse: null }
          : beslut({ cfg, t, prev, typ, mal, p, logg, senastDrag: lasSnap?.exists ? lasSnap.data() : null });
        const h = {
          uid, classId: p.classId, namn: p.name, nr, attemptId: forsokId, t, ...b, k: kMax, kRum,
          ...(graded ? { svar: svarsFalt(graded, k, null) } : {}), fel: felHar, at: FieldValue.serverTimestamp(),
        };
        tx.create(r.ev(uid, nr), h);
        if (h.typ === "drag") tx.set(lasRef, { id, t, classId: p.classId, uid, typ: "drag", ...(mal ? { mal } : {}) });
        return { ny: h };
      });
      if (ut.igen) return utFran(ut.igen, { igen: true, status: statusNu() });
      const h = ut.ny;
      minnsLank(deps, sid, uid, h);
      if (HANDLINGAR.includes(h.typ)) laggTillLogg(deps, sid, id, h);
      const skrev = await kanskeStatus(deps, sid, s, deps.now()).catch(() => null);
      const effekt = h.typ === "skold" || h.typ === "laser" ? { [h.typ]: effektPerTryck(cfg, p.classId)[h.typ] } : null;
      return utFran(h, { ...(arFel ? {} : { effekt }), status: skrev || statusNu() });
    } catch (err) {
      if (err === OMSYNK) {
        nr = null;
        continue;
      }
      if (err === GAMMAL) return gammalt(deps, sid, uid, forsokId, statusNu);
      if (gissat && err?.details?.omsynk) {
        // k-ordningen prövades mot klientens nr: slå upp den verkliga länken först.
        nr = null;
        continue;
      }
      if (finnsRedan(err)) {
        const d = (await r.ev(uid, nr).get()).data();
        if (d?.attemptId === forsokId) return utFran(d, { igen: true, status: statusNu() });
        nr = null;
        continue;
      }
      throw err;
    }
  }
  throw new KsError("aborted", "Många svar samtidigt – försök igen.");
}

/** k redan passerat: samma attemptId finns → samma svar (F4), annars nekat. */
async function gammalt(deps, sid, uid, attemptId, statusNu) {
  const snap = await refs(deps.db, sid).events.where("uid", "==", uid).where("attemptId", "==", attemptId).get();
  if (!snap.empty) return utFran(snap.docs[0].data(), { igen: true, status: statusNu() });
  throw fel("failed-precondition", "Den frågan är redan besvarad.", { omsynk: true });
}

export async function lage(deps, uid, raw) {
  const sid = parseSid(raw);
  const s = await sessionFor(deps, sid);
  await playerFor(deps, sid, uid, s);
  const h = await senaste(deps, sid, uid);
  if (h) minnsLank(deps, sid, uid, h);
  let status = statusUrMinnet(deps, sid, cfgFor(s), deps.now());
  if (!status) status = (await refs(deps.db, sid).status.get()).data() || null;
  if (status?.uppdaterad) delete status.uppdaterad;
  return { nr: h?.nr || 0, energi: h?.energi || 0, k: Number.isInteger(h?.k) ? h.k : -1, status };
}

/** Läraren som styr matchen (samma som reglernas liveTeacherOf). */
function larareFor(roll, s) {
  if (!roll) return false;
  if (roll.role === "admin") return true;
  return (s.participatingClassIds || []).some((c) => (roll.classIds || []).includes(c));
}

/** msAvsluta. deps.roll(auth) = callerRole (index.js) – null för elever. → { result, redan } */
export async function avsluta(deps, auth, raw) {
  const { db, FieldValue, Timestamp } = deps;
  const sid = parseSid(raw);
  const r = refs(db, sid);
  let s = await sessionFor(deps, sid, { farsk: true });
  const w = matchWindow(s);
  if (!w) throw new KsError("failed-precondition", "Matchen har inte startat.");
  if (s.result) return { result: s.result, redan: true };
  if (!larareFor(deps.roll ? await deps.roll(auth) : null, s)) {
    await playerFor(deps, sid, auth?.uid, s);
    if (s.status !== "finished" && deps.now() < w.end) throw new KsError("failed-precondition", "Stormen pågår fortfarande.");
  }
  if (s.status !== "finished") {
    const now = deps.now();
    await db.runTransaction(async (tx) => {
      if ((await tx.get(r.sess)).data().status !== "finished") tx.update(r.sess, { status: "finished", finishedAt: Timestamp.fromMillis(now) });
    });
    s = await sessionFor(deps, sid, { farsk: true });
  }
  const slut = slutFor(s);
  // De sista felbuffrarna (elevskärmarna skickar dem när de ser slutet).
  const vanta = Math.min(MS_AVSLUTA_VANTA_MS, slut + MS_AVSLUTA_VANTA_MS - deps.now());
  if (vanta > 0) await (deps.sleep || ((ms) => new Promise((res) => setTimeout(res, ms))))(vanta);

  const [evSnap, mpSnap, plSnap] = await Promise.all([r.events.get(), r.msPlayers.get(), r.players.get()]);
  const players = plSnap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  if (!stationerOk(s)) s = { ...s, msStationer: raknaStationer(s, players) };
  const cfg = cfgFor(s);
  const events = evSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const { result, spelare } = byggResultat({
    s, cfg, slutMs: slut, events, players,
    extraFel: Object.fromEntries(mpSnap.docs.map((d) => [d.id, d.data().fel || []])),
    questions: s.gameMode === QUIZ ? (await quizFor(deps, sid)).pub.questions || [] : null,
  });
  const handlingar = events.filter((h) => HANDLINGAR.includes(h.typ) && h.t <= slut).map((h) => somHandling(h.id, h));
  const slutStatus = {
    ...statusFran(cfg, handlingar, Math.max(slut, cfg.startMs) + RENDER_FORDROJNING_MS),
    klart: true,
    resultat: {
      lage: result.lage, winner: result.winner, draw: result.draw, placering: result.placering,
      ...(result.lage === "en-klass" ? { stjarnor: result.stjarnor, overlevde: result.overlevde } : {}),
    },
  };
  return db.runTransaction(async (tx) => {
    const d = (await tx.get(r.sess)).data();
    if (d.result) return { result: d.result, redan: true };
    tx.update(r.sess, {
      result: { ...result, computedAt: FieldValue.serverTimestamp() },
      ...(stationerOk(d) ? {} : { msStationer: s.msStationer }),
    });
    // Utan merge (#821 F5): felbufferten är inräknad i totalerna och följer inte med.
    for (const [id, tot] of Object.entries(spelare)) tx.set(r.msPlayer(id), { ...tot, klar: true });
    tx.set(r.status, { ...slutStatus, uppdaterad: FieldValue.serverTimestamp() });
    return { result, redan: false };
  });
}
