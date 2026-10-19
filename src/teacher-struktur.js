// ============================================================================
// Pluggporten – lärarsidan: placeringskartan (teacher-struktur.js, #803)
// ----------------------------------------------------------------------------
// Epic #802 (Lärarsidan – enklare struktur), spec §0.1 "Ingen funktion får
// försvinna". EN rad per flik i TEACHER_TABS, sektion i CLASS_SECTIONS och
// statistikflik i STATS_TABS:
//   roll  – vem som når den i dag ("alla" = årskurslärare + admin, "admin")
//   efter – var den ligger efter omgörningen (spec DEL 1–8)
//   del   – sub-issuen som flyttar den dit (A = #803 … F); "–" = ligger redan rätt
// test/lararsida-inventering.test.js kontrollerar att varje rad finns, att
// rollen stämmer med registryn och att allt går att nå i toppmenyn. En ny flik
// eller sektion utan rad här gör testet rött. B–F uppdaterar `efter`/`del` när
// de flyttar något. Den läsbara tabellen: docs/LARARSIDAN_INVENTERING.md.
// Ren data utan importer; laddas aldrig i bootgrafen (#271).
// ============================================================================

/** Toppmenyns val efter omgörningen (DEL 1.1) + profilmenyn (DEL 1.2). */
export const NYA_PLATSER = ["Hem", "Mina klasser", "Material", "Prov", "Live", "Admin", "Profilmenyn"];

export const PLACERING = {
  flikar: {
    hem: { roll: "alla", efter: "Hem", del: "E" },
    klasser: { roll: "alla", efter: "Mina klasser → Vad eleverna ser · Fokusläge · Elever", del: "B" },
    statistik: { roll: "alla", efter: "Mina klasser → Hur går det?", del: "B" },
    material: { roll: "alla", efter: "Material (underflikarna nedan)", del: "D" },
    prov: { roll: "alla", efter: "Prov → Mina prov (med Att rätta överst)", del: "E" },
    provtillfallen: { roll: "alla", efter: "Prov → Provtillfällen", del: "–" },
    live: { roll: "alla", efter: "Live", del: "–" },
    mattematchen: { roll: "admin", efter: "Live → Mattematchen (och kort på Admin)", del: "–" },
    adminklasser: { roll: "admin", efter: "Admin → Klasser (skapa/döp om/ta bort) + Mina klasser → Elever", del: "C" },
    konton: { roll: "admin", efter: "Admin → Lärarkonton", del: "C" },
    sasong: { roll: "admin", efter: "Admin → Säsong", del: "C" },
    hjalp: { roll: "alla", efter: "Profilmenyn → Hjälp och guide", del: "F" },
  },
  // Materialets underflikar (#806, teacher-material-flikar.js): var de gamla flikarna Plugga-material,
  // Bråkresan och Hitta rätt! (och de nya Läsresan, Ekvationsresan, Schack) ligger.
  material: {
    plugga: { roll: "alla", efter: "Material → Plugga-områden", del: "D" },
    lasresan: { roll: "alla", efter: "Material → Läsresan (förklaring + länk till nivåerna)", del: "D" },
    ekvationsresan: { roll: "alla", efter: "Material → Ekvationsresan (prova som lärare)", del: "D" },
    brakresan: { roll: "alla", efter: "Material → Bråkresan (testläge)", del: "D" },
    "hitta-ratt": { roll: "admin", efter: "Material → Hitta rätt! (och kort på Admin)", del: "D" },
    schack: { roll: "alla", efter: "Material → Schack (prova mot datorn)", del: "D" },
  },
  sektioner: {
    inloggning: { roll: "alla", efter: "Mina klasser → Elever", del: "B" },
    elever: { roll: "admin", efter: "Mina klasser → Elever (admin: konton och mynt)", del: "C" },
    omraden: { roll: "alla", efter: "Mina klasser → Vad eleverna ser → 1. Områden", del: "B" },
    lagen: { roll: "alla", efter: "Mina klasser → Vad eleverna ser → 3. Avancerat (ihopfällt)", del: "B" },
    synlighet: { roll: "alla", efter: "Mina klasser → Vad eleverna ser → 2. Delar i elevernas meny", del: "B" },
    fokus: { roll: "alla", efter: "Mina klasser → Fokusläge", del: "B" },
    schack: { roll: "alla", efter: "Mina klasser → Hur går det? → Schack (på/av under Vad eleverna ser)", del: "B" },
    klasscenter: { roll: "admin", efter: "Mina klasser → Elever (admin: Klasscentret)", del: "C" },
    statistik: { roll: "alla", efter: "Mina klasser → Hur går det?", del: "B" },
  },
  statistik: {
    amnen: { roll: "alla", efter: "Mina klasser → Hur går det? → Ämnen", del: "B" },
    omraden: { roll: "alla", efter: "Mina klasser → Hur går det? → Per område", del: "B" },
    lasresan: { roll: "alla", efter: "Mina klasser → Hur går det? → Läsresan (med nivåerna)", del: "B" },
    ekvationsresan: { roll: "alla", efter: "Mina klasser → Hur går det? → Ekvationsresan (med nivåerna)", del: "B" },
    prov: { roll: "alla", efter: "Mina klasser → Hur går det? → Prov", del: "B" },
    brakresan: { roll: "alla", efter: "Mina klasser → Hur går det? → Bråkresan", del: "B" },
    mattematchen: { roll: "alla", efter: "Mina klasser → Hur går det? → Mattematchen", del: "B" },
    live: { roll: "alla", efter: "Mina klasser → Hur går det? → Live", del: "B" },
  },
};

/** Gamla adresser (DEL 7) → planerad plats; nuvarande mål står i TEACHER_REDIRECTS. */
export const GAMLA_ADRESSER = {
  "/larare/oversikt": "Hem",
  "/larare/klasser": "Mina klasser → Vad eleverna ser",
  "/larare/statistik": "Mina klasser → Hur går det?",
  "/larare/admin/klasser": "Admin, och för en vald klass Mina klasser → Elever",
  "/larare/innehall": "Material → Plugga-områden",
  "/larare/brakresan": "Material → Bråkresan",
  "/larare/hitta-ratt": "Material → Hitta rätt! (?prov= fungerar som förut)",
};
