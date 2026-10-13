// ============================================================================
// Datakuppen 💾 – FILTABELLEN, valutan och säkerhetstipsen (#652, epic
// Datakuppen, spec docs/UTVECKLINGSUPPDRAG_DATAKUPPEN.md §1.1, §1.3, §1.7).
// EN konfig för filerna: effekt, sannolikhet OCH utseende/ljud/händelsetext –
// samma stil som Guldrushens chests-config.js. En ny filtyp läggs till HÄR –
// servern, elevvyn och projektorn läser samma post.
//
// ⚠️ DELAD MED SERVERN: functions/datakuppen/ är en GENERERAD kopia av den här
// mappen (src/live/formats/datakuppen/delat/, även koder.json). Ändra bara här
// och kör `npm run sync:kistspel` (firebase-deployens predeploy gör det också);
// test/live-datakuppen.test.js fäller en kopia som glidit isär.
// Lövmodul – inga importer (Cloud Functions laddar den utan resten av src/).
//
// Servern läser BARA id, weight och effect (+ fallback). Visuella fält (icon,
// label, rarity, look, sound, eventText, feedText) ignoreras där. Emojierna i
// icon är bara beskrivning – elevvyn/projektorn ritar egna SVG:er per id.
//
// FIL = { id, icon, label, rarity, weight, effect, look, sound, eventText,
//         feedText, fallback? } – kistmotorns "kista" (src/live/kistspel/delat/
//   ks-regler.js). Saldot heter `gold` i motorn; Datakuppen visar det som MB.
//   effect  "gold" { amount } +MB · "double" { cap } dubblar, högst +cap ·
//           "lose" { share } virus, ≤ 10 % · "empty" · "shield" brandvägg
//           (DK_RULES.shieldMs) · "steal" { share } HACK: välj mål och knäck
//           koden (servern, functions/datakuppen-core.js), ≤ 15 %
//   fallback  (hack) filens id när ingen kan väljas (alla skyddade …)
//   eventText {namn} öppnaren, {belopp}, {offer} målet; feedText = projektorns
//           terminalrad (högst en kort rad)
//
// HACKNING AV (lärarens val, session.hacking = false): Hack kan inte komma –
// dess vikt fördelas på datafilerna (effect "gold") i proportion till deras
// egna vikter (kistmotorns chestTable), som Guldrushens "Stöld och byte av".
// ============================================================================

// Valutan (§1.1) – namn, enhet och ikon kan bytas här.
export const DK_CURRENCY = Object.freeze({ name: "data", unit: "MB", icon: "💾" });

export const DK_FILES = Object.freeze([
  {
    id: "liten_fil", icon: "📄", label: "Liten fil", rarity: "vanlig", weight: 22,
    effect: { kind: "gold", amount: 10 },
    look: "fil-liten", sound: "beep", eventText: "📄 {namn} laddade ner {belopp} MB",
    feedText: "> {namn} laddade ner {belopp} MB",
  },
  {
    id: "mapp", icon: "📁", label: "Mapp", rarity: "vanlig", weight: 20,
    effect: { kind: "gold", amount: 25 },
    look: "mapp", sound: "beep", eventText: "📁 {namn} laddade ner {belopp} MB",
    feedText: "> {namn} laddade ner {belopp} MB",
  },
  {
    id: "stor_fil", icon: "💽", label: "Stor fil", rarity: "ovanlig", weight: 9,
    effect: { kind: "gold", amount: 50 },
    look: "fil-stor", sound: "beep-dubbel", eventText: "💽 {namn} laddade ner {belopp} MB",
    feedText: "> {namn} laddade ner {belopp} MB",
  },
  {
    id: "serverhall", icon: "🖥️", label: "Serverhall", rarity: "sällsynt", weight: 3,
    effect: { kind: "gold", amount: 100 },
    look: "serverhall", sound: "uppladdning", eventText: "🖥️ SERVERHALL! {namn} laddade ner {belopp} MB",
    feedText: "> {namn} hittade en serverhall: +{belopp} MB",
  },
  {
    id: "overklockning", icon: "⚡", label: "Överklockning", rarity: "ovanlig", weight: 7,
    effect: { kind: "double", cap: 150 },
    look: "overklockning", sound: "laddning", eventText: "⚡ {namn} överklockade och dubblade sin data (+{belopp} MB)",
    feedText: "> {namn} överklockade: +{belopp} MB",
  },
  {
    id: "virus", icon: "🐛", label: "Virus", rarity: "ovanlig", weight: 8,
    effect: { kind: "lose", share: 0.1 },
    look: "virus", sound: "glitch", eventText: "🐛 Hoppsan! {namn} fick ett virus: −{belopp} MB",
    feedText: "> {namn} fick ett virus: −{belopp} MB",
  },
  {
    id: "tom_mapp", icon: "🗂️", label: "Tom mapp", rarity: "vanlig", weight: 13,
    effect: { kind: "empty" },
    look: "tom-mapp", sound: "puff", eventText: "🗂️ {namn} hittade en tom mapp.",
    feedText: "> {namn}: tom mapp",
  },
  {
    id: "brandvagg", icon: "🧱", label: "Brandvägg", rarity: "ovanlig", weight: 6,
    effect: { kind: "shield" },
    look: "brandvagg", sound: "vosh", eventText: "🧱 {namn} aktiverade brandvägg!",
    feedText: "> {namn} aktiverade brandvägg",
  },
  {
    id: "hack", icon: "💻", label: "Hack", rarity: "ovanlig", weight: 9,
    effect: { kind: "steal", share: 0.15 }, fallback: "mapp",
    look: "hack", sound: "access", eventText: "💻 {namn} hackade {offer}: +{belopp} MB",
    feedText: "> {namn} hackade {offer}: +{belopp} MB",
  },
]);

// Händelser som inte är en fil (samma mallar som eventText).
export const DK_EVENT_TEXTS = Object.freeze({
  lead: "⭐ {namn} tog ledningen!",
  leadFeed: "> {namn} leder!",
  // Målets egen notis när koden knäckts (elevskärmen, §1.5).
  victimSteal: "💻 {namn} knäckte din kod och tog {belopp} MB!",
});

// Namn i händelseflödet AV (session.showNames = false): mallarnas namn byts.
export const DK_ANON = Object.freeze({ namn: "Någon", offer: "en klasskamrat" });

// Spelets rattar (servern kontrollerar alla).
export const DK_RULES = Object.freeze({
  chestsOffered: 3, // filer att välja mellan efter ett rätt svar
  // ETT skydd (protectedUntil, kistmotorn): ingen kan hacka en skyddad elev.
  shieldMs: 60_000, // Brandvägg-filen
  protectionMs: 30_000, // skydd efter att ha blivit hackad (§1.5)
  victimPickMs: 10_000, // tid att välja mål innan servern slumpar (§1.4 steg 1)
  victimGraceMs: 5_000, // nätverksmarginal efter varje nedräkning
  codeGuessMs: 10_000, // tid att välja kod; ute = hacket misslyckas (§1.4 steg 2)
  codePickMs: 10_000, // tid att välja ny kod efter hack innan servern väljer (§1.5)
  codeOffers: 4, // kodförslag att välja bland (lobbyn + efter hack)
  codeOptions: 3, // koder i ett hackförsök (1 rätt + 2 lockkoder)
  minChestGapMs: 1_000, // minsta tid mellan två filer per elev (skript-spärr)
  maxGold: 1_000_000, // tak för data
});

// Säkerhetstipsen (§1.7) – roterar i lobbyn och på finalskärmen.
export const DK_TIPS = Object.freeze([
  "Ett bra lösenord är långt och svårt att gissa.",
  "Berätta aldrig ditt lösenord för någon, inte ens för en kompis.",
  "Använd inte samma lösenord överallt.",
  "Om någon frågar efter ditt lösenord – säg nej och berätta för en vuxen.",
  "Logga alltid ut när du lånat någon annans dator.",
  "Klicka inte på länkar från någon du inte känner.",
]);
