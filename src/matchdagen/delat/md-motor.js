// ============================================================================
// Matchdagen (#868, Etapp 1b): matchmotorn – en REN tillståndsmaskin (spec §3).
// Ingen DOM, ingen Firebase, ingen three.js, ingen Math.random/Date.now: slumpen
// (rng: () → [0, 1)) och tiden (nu, ms) skickas in, som i Kurragömma. Alla tal i
// md-config.js, alla texter i md-texter.js. Testas i node
// (test/matchdagen-motor.test.js), körs av balanssimuleringen
// (admin/md-balans-sim.mjs) och delas med servern i Etapp 4.
//
//   nyMatch({ mot, bonus?, div?, nu? })      → tillstånd (avspark för oss)
//   lage(m)                                  → vad händer nu: { typ, val, fragor, rad, d? }
//                                              typ: anfall | forsvar | derasPass | derasSkott | halvtid | slut
//   spela(m, valId, svar, rng, nu?)          → { m, h } – nytt tillstånd + händelsen (m ändras inte)
//                                              svar: [{ ratt, kalla? }] eller [bool], så många som lagets fragor
//   andraHalvlek(m, nu?)                     → tillstånd för andra halvlek (efter halvtid)
//   resultat(m)                              → { oss, dem, utfall, mal, stat }
//   chansPass/chansSkott/chansSnett/chansForsvar/chansRaddning/chansDerasMal, skottText, lagbonus
//
// Tillståndet är ren data (JSON) – 1c sparar det i localStorage efter varje läge.
// ============================================================================

import * as C from "./md-config.js";
import { KOMMENTAR, LAGE_TEXT, SKOTT_TEXT, VAL_TEXT } from "./md-texter.js";

export const kl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mellan = (rng, r) => r.min + (r.max - r.min) * rng();
const valj = (rng, lista) => lista[Math.floor(rng() * lista.length)];
const bonusAv = (bonus, del) => Number(bonus?.[del]) || 0;
const kopiera = (m) => JSON.parse(JSON.stringify(m));

/** Ett utfall ur { namn: vikt }. */
function viktat(rng, vikter) {
  const poster = Object.entries(vikter);
  const summa = poster.reduce((s, [, v]) => s + v, 0);
  let u = rng() * summa;
  for (const [namn, v] of poster) {
    if (u < v) return namn;
    u -= v;
  }
  return poster[poster.length - 1][0];
}

// ---- Lagbonus och chanserna (spec §3.2, §3.3, §8.1) -------------------------

/** Lagbonus per lagdel ur truppen: (snittstjärnor − 2) × 0,05. Saknad lagdel → 0. */
export function lagbonus(trupp = []) {
  const ut = {};
  for (const del of C.LAGDELAR) {
    const st = trupp.filter((s) => s?.pos === del).map((s) => Number(s.st) || 0);
    ut[del] = st.length ? (st.reduce((a, b) => a + b, 0) / st.length - C.LAGBONUS.bas) * C.LAGBONUS.perStjarna : 0;
  }
  return ut;
}

/** Kort pass, långt pass eller dribbling lyckas. */
export function chansPass(val, ratt, bonus, styrka) {
  const p = C.PASS[val];
  return kl((ratt ? p.ratt : p.fel) + bonusAv(bonus, "MIT") - styrka * C.PASS_STYRKA, 0, 1);
}

/**
 * Vårt skott går in (d = avståndet till mål i meter). Fel svar ger SKOTT.fel, men
 * aldrig mer än ett rätt svar från samma avstånd (ett långskott går nästan aldrig in).
 */
export function chansSkott(d, ratt, bonus, styrka) {
  const s = C.SKOTT;
  const rattChans = kl(kl(s.bas - d * s.perMeter, s.min, s.max) * (1 - styrka * s.styrka) + bonusAv(bonus, "ANF"), 0, 1);
  return ratt ? rattChans : Math.min(s.fel, rattChans);
}

/** Deras pass på deras planhalva går snett och blir vår boll. */
export function chansSnett(bonus, styrka) {
  return kl(C.SNETT.bas - styrka * C.SNETT.perStyrka + bonusAv(bonus, "MIT"), 0, 1);
}

/** Tackla / Täck vinner bollen. */
export function chansForsvar(val, ratt, bonus, styrka) {
  const p = val === "tackla" ? C.TACKLA : C.TACK;
  return kl((ratt ? p.ratt : p.fel) + bonusAv(bonus, "FÖR") - styrka * C.FORSVAR_STYRKA, 0, 1);
}

/** Vår målvakt räddar ett skott på mål. */
export function chansRaddning(ratt, bonus, styrka) {
  const r = C.RADDNING;
  return ratt ? kl(r.bas + bonusAv(bonus, "MV") * r.bonus - styrka * r.perStyrka, r.min, r.max) : r.fel;
}

/** Deras skott: på mål, och mål = påMål × (1 − räddning). */
export const chansDerasPaMal = (styrka) => kl(C.DERAS_SKOTT.bas + styrka * C.DERAS_SKOTT.perStyrka, 0, 1);
export function chansDerasMal(ratt, bonus, styrka) {
  return chansDerasPaMal(styrka) * (1 - chansRaddning(ratt, bonus, styrka));
}

/** Skottknappens text efter avståndet d. */
export function skottText(d) {
  if (d > C.SKOTT_MAX_D) return SKOTT_TEXT.forLangt;
  if (d > C.SKOTT_LAGE.langt) return SKOTT_TEXT.langt;
  if (d > C.SKOTT_LAGE.bra) return SKOTT_TEXT.bra;
  return SKOTT_TEXT.jatte;
}

// ---- Tillståndet --------------------------------------------------------------

const tomStat = () => ({
  skott: 0, skottPaMal: 0, pass: 0, passOk: 0, tacklingar: 0, vunnaBollar: 0, raddningar: 0,
  horner: 0, derasSkott: 0, fragor: 0, ratt: 0, perKalla: {}, sekunder: 0,
});

/**
 * En ny match, avspark för oss.
 * @param {{ mot: { namn?: string, styrka: number }, bonus?: object, div?: number, nu?: number }} o
 */
export function nyMatch({ mot, bonus = {}, div = 0, nu = null } = {}) {
  const styrka = Number(mot?.styrka);
  if (!Number.isFinite(styrka)) throw new Error("nyMatch: mot.styrka saknas");
  return {
    v: 1,
    mot: { namn: String(mot.namn || "Motståndarna"), styrka },
    bonus: Object.fromEntries(C.LAGDELAR.map((d) => [d, bonusAv(bonus, d)])),
    div: Number(div) || 0,
    min: 0, halvlek: 1, halvtid: false, slut: false,
    avspark: "oss", boll: "oss", x: C.AVSPARK.x, y: C.AVSPARK.y, horna: false,
    oss: 0, dem: 0, mal: [], lagen: 0,
    stat: tomStat(),
    senast: typeof nu === "number" ? nu : null,
  };
}

/** Skottet kräver två rätt i rad från Division 3 (spec §7.3). */
export const dubbelSkott = (div) => div >= C.DUBBEL_SKOTT_FRAN_DIV;

const valPost = (id, fragor = 1, extra = {}) => ({ id, ...VAL_TEXT[id], fragor, ...extra });

/** Vad som händer nu, och vilka val eleven har. */
export function lage(m) {
  if (m.slut) return { typ: "slut", val: [], fragor: 0, rad: LAGE_TEXT.slut };
  if (m.halvtid) return { typ: "halvtid", val: [], fragor: 0, rad: LAGE_TEXT.halvtid };
  const mot = (t) => t.replace("{mot}", m.mot.namn);
  if (m.boll === "oss") {
    const d = C.PLAN.langd - m.x;
    const val = ["kort", "lang", "dribbla"].map((id) => valPost(id));
    val.push(valPost("skjut", dubbelSkott(m.div) ? 2 : 1, { text: skottText(d), av: d > C.SKOTT_MAX_D }));
    const rad = m.horna ? LAGE_TEXT.horna
      : m.x > C.LAGE_X.nara ? LAGE_TEXT.nara
        : m.x > C.LAGE_X.derasHalva ? LAGE_TEXT.derasHalva : LAGE_TEXT.egenHalva;
    return { typ: "anfall", val, fragor: 0, d, horna: m.horna, rad };
  }
  if (m.x >= C.DERAS_HALVA_X) return { typ: "derasPass", val: [], fragor: 0, rad: mot(LAGE_TEXT.derasPass) };
  if (m.x <= C.DERAS_SKOTT_X) return { typ: "derasSkott", val: [], fragor: 1, rad: mot(LAGE_TEXT.derasSkott) };
  return { typ: "forsvar", val: [valPost("tackla"), valPost("tack")], fragor: 0, rad: mot(LAGE_TEXT.forsvar) };
}

/** Antal frågor för ett val i läget (0 = inget svar behövs). */
export function antalFragor(m, valId = null) {
  const l = lage(m);
  return l.val.length ? (l.val.find((v) => v.id === valId)?.fragor ?? 0) : l.fragor;
}

const normaliseraSvar = (svar) => (Array.isArray(svar) ? svar : []).map((s) =>
  (typeof s === "object" && s ? { ratt: s.ratt === true, kalla: typeof s.kalla === "string" ? s.kalla : null } : { ratt: s === true, kalla: null }));

function flytta(m, x, rng, y = null) {
  m.x = kl(x, C.X_GRANS.min, C.X_GRANS.max);
  m.y = y ?? kl(m.y + (rng() * 2 - 1) * C.Y_SVAJ, C.Y_GRANS.min, C.Y_GRANS.max);
}

function avspark(m, lag) {
  m.boll = lag;
  m.x = C.AVSPARK.x;
  m.y = C.AVSPARK.y;
}

/** Matchminuten för ett mål just nu (1–45 i första halvleken, 46–90 i andra). */
const malMinut = (m) => Math.min(m.halvlek * C.HALVLEK_MIN, Math.floor(m.min) + 1);

function tick(m, rng) {
  m.min += mellan(rng, C.STEG_MIN);
  const slut = m.halvlek * C.HALVLEK_MIN;
  if (m.min >= slut) {
    m.min = slut;
    if (m.halvlek < C.HALVLEKAR) m.halvtid = true;
    else m.slut = true;
  }
}

/**
 * Spela läget: elevens val och svar (eller inget, när läget är automatiskt).
 * @param {object} m0        tillståndet (ändras inte)
 * @param {string|null} valId kort | lang | dribbla | skjut | tackla | tack – null i derasPass/derasSkott
 * @param {Array} svar       ett svar per fråga: { ratt, kalla? } eller bool
 * @param {() => number} rng slumpen
 * @param {number} [nu]      verklig tid i ms (statistikens sekunder)
 * @returns {{ m: object, h: object }}
 */
export function spela(m0, valId, svar, rng, nu) {
  if (typeof rng !== "function") throw new Error("spela: rng saknas");
  const l = lage(m0);
  if (l.typ === "slut" || l.typ === "halvtid") throw new Error(`spela: matchen är i ${l.typ}`);
  let fragor = l.fragor;
  if (l.val.length) {
    const v = l.val.find((x) => x.id === valId);
    if (!v || v.av) throw new Error(`spela: valet ${valId} finns inte i läget ${l.typ}`);
    fragor = v.fragor;
  } else valId = null;
  const s = normaliseraSvar(svar);
  if (s.length !== fragor) throw new Error(`spela: ${fragor} svar behövs, fick ${s.length}`);

  const m = kopiera(m0);
  const st = m.stat;
  for (const { ratt, kalla } of s) {
    st.fragor++;
    if (ratt) st.ratt++;
    if (kalla) {
      const k = (st.perKalla[kalla] ??= { fragor: 0, ratt: 0 });
      k.fragor++;
      if (ratt) k.ratt++;
    }
  }
  if (typeof nu === "number") {
    if (typeof m.senast === "number") st.sekunder += Math.min(C.MAX_LAGE_S, Math.max(0, nu - m.senast) / 1000);
    m.senast = nu;
  }
  const ratt = s.every((x) => x.ratt);
  const rad = (lista) => valj(rng, lista).replace("{mot}", m.mot.namn);
  const h = { typ: l.typ, val: valId, svar: s.map((x) => x.ratt), ratt: fragor ? ratt : null, min: malMinut(m), fran: { x: m.x, y: m.y } };
  const styrka = m.mot.styrka;
  m.lagen++;

  if (l.typ === "anfall") {
    m.horna = false;
    if (valId === "skjut") skott(m, h, s, l.d, rng, rad);
    else pass(m, h, valId, ratt, rng, rad);
  } else if (l.typ === "derasPass") {
    const p = C.DERAS_PASS;
    flytta(m, m.x - mellan(rng, p.fram) * (p.bas + styrka * p.perStyrka), rng);
    if (rng() < chansSnett(m.bonus, styrka)) {
      m.boll = "oss";
      st.vunnaBollar++;
      Object.assign(h, { utfall: "snett", rad: rad(KOMMENTAR.snett) });
    } else Object.assign(h, { utfall: "fram", rad: rad(KOMMENTAR.derasPass) });
  } else if (l.typ === "forsvar") {
    st.tacklingar++;
    if (rng() < chansForsvar(valId, ratt, m.bonus, styrka)) {
      m.boll = "oss";
      st.vunnaBollar++;
      flytta(m, m.x + C.VUNNEN_FRAM, rng);
      Object.assign(h, { utfall: "vunnen", rad: rad(ratt ? KOMMENTAR.vunnen : KOMMENTAR.vunnenTur) });
    } else {
      const stopp = valId === "tack" && ratt;
      flytta(m, m.x - (stopp ? C.TACK_STOPP : mellan(rng, C.FORBI)), rng);
      Object.assign(h, { utfall: stopp ? "stoppad" : "forbi", rad: rad(stopp ? KOMMENTAR.stoppad : ratt ? KOMMENTAR.forbi : KOMMENTAR.forbiFel) });
    }
  } else derasSkott(m, h, ratt, rng, rad);

  h.till = { x: m.x, y: m.y };
  h.boll = m.boll;
  h.stallning = [m.oss, m.dem];
  tick(m, rng);
  return { m, h };
}

function pass(m, h, valId, ratt, rng, rad) {
  const st = m.stat;
  st.pass++;
  h.hojd = valId === "lang" ? "bage" : "mark";
  if (rng() < chansPass(valId, ratt, m.bonus, m.mot.styrka)) {
    st.passOk++;
    flytta(m, m.x + mellan(rng, C.PASS[valId].fram), rng);
    const ok = valId === "dribbla" ? KOMMENTAR.dribblaOk : KOMMENTAR.passOk;
    Object.assign(h, { utfall: "ok", rad: rad(ratt ? ok : KOMMENTAR.passTur) });
  } else {
    flytta(m, m.x + mellan(rng, C.BRUTET_FRAM), rng);
    m.boll = "dem";
    Object.assign(h, { utfall: "bruten", rad: rad(ratt ? KOMMENTAR.passBruten : KOMMENTAR.passFel) });
  }
}

function skott(m, h, s, d, rng, rad) {
  const st = m.stat;
  const ratt = s.every((x) => x.ratt);
  st.skott++;
  h.hojd = "skott";
  h.d = d;
  if (rng() < chansSkott(d, ratt, m.bonus, m.mot.styrka)) {
    st.skottPaMal++;
    m.oss++;
    m.mal.push({ min: h.min, lag: "oss" });
    avspark(m, "dem");
    Object.assign(h, { utfall: "mal", mal: "oss", rad: rad(KOMMENTAR.mal) });
    return;
  }
  const utfall = viktat(rng, ratt ? C.SKOTT_MISS.ratt : C.SKOTT_MISS.fel);
  if (utfall === "raddning") st.skottPaMal++;
  h.utfall = utfall;
  if (ratt) h.rad = rad(utfall === "raddning" ? KOMMENTAR.raddningRatt : utfall === "stolpe" ? KOMMENTAR.stolpe : KOMMENTAR.utanforRatt);
  else if (s.length > 1 && !s[0].ratt) h.rad = rad(KOMMENTAR.dubbelFel);
  else h.rad = rad(utfall === "raddning" ? KOMMENTAR.raddningFel : KOMMENTAR.skottFel);
  if (ratt && utfall === "raddning" && rng() < C.HORNA_CHANS) {
    st.horner++;
    m.horna = true;
    m.boll = "oss";
    flytta(m, C.HORNA.x, rng, rng() < 0.5 ? C.HORNA.y : C.PLAN.bredd - C.HORNA.y);
    h.horna = true;
    h.rad = `${h.rad} ${rad(KOMMENTAR.horna)}`;
    return;
  }
  m.boll = "dem";
  flytta(m, C.INSPARK_DERAS, rng, C.AVSPARK.y);
  h.inspark = "dem";
}

function derasSkott(m, h, ratt, rng, rad) {
  const st = m.stat;
  const styrka = m.mot.styrka;
  st.derasSkott++;
  h.hojd = "skott";
  if (rng() < chansDerasPaMal(styrka)) {
    if (rng() < chansRaddning(ratt, m.bonus, styrka)) {
      st.raddningar++;
      m.boll = "oss";
      flytta(m, C.INSPARK_VAR, rng, C.AVSPARK.y);
      Object.assign(h, { utfall: "raddning", inspark: "oss", rad: rad(KOMMENTAR.varRaddning) });
      return;
    }
    m.dem++;
    m.mal.push({ min: h.min, lag: "dem" });
    avspark(m, "oss");
    Object.assign(h, { utfall: "mal", mal: "dem", rad: rad(KOMMENTAR.derasMal) });
    return;
  }
  m.boll = "oss";
  flytta(m, C.INSPARK_VAR, rng, C.AVSPARK.y);
  Object.assign(h, { utfall: "utanfor", inspark: "oss", rad: rad(KOMMENTAR.derasUtanfor) });
}

/** Andra halvlek: laget som inte började gör avspark. Pausen räknas inte som speltid. */
export function andraHalvlek(m0, nu) {
  if (!m0.halvtid) throw new Error("andraHalvlek: det är inte halvtid");
  const m = kopiera(m0);
  m.halvtid = false;
  m.halvlek = 2;
  m.min = C.HALVLEK_MIN;
  m.horna = false;
  avspark(m, m.avspark === "oss" ? "dem" : "oss");
  if (typeof nu === "number") m.senast = nu;
  return m;
}

/** Resultatet: ställningen, vinst/oavgjort/förlust, målen med minut och statistiken (§3.6). */
export function resultat(m) {
  const utfall = m.oss > m.dem ? "vinst" : m.oss < m.dem ? "forlust" : "oavgjort";
  return { oss: m.oss, dem: m.dem, utfall, mal: m.mal.map((x) => ({ ...x })), stat: kopiera(m.stat), klar: m.slut };
}
