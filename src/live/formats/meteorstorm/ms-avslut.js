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
// API
//   buildResult(s, classes, players, mode, extra?) → extra.result | ett tomt
//                     result utan rewards (om servern inte kunde nås)
//   resultInputs(s) → { result } – msAvsluta + utbetalning (lärare)
//   avslutaOchBetala(s, deps?) → result | null
//     deps = { avsluta(sid), settle(sid, session) } (testerna/demot)
// ============================================================================

import { MS_FORMAT } from "./ms-setup.js";

async function standardDeps() {
  const [{ avsluta }, { settleLiveRewards }] = await Promise.all([
    import("./meteorstorm-data.js"),
    import("../../live-rewards-data.js"),
  ]);
  return { avsluta, settle: settleLiveRewards };
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
  if (result?.rewards && s.demo !== true) {
    await d.settle(s.id, { ...s, status: "finished", result });
  }
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
