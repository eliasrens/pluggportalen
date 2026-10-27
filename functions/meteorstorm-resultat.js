// ============================================================================
// Meteorstormen på SERVERN – SLUTET ur loggen (functions/meteorstorm-resultat.js, #821)
// ----------------------------------------------------------------------------
// Ren logik utan Firestore: msAvsluta (meteorstorm-core.js) läser hela loggen
// (msEvents), de sista felbuffrarna (msPlayers.fel) och spelarna, och låter
// den här filen räkna fram result + varje elevs totaler. Motorn körs med HELA
// loggen – serverns resultat gäller (Elias 2026-10-21: totalerna räknas här,
// inte vid varje svar). Testas i test/live-meteorstorm-server.test.js.
//
// byggResultat({ s, cfg, slutMs, events, extraFel?, players?, questions? })
//   s          sessionen (participatingClassIds, classNames, rewards, gameMode)
//   cfg        motorns indata utan handlingar ({ seed, startMs, varaktighetMs,
//              stationer, installningar })
//   slutMs     när matchen tog slut (ordinarie slut, eller lärarens avslut)
//   events     msEvents-dokumenten [{ id, t, classId, uid, namn, typ, mal?, energi,
//              nekad?, svar, fel[] }] – handlingar efter slutMs räknas inte;
//              typ "fel" = bara en felbuffert (inget rätt svar)
//   extraFel   { uid: [felsvar] } – msPlayers/{uid}.fel (bufferten som skickades i slutet)
//   players    kärnans spelare [{ uid, classId, name }] (deltagare utan handling)
//   questions  quizets elevsynliga frågor (texten i perQuestion) | null
// → { result, spelare: { uid: msPlayers-totalerna } }
//
// result = { format: "meteorstorm", lage, winner (classId | null), draw, placering,
//   stjarnor?, overlevde?, startMs, slutMs, players, totalCorrect, totalAnswered,
//   handlingar { skold, laser, drag, spara }, nekade,
//   perClass { classId: { name, players, aktiva, skrov, skold, nedskjutna, traffar,
//     kastade, handlingar, correct, answered, ogonblick[] } },
//   ranking [{ uid, name, classId, correct, answered, handlingar, bidrag, rank }],
//   perQuestion [{ index, key, text, answered, correct, statKeys, byClass }],
//   rewards? { uid: { rank, correct, prize, correctCoins, total } } }
// ogonblick (bästa ögonblicken per klass, C:s slutruta – bara det som är bra):
//   { typ: "nedskjutna"|"sista"|"skold"|"kast", uid, namn, antal?, t? }
//   nedskjutna = flest nedskjutna meteorer, sista = sista sköld/laser före slutet
//   (bara om stationen klarade sig), skold = flest sköldtryck, kast = flest kast.
// ============================================================================

import { simulera, buildResultat } from "./meteorstorm/ms-motor.js";
import { HANDLINGAR } from "./meteorstorm/ms-balans.js";
import { sessionRewards, placementPrize, perCorrectCoins, msPlats } from "./meteorstorm-mynt.js";

export const MAX_QUESTIONS = 150;
const SISTA_FONSTER_MS = 30_000;
const MULT = "multiplication_0_10";

const typerNoll = () => Object.fromEntries(HANDLINGAR.map((t) => [t, 0]));
const bidragNoll = () => ({ skold: 0, laser: 0, drag: 0, nedskjutna: 0, kast: 0 });

/** Samma nyckel som kistspelets historik (ks-historik-data.js questionKey). */
export function questionKey(a) {
  if (!a) return null;
  if (Number.isInteger(a.factorA) && Number.isInteger(a.factorB)) {
    const [x, y] = [a.factorA, a.factorB].sort((p, q) => p - q);
    return `m:${x}x${y}`;
  }
  return Number.isInteger(a.q) ? `q:${a.q}` : null;
}

function describe(key, a, questions) {
  if (key.startsWith("m:")) {
    const [x, y] = key.slice(2).split("x").map(Number);
    return { order: x * 100 + y, text: `${x} × ${y}`, statKeys: [...new Set([`t${x}`, `t${y}`])] };
  }
  const q = a.q;
  const text = questions?.[q]?.text ?? questions?.[q]?.question ?? "";
  const keys = Array.isArray(a.statKeys) ? a.statKeys : questions?.[q]?.statKeys;
  return {
    order: q, text: String(text || `Fråga ${q + 1}`).slice(0, 200),
    statKeys: (Array.isArray(keys) ? keys : []).filter((k) => typeof k === "string"),
  };
}

/** Andel rätt per fråga – samma form som kistspelets perQuestion. */
function fragestatistik(svar, questions) {
  const by = new Map();
  for (const a of svar) {
    const key = questionKey(a);
    if (!key) continue;
    let row = by.get(key);
    if (!row) by.set(key, (row = { key, ...describe(key, a, questions), answered: 0, correct: 0, byClass: {} }));
    row.answered++;
    if (a.isCorrect) row.correct++;
    const b = (row.byClass[a.classId] ||= { answered: 0, correct: 0 });
    b.answered++;
    if (a.isCorrect) b.correct++;
  }
  return [...by.values()].sort((a, b) => a.order - b.order).slice(0, MAX_QUESTIONS)
    .map(({ order, ...r }, index) => ({ index, ...r }));
}

/** Bäst i klassen på ett bidrag (lika → först i uid-ordning, aldrig 0). */
function bast(uids, varde) {
  let ut = null;
  for (const uid of [...uids].sort()) {
    const v = varde(uid);
    if (v > 0 && (!ut || v > ut.antal)) ut = { uid, antal: v };
  }
  return ut;
}

export function byggResultat({ s, cfg, slutMs, events = [], extraFel = {}, players = [], questions = null }) {
  const klasser = cfg.stationer.map((st) => st.classId);
  const iTid = events.filter((e) => Number(e.t) <= slutMs).sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
  const handlingar = iTid
    .filter((e) => HANDLINGAR.includes(e.typ))
    .map((e) => ({ id: e.id, t: e.t, classId: e.classId, uid: e.uid, typ: e.typ, ...(e.mal ? { mal: e.mal } : {}) }));
  const tMs = Math.min(slutMs, cfg.startMs + cfg.varaktighetMs);
  const st = simulera({ ...cfg, handlingar }, tMs);
  const lage = cfg.installningar?.lage;
  const res = st.resultat || buildResultat(st.stationer, lage);

  // Eleverna: deltagare (kärnans spelare) + alla som har handlat eller svarat.
  const elev = new Map();
  const elevFor = (uid, classId, namn) => {
    if (!uid) return null;
    let e = elev.get(uid);
    if (!e) {
      elev.set(uid, (e = {
        uid, classId: classId || "", name: String(namn || ""), correct: 0, incorrect: 0,
        handlingar: typerNoll(), nekade: 0, bidrag: bidragNoll(), energi: 0, felSett: new Set(),
      }));
    }
    if (!e.classId && classId) e.classId = classId;
    if (!e.name && namn) e.name = String(namn);
    return e;
  };
  for (const p of players) elevFor(p.uid, p.classId, p.name);

  const svar = [];
  const lasFel = (e, lista) => {
    for (const f of Array.isArray(lista) ? lista : []) {
      if (f?.isCorrect !== false) continue;
      if (f.attemptId) {
        if (e.felSett.has(f.attemptId)) continue;
        e.felSett.add(f.attemptId);
      }
      e.incorrect++;
      svar.push({ ...f, classId: e.classId });
    }
  };
  for (const h of iTid) {
    const e = elevFor(h.uid, h.classId, h.namn);
    if (!e) continue;
    lasFel(e, h.fel);
    if (h.typ === "fel") continue; // bara en felbuffert (#821 F3), inget rätt svar
    e.correct++;
    if (HANDLINGAR.includes(h.typ)) e.handlingar[h.typ]++;
    if (h.nekad) e.nekade++;
    if (Number.isFinite(h.energi)) e.energi = h.energi;
    if (h.svar) svar.push({ ...h.svar, isCorrect: true, classId: h.classId });
  }
  for (const [uid, lista] of Object.entries(extraFel || {})) {
    const e = elev.get(uid);
    if (e) lasFel(e, lista);
  }
  for (const [uid, b] of Object.entries(st.bidrag || {})) {
    const e = elev.get(uid);
    if (e) e.bidrag = { ...bidragNoll(), ...b };
  }

  const placering = res.placering || [];
  const perClass = {};
  const totalTyper = typerNoll();
  let nekade = 0;
  for (const [i, classId] of klasser.entries()) {
    const station = st.stationer[i];
    const ur = [...elev.values()].filter((e) => e.classId === classId);
    const deltar = ur.filter((e) => e.correct + e.incorrect > 0);
    const typer = typerNoll();
    for (const e of ur) for (const t of HANDLINGAR) typer[t] += e.handlingar[t];
    for (const t of HANDLINGAR) totalTyper[t] += typer[t];
    nekade += ur.reduce((n, e) => n + e.nekade, 0);
    const uids = ur.map((e) => e.uid);
    const namn = (uid) => elev.get(uid)?.name || "";
    const ogonblick = [];
    const ned = bast(uids, (u) => elev.get(u).bidrag.nedskjutna);
    if (ned) ogonblick.push({ typ: "nedskjutna", uid: ned.uid, namn: namn(ned.uid), antal: ned.antal });
    if (station.skrov > 0) {
      const sista = handlingar.filter((h) => h.classId === classId && (h.typ === "skold" || h.typ === "laser") && h.t >= tMs - SISTA_FONSTER_MS).pop();
      if (sista) ogonblick.push({ typ: "sista", uid: sista.uid, namn: namn(sista.uid), t: sista.t });
    }
    const skold = bast(uids, (u) => elev.get(u).bidrag.skold);
    if (skold) ogonblick.push({ typ: "skold", uid: skold.uid, namn: namn(skold.uid), antal: skold.antal });
    const kast = bast(uids, (u) => elev.get(u).bidrag.kast);
    if (kast) ogonblick.push({ typ: "kast", uid: kast.uid, namn: namn(kast.uid), antal: kast.antal });
    perClass[classId] = {
      name: String(s?.classNames?.[classId] || classId),
      players: deltar.length,
      aktiva: cfg.stationer[i].aktiva,
      skrov: station.skrov, skold: station.skold, nedskjutna: station.nedskjutna, traffar: station.traffar,
      kastade: station.kastade, handlingar: typer,
      correct: ur.reduce((n, e) => n + e.correct, 0),
      answered: ur.reduce((n, e) => n + e.correct + e.incorrect, 0),
      ogonblick,
    };
  }

  const plats = (classId) => msPlats(res, classId);
  const ranking = [...elev.values()]
    .filter((e) => klasser.includes(e.classId))
    .map((e) => ({
      uid: e.uid, name: e.name, classId: e.classId, correct: e.correct, answered: e.correct + e.incorrect,
      handlingar: e.handlingar, bidrag: e.bidrag, rank: plats(e.classId),
    }))
    .sort((a, b) => a.rank - b.rank || b.correct - a.correct || (a.uid < b.uid ? -1 : 1));

  const result = {
    format: "meteorstorm",
    lage: res.lage,
    winner: res.vinnare ?? null,
    draw: !!res.oavgjort,
    placering,
    ...(res.lage === "en-klass" ? { stjarnor: res.stjarnor, overlevde: res.overlevde } : {}),
    startMs: cfg.startMs,
    slutMs: tMs,
    players: ranking.filter((r) => r.answered > 0).length,
    totalCorrect: ranking.reduce((n, r) => n + r.correct, 0),
    totalAnswered: ranking.reduce((n, r) => n + r.answered, 0),
    handlingar: totalTyper,
    nekade,
    perClass,
    ranking,
    perQuestion: fragestatistik(svar, s?.gameMode === MULT ? null : questions),
  };
  const cfgMynt = sessionRewards(s);
  if (cfgMynt) {
    result.rewards = {};
    for (const r of ranking) {
      if (!(r.answered > 0)) continue;
      const prize = placementPrize(cfgMynt.firstPrize, r.rank);
      const correctCoins = perCorrectCoins(r.correct, cfgMynt.perCorrect, cfgMynt.cap);
      result.rewards[r.uid] = { rank: r.rank, correct: r.correct, prize, correctCoins, total: prize + correctCoins };
    }
  }

  const spelare = {};
  for (const e of elev.values()) {
    if (!klasser.includes(e.classId)) continue;
    spelare[e.uid] = {
      uid: e.uid, classId: e.classId, name: e.name, correct: e.correct, incorrect: e.incorrect,
      handlingar: e.handlingar, nekade: e.nekade, bidrag: e.bidrag, energi: e.energi,
    };
  }
  return { result, spelare, tillstand: st };
}
