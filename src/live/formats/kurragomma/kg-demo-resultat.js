// ============================================================================
// Kurragömma 🙈 (#839, LIVE-FORMAT §8): demots RESULTAT – samma form som serverns
// kgAvsluta (functions/kurragomma-resultat.js byggResultat): överlevnadspoängen
// åt dem som är gömda vid slutet, delad placering, gömställena (matchen är slut
// – avslöjar inget), result.rewards ur live-rewards withRewards (demot betalar
// ändå aldrig: sessionen är demo: true). Ren funktion – testad i
// test/live-kurragomma-demo.test.js.
//
//   byggDemoResultat({ session, spelare, secrets, events, t0, letStart, slut })
//     → { result, totaler: { uid: { poang, klaradeSig, klar } } }
// ============================================================================

import { withRewards } from "../../live-rewards.js";
import { poangGomdVidSlut, placering, rewardRader } from "./delat/kg-regler.js";

export function byggDemoResultat({ session, spelare, secrets, events = [], t0, letStart, slut }) {
  const letStartAt = letStart ?? slut;
  const rader = spelare.map((p) => ({
    uid: p.uid, name: String(p.name || ""), classId: p.classId, roll: p.roll, klaradeSig: p.roll === "gomd",
    poang: (p.poang | 0) + (p.roll === "gomd" ? poangGomdVidSlut({ letStartAt, slutAt: slut }) : 0),
    ratt: p.ratt | 0, besvarade: p.besvarade | 0, hittade: p.hittade | 0,
  }));
  const ranking = placering(rader).map(({ plats, ...r }) => ({ ...r, rank: plats }));
  const flest = [...rader].filter((r) => r.hittade > 0).sort((a, b) => b.hittade - a.hittade || a.uid.localeCompare(b.uid))[0] || null;
  const namn = (uid) => spelare.find((p) => p.uid === uid)?.name || "";
  const gomstallen = [...secrets.entries()]
    .filter(([, d]) => Number.isFinite(d?.x) && Number.isFinite(d?.z))
    .map(([uid, d]) => ({ uid, x: d.x, z: d.z, skydd: d.skydd | 0, namn: namn(uid), hittad: d.gomd !== true }))
    .sort((a, b) => a.uid.localeCompare(b.uid));
  const result = withRewards(session, {
    format: "kurragomma", winner: null, draw: false, startMs: t0, letStartMs: letStart, slutMs: slut,
    players: rader.filter((r) => r.besvarade > 0).length,
    totalCorrect: rader.reduce((n, r) => n + r.ratt, 0),
    totalAnswered: rader.reduce((n, r) => n + r.besvarade, 0),
    klaradeSig: rader.filter((r) => r.klaradeSig).length,
    hittade: rader.filter((r) => !r.klaradeSig && Number.isFinite(secrets.get(r.uid)?.x)).length,
    visslingar: events.filter((e) => e.typ === "vissling").length,
    flestHittade: flest ? { uid: flest.uid, name: flest.name, antal: flest.hittade } : null,
    ranking, gomstallen, perQuestion: [], demo: true,
  }, rewardRader(rader));
  const totaler = {};
  for (const r of rader) totaler[r.uid] = { poang: r.poang, klaradeSig: r.klaradeSig, klar: true };
  return { result, totaler };
}
