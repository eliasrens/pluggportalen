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
// Servern läser BARA id, weight, sannolikhet och effect (+ fallback). Visuella
// fält (icon, label, rarity, look, sound, eventText, feedText) ignoreras där.
// Emojierna i icon är bara beskrivning – elevvyn/projektorn ritar egna SVG:er.
//
// FIL = { id, icon, label, rarity, weight, sannolikhet?, effect, look, sound,
//         eventText, feedText, fallback? } – kistmotorns "kista" (src/live/
//   kistspel/delat/ks-regler.js). Saldot heter `gold` i motorn; Datakuppen
//   visar det som MB. Slumpen och effekterna: delat/dk-filregler.js (#832).
//   effect  "gold" { amount } +MB · "double" { factor, cap } saldot × factor,
//           högst +cap · "lose" { min, max } virus, fast min–max MB (bara
//           efter en felsvit) · "shield" brandvägg (DK_RULES.shieldMs) ·
//           "steal" { share } HACK: välj mål och knäck koden (servern,
//           functions/datakuppen-core.js), ≤ 15 %
//   sannolikhet  fast andel (Superservern 1 %), tas från vanlig mapp
//   fallback  (hack) filens id när ingen kan väljas (alla skyddade …)
//   eventText {namn} öppnaren, {belopp}, {offer} målet; feedText = projektorns
//           terminalrad (högst en kort rad). eventText null = syns inte på
//           projektorn (viruset, #832 §15)
//
// HACKNING AV (lärarens val, session.hacking = false): Hack kan inte komma –
// dess andel fördelas på datafilerna (effect "gold", utom Superservern) i
// proportion till deras andelar, som Guldrushens "Stöld och byte av".
// ============================================================================

// Valutan (§1.1) – namn, enhet och ikon kan bytas här.
export const DK_CURRENCY = Object.freeze({ name: "data", unit: "MB", icon: "💾" });

// KLASSRÅDETS ÄNDRINGAR (#832, uppdraget datakuppen-klassradet.md §2). Alla
// värden här – servern läser samma kopia (functions/datakuppen/). Filernas
// effekter i DK_FILES nedan hämtar sina värden härifrån; reglerna läses av
// delat/dk-filregler.js (tabellen, viruset) och servern (hack, kodläcka).
export const DK_BALANS = Object.freeze({
  filer: Object.freeze({
    // "Liten mapp" i uppdraget = filen Liten fil: ger 50 MB (var 10).
    litenMapp: Object.freeze({ id: "liten_fil", mb: 50 }),
    // "Vanlig mapp" = filen Mapp: 100 MB (var 25; Elias #832 F1 – större än liten mapp).
    // Superserverns procent tas härifrån.
    vanligMapp: Object.freeze({ id: "mapp", mb: 100 }),
    // Jackpotten: 1000 MB med exakt 1 % per fil, oavsett lärarens val och felsvit.
    // overklockas false = ger alltid exakt mb (Överklockningen rör den aldrig).
    superserver: Object.freeze({ id: "superserver", mb: 1000, sannolikhet: 0.01, overklockas: false }),
    // Tom mapp är borttagen: dess vikt (13) gick proportionellt till liten och vanlig mapp.
    tomMapp: null,
  }),
  overklockning: Object.freeze({
    multiplikator: 3, // ett steg högre (×2 → ×3): saldot tredubblas när filen öppnas …
    tak: 300, // … högst +300 MB (var +150 vid ×2 – samma brytpunkt, 150 MB saldo)
  }),
  virus: Object.freeze({
    efterFelIRad: 3, // viruset kan bara komma på ett rätt svar efter minst så här många fel i rad
    minMb: 10, // fast förlust, heltal min–max (slumpas av servern), aldrig under 0 MB
    maxMb: 20,
  }),
  hack: Object.freeze({
    ersattningOmIngetMal: "litenMapp", // ingen går att hacka → en liten mapp (50 MB) i stället
    nyttMalvalSekunder: 10, // brandvägg/kodbyte under hacket → ny tid att välja mål
  }),
  kodlacka: Object.freeze({
    grans: 5, // så många olika klasskamrater som listat ut ens kod → man får byta
    gransSmaKlasser: 3, // gränsen när matchen har färre än smaKlassUnder elever
    smaKlassUnder: 12,
  }),
});

const { litenMapp, vanligMapp, superserver } = DK_BALANS.filer;

// Vikter (andel = vikt / summan, 97). Tomma mappens vikt 13 fördelad på liten
// och vanlig mapp i proportion till deras vikter 22 och 20 (#832 §3.1).
export const DK_FILES = Object.freeze([
  {
    id: litenMapp.id, icon: "📄", label: "Liten fil", rarity: "vanlig", weight: 22 + (13 * 22) / 42,
    effect: { kind: "gold", amount: litenMapp.mb },
    look: "fil-liten", sound: "beep", eventText: "📄 {namn} laddade ner {belopp} MB",
    feedText: "> {namn} laddade ner {belopp} MB",
  },
  {
    id: vanligMapp.id, icon: "📁", label: "Mapp", rarity: "vanlig", weight: 20 + (13 * 20) / 42,
    effect: { kind: "gold", amount: vanligMapp.mb },
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
    feedText: "> {namn}: serverhall +{belopp} MB",
  },
  {
    // Jackpotten (#832 §3.3): fast 1 % per fil, tas från vanlig mapp.
    id: superserver.id, icon: "🚀", label: "Superserver", rarity: "jackpott", weight: 0,
    sannolikhet: superserver.sannolikhet,
    effect: { kind: "gold", amount: superserver.mb },
    look: "superserver", sound: "treklang", eventText: "🚀 {namn} hittade en Superserver: +{belopp} MB!",
    feedText: "🚀 {namn} hittade en Superserver: +{belopp} MB!",
  },
  {
    id: "overklockning", icon: "⚡", label: "Överklockning", rarity: "ovanlig", weight: 7,
    effect: { kind: "double", factor: DK_BALANS.overklockning.multiplikator, cap: DK_BALANS.overklockning.tak },
    look: "overklockning", sound: "laddning",
    eventText: `⚡ {namn} överklockade ×${DK_BALANS.overklockning.multiplikator} (+{belopp} MB)`,
    feedText: "> {namn} överklockade: +{belopp} MB",
  },
  {
    // Bara efter en felsvit (DK_BALANS.virus) – syns aldrig på projektorn (#832 §4, §15).
    id: "virus", icon: "🐛", label: "Virus", rarity: "ovanlig", weight: 8,
    effect: { kind: "lose", min: DK_BALANS.virus.minMb, max: DK_BALANS.virus.maxMb },
    look: "virus", sound: "glitch", eventText: null, feedText: null,
  },
  {
    id: "brandvagg", icon: "🧱", label: "Brandvägg", rarity: "ovanlig", weight: 6,
    effect: { kind: "shield" },
    look: "brandvagg", sound: "vosh", eventText: "🧱 {namn} aktiverade brandvägg!",
    feedText: "> {namn} aktiverade brandvägg",
  },
  {
    id: "hack", icon: "💻", label: "Hack", rarity: "ovanlig", weight: 9,
    effect: { kind: "steal", share: 0.15 }, fallback: DK_BALANS.filer[DK_BALANS.hack.ersattningOmIngetMal].id,
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
  // Elevens egna meddelanden efter klassrådet (#832 §8) – aldrig på projektorn.
  superserver: "🚀 Superserver! +{belopp} MB",
  virus: "🐛 Ett virus åt upp {belopp} MB. Det kan hända när man gissar många gånger i rad. Läs frågan noga!",
  virusTomt: "🐛 Ett virus försökte, men det fanns ingen data att ta. Läs frågan noga!",
  ingetMal: "Ingen gick att hacka just nu, du fick {belopp} MB i stället.",
  kodlacka: "🔓 Din kod har läckt! Välj en ny.",
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
  codeOffers: 4, // kodförslag att välja bland (lobbyn, efter ett hack och efter en kodläcka)
  codePickMs: 10_000, // tid att välja ny kod efter hack/läcka innan servern väljer (#832 §6.4)
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
