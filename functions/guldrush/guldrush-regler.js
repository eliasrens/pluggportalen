// ============================================================================
// Guldrushen 💰 – SPELREGLERNA som ren logik (#563, epic #562). Delas med
// servern (functions/guldrush/ = genererad kopia, se chests-config.js) så att
// Cloud Functionen och elevens offerlista avgör EXAKT samma sak. Servern är
// ändå den enda som skriver guld – klienten använder bara reglerna för att
// grå:a ut offer som servern ändå skulle neka. Inga importer utom kistkonfigen.
//
// Spelare (grPlayers-dokumentet, se docs/DATAMODELL.md "Guldrushen"):
//   { uid, gold, protectedUntil, lastVictimUid, … } – tider som ms eller
//   Firestore-Timestamp (toMs).
//
// ETT SKYDD (#588): protectedUntil. Skyddad = protectedUntil > nu – ingen kan
// stjäla från eller byta med eleven. Sköld-kistan → nu + GR_RULES.shieldMs
// (60 s; redan skyddad → förlängs till 60 s från nu), bestulen/bytt → nu +
// GR_RULES.protectionMs (30 s). Skyddet går ut av sig självt; servern prövar
// det i ögonblicket valet görs (victimProblem), slumpen tar bara oskyddade.
//
// TRYGGHET (§6.5) – kontrolleras här och av servern:
//   • skyddad elev (ovan) går inte att välja
//   • ingen stjäl/byter med samma elev två gånger i rad (lastVictimUid)
//   • ingen effekt nollställer: stöld ≤ 15 %, hål i fickan ≤ 10 %, byte bara
//     med någon som har MER guld och bara om man själv har guld
//
// API
//   toMs(t)                         → ms | null
//   chestById(id)                   → kista | null
//   isVictimKind(chest)             → bool (stöld/byte – eleven väljer offer)
//   chestTable(stealSwap)           → [{ chest, weight }] – vikterna som gäller
//   rollChest(stealSwap, rng)       → kista (rng() i [0,1))
//   applySelfEffect(chest, gold)    → { delta, gold, protect }  (ej stöld/
//                                     byte; protect = kistan ger skydd)
//   isProtected(p, now)             → bool
//   protectedLeftMs(p, now)         → ms kvar av skyddet (0 = oskyddad)
//   shieldUntil(now)                → protectedUntil (ms) efter Sköld-kistan
//   hitProtectionUntil(p, now)      → protectedUntil (ms) efter bestulen/bytt
//   victimProblem(kind, thief, victim, now) → null | orsak ("sig-sjalv",
//                                     "saknas", "skyddad", "samma-igen",
//                                     "for-lite-guld", "inte-mer-guld",
//                                     "inget-eget-guld")
//   victimMessage(orsak, victim?)   → elevvänlig text ("🛡️ Alma hann skaffa
//                                     en sköld!")
//   eligibleVictims(kind, thief, players, now) → spelare som går att välja
//                                     (servern slumpar bland dem)
//   resolveVictim(kind, thief, victim) → { amount, thiefGold, victimGold }
//   eventText(ev, { names })        → händelseflödets text (ev från grEvents)
//                                     ("{mynt}" = mynt-ikonens markör, #590)
// ============================================================================

import { GR_CHESTS, GR_EVENT_TEXTS, GR_ANON, GR_RULES, GR_COIN } from "./chests-config.js";

const VICTIM_KINDS = ["steal", "swap"];
const int = (v) => Math.max(0, Math.floor(Number(v) || 0));
const fill = (tpl, vars) => String(tpl || "").replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ""));

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
  return { delta: next - g, gold: next, protect: e.kind === "shield" };
}

export function protectedLeftMs(p, now) {
  const until = toMs(p?.protectedUntil);
  return until != null && until > now ? until - now : 0;
}

export function isProtected(p, now) {
  return protectedLeftMs(p, now) > 0;
}

/** Sköld-kistan: skyddad shieldMs från NU (redan skyddad → förlängs dit). */
export function shieldUntil(now) {
  return now + GR_RULES.shieldMs;
}

/** Bestulen/bytt: stöldskydd protectionMs – kortar aldrig ett längre skydd. */
export function hitProtectionUntil(p, now) {
  return Math.max(toMs(p?.protectedUntil) ?? 0, now + GR_RULES.protectionMs);
}

const stealShare = () => Math.min(Number(chestById("stold")?.effect?.share) || 0.15, 0.15);

/** Varför offret inte går att välja (null = går) – i ögonblicket `now`. */
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
  "skyddad": "🛡️ {namn} hann skaffa en sköld!",
  "samma-igen": "Du kan inte välja samma elev två gånger i rad.",
  "for-lite-guld": "Den eleven har för lite guld att knycka.",
  "inte-mer-guld": "Du kan bara byta med någon som har mer guld än du.",
  "inget-eget-guld": "Du behöver eget guld för att byta.",
};
export function victimMessage(reason, victim = null) {
  const namn = String(victim?.name || "").trim().split(/\s+/)[0] || "Klasskamraten";
  return fill(MESSAGES[reason] || "Det går inte att välja den eleven.", { namn });
}

/** De som går att välja just nu (offerlistan; servern slumpar bland dem). */
export function eligibleVictims(kind, thief, players, now) {
  return (players || []).filter((v) => !victimProblem(kind, thief, v, now));
}

/** Stöldens/bytets utfall (offret är redan kontrollerat med victimProblem). */
export function resolveVictim(kind, thief, victim) {
  const tg = int(thief?.gold);
  const vg = int(victim?.gold);
  if (kind === "swap") return { amount: vg - tg, thiefGold: vg, victimGold: tg };
  const amount = Math.floor(vg * stealShare());
  return { amount, thiefGold: Math.min(GR_RULES.maxGold, tg + amount), victimGold: vg - amount };
}

/**
 * Händelseflödets text. ev = grEvents-dokumentet:
 *   { type: "chest"|"steal"|"swap"|"lead", chest?, name, victimName?, amount? }
 * names false (session.showNames av) → "Någon"/"en klasskamrat". Okänd typ
 * (t.ex. "shieldBlock" från före #588) → "".
 */
export function eventText(ev, { names = true } = {}) {
  const vars = {
    namn: names ? ev?.name || "?" : GR_ANON.namn,
    offer: names ? ev?.victimName || "?" : GR_ANON.offer,
    belopp: Math.abs(Number(ev?.amount) || 0).toLocaleString("sv-SE"),
    mynt: GR_COIN, // markören står kvar – UI:t byter den mot mynt-ikonen
  };
  if (ev?.type === "lead") return fill(GR_EVENT_TEXTS.lead, vars);
  if (ev?.type && !["chest", ...VICTIM_KINDS].includes(ev.type)) return "";
  return fill(chestById(ev?.chest)?.eventText, vars);
}
