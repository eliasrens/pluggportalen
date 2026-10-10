// ============================================================================
// Guldrushen 💰 – KISTTABELLEN (#563, epic #562). EN konfig för kistorna:
// effekt, sannolikhet OCH utseende/ljud/händelsetext (designspec §6.4). En ny
// kisttyp läggs till HÄR – servern, elevvyn och projektorn läser samma post.
//
// ⚠️ DELAD MED SERVERN: functions/guldrush/ är en GENERERAD kopia av den här
// mappen (src/live/formats/guldrush/delat/). Ändra bara här och kör
// `npm run sync:guldrush` (firebase-deployens predeploy gör det också);
// test/live-guldrush-delat.test.js fäller en kopia som glidit isär.
// Lövmodul – inga importer (Cloud Functions laddar den utan resten av src/).
//
// Servern läser BARA id, weight och effect (+ fallback). Visuella fält (icon,
// label, rarity, look, sound, eventText) ignoreras där.
//
// KISTA = { id, icon, label, rarity, weight, effect, look, sound, eventText,
//           fallback? }
//   weight  relativ sannolikhet (summan behöver inte vara 100)
//   effect  { kind, … } – vad kistan gör (guldrush-regler.js applySelfEffect /
//           resolveVictim):
//     "gold"   { amount }  +amount guld
//     "double" { cap }     dubblar elevens guld, högst +cap
//     "lose"   { share }   tappar floor(share × guld) (Hål i fickan, ≤ 10 %)
//     "empty"              ingenting
//     "shield"             skyddar mot NÄSTA stöld/byte
//     "steal"  { share }   VÄLJ OFFER: knycker floor(share × offrets guld)
//     "swap"               VÄLJ OFFER: byter allt guld med någon som har MER
//   fallback  (steal/swap) kistans id som gäller i stället när ingen kan väljas
//             (alla skyddade, ingen har mer guld …) – "vanlig guldkista"
//   look/sound  animations- och ljud-id för elevvyn/projektorn
//   eventText   händelseflödets mall: {namn} öppnaren, {belopp}, {offer}
//
// STÖLD OCH BYTE AV (lärarens val, session.stealSwap = false): steal/swap
// kan inte komma – deras vikt fördelas på guldkistorna (effect "gold") i
// proportion till guldkistornas egna vikter (guldrush-regler.js chestTable).
// ============================================================================

export const GR_CHESTS = Object.freeze([
  {
    id: "lite_guld", icon: "🪙", label: "Lite guld", rarity: "vanlig", weight: 22,
    effect: { kind: "gold", amount: 10 },
    look: "mynt-hopp", sound: "klirr", eventText: "🪙 {namn} hittade {belopp} guld!",
  },
  {
    id: "guld", icon: "💰", label: "Guld", rarity: "vanlig", weight: 20,
    effect: { kind: "gold", amount: 25 },
    look: "mynt-fontan", sound: "klirr-stor", eventText: "💰 {namn} hittade {belopp} guld!",
  },
  {
    id: "mycket_guld", icon: "💎", label: "Mycket guld", rarity: "ovanlig", weight: 9,
    effect: { kind: "gold", amount: 50 },
    look: "adelstenar", sound: "glitter", eventText: "💎 {namn} hittade {belopp} guld!",
  },
  {
    id: "skattkammare", icon: "👑", label: "Skattkammare", rarity: "sällsynt", weight: 3,
    effect: { kind: "gold", amount: 100 },
    look: "guldexplosion", sound: "fanfar", eventText: "👑 SKATTKAMMARE! {namn} hittade {belopp} guld!",
  },
  {
    id: "dubbla", icon: "✖️2", label: "Dubbla", rarity: "ovanlig", weight: 7,
    effect: { kind: "double", cap: 150 },
    look: "siffra-delas", sound: "pling-pling", eventText: "✖️2 {namn} dubblade sitt guld (+{belopp})!",
  },
  {
    id: "stold", icon: "🦝", label: "Stöld", rarity: "ovanlig", weight: 9,
    effect: { kind: "steal", share: 0.15 }, fallback: "guld",
    look: "tvattbjorn", sound: "smygtassar", eventText: "🦝 {namn} knyckte {belopp} guld från {offer}!",
  },
  {
    id: "byte", icon: "🔄", label: "Byte", rarity: "sällsynt", weight: 3,
    effect: { kind: "swap" }, fallback: "guld",
    look: "guldpilar", sound: "svisch", eventText: "🔄 {namn} och {offer} bytte guld!",
  },
  {
    id: "hal_i_fickan", icon: "🕳️", label: "Hål i fickan", rarity: "ovanlig", weight: 8,
    effect: { kind: "lose", share: 0.1 },
    look: "mynt-rullar", sound: "mynt-studs", eventText: "🕳️ Hoppsan! {namn} tappade {belopp} guld.",
  },
  {
    id: "tom", icon: "🍃", label: "Tom kista", rarity: "vanlig", weight: 13,
    effect: { kind: "empty" },
    look: "lov-dammpuff", sound: "puff", eventText: "🍃 {namn} hittade ett löv.",
  },
  {
    id: "skold", icon: "🛡️", label: "Sköld", rarity: "ovanlig", weight: 6,
    effect: { kind: "shield" },
    look: "skold-glod", sound: "vosh", eventText: "🛡️ {namn} skaffade en sköld!",
  },
]);

// Händelser som inte är en kista (samma mallar som eventText).
export const GR_EVENT_TEXTS = Object.freeze({
  // Offrets sköld stoppade en stöld/ett byte – skölden förbrukas.
  shieldBlock: "🛡️ {offer}s sköld stoppade {namn}!",
  lead: "⭐ {namn} tog ledningen!",
  // Elevens egen notis när någon knyckt/bytt (elevskärmen, §6.7).
  victimSteal: "🦝 {namn} knyckte {belopp} guld från dig!",
  victimSwap: "🔄 {namn} bytte guld med dig!",
  victimBlocked: "🛡️ Din sköld stoppade {namn}!",
});

// Namn i händelseflödet AV (session.showNames = false): mallarnas namn byts.
export const GR_ANON = Object.freeze({ namn: "Någon", offer: "en klasskamrat" });

// Spelets rattar (servern kontrollerar alla).
export const GR_RULES = Object.freeze({
  chestsOffered: 3, // kistor att välja mellan efter ett rätt svar
  protectionMs: 30_000, // stöldskydd efter bestulen/bytt (§6.5)
  victimPickMs: 10_000, // tid att välja offer innan servern slumpar (§6.4)
  victimGraceMs: 5_000, // nätverksmarginal efter victimPickMs
  minChestGapMs: 1_000, // minsta tid mellan två kistor per elev (skript-spärr)
  maxGold: 1_000_000, // tak – ingen kan räkna upp guld i det oändliga
});
