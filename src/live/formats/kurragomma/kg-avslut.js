// ============================================================================
// Kurragömma 🙈 (#839, spec §10, LIVE-FORMAT §6): RESULTATET och PLUGGMYNTEN –
// samma väg som Meteorstormen (ms-avslut.js).
//
// SERVERN räknar slutet: kgAvsluta räknar överlevnadspoängen, placeringen och
// result.rewards (functions/kurragomma-resultat.js) och skriver liveSessions.result
// – ingen klient får skriva result (reglerna). Kärnan (live-feed.js chores,
// historiken) gör som för alla format: resultInputs(s) → buildResult(…, extra) →
// writeResultIfMissing. Här är resultInputs = anropa kgAvsluta, och buildResult
// lämnar tillbaka serverns result – writeResultIfMissing ser att det redan finns.
//
// Kärnan betalar därför aldrig ut mynten här (bara när DEN skrev result), så
// avslutaOchBetala gör det: kgAvsluta → settleLiveRewards med serverns result
// (idempotent – kvittot coinReceipts/{uid}; bara läraren får skriva kvittot).
// Projektorns Avsluta-knapp, 00:00 och "alla hittade" (kgTick → kgAvsluta på
// servern, sedan status finished → kärnans resultTimer → hit) går alla denna väg.
// Klasscentret: pokaler och kassapriset är idempotenta och körs varje gång;
// klassbonusen (ökar klassens EXP, inte idempotent) som i Meteorstormen bara av
// den som AVSLUTADE: kgAvsluta med redan === false (Avsluta-knappen), eller
// projektorn vars kgTick avslutade matchen (avslutadeNu – kgp-on.js; en
// projektor per match). Stängd projektor vid slutet → ingen klassbonus (som
// Meteorstormens elevavslut). Kurragömmas result saknar perClass (en klass),
// så medPerClass bygger det ur sessionen för kc-koppling liveBonusar.
//
// API
//   buildResult(s, classes, players, mode, extra?) → extra.result | tomt result utan rewards
//   resultInputs(s) → { result } – kgAvsluta + utbetalning (lärare)
//   avslutaOchBetala(s, deps?, { avslutadeNu? }) → result | null
//     deps = { avsluta(sid), settle(sid, session), admin(), klass, vanta(ms)? } (testerna)
//   medPerClass(s, result) → result med perClass { classId: { name, players } }
//   avslutaMedForsok(avsluta, sid, vanta?) → kgAvsluta-svaret, två nya försök vid tillfälliga fel
// ============================================================================

import { KG_FORMAT } from "./kg-setup.js";

async function standardDeps() {
  const [{ avsluta }, { settleLiveRewards }, { isAdmin }] = await Promise.all([
    import("./kurragomma-data.js"),
    import("../../live-rewards-data.js"),
    import("../../../auth.js"),
  ]);
  return { avsluta, settle: settleLiveRewards, admin: isAdmin, klass: () => import("../../../klasscenter/kc-koppling.js") };
}

/** Kurragömmas result har inget perClass (en klass): klassbonusen (liveBonusar) behöver det. */
export function medPerClass(s, result) {
  if (!result || result.perClass) return result;
  const perClass = {};
  for (const cid of s?.participatingClassIds || []) perClass[cid] = { name: s?.classNames?.[cid] || cid, players: Number(result.players) || 0 };
  return { ...result, perClass };
}

/** Klasscentret som i live-data.js writeResultIfMissing – aldrig kastande. */
async function klasscenter(d, s, svar, avslutadeNu) {
  if (!d.admin?.() || !d.klass) return;
  try {
    const m = await d.klass();
    const skrev = { ...s, status: "finished", result: svar.result };
    if (svar.redan === false || avslutadeNu) await m.liveKlassBonus(medPerClass(s, svar.result));
    await m.pokalerEfterAvslut("live", s.id, skrev);
    await m.livePrisEfterAvslut(s.id, skrev);
  } catch (err) {
    console.warn("[kurragomma] klasscentret hoppades över", s.id, err?.code || err);
  }
}

/** Fel som inte blir bättre av ett nytt försök. */
const SLUTGILTIGA = new Set(["permission-denied", "unauthenticated", "invalid-argument", "not-found", "failed-precondition"]);
export const AVSLUTA_FORSOK_MS = [2000, 5000];

/** kgAvsluta med två nya försök vid tillfälliga fel (idempotent – samma result). */
export async function avslutaMedForsok(avsluta, sid, vanta = (ms) => new Promise((r) => setTimeout(r, ms))) {
  for (let i = 0; ; i++) {
    try {
      return await avsluta(sid);
    } catch (err) {
      if (i >= AVSLUTA_FORSOK_MS.length || SLUTGILTIGA.has(err?.code)) throw err;
      await vanta(AVSLUTA_FORSOK_MS[i]);
    }
  }
}

/** kgAvsluta (idempotent) och sedan pluggmynten ur det resultatet. Demo (s.demo) betalar aldrig. */
export async function avslutaOchBetala(s, deps = null, { avslutadeNu = false } = {}) {
  if (!s?.id) return null;
  const d = deps || (await standardDeps());
  const svar = await avslutaMedForsok(d.avsluta, s.id, d.vanta);
  const result = svar?.result || null;
  if (!result || s.demo === true) return result;
  if (result.rewards) await d.settle(s.id, { ...s, status: "finished", result });
  await klasscenter(d, s, svar, avslutadeNu);
  return result;
}

export async function resultInputs(s) {
  return { result: await avslutaOchBetala(s) };
}

/** Serverns result; utan det ett minimalt result utan mynt (reglerna nekar ändå klientens skrivning). */
export function buildResult(s, _classes, players = [], _mode = null, extra = undefined) {
  if (extra?.result) return extra.result;
  return {
    format: KG_FORMAT, winner: null, draw: false, players: (players || []).length,
    totalCorrect: 0, totalAnswered: 0, klaradeSig: 0, hittade: 0, visslingar: 0, ranking: [], gomstallen: [],
  };
}
