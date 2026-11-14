// ============================================================================
// Myntsäkerhet B1 (#853, docs/SAKERHET-MYNT.md §6 B1): dagskvittot myntDag.
// ----------------------------------------------------------------------------
// Ren data + ren planering, inga beroenden utom datumet (importeras av
// data-mynt.js och `node --test`). Talen här MÅSTE stämma med firestore.rules
// (myntDagOk, myntPerGang, myntPerDag) – test/mynt-dag.test.js läser reglerna
// och faller om de glider isär. Ändra talet → ändra reglerna → deploy.
//
// Kvittot: studentData/{uid}/myntDag/{dag} (dag = svenskt datum ÅÅÅÅ-MM-DD,
// samma som Mattematchens mmMynt) = { dag, kalla, lastAt, senastMynt,
// senastXp, ovning, lasresa, amnes, ekv, gard, xp, gardUid, gavor }.
// Varje intjäning i klienten (E1–E5) höjer saldot och kvittot i EN
// transaktion (data-mynt.js tjanaMynt). Reglerna godtar en höjning av
// räknaren bara om `coins` (och `xp`) höjs exakt lika mycket i samma skrivning,
// inom taket per gång och per dag. Gåvan (gard) har inget eget dagstak: den
// ges en gång per ÄGT gårdsdjur (studentData.agdaDjur, bara servern skriver)
// och dag – gavor.<djur-uid>.
// ============================================================================

import { myntDag } from "./tavling/mm-config.js";

export { myntDag };

/** Undersamlingen under studentData/{uid} (reglerna: match /myntDag/{dag}). */
export const MYNT_DAG_KVITTON = "myntDag";
/** Källorna (reglerna: d.kalla in [...]). */
export const KALLOR = ["ovning", "lasresa", "amnes", "ekv", "gard"];

/**
 * Tak per utbetalning. Får ALDRIG skära en legitim utbetalning
 * (test/mynt-dag.test.js räknar fram det största beloppet per källa ur koden):
 *   ovning  – deterministiska lägen ≤ 52 (Äventyr, goal 10). Fånga sanningar
 *             har inget slut (1–2 mynt per fångad sanning tills tre liv är
 *             slut) → 500 ≈ tolv minuters felfritt spel i maxtempo, även om
 *             varje fångst vore färsk (2 mynt).
 *   lasresa – 3/rätt, banken har ≤ 9 frågor per text → 60 täcker 20 frågor.
 *   amnes   – 5/rätt, lärarens texter (frågeantalet är bara en varning) → 20 frågor.
 *   ekv     – COINS.extraChallenge 7 (högsta i tabellen).
 */
export const PER_GANG = Object.freeze({ ovning: 500, lasresa: 60, amnes: 100, ekv: 7 });
/** Tak per svensk dag och källa (§9 F1). Gåvan: 8 per ägt gårdsdjur, inget eget tak. */
export const PER_DAG = Object.freeze({ ovning: 1500, lasresa: 400, amnes: 400, ekv: 300 });
/** XP per övning (xpForExercise(3) = 50) och per dag. Bara övningar ger XP. */
export const XP_PER_GANG = 50;
export const XP_PER_DAG = 3000;
/** Gåvans belopp (= farm-core FARM_GIFT_COINS, reglerna: d.senastMynt == 8). */
export const GAVA_MYNT = 8;
/** Gårdsdjurens varu-id (= shop-items farmAnimal: true, reglerna: agdaDjur-värdet). */
export const GARDSDJUR = ["animal_horse", "animal_cow", "animal_pig"];
/** Visas på resultatskärmen när taket klipper utbetalningen. */
export const MYNT_DAG_TAK_TEXT = "Du har fått dagens alla mynt härifrån – resultatet sparas ändå.";

const heltal = (v) => Math.max(0, Math.round(Number(v) || 0));

/**
 * Planera en intjäning mot dagens kvitto (ren, inget SDK).
 *   sd     – studentData före (null = saknas)
 *   kvitto – dagens myntDag-dokument före (null = saknas)
 * Klipper beloppet mot taken. XP skrivs BARA när `sd.xp` redan är ett tal
 * (§6 B1 "XP i gamla dokument": migreringen sätter det härledda värdet).
 * @returns {{mynt:number, xp:number, tak:boolean, xpSaknas:boolean,
 *   kvitto:(object|null), sd:(object|null)}} kvitto/sd = fälten att skriva
 *   (null = ingenting att betala, kvittot skrivs inte).
 */
export function planTjana({ kalla, mynt, xp = 0, sd = null, kvitto = null, gardUid = null }) {
  if (!KALLOR.includes(kalla)) throw new Error(`okänd källa: ${kalla}`);
  const k = kvitto || {};
  const onskat = heltal(mynt);
  let m;
  if (kalla === "gard") {
    const gavor = k.gavor && typeof k.gavor === "object" ? k.gavor : {};
    m = onskat > 0 && typeof gardUid === "string" && gardUid && !gavor[gardUid] ? GAVA_MYNT : 0;
  } else {
    m = Math.max(0, Math.min(onskat, PER_GANG[kalla], PER_DAG[kalla] - heltal(k[kalla])));
  }
  const xpOnskat = kalla === "ovning" ? heltal(xp) : 0;
  const xpFinns = !!sd && typeof sd.xp === "number";
  const x = xpFinns ? Math.max(0, Math.min(xpOnskat, XP_PER_GANG, XP_PER_DAG - heltal(k.xp))) : 0;
  const tak = m < onskat || (xpFinns && x < xpOnskat);
  const xpSaknas = xpOnskat > 0 && !xpFinns;
  if (m + x < 1) return { mynt: 0, xp: 0, tak, xpSaknas, kvitto: null, sd: null };
  const nyttKvitto = { kalla, senastMynt: m, senastXp: x, [kalla]: heltal(k[kalla]) + m };
  if (x > 0) nyttKvitto.xp = heltal(k.xp) + x;
  if (kalla === "gard") {
    nyttKvitto.gardUid = gardUid;
    nyttKvitto.gavor = { [gardUid]: true };
  }
  const sdPatch = { coins: (Number(sd && sd.coins) || 0) + m };
  if (x > 0) sdPatch.xp = sd.xp + x;
  return { mynt: m, xp: x, tak, xpSaknas, kvitto: nyttKvitto, sd: sdPatch };
}

/**
 * Dagen på andra sidan svensk midnatt, om `ms` ligger inom `fonster` från den
 * (annars null). tjanaMynt försöker EN gång till med den när kvittot nekas:
 * klientens dag kan ligga på fel sida om midnatt (klockskev < 5 s, eller
 * transaktionen startade före och skrevs efter). Ett nekande betyder alltså
 * inte att taket är nått (#848 F5).
 */
export function grannDag(ms, fonster = 10 * 60 * 1000) {
  const d = myntDag(ms);
  const fram = myntDag(ms + fonster);
  if (fram !== d) return fram;
  const bak = myntDag(ms - fonster);
  return bak !== d ? bak : null;
}
