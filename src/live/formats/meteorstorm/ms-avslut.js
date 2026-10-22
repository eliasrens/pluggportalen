// ============================================================================
// Meteorstormen ☄️ (#823, spec §7, LIVE-FORMAT §6): RESULTATET och
// PLUGGMYNTEN på lärarsidan.
//
// SERVERN räknar slutet: msAvsluta kör motorn med hela loggen och skriver
// liveSessions.result (med result.rewards) – ingen klient får skriva result
// här (reglerna). Kärnan (live-feed.js, historiken) gör som för alla format:
// resultInputs(s) → buildResult(…, extra) → writeResultIfMissing. För
// Meteorstormen är resultInputs = anropa msAvsluta, och buildResult lämnar
// bara tillbaka serverns result – writeResultIfMissing ser då att result redan
// finns och skriver ingenting.
//
// Därför betalar kärnan aldrig ut mynten här (den gör det bara när DEN skrev
// result). avslutaOchBetala gör det: msAvsluta → settleLiveRewards med
// serverns result (idempotent – kvittot coinReceipts/{uid}; bara läraren får
// skriva kvittot, så en elevs anrop betalar inget). Historiken försöker igen
// (teacher-live-history.js) om lärarfliken stängdes.
//
// KLASSCENTRET (#823 F2): kärnan delar ut klassbonusen, klasspokalerna och
// Live-priset till klasskassan bara när den själv skrev result
// (live-data.js writeResultIfMissing, admin). Här gör avslutaOchBetala samma
// sak med samma argument: pokalerna och kassapriset är idempotenta
// (deterministiska id) och körs varje gång; klassbonusen ÖKAR klassens EXP och
// är inte idempotent – den delas bara ut av det msAvsluta-anrop som SKREV
// result (svarets redan === false, servern avgör i en transaktion), som
// kärnans "klienten vars transaktion skrev result". ⚠️ Skrev en elevs
// msAvsluta result (projektorn stängd vid slutet) blir det ingen klassbonus –
// pokalerna och priset delas ändå ut av historikens settle (meteorstorm-history.js)
// när en admin öppnar matchen. Bara klassbonusen kan gå förlorad.
//
// API
//   buildResult(s, classes, players, mode, extra?) → extra.result | ett tomt
//                     result utan rewards (om servern inte kunde nås)
//   resultInputs(s) → { result } – msAvsluta + utbetalning (lärare)
//   avslutaOchBetala(s, deps?) → result | null
//     deps = { avsluta(sid), settle(sid, session), admin(), klass } (testerna)
//     klass = kc-koppling.js (liveKlassBonus, pokalerEfterAvslut, livePrisEfterAvslut)
// ============================================================================

import { MS_FORMAT } from "./ms-setup.js";

async function standardDeps() {
  const [{ avsluta }, { settleLiveRewards }, { isAdmin }] = await Promise.all([
    import("./meteorstorm-data.js"),
    import("../../live-rewards-data.js"),
    import("../../../auth.js"),
  ]);
  return { avsluta, settle: settleLiveRewards, admin: isAdmin, klass: () => import("../../../klasscenter/kc-koppling.js") };
}

/** Klasscentret som i live-data.js writeResultIfMissing – aldrig kastande. */
async function klasscenter(d, s, svar) {
  if (!d.admin?.() || !d.klass) return;
  try {
    const m = await d.klass();
    const skrev = { ...s, status: "finished", result: svar.result };
    if (svar.redan === false) await m.liveKlassBonus(svar.result);
    await m.pokalerEfterAvslut("live", s.id, skrev);
    await m.livePrisEfterAvslut(s.id, skrev);
  } catch (err) {
    console.warn("[meteorstorm] klasscentret hoppades över", s.id, err?.code || err);
  }
}

/**
 * msAvsluta (idempotent – finns result får vi det) och sedan pluggmynten ur
 * det resultatet. Kastar om servern inte kan nås; själva utbetalningen kastar
 * aldrig (settleLiveRewards sväljer och loggar).
 */
export async function avslutaOchBetala(s, deps = null) {
  if (!s?.id) return null;
  const d = deps || (await standardDeps());
  const svar = await d.avsluta(s.id);
  const result = svar?.result || null;
  if (!result || s.demo === true) return result;
  if (result.rewards) await d.settle(s.id, { ...s, status: "finished", result });
  await klasscenter(d, s, svar);
  return result;
}

export async function resultInputs(s) {
  return { result: await avslutaOchBetala(s) };
}

/**
 * Serverns result. Utan det (msAvsluta gick inte att nå) ett minimalt result
 * utan mynt – reglerna nekar ändå klientens skrivning, så historiken frågar
 * servern igen nästa gång.
 */
export function buildResult(s, _classes, players = [], _mode = null, extra = undefined) {
  if (extra?.result) return extra.result;
  return {
    format: MS_FORMAT,
    lage: s?.msInstallningar?.lage ?? null,
    winner: null,
    draw: false,
    placering: [],
    players: (players || []).length,
    totalCorrect: 0,
    totalAnswered: 0,
    ranking: [],
  };
}
