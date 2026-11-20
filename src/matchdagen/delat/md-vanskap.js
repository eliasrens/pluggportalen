// ============================================================================
// Matchdagen (#874, Etapp 4): VÄNSKAPSMATCHEN – två elever mot varandra (spec §11.3).
// Ren som md-motor.js (ingen DOM, Firebase, Math.random eller Date.now) och delad med
// servern (admin/sync-matchdagen-functions.mjs → functions/matchdagen/). Servern kör
// motorn, klienterna visar händelserna med samma plan som solospelet (spegla, vy).
//
// Sidorna heter "a" (den som utmanade) och "b". Planen ses från a: a anfaller mot x = 100,
// b mot x = 0. Varje läge har en anfallare (den som har bollen) och en försvarare, och
// BÅDA svarar på varsin fråga ur sina egna frågekällor (servern rättar):
//   anfallaren  kort pass | långt pass | dribbla | skjut (d ≤ 45)
//   försvararen tackla | täck – vid ett skott är svaret målvaktens räddning (automatiskt)
// Chanserna är solospelets (chansPass, chansForsvar, chansSkott, chansRaddning) med
// motståndarstyrkan 0 och lagens egna bonusar, vägda med VANSKAP i md-config.js.
//
//   nyVanskap({ a, b, avspark? }) → V           a/b: { namn, farg, bonus }
//   vLage(V) → { typ: spel|halvtid|slut, anf, forsv, d, horna, valAnf, valForsv }
//   vSpela(V, { a: { val, ratt, kalla? }, b: {…} }, rng) → { V, h }   (V0 ändras inte)
//   vAndraHalvlek(V) · vWalkover(V, forlorare) · vResultat(V)
//   spegla(h, sida) → händelsen som md-plan.js spelar (oss = elevens eget lag)
//   vy(V, sida) → { x, y, boll, mot } för plan.stall
// ============================================================================

import * as C from "./md-config.js";
import { VAL_TEXT, VANSKAP_KOMMENTAR } from "./md-texter.js";
import { chansForsvar, chansPass, chansRaddning, chansSkott, kl, skottText, viktat } from "./md-motor.js";

export const SIDOR = ["a", "b"];
export const motsida = (s) => (s === "a" ? "b" : "a");
const ANFALL = ["kort", "lang", "dribbla", "skjut"];
const FORSVAR = ["tackla", "tack"];
const mellan = (rng, r) => r.min + (r.max - r.min) * rng();
const valj = (rng, lista) => lista[Math.floor(rng() * lista.length)];
const kopiera = (v) => JSON.parse(JSON.stringify(v));
const FARG = new RegExp("^#[0-9a-fA-F]{6}$");

const tomStat = () => ({
  skott: 0, skottPaMal: 0, pass: 0, passOk: 0, tacklingar: 0, vunnaBollar: 0, raddningar: 0, horner: 0,
  fragor: 0, ratt: 0, perKalla: {},
});

function lag(l) {
  return {
    namn: String(l?.namn || "Laget").slice(0, C.LAGNAMN_MAX),
    farg: FARG.test(String(l?.farg)) ? String(l.farg) : "#1e6fd9",
    bonus: Object.fromEntries(C.LAGDELAR.map((d) => [d, kl(Number(l?.bonus?.[d]) || 0, -0.5, 0.5)])),
  };
}

/** En ny vänskapsmatch, avspark för `avspark` ("a" som standard). */
export function nyVanskap({ a, b, avspark = "a" } = {}) {
  const s = avspark === "b" ? "b" : "a";
  return {
    v: 1, lag: { a: lag(a), b: lag(b) },
    min: 0, halvlek: 1, halvtid: false, slut: false, walkover: null,
    avspark: s, boll: s, x: C.AVSPARK.x, y: C.AVSPARK.y, horna: false,
    stallning: { a: 0, b: 0 }, mal: [], lagen: 0, stat: { a: tomStat(), b: tomStat() },
  };
}

/** Avståndet till målet för den som anfaller. */
export const avstand = (V, sida) => (sida === "a" ? C.PLAN.langd - V.x : V.x);

/** Läget nu: vem anfaller, avståndet och valen för var och en. */
export function vLage(V) {
  if (V.slut) return { typ: "slut" };
  if (V.halvtid) return { typ: "halvtid" };
  const anf = V.boll;
  const d = avstand(V, anf);
  const valAnf = ANFALL.map((id) => ({ id, ...VAL_TEXT[id], fragor: 1 }));
  Object.assign(valAnf.find((v) => v.id === "skjut"), { text: skottText(d), av: d > C.SKOTT_MAX_D });
  return {
    typ: "spel", anf, forsv: motsida(anf), d, horna: V.horna, valAnf,
    valForsv: FORSVAR.map((id) => ({ id, ...VAL_TEXT[id], fragor: 1 })),
  };
}

/** Ett giltigt val för rollen – annars standardvalet (tiden ute, VANSKAP.standardVal). */
export function giltigtVal(l, roll, val) {
  if (roll === "anf") {
    const v = l.valAnf.find((x) => x.id === val);
    return v && !v.av ? val : C.VANSKAP.standardVal.anfall;
  }
  return FORSVAR.includes(val) ? val : C.VANSKAP.standardVal.forsvar;
}

const flytta = (V, x, rng, y = null) => {
  V.x = kl(x, C.X_GRANS.min, C.X_GRANS.max);
  V.y = y ?? kl(V.y + (rng() * 2 - 1) * C.Y_SVAJ, C.Y_GRANS.min, C.Y_GRANS.max);
};
/** x efter `m` meter framåt för sidan. */
const fram = (V, sida, m) => V.x + (sida === "a" ? m : -m);
const malMinut = (V) => Math.min(V.halvlek * C.HALVLEK_MIN, Math.floor(V.min) + 1);

function tick(V, rng) {
  V.min += mellan(rng, C.VANSKAP.steg);
  const slut = V.halvlek * C.HALVLEK_MIN;
  if (V.min >= slut) {
    V.min = slut;
    if (V.halvlek < C.HALVLEKAR) V.halvtid = true;
    else V.slut = true;
  }
}

function rakna(st, s) {
  st.fragor++;
  if (s.ratt) st.ratt++;
  if (s.kalla) {
    const k = (st.perKalla[s.kalla] ??= { fragor: 0, ratt: 0 });
    k.fragor++;
    if (s.ratt) k.ratt++;
  }
}

const svarAv = (x) => ({
  val: typeof x?.val === "string" ? x.val : null,
  ratt: x?.ratt === true,
  kalla: typeof x?.kalla === "string" ? x.kalla : null,
});

/**
 * Spela läget med båda elevernas val och svar (ett uteblivet svar = fel, inget val = standardvalet).
 * @returns {{ V: object, h: object }} h ur a:s perspektiv – spegla(h, sida) för en elev
 */
export function vSpela(V0, svar, rng) {
  if (typeof rng !== "function") throw new Error("vSpela: rng saknas");
  const l = vLage(V0);
  if (l.typ !== "spel") throw new Error(`vSpela: matchen är i ${l.typ}`);
  const V = kopiera(V0);
  const s = { a: svarAv(svar?.a), b: svarAv(svar?.b) };
  const { anf, forsv } = l;
  const valA = giltigtVal(l, "anf", s[anf].val);
  const valF = giltigtVal(l, "forsv", s[forsv].val);
  for (const sida of SIDOR) rakna(V.stat[sida], s[sida]);
  const namn = { anf: V.lag[anf].namn, forsv: V.lag[forsv].namn };
  const rad = (lista) => valj(rng, lista).replace(/\{anf\}/g, namn.anf).replace(/\{forsv\}/g, namn.forsv);
  const h = {
    nr: V.lagen + 1, anf, forsv, val: { [anf]: valA, [forsv]: valF }, ratt: { a: s.a.ratt, b: s.b.ratt },
    min: malMinut(V), fran: { x: V.x, y: V.y },
  };
  V.lagen++;
  V.horna = false;
  if (valA === "skjut") skott(V, h, l.d, s[anf].ratt, s[forsv].ratt, rng, rad);
  else pass(V, h, valA, valF, s[anf].ratt, s[forsv].ratt, rng, rad);
  h.till = { x: V.x, y: V.y };
  h.boll = V.boll;
  h.stallning = { ...V.stallning };
  tick(V, rng);
  return { V, h };
}

function pass(V, h, valA, valF, rA, rF, rng, rad) {
  const { anf, forsv } = h;
  const sA = V.stat[anf];
  sA.pass++;
  V.stat[forsv].tacklingar++;
  h.typ = "pass";
  h.hojd = valA === "lang" ? "bage" : "mark";
  const pA = chansPass(valA, rA, V.lag[anf].bonus, 0);
  const pF = chansForsvar(valF, rF, V.lag[forsv].bonus, 0);
  if (rng() < pA * (1 - pF * C.VANSKAP.forsvar)) {
    sA.passOk++;
    const stopp = valF === "tack" && rF;
    flytta(V, fram(V, anf, mellan(rng, C.PASS[valA].fram) * (stopp ? 0.5 : 1)), rng);
    Object.assign(h, { utfall: stopp ? "stoppad" : "ok", rad: rad(stopp ? VANSKAP_KOMMENTAR.stoppad : valA === "dribbla" ? VANSKAP_KOMMENTAR.dribblaOk : VANSKAP_KOMMENTAR.passOk) });
    return;
  }
  flytta(V, fram(V, anf, mellan(rng, C.BRUTET_FRAM)), rng);
  V.boll = forsv;
  V.stat[forsv].vunnaBollar++;
  Object.assign(h, { utfall: "bruten", rad: rad(valF === "tack" ? VANSKAP_KOMMENTAR.tackad : VANSKAP_KOMMENTAR.bruten) });
}

function skott(V, h, d, rA, rF, rng, rad) {
  const { anf, forsv } = h;
  const sA = V.stat[anf];
  sA.skott++;
  Object.assign(h, { typ: "skott", hojd: "skott", d });
  const p = chansSkott(d, rA, V.lag[anf].bonus, 0) * (1 - chansRaddning(rF, V.lag[forsv].bonus, 0) * C.VANSKAP.raddning);
  if (rng() < p) {
    sA.skottPaMal++;
    V.stallning[anf]++;
    V.mal.push({ min: h.min, lag: anf });
    V.boll = forsv;
    V.x = C.AVSPARK.x;
    V.y = C.AVSPARK.y;
    Object.assign(h, { utfall: "mal", mal: anf, rad: rad(VANSKAP_KOMMENTAR.mal) });
    return;
  }
  const utfall = viktat(rng, rA ? C.SKOTT_MISS.ratt : C.SKOTT_MISS.fel);
  h.utfall = utfall;
  h.rad = rad(VANSKAP_KOMMENTAR[utfall]);
  if (utfall === "raddning") {
    sA.skottPaMal++;
    V.stat[forsv].raddningar++;
  }
  if (rA && utfall === "raddning" && rng() < C.HORNA_CHANS) {
    sA.horner++;
    V.horna = true;
    const hx = anf === "a" ? C.HORNA.x : C.PLAN.langd - C.HORNA.x;
    flytta(V, hx, rng, rng() < 0.5 ? C.HORNA.y : C.PLAN.bredd - C.HORNA.y);
    h.horna = true;
    h.rad = `${h.rad} ${rad(VANSKAP_KOMMENTAR.horna)}`;
    return;
  }
  V.boll = forsv;
  flytta(V, forsv === "a" ? C.INSPARK_VAR : C.INSPARK_DERAS, rng, C.AVSPARK.y);
  h.inspark = forsv;
}

/** Andra halvlek: laget som inte började gör avspark. */
export function vAndraHalvlek(V0) {
  if (!V0.halvtid) throw new Error("vAndraHalvlek: det är inte halvtid");
  const V = kopiera(V0);
  Object.assign(V, { halvtid: false, halvlek: 2, min: C.HALVLEK_MIN, horna: false, boll: motsida(V.avspark), x: C.AVSPARK.x, y: C.AVSPARK.y });
  return V;
}

/** Walkover (§11.3): `forlorare` har inte gjort något på VANSKAP.inaktiv sekunder (eller gav upp). */
export function vWalkover(V0, forlorare) {
  const V = kopiera(V0);
  Object.assign(V, { slut: true, halvtid: false, walkover: forlorare === "b" ? "b" : "a" });
  return V;
}

/**
 * Resultatet: ställningen, vinnaren (null = oavgjort – inga straffar i en vänskapsmatch)
 * och statistiken per sida. En walkover vinns av den andra sidan, ställningen står kvar.
 */
export function vResultat(V) {
  const { a, b } = V.stallning;
  const vinnare = V.walkover ? motsida(V.walkover) : a > b ? "a" : b > a ? "b" : null;
  return { stallning: { a, b }, vinnare, walkover: V.walkover || null, klar: !!V.slut, mal: V.mal.map((x) => ({ ...x })), stat: kopiera(V.stat) };
}

/** Planens tillstånd för en elev (plan.stall och utropen): oss = elevens lag, x sett från eleven. */
export function vy(V, sida) {
  return {
    x: sida === "a" ? V.x : C.PLAN.langd - V.x, y: V.y, boll: V.boll === sida ? "oss" : "dem",
    oss: V.stallning[sida], dem: V.stallning[motsida(sida)], min: V.min, mot: { namn: V.lag[motsida(sida)].namn },
  };
}

/**
 * Händelsen som elevens plan spelar (md-plan.js spela): typ anfall när eleven anföll,
 * annars forsvar (pass) eller derasSkott (skott). Hörnan följer bara med för anfallaren.
 */
export function spegla(h, sida) {
  const egen = h.anf === sida;
  const X = (p) => (p ? { x: sida === "a" ? p.x : C.PLAN.langd - p.x, y: p.y } : p);
  return {
    typ: egen ? "anfall" : h.typ === "skott" ? "derasSkott" : "forsvar",
    val: h.val?.[sida] ?? null, ratt: h.ratt?.[sida] ?? null, min: h.min, fran: X(h.fran), till: X(h.till),
    boll: h.boll === sida ? "oss" : "dem", stallning: [h.stallning?.[sida] ?? 0, h.stallning?.[motsida(sida)] ?? 0],
    utfall: h.utfall, hojd: h.hojd, rad: h.rad,
    ...(h.mal ? { mal: h.mal === sida ? "oss" : "dem" } : {}), ...(h.horna && egen ? { horna: true } : {}),
  };
}
