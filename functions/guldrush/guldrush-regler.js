// ============================================================================
// Guldrushen 💰 – SPELREGLERNA som ren logik (#563, epic #562). Delas med
// servern (functions/guldrush/ = genererad kopia, se chests-config.js) så att
// Cloud Functionen och elevens offerlista avgör EXAKT samma sak. Servern är
// ändå den enda som skriver guld – klienten använder bara reglerna för att
// grå:a ut offer som servern ändå skulle neka. Inga importer utom kistkonfigen.
//
// Spelare (grPlayers-dokumentet, se docs/DATAMODELL.md "Guldrushen"):
//   { uid, gold, shield, protectedUntil, lastVictimUid, … } – tider som ms
//   eller Firestore-Timestamp (toMs).
//
// TRYGGHET (§6.5) – kontrolleras här och av servern:
//   • stöldskydd GR_RULES.protectionMs efter att ha blivit bestulen/bytt
//   • ingen stjäl/byter med samma elev två gånger i rad (lastVictimUid)
//   • ingen effekt nollställer: stöld ≤ 15 %, hål i fickan ≤ 10 %, byte bara
//     med någon som har MER guld och bara om man själv har guld
//   • sköld (shield) stoppar NÄSTA stöld/byte och förbrukas då
//
// API
//   toMs(t)                         → ms | null
//   chestById(id)                   → kista | null
//   isVictimKind(chest)             → bool (stöld/byte – eleven väljer offer)
//   chestTable(stealSwap)           → [{ chest, weight }] – vikterna som gäller
//   rollChest(stealSwap, rng)       → kista (rng() i [0,1))
//   applySelfEffect(chest, gold)    → { delta, gold, shield }  (ej stöld/byte)
//   isProtected(p, now)             → bool
//   victimProblem(kind, thief, victim, now) → null | orsak ("sig-sjalv",
//                                     "saknas", "skyddad", "samma-igen",
//                                     "for-lite-guld", "inte-mer-guld",
//                                     "inget-eget-guld")
//   victimMessage(orsak)            → elevvänlig text
//   eligibleVictims(kind, thief, players, now, { random? }) → spelare som
//                                     går att välja (random: utan sköld)
//   resolveVictim(kind, thief, victim, share?) → { blocked, amount,
//                                     thiefGold, victimGold }
//   eventText(ev, { names })        → händelseflödets text (ev från grEvents)
// ============================================================================

import { GR_CHESTS, GR_EVENT_TEXTS, GR_ANON, GR_RULES } from "./chests-config.js";

const VICTIM_KINDS = ["steal", "swap"];
const int = (v) => Math.max(0, Math.floor(Number(v) || 0));

/** Timestamp | Date | number → ms (null om saknas). */
export function toMs(t) {
  if (t == null) return null;
  if (typeof t === "number") return Number.isFinite(t) ? t : null;
  if (typeof t.toMillis === "function") return t.toMillis();
  if (t instanceof Date) return t.getTime();
  if (typeof t.seconds === "number") return t.seconds * 1000 + Math.floor((t.nanoseconds || 0) / 1e6);
  return null;
}

export function chestById(id) {
  return GR_CHESTS.find((c) => c.id === id) || null;
}

export function isVictimKind(chest) {
  return VICTIM_KINDS.includes(chest?.effect?.kind);
}

/** Vikterna som gäller – stöld/byte av → deras vikt till guldkistorna. */
export function chestTable(stealSwap) {
  const rows = GR_CHESTS.map((chest) => ({ chest, weight: Math.max(0, Number(chest.weight) || 0) }));
  if (stealSwap !== false) return rows;
  const moved = rows.filter((r) => isVictimKind(r.chest)).reduce((n, r) => n + r.weight, 0);
  const gold = rows.filter((r) => r.chest.effect.kind === "gold");
  const goldSum = gold.reduce((n, r) => n + r.weight, 0);
  return rows.filter((r) => !isVictimKind(r.chest)).map((r) =>
    (r.chest.effect.kind === "gold" && goldSum > 0 ? { ...r, weight: r.weight + moved * (r.weight / goldSum) } : r));
}

/** Slumpa en kista ur tabellen. */
export function rollChest(stealSwap, rng = Math.random) {
  const rows = chestTable(stealSwap).filter((r) => r.weight > 0);
  const total = rows.reduce((n, r) => n + r.weight, 0);
  let x = Math.min(Math.max(Number(rng()) || 0, 0), 0.999999999) * total;
  for (const r of rows) {
    if (x < r.weight) return r.chest;
    x -= r.weight;
  }
  return rows[rows.length - 1].chest;
}

/** Kistor utan offer: nytt guld (aldrig under 0, aldrig över taket). */
export function applySelfEffect(chest, gold) {
  const g = int(gold);
  const e = chest?.effect || {};
  let delta = 0;
  if (e.kind === "gold") delta = int(e.amount);
  else if (e.kind === "double") delta = Math.min(g, int(e.cap));
  else if (e.kind === "lose") delta = -Math.floor(g * Math.min(Number(e.share) || 0, 0.1));
  const next = Math.min(GR_RULES.maxGold, Math.max(0, g + delta));
  return { delta: next - g, gold: next, shield: e.kind === "shield" };
}

export function isProtected(p, now) {
  const until = toMs(p?.protectedUntil);
  return until != null && until > now;
}

const stealShare = () => Math.min(Number(chestById("stold")?.effect?.share) || 0.15, 0.15);

/** Varför offret inte går att välja (null = går). Sköld är INTE ett hinder – den stoppar. */
export function victimProblem(kind, thief, victim, now) {
  if (!victim?.uid) return "saknas";
  if (victim.uid === thief?.uid) return "sig-sjalv";
  if (isProtected(victim, now)) return "skyddad";
  if (thief?.lastVictimUid && thief.lastVictimUid === victim.uid) return "samma-igen";
  if (kind === "steal" && Math.floor(int(victim.gold) * stealShare()) < 1) return "for-lite-guld";
  if (kind === "swap") {
    if (int(thief?.gold) < 1) return "inget-eget-guld";
    if (int(victim.gold) <= int(thief?.gold)) return "inte-mer-guld";
  }
  return null;
}

const MESSAGES = {
  "saknas": "Den eleven är inte med i matchen.",
  "sig-sjalv": "Du kan inte välja dig själv.",
  "skyddad": "Den eleven har stöldskydd en liten stund till 🛡️",
  "samma-igen": "Du kan inte välja samma elev två gånger i rad.",
  "for-lite-guld": "Den eleven har för lite guld att knycka.",
  "inte-mer-guld": "Du kan bara byta med någon som har mer guld än du.",
  "inget-eget-guld": "Du behöver eget guld för att byta.",
};
export function victimMessage(reason) {
  return MESSAGES[reason] || "Det går inte att välja den eleven.";
}

/** Offerlistan (elevens val) – random: servern slumpar bara bland dem utan sköld. */
export function eligibleVictims(kind, thief, players, now, { random = false } = {}) {
  return (players || []).filter((v) => !victimProblem(kind, thief, v, now) && !(random && v.shield));
}

/** Stöldens/bytets utfall (offret är redan kontrollerat med victimProblem). */
export function resolveVictim(kind, thief, victim) {
  const tg = int(thief?.gold);
  const vg = int(victim?.gold);
  if (victim?.shield) return { blocked: true, amount: 0, thiefGold: tg, victimGold: vg };
  if (kind === "swap") return { blocked: false, amount: vg - tg, thiefGold: vg, victimGold: tg };
  const amount = Math.floor(vg * stealShare());
  return { blocked: false, amount, thiefGold: Math.min(GR_RULES.maxGold, tg + amount), victimGold: vg - amount };
}

const fill = (tpl, vars) => String(tpl || "").replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ""));

/**
 * Händelseflödets text. ev = grEvents-dokumentet:
 *   { type: "chest"|"steal"|"swap"|"shieldBlock"|"lead", chest?, name,
 *     victimName?, amount? }
 * names false (session.showNames av) → "Någon"/"en klasskamrat".
 */
export function eventText(ev, { names = true } = {}) {
  const vars = {
    namn: names ? ev?.name || "?" : GR_ANON.namn,
    offer: names ? ev?.victimName || "?" : GR_ANON.offer,
    belopp: Math.abs(Number(ev?.amount) || 0).toLocaleString("sv-SE"),
  };
  if (ev?.type === "shieldBlock" || ev?.type === "lead") return fill(GR_EVENT_TEXTS[ev.type], vars);
  return fill(chestById(ev?.chest)?.eventText, vars);
}
