// ============================================================================
// Guldrushen (#564): ELEVSKÄRMENS LOGIK – ren (ingen DOM/Firebase), testas i
// test/live-guldrush-elev.test.js. Vyn (guldrush-student.js + gr-kistor.js +
// gr-offer.js) ritar bara det som räknas ut här (designspec §6.4–6.6).
//
// Allt guld kommer ur grPlayers (bara servern skriver, #563). Eleven räknar
// aldrig själv ut vad en kista innehåller – kistans utseende/ljud slås upp ur
// kistkonfigen (delat/chests-config.js) med det id servern svarade.
//
// INGEN PLACERING SOM NUMMER (Elias 2026-10-10, samma regel som
// Snilleblixten): toppraden visar läget mot närmaste elev FRAMFÖR ("20 guld
// bakom Alma" / "Du leder! 💰"); bara topp 3 ser sin pallplats på slutskärmen.
//
// Logiken är den gemensamma kistspelsmodulen (#651): src/live/kistspel/
// ks-elev.js – här bara Guldrushens texter. Samma API som förut.
//
// API
//   goldStanding(grPlayers, uid) → { gold, rel }   rel = relativeStanding (guld)
//   standingText(rel) → "20 guld bakom Alma" | "Du leder! 💰" | "Lika med Alma" | ""
//   victimRows(kind, me, grPlayers, now) → [{ uid, name, first, classId, gold,
//       ok, shield, leftMs, why }]  offerväljarens knappar: sorterade på guld
//       (mest först), aldrig en själv; byte visar BARA de med mer guld.
//       ok=false = gråad (skyddad "🛡️ 0:04" / samma igen / för lite guld);
//       leftMs = skyddet kvar – listan ritas om tills den blir valbar
//   protectionText(ms) → "0:42" (skyddets nedräkning, uppåt avrundad)
//   myProtection(me, now) → "🛡️ Skyddad 0:42" | "" (elevens egen toppruta)
//   pendingLeftMs(pending, now) → ms kvar att välja offer (0 = slut)
//   chestView(result) → { chest, look, sound, icon, label, delta, gold, mood,
//       caption }  kistans visning ur serverns svar (openChest/chooseVictim)
//   victimView(result, names?) → samma för stöldens/bytets utfall
//   createHitWatcher() → { take(me) → notis | null }  "🦝 Leo knyckte 20 guld
//       från dig!" – FÖRSTA anropet är baslinjen (omladdning visar inget gammalt)
//   endStanding(result, uid) → { podium: 1|2|3|null, row, rel }
//   stageAction(phase) → "spel" | "lobby" | "slut" | null
//   formatGold(n) → "1 240"
//   countUp(from, to, t) → värdet vid t ∈ [0,1] (mjuk inbromsning)
//   chestKey(sid, uid) → localStorage-nyckeln för en oöppnad kista
// ============================================================================

import { GR_EVENT_TEXTS, GR_RULES } from "./delat/chests-config.js";
import { GR_REGLER } from "./delat/guldrush-regler.js";
import {
  firstName, formatGold, goldStanding, protectionText, myProtection, endStanding, stageAction, countUp, createKistElev,
} from "../../kistspel/ks-elev.js";

export { firstName, formatGold, goldStanding, protectionText, myProtection, endStanding, stageAction, countUp };

/** Guldrushens tema för elevskärmen (kistspel createKistElev). */
export const GR_ELEV = createKistElev({
  regler: GR_REGLER,
  rules: GR_RULES,
  eventTexts: GR_EVENT_TEXTS,
  keyPrefix: "pp:gr:kista",
  jubelChests: ["skattkammare"],
  texts: {
    lead: "Du leder! 💰",
    leadTie: (n) => `Lika med ${n} – ni leder! 💰`,
    tie: (n) => `Lika med ${n}`,
    behind: (diff, n) => `${diff} guld bakom ${n}`,
    why: { "samma-igen": "Nyss vald", "for-lite-guld": "För lite guld" },
    gain: (x) => `+${x} guld`,
    lose: (x) => `−${x} guld`,
    loseEmpty: "Puh, fickan var tom!",
    empty: "Bara ett löv …",
    shield: (sek) => `Skyddad i ${sek} s!`,
    steal: "Stöld! Välj vem",
    swap: "Byte! Välj vem",
    fallback: (x) => `Ingen att välja – +${x} guld`,
    swapped: (who) => `🔄 Du bytte guld med ${who}!`,
    stole: (x, who) => `🦝 +${x} guld från ${who}!`,
  },
});

export const { standingText, victimRows, pendingLeftMs, chestView, victimView, createHitWatcher, chestKey } = GR_ELEV;
