// ============================================================================
// Matchdagen (#870, Etapp 2a): STRAFFLÄGGNINGEN – ren (spec §7.4). Ingen DOM,
// ingen Firebase, ingen Math.random/Date.now: slumpen och tiden skickas in, som
// i md-motor.js. Körs på matchens tillstånd m efter slutsignalen när matchen
// måste avgöras (nyMatch({ avgor: true }) – kvalet, i Etapp 2c–3 cupen och
// Mästarcupen) och det står oavgjort. Tillståndet ligger i m.straffar och är ren
// JSON, så en straffläggning fortsätter efter en omladdning (md-lokal.js).
//
//   straffLage(m)              → { lag: "oss"|"dem", nr, fragor: 1, rad, stallning } | null (klar)
//   straffa(m, svar, rng, nu?) → { m, h }   ett svar (vår straff: skottet; deras: "Kan målvakten rädda?")
//                                           h = { typ: "straff", lag, nr, ratt, utfall, mal, stallning, rad, klar, vinnare }
//   avgjord({ oss, dem })      → "oss" | "dem" | null   (listorna med mål/miss per straff)
//   straffStallning(m)         → [vi, de]
//
// Fem straffar var, vi skjuter först i varje omgång, sedan sudden death. Avgjort så
// fort ena laget inte längre kan komma ikapp (t.ex. 3 – 0 efter tre straffar var).
// ============================================================================

import * as C from "./md-config.js";
import { behoverStraffar, kl, normaliseraSvar, raknaSvar } from "./md-motor.js";
import { KOMMENTAR, LAGE_TEXT } from "./md-texter.js";

const kopiera = (m) => JSON.parse(JSON.stringify(m));
const valj = (rng, lista) => lista[Math.floor(rng() * lista.length)];
const antalMal = (lista) => lista.filter(Boolean).length;

function viktat(rng, vikter) {
  const poster = Object.entries(vikter);
  let u = rng() * poster.reduce((s, [, v]) => s + v, 0);
  for (const [namn, v] of poster) {
    if (u < v) return namn;
    u -= v;
  }
  return poster[poster.length - 1][0];
}

/**
 * Är straffläggningen avgjord? oss/dem = mål (true) eller miss (false) per straff.
 * De första C.STRAFFAR.antal omgångarna: avgjort när ena laget inte kan komma ikapp
 * med sina återstående straffar. Sudden death: avgjort när en omgång är slut och
 * det skiljer. Efter C.STRAFFAR.max omgångar vinner vi (aldrig ändlöst).
 */
export function avgjord({ oss = [], dem = [] }) {
  const vi = antalMal(oss);
  const de = antalMal(dem);
  const rundor = Math.max(C.STRAFFAR.antal, oss.length); // vi skjuter först: oss.length ≥ dem.length
  if (vi > de + (rundor - dem.length)) return "oss";
  if (de > vi + (rundor - oss.length)) return "dem";
  if (oss.length >= C.STRAFFAR.max && dem.length >= oss.length) return "oss";
  return null;
}

export function straffStallning(m) {
  const s = m.straffar || { oss: [], dem: [] };
  return [antalMal(s.oss), antalMal(s.dem)];
}

/** Vems tur, vilken straff i ordningen och raden före frågan – null när det är avgjort. */
export function straffLage(m) {
  if (!behoverStraffar(m)) return null;
  const s = m.straffar || { oss: [], dem: [] };
  const lag = s.oss.length === s.dem.length ? "oss" : "dem";
  const nr = (lag === "oss" ? s.oss.length : s.dem.length) + 1;
  const mall = lag === "oss" ? LAGE_TEXT.straffOss : LAGE_TEXT.straffDem;
  const sudden = nr > C.STRAFFAR.antal;
  const rad = mall.replace("{nr}", String(nr)).replace("{mot}", m.mot.namn) + (sudden ? ` ${LAGE_TEXT.suddenDeath}` : "");
  return { lag, nr, fragor: 1, rad, sudden, stallning: straffStallning(m) };
}

/** Chansen att straffen går in (spec §7.4): vår vid rätt / fel svar, deras vid rätt / fel svar på räddningsfrågan. */
export const chansStraff = (lag, ratt) => kl(C.STRAFFAR[lag === "oss" ? "egen" : "deras"][ratt ? "ratt" : "fel"], 0, 1);

/**
 * En straff. svar: [{ ratt, kalla? }] eller [bool] – exakt ett. Svaren räknas in i
 * matchens statistik (frågor, rätt per källa, sekunder) som alla andra frågor.
 */
export function straffa(m0, svar, rng, nu) {
  if (typeof rng !== "function") throw new Error("straffa: rng saknas");
  const l = straffLage(m0);
  if (!l) throw new Error("straffa: ingen straffläggning pågår");
  const s = normaliseraSvar(svar);
  if (s.length !== 1) throw new Error(`straffa: 1 svar behövs, fick ${s.length}`);
  const m = kopiera(m0);
  m.straffar ??= { oss: [], dem: [], klar: false, vinnare: null };
  raknaSvar(m, s, nu);
  const ratt = s[0].ratt;
  const mal = rng() < chansStraff(l.lag, ratt);
  const sida = l.lag === "oss" ? "egen" : "deras";
  const utfall = mal ? "mal" : viktat(rng, C.STRAFF_MISS[sida][ratt ? "ratt" : "fel"]);
  m.straffar[l.lag].push(mal);
  const vinnare = avgjord(m.straffar);
  if (vinnare) Object.assign(m.straffar, { klar: true, vinnare });
  const rad = (lista) => valj(rng, lista).replace("{mot}", m.mot.namn);
  const kommentar = l.lag === "oss"
    ? (mal ? KOMMENTAR.straffMal : utfall === "raddning" ? (ratt ? KOMMENTAR.straffRaddad : KOMMENTAR.straffFel) : utfall === "stolpe" ? KOMMENTAR.straffStolpe : KOMMENTAR.straffUtanfor)
    : (mal ? (ratt ? KOMMENTAR.derasStraffMal : KOMMENTAR.derasStraffFel) : utfall === "raddning" ? KOMMENTAR.varStraffRaddning : utfall === "stolpe" ? KOMMENTAR.derasStraffStolpe : KOMMENTAR.derasStraffMiss);
  let text = rad(kommentar);
  if (vinnare) text = `${text} ${rad(vinnare === "oss" ? KOMMENTAR.straffVinst : KOMMENTAR.straffForlust)}`;
  const h = {
    typ: "straff", lag: l.lag, nr: l.nr, ratt, utfall, mal, stallning: straffStallning(m), rad: text,
    klar: !!vinnare, vinnare: vinnare || null,
  };
  return { m, h };
}
