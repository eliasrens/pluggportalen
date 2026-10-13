// ============================================================================
// Guldrushen – Skattkammaren (#565, designspec §6): REN LOGIK för projektor-
// vyerna. Ingen DOM, ingen Firebase – testas i test/live-guldrush-projektor
// .test.js. Vyerna ritar bara det som räknas ut här; guld och placering kommer
// ALLTID ur serverns grPlayers/grEvents (designspec §1), aldrig ur en animation.
//
// ENLIGT SPECEN (Elias 2026-10-10, #578): Guldrushen visar rangordning –
// Snilleblixtens "ingen uthängning" gäller inte här. Skattkammaren: topp 10
// som avatarer vid egna guldhögar, händelseflöde med namn och små avatarer
// (lärarens "Visa namn" av → inga namn och inga avatarer i flödet), banderoll
// vid Skattkammare, Byte och ledningsbyte. Statistiken: exakt ställning för
// alla elever. Trygghetsreglerna (§6.5) gäller: lekfulla mallar, inget hån.
//
// Logiken är den gemensamma kistspelsmodulen (#651): src/live/kistspel/
// ks-proj-scen.js – här bara Guldrushens tema (delmålen, banderollerna,
// ljuden, finalens rubrik och totalrad). Samma API som förut.
//
// API
//   GR_SCEN                       Guldrushens tema (kistspel createProjScen)
//   GR_TOP                        10 guldhögar
//   GR_TICK_S                     tick sista 10 s
//   GR_MILESTONES                 klassens gemensamma delmål (guld)
//   matchClock(s, now)            → { msLeft, secs, text, tension, phase }
//   topPiles(players, n?)         → de n rikaste (guld > 0), rank-ordning
//   pileSlot(i)                   → { row: 0 överst | 1 underst, col 0–4 } –
//                                   läsordning: 1–5 överst, 6–10 underst (#579)
//   createPileScale(min?)         → { ref(maxGold) } – skalans tak höjs bara
//                                   (en hög krymper bara när DEN tappar guld)
//   pileLevel(gold, ref)          → 0.18–1 (höjd som andel av taket)
//   isProtected(p, now)           → skyddad just nu (guldrush-regler.js, #588:
//                                   🛡️ vid namnet + bubblan bara då)
//   milestone(total)              → { prev, next, frac } – nästa delmål
//   crossedMilestone(from, to)    → högsta delmål som passerades | null
//   feedItem(ev, { names })       → händelseflödets post (text, short = EN
//                                   kort rad i flödet (#591), avatarer, stor?,
//                                   ljud, banderoll, reaktioner) | null
//                                   (null = visas inte: 0 guld tappat/dubblat)
//   weight(item) / trimPending(list, max?) → händelseflödets gallring vid
//                                   trängsel (småguld först, stora sist)
//   podiumGroups(players)         → [{ rank, players }] ≤ 3 steg, delad plats
//   classTitle(s)                 → "4B" / "4B + 5E"
//   FINAL_TITLE                   → "🏆 Guldrushen – Prispall" (finalens rubrik)
//   togetherHtml(gold)            → "Tillsammans: <strong>4 380 guld</strong> 💰"
//   statSummary(standing)         → klassens siffror (statistikvyn)
//   standingRows(players, now)    → exakt ställning för alla elever
//                                   [{ uid, rank, name, gold, correct,
//                                   answered, share, shield }]
//   createRate({ windowMs? })     → { add(total, now), perMin(now) } – svar/min
//                                   (null de första 15 s – inget påhittat 0)
//   tal(n)                        → "2 140"
// ============================================================================

import {
  KS_TOP, KS_TICK_S, tal, matchClock, topPiles, pileSlot, createPileScale, pileLevel, podiumGroups,
  classTitle, statSummary, standingRows, createRate, createProjScen,
} from "../../kistspel/ks-proj-scen.js";
import { GR_REGLER, isProtected } from "./delat/guldrush-regler.js";

export {
  tal, matchClock, topPiles, pileSlot, createPileScale, pileLevel, podiumGroups, classTitle,
  statSummary, standingRows, createRate, isProtected,
};

export const GR_TOP = KS_TOP;
export const GR_TICK_S = KS_TICK_S;

/** Guldrushens tema för projektorn (kistspel createProjScen). */
export const GR_SCEN = createProjScen({
  regler: GR_REGLER,
  milestones: [250, 500, 1000, 2000, 3000, 5000, 7500, 10000, 15000, 20000, 30000, 50000, 75000, 100000],
  title: "🏆 Guldrushen – Prispall",
  unit: "guld",
  icon: "💰",
  feed: {
    lead: {
      cue: "swoosh", tone: "gold",
      banner: (who) => ({ icon: "⭐", title: who ? `Ny ledare: ${who}!` : "Ny ledare!", sub: "", tone: "gold" }),
    },
    swap: {
      cue: "fanfarKort",
      banner: (who, ev, names) => ({
        icon: "🔄", title: "BYTE!", sub: names ? `${who} och ${ev?.victimName || ""} bytte guld` : "Två skattjägare bytte guld", tone: "blue",
      }),
    },
    steal: { cue: "stold" },
    bigChests: {
      skattkammare: {
        cue: "fanfarKort", tone: "gold",
        banner: (who, ev, names) => ({
          icon: "👑", title: "SKATTKAMMARE!", sub: names ? `${who} hittade ${tal(ev?.amount)} guld` : `+${tal(ev?.amount)} guld`, tone: "gold",
        }),
      },
    },
    small: ["lite_guld", "tom"],
  },
});

export const GR_MILESTONES = GR_SCEN.milestones;
export const { milestone, crossedMilestone, feedItem, weight, trimPending, FINAL_TITLE, togetherHtml } = GR_SCEN;
