// ============================================================================
// Kistspel 🎁 – SPELREGLERNA som ren logik (#651, epic Datakuppen). Utbrutet
// ur Guldrushens delat/guldrush-regler.js (#563/#588): kistmotorn
// (tabelldriven slump), skyddet (protectedUntil), trygghetsreglerna,
// stöldens/bytets utfall och händelsetexterna – parametriserat, så att varje
// kistformat (Guldrushen, Datakuppen) ger sin egen kisttabell, sina rattar och
// texter. Ett format bygger sina regler EN gång med createKistRegler(…) och
// exporterar dem (se src/live/formats/guldrush/delat/guldrush-regler.js).
//
// ⚠️ DELAD MED SERVERN: functions/kistspel/ är en GENERERAD kopia av den här
// mappen (src/live/kistspel/delat/). Ändra bara här och kör
// `npm run sync:kistspel` (= sync:guldrush; deployens predeploy gör det
// också); test/live-guldrush-delat.test.js fäller en kopia som glidit isär.
// Lövmodul – inga importer (Cloud Functions laddar den utan resten av src/).
//
// MOTORNS ORD (valutaneutrala – temat sätter namn/enhet/ikon i texterna):
//   Spelaren  { uid, gold, protectedUntil, lastVictimUid, … }. Saldot heter
//             `gold` i motorn för alla format (Datakuppen visar det som MB).
//   Kista     { id, weight, effect, fallback?, eventText, feedText, … }
//   effect    { kind, … }:
//     "gold"   { amount }  +amount
//     "double" { cap }     dubblar saldot, högst +cap
//     "lose"   { share }   tappar floor(share × saldo), share ≤ loseCap (10 %)
//     "empty"              ingenting
//     "shield"             skyddad rules.shieldMs
//     "steal"  { share }   VÄLJ OFFER: knycker floor(share × offrets saldo),
//                          share ≤ stealCap (15 %)
//     "swap"               VÄLJ OFFER: byter allt med någon som har MER
//   Offer-kistor (steal/swap) av (stealSwap = false) → deras vikt fördelas på
//   "gold"-kistorna i proportion till deras egna vikter (chestTable).
//
// API
//   toMs(t) / protectedLeftMs(p, now) / isProtected(p, now) / fill(tpl, vars)
//   createKistRegler({
//     chests,       kisttabellen (frusen lista)
//     rules,        { shieldMs, protectionMs, maxGold, … }
//     eventTexts,   { lead, leadFeed, … } (ledningsbytets mallar)
//     anon,         { namn, offer } – namn av (session.showNames = false)
//     messages,     { [orsak]: mall med {namn} } – victimMessage
//     vars?,        extra mallvariabler i eventText (t.ex. { mynt: "{mynt}" })
//     stealCap? = 0.15, loseCap? = 0.1
//   }) → {
//     toMs, chestById(id), isVictimKind(chest), chestTable(stealSwap),
//     rollChest(stealSwap, rng), applySelfEffect(chest, gold) → { delta, gold, protect },
//     isProtected, protectedLeftMs, shieldUntil(now), hitProtectionUntil(p, now),
//     victimProblem(kind, thief, victim, now) → null | "sig-sjalv" | "saknas" |
//       "skyddad" | "samma-igen" | "for-lite-guld" | "inte-mer-guld" | "inget-eget-guld",
//     victimMessage(orsak, victim?), eligibleVictims(kind, thief, players, now),
//     resolveVictim(kind, thief, victim) → { amount, thiefGold, victimGold },
//     eventText(ev, { names?, short? }),
//   }
// ============================================================================

const VICTIM_KINDS = ["steal", "swap"];
const int = (v) => Math.max(0, Math.floor(Number(v) || 0));

export const fill = (tpl, vars) => String(tpl || "").replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ""));

/** Timestamp | Date | number → ms (null om saknas). */
export function toMs(t) {
  if (t == null) return null;
  if (typeof t === "number") return Number.isFinite(t) ? t : null;
  if (typeof t.toMillis === "function") return t.toMillis();
  if (t instanceof Date) return t.getTime();
  if (typeof t.seconds === "number") return t.seconds * 1000 + Math.floor((t.nanoseconds || 0) / 1e6);
  return null;
}

export function protectedLeftMs(p, now) {
  const until = toMs(p?.protectedUntil);
  return until != null && until > now ? until - now : 0;
}

export function isProtected(p, now) {
  return protectedLeftMs(p, now) > 0;
}

export function createKistRegler({
  chests, rules, eventTexts = {}, anon = {}, messages = {}, vars: extraVars = {}, stealCap = 0.15, loseCap = 0.1,
}) {
  function chestById(id) {
    return chests.find((c) => c.id === id) || null;
  }

  function isVictimKind(chest) {
    return VICTIM_KINDS.includes(chest?.effect?.kind);
  }

  /** Vikterna som gäller – stöld/byte av → deras vikt till guldkistorna. */
  function chestTable(stealSwap) {
    const rows = chests.map((chest) => ({ chest, weight: Math.max(0, Number(chest.weight) || 0) }));
    if (stealSwap !== false) return rows;
    const moved = rows.filter((r) => isVictimKind(r.chest)).reduce((n, r) => n + r.weight, 0);
    const gold = rows.filter((r) => r.chest.effect.kind === "gold");
    const goldSum = gold.reduce((n, r) => n + r.weight, 0);
    return rows.filter((r) => !isVictimKind(r.chest)).map((r) =>
      (r.chest.effect.kind === "gold" && goldSum > 0 ? { ...r, weight: r.weight + moved * (r.weight / goldSum) } : r));
  }

  /** Slumpa en kista ur tabellen. */
  function rollChest(stealSwap, rng = Math.random) {
    const rows = chestTable(stealSwap).filter((r) => r.weight > 0);
    const total = rows.reduce((n, r) => n + r.weight, 0);
    let x = Math.min(Math.max(Number(rng()) || 0, 0), 0.999999999) * total;
    for (const r of rows) {
      if (x < r.weight) return r.chest;
      x -= r.weight;
    }
    return rows[rows.length - 1].chest;
  }

  /** Kistor utan offer: nytt saldo (aldrig under 0, aldrig över taket). */
  function applySelfEffect(chest, gold) {
    const g = int(gold);
    const e = chest?.effect || {};
    let delta = 0;
    if (e.kind === "gold") delta = int(e.amount);
    else if (e.kind === "double") delta = Math.min(g, int(e.cap));
    else if (e.kind === "lose") delta = -Math.floor(g * Math.min(Number(e.share) || 0, loseCap));
    const next = Math.min(rules.maxGold, Math.max(0, g + delta));
    return { delta: next - g, gold: next, protect: e.kind === "shield" };
  }

  /** Sköld-kistan: skyddad shieldMs från NU (redan skyddad → förlängs dit). */
  function shieldUntil(now) {
    return now + rules.shieldMs;
  }

  /** Bestulen/bytt: stöldskydd protectionMs – kortar aldrig ett längre skydd. */
  function hitProtectionUntil(p, now) {
    return Math.max(toMs(p?.protectedUntil) ?? 0, now + rules.protectionMs);
  }

  const stealChest = chests.find((c) => c.effect?.kind === "steal") || null;
  const stealShare = () => Math.min(Number(stealChest?.effect?.share) || stealCap, stealCap);

  /** Varför offret inte går att välja (null = går) – i ögonblicket `now`. */
  function victimProblem(kind, thief, victim, now) {
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

  function victimMessage(reason, victim = null) {
    const namn = String(victim?.name || "").trim().split(/\s+/)[0] || "Klasskamraten";
    return fill(messages[reason] || "Det går inte att välja den eleven.", { namn });
  }

  /** De som går att välja just nu (offerlistan; servern slumpar bland dem). */
  function eligibleVictims(kind, thief, players, now) {
    return (players || []).filter((v) => !victimProblem(kind, thief, v, now));
  }

  /** Stöldens/bytets utfall (offret är redan kontrollerat med victimProblem). */
  function resolveVictim(kind, thief, victim) {
    const tg = int(thief?.gold);
    const vg = int(victim?.gold);
    if (kind === "swap") return { amount: vg - tg, thiefGold: vg, victimGold: tg };
    const amount = Math.floor(vg * stealShare());
    return { amount, thiefGold: Math.min(rules.maxGold, tg + amount), victimGold: vg - amount };
  }

  /**
   * Händelseflödets text. ev = händelsedokumentet:
   *   { type: "chest"|"steal"|"swap"|"lead", chest?, name, victimName?, amount? }
   * names false → anon-namnen. Okänd typ → "".
   */
  function eventText(ev, { names = true, short = false } = {}) {
    const vars = {
      namn: names ? ev?.name || "?" : anon.namn,
      offer: names ? ev?.victimName || "?" : anon.offer,
      belopp: Math.abs(Number(ev?.amount) || 0).toLocaleString("sv-SE"),
      ...extraVars,
    };
    if (ev?.type === "lead") return fill(short ? eventTexts.leadFeed : eventTexts.lead, vars);
    if (ev?.type && !["chest", ...VICTIM_KINDS].includes(ev.type)) return "";
    const chest = chestById(ev?.chest);
    return fill(short ? chest?.feedText || chest?.eventText : chest?.eventText, vars);
  }

  return {
    toMs, chestById, isVictimKind, chestTable, rollChest, applySelfEffect, protectedLeftMs, isProtected,
    shieldUntil, hitProtectionUntil, victimProblem, victimMessage, eligibleVictims, resolveVictim, eventText,
  };
}
