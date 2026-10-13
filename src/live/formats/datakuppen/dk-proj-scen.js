// ============================================================================
// Datakuppen 💾 – NÄTVERKET (#654, spec §0.2, §4.2): REN LOGIK för projektor-
// vyerna. Ingen DOM, ingen Firebase – testas i test/live-datakuppen-
// projektor.test.js. Data och placering kommer ALLTID ur serverns dkPlayers/
// dkEvents, aldrig ur en animation.
//
// Logiken är den gemensamma kistspelsmodulen (#651): src/live/kistspel/
// ks-proj-scen.js – här bara Datakuppens tema (delmålen, terminalraderna,
// ljuden, finalens rubrik och totalrad) och det som är nytt i Nätverket:
// serverskåpens lysdioder, hack-ljuslinjens väg och säkerhetstipsen.
// Datakuppen har ingen banderoll: terminalen bär händelserna, hack-linjen och
// totalrutan de stora ögonblicken.
//
// API
//   DK_SCEN                       Datakuppens tema (kistspel createProjScen)
//   DK_TOP / DK_TICK_S            10 servrar · tick sista 10 s
//   DK_MILESTONES                 klassens gemensamma delmål (MB)
//   matchClock, topPiles, pileSlot, createPileScale, pileLevel, isProtected,
//   podiumGroups, statSummary, standingRows, createRate, tal   (ks-proj-scen)
//   milestone, crossedMilestone, feedItem, weight, trimPending,
//   FINAL_TITLE ("🏆 Datakuppen – Prispall"), togetherHtml(mb) → "Tillsammans:
//   <strong>12 400 MB</strong>"
//   DK_LEDS                       lysdioder per serverskåp (10)
//   ledCount(mb, ref)             → 2–10 tända lysdioder (pileLevel × DK_LEDS)
//   hackLink(ev)                  → { from, to } för ett lyckat hack | null
//   circuitPath(a, b, { lift? })  → SVG-väg (kretsbana: upp, tvärs, ned)
//                                   mellan två serverskåp ({ x, y } i px)
//   tipAt(now, { periodMs?, tips? }) → säkerhetstipset som visas nu (roterar)
//   hackShare(hacks)              → andel lyckade hack i hela procent | null
// ============================================================================

import {
  KS_TOP, KS_TICK_S, tal, matchClock, topPiles, pileSlot, createPileScale, pileLevel, podiumGroups,
  classTitle, statSummary, standingRows, createRate, createProjScen,
} from "../../kistspel/ks-proj-scen.js";
import { DK_REGLER, isProtected } from "./delat/datakuppen-regler.js";
import { DK_TIPS } from "./delat/files-config.js";

export {
  tal, matchClock, topPiles, pileSlot, createPileScale, pileLevel, podiumGroups, classTitle,
  statSummary, standingRows, createRate, isProtected,
};

export const DK_TOP = KS_TOP;
export const DK_TICK_S = KS_TICK_S;

const ingenBanderoll = () => null;

/** Datakuppens tema för projektorn (kistspel createProjScen). */
export const DK_SCEN = createProjScen({
  regler: DK_REGLER,
  milestones: [250, 500, 1000, 2000, 3000, 5000, 7500, 10000, 15000, 20000, 30000, 50000, 75000, 100000],
  title: "🏆 Datakuppen – Prispall",
  unit: "MB",
  feed: {
    lead: { cue: "dkLedare", banner: ingenBanderoll },
    // Datakuppen har inget byte – posten krävs av motorn men används aldrig.
    swap: { cue: "dkAccess", banner: ingenBanderoll },
    steal: { cue: "dkAccess" },
    bigChests: { serverhall: { cue: "dkUpp", banner: ingenBanderoll } },
    small: ["liten_fil", "tom_mapp"],
  },
});

export const DK_MILESTONES = DK_SCEN.milestones;
export const { milestone, crossedMilestone, feedItem, weight, trimPending, FINAL_TITLE, togetherHtml } = DK_SCEN;

export const DK_LEDS = 10;

/** Tända lysdioder i serverskåpet: växer med datan (samma skala som Guldrushens högar). */
export function ledCount(mb, ref) {
  return Math.max(0, Math.min(DK_LEDS, Math.round(pileLevel(mb, ref) * DK_LEDS)));
}

/** Ett lyckat hack (servern skriver bara lyckade: type "steal", chest "hack"). */
export function hackLink(ev) {
  if (ev?.type !== "steal" || ev?.chest !== "hack" || !ev.uid || !ev.victimUid || ev.uid === ev.victimUid) return null;
  return { from: ev.uid, to: ev.victimUid };
}

const r1 = (v) => Math.round(v * 10) / 10;

/**
 * Kretsbanan mellan två servrar: rakt upp från hackaren, tvärs över en bit
 * ovanför den högsta av dem, rakt ned till målet – med rundade hörn.
 */
export function circuitPath(a, b, { lift = 40, radius = 14 } = {}) {
  const top = Math.min(a.y, b.y) - lift;
  const dir = b.x >= a.x ? 1 : -1;
  const r = Math.max(0, Math.min(radius, Math.abs(b.x - a.x) / 2, lift));
  return [
    `M${r1(a.x)} ${r1(a.y)}`,
    `V${r1(top + r)}`,
    `Q${r1(a.x)} ${r1(top)} ${r1(a.x + dir * r)} ${r1(top)}`,
    `H${r1(b.x - dir * r)}`,
    `Q${r1(b.x)} ${r1(top)} ${r1(b.x)} ${r1(top + r)}`,
    `V${r1(b.y)}`,
  ].join(" ");
}

/** Säkerhetstipset som visas nu – byts var periodMs (samma tips i alla fönster). */
export function tipAt(now, { periodMs = 9000, tips = DK_TIPS } = {}) {
  if (!tips.length) return "";
  const i = Math.floor((Number(now) || 0) / periodMs) % tips.length;
  return tips[(i + tips.length) % tips.length];
}

/** Andel lyckade hack för hela klassen (null innan någon försökt). */
export function hackShare(hacks) {
  const a = Number(hacks?.attempts) || 0;
  return a > 0 ? Math.round(((Number(hacks?.success) || 0) / a) * 100) : null;
}
