// ============================================================================
// Matchdagen (#870, Etapp 2a): KVALET – ren (spec §7.2). Ingen DOM, ingen
// Firebase, ingen klocka. Ligavinnaren under Superligan får K.kval när säsongen
// tar slut (md-sasong.js matchKlar): en match mot ett lag från divisionen ovanför
// med styrka(div + 1). Oavgjort → straffar (md-straffar.js). Vinst → upp en
// division och pokalen "Kvalade upp till …". Förlust → kvar, ny chans nästa
// säsong. Ingen åker någonsin ner.
//
//   kvalMatch(K)                                → { div, till, mot } | null   (ett ospelat kval)
//   kvalKlar(K, { res, nu, matchId, kallNamn?, rng? }) → { K, match, pengar, vann, div }   (rng → ny marknad)
//     res = resultat(m) ur md-motor.js för en match med avgor: true (res.vann satt)
//   stegen(div)                                 → [{ div, namn, lag, omgangar, nu }] (tabellens stege, §7.1)
// ============================================================================

import * as C from "./md-config.js";
import { bokforMatch } from "./md-sasong.js";
import { nyMarknad } from "./md-trupp.js";

const kopia = (v) => JSON.parse(JSON.stringify(v));

/** Ett kval som väntar på att spelas, eller null. */
export function kvalMatch(K) {
  const k = K?.kval;
  if (!k || k.spelad || !k.mot) return null;
  const div = Number(k.div) || 0;
  return { div, till: Math.min(C.TOPP_DIV, div + 1), mot: { id: "kval", namn: k.mot.namn, farg: k.mot.farg, styrka: k.mot.styrka, vi: false } };
}

/** Vann vi? res.vann ur motorn (straffarna inräknade) – annars målen (en match utan straffar). */
function vannKvalet(res) {
  if (typeof res.vann === "boolean") return res.vann;
  if (res.oss === res.dem) throw new Error("kvalKlar: oavgjort kval utan straffar");
  return res.oss > res.dem;
}

/**
 * Kvalet är spelat. Ändrar inte K. Vinst: div + 1 (aldrig över Superligan),
 * pokalen och uppflyttningspengarna. Förlust: samma division. Säsongshistoriken
 * får kvalets utfall ("upp" / "kvar").
 */
export function kvalKlar(K0, { res, nu, matchId, kallNamn = {}, rng = null }) {
  const kv = kvalMatch(K0);
  if (!kv) throw new Error("kvalKlar: inget kval att spela");
  const vann = vannKvalet(res);
  const K = kopia(K0);
  const extraPengar = vann ? Math.round(C.KASSA.uppflyttning * (1 + kv.div * C.KASSA.perDiv)) : 0;
  const { match, pengar, dag } = bokforMatch(K, { res, nu, matchId, kallNamn, mot: kv.mot.namn, typ: "kval", div: kv.div, extraPengar });
  // Uppåt eller kvar – aldrig ned, oavsett vad dokumentet säger om divisionen.
  const fore = Number(K.div) || 0;
  K.div = vann ? Math.max(fore, kv.till) : Math.max(fore, kv.div);
  if (vann) K.pokaler = [...(K.pokaler || []), { typ: "kval", namn: `Kvalade upp till ${C.DIVISIONER[K.div]}`, sasong: K.sasong, datum: dag }];
  K.kval = { ...K.kval, spelad: true, vann, oss: res.oss, dem: res.dem };
  if (match.straffar) K.kval.straffar = match.straffar;
  const sasong = (K.sasonger || [])[0];
  if (sasong && sasong.sasong === K.sasong) K.sasonger[0] = { ...sasong, kval: vann ? "upp" : "kvar" };
  if (rng) K.marknad = nyMarknad(K, rng); // nya spelare efter matchen – i den nya divisionen efter en uppflyttning (§8.3)
  return { K, match, pengar, vann, div: K.div };
}

/** Stegen överst i tabellen (§7.1): alla åtta nivåer, den nuvarande markerad. */
export function stegen(div) {
  return C.DIVISIONER.map((namn, i) => ({ div: i, namn, lag: C.LAGANTAL[i], omgangar: C.LAGANTAL[i] - 1, nu: i === div }));
}
