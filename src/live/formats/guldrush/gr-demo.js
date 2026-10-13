// ============================================================================
// Guldrushen – ISOLERAT DEMOLÄGE (#566, funktionsspec §7.7, designspec §13).
// En hel match i minnet, byggd på Snilleblixtens demoramverk (#560: samma 30
// påhittade elever med olika djur + kläder, samma "reducerad rörelse"). Svar
// strömmar in (rätt + fel), rätt svar öppnar en kista med formatets RIKTIGA
// regler (rollChest/applySelfEffect/eligibleVictims/resolveVictim – samma
// som servern), händelserna och ledningsbytet skrivs som servern skriver dem
// (grEvents, nyast först) och ställningen/resultatet ur computeStandings/
// buildResult. Projektorn monteras med `deps` (mountProjector) – inget
// Firestore-lager laddas, inga Cloud Functions anropas, inget skrivs: inga
// sessioner, resultat eller pluggmynt (sessionen har dessutom demo:true, som
// live-rewards aldrig betalar för). Sidan: preview/preview-guldrush-demo.html.
// Testas i test/live-guldrush-demo.test.js.
//
// Demomotorn är den gemensamma kistspelsmodulen (#651): src/live/kistspel/
// ks-demo.js – här bara Guldrushens tema (kistornas id, delmålen, texterna).
//
// API
//   createGrDemo({ sid, classes?, showNames?, stealSwap?, screen?, now?, auto?,
//                  onLog?, rng? }) → demo
//     demo.deps                     mountProjector-deps (subscribe, now, start,
//                                   finish, remove, loadProjection, guldrush)
//     demo.join(n, staggerMs)       n elever ansluter (lobbyn)
//     demo.setAuto(on)              svar strömmar in (~75 % rätt) under matchen
//     demo.answer(uid, correct, chestId?) ett svar; rätt → kista (slumpad
//                                   eller chestId)
//     demo.chest(id)                trigga EN kisttyp (stöld/byte väljer offer)
//     demo.shield({ ms? })          en elev i topp 3 öppnar Sköld-kistan →
//                                   skyddad 60 s (ms: kortare, för att se
//                                   skyddet gå ut); offerlistor hoppar över den
//     demo.protectedList()          [{ uid, name, leftMs }] – skyddade just nu
//     demo.leadChange()             en ny elev tar ensam ledningen
//     demo.storm()                  alla elever öppnar en kista samtidigt
//     demo.treasure()               klassen når nästa gemensamma skatt (en
//                                   Guld-kista tar totalen över delmålet, #591)
//     demo.soonOut(sek)             matchen har sek sekunder kvar
//     demo.playHistory(n)           n svar direkt (en pågående match)
//     demo.jumpToFinal(tie, n?)     hoppa till pallplatsen; tie null | "andra"
//                                   (delad 2:a) | "forsta" (oavgjort om 1:a);
//                                   n = antal elever (alla 30 om utelämnat)
//     demo.toggleFreeze()           tiden står still (skärmdumpar)
//     demo.state()                  { session, players, grPlayers, events, answers, reads }
//   forceReducedMotion(on)          (Snilleblixtens demo) – bara demot
// ============================================================================

import { createKistDemo } from "../../kistspel/ks-demo.js";
import { computeStandings, buildResult } from "./guldrush-core.js";
import { GR_REGLER } from "./delat/guldrush-regler.js";
import { GR_CHESTS } from "./delat/chests-config.js";
import { milestone } from "./gr-proj-scen.js";
import { withGrIcons } from "./gr-ikoner.js";

export { forceReducedMotion } from "../snilleblixt/sb-demo.js";
export const DEMO_CHESTS = GR_CHESTS.map((c) => ({ id: c.id, icon: withGrIcons(c.icon), label: c.label }));

const THEME = {
  format: "guldrush",
  displayName: "Guldrushen",
  regler: GR_REGLER,
  computeStandings,
  buildResult,
  milestone,
  chests: { fallback: "guld", shield: "skold", lead: "skattkammare", treasure: "guld" },
  dataKey: "guldrush",
  logs: { allReached: "alla skatter redan hittade", reached: (next, name) => `🎉 skatt ${next} – ${name}` },
};

export function createGrDemo(opts = {}) {
  return createKistDemo(THEME, { sid: "demo-guldrush", ...opts });
}
