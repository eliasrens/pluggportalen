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
    // #804: Klasser + Statistik blev EN flik, Mina klasser (#/larare/mina-klasser).
    klasser: { roll: "alla", efter: "Mina klasser → Hur går det? · Vad eleverna ser · Fokusläge · Elever", del: "B" },
    innehall: { roll: "alla", efter: "Material → Plugga-områden", del: "D" },
    brakresan: { roll: "alla", efter: "Material → Bråkresan", del: "D" },
    hittaratt: { roll: "admin", efter: "Material → Hitta rätt! (och kort på Admin)", del: "D" },
    prov: { roll: "alla", efter: "Prov → Mina prov (med Att rätta överst)", del: "E" },
    provtillfallen: { roll: "alla", efter: "Prov → Provtillfällen", del: "–" },
    live: { roll: "alla", efter: "Live", del: "–" },
    mattematchen: { roll: "admin", efter: "Live → Mattematchen (och kort på Admin)", del: "–" },
    // #805: förr adminklasser (#/larare/admin/klasser, omdirigeras) – nu Admin-sidan med kort.
    admin: { roll: "admin", efter: "Admin → kort: Skapa klass · Döp om klass · Ta bort klass · Lärarkonton · Säsong · Hitta rätt! · Mattematchen", del: "C" },
    konton: { roll: "admin", efter: "Admin → Lärarkonton (kort + underflik)", del: "C" },
    sasong: { roll: "admin", efter: "Admin → Säsong (kort + underflik)", del: "C" },
    hjalp: { roll: "alla", efter: "Profilmenyn → Hjälp och guide", del: "F" },
  },
  sektioner: {
    inloggning: { roll: "alla", efter: "Mina klasser → Elever (kompakt tabell, ⋯ Byt lösenord)", del: "C" },
    elever: { roll: "admin", efter: "Mina klasser → Elever (admin: samma tabell + Ge mynt, Ta ur klassen, Ta bort konto, Lägg till elev)", del: "C" },
    omraden: { roll: "alla", efter: "Mina klasser → Vad eleverna ser → 1. Områden", del: "B" },
    lagen: { roll: "alla", efter: "Mina klasser → Vad eleverna ser → 3. Avancerat (ihopfällt)", del: "B" },
    synlighet: { roll: "alla", efter: "Mina klasser → Vad eleverna ser → 2. Delar i elevernas meny", del: "B" },
    fokus: { roll: "alla", efter: "Mina klasser → Fokusläge", del: "B" },
    klasscenter: { roll: "admin", efter: "Mina klasser → Elever (admin: Klasscentret under tabellen)", del: "C" },
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
    // #804: förr klassens sektion "Schack" (på/av även under Vad eleverna ser).
    schack: { roll: "alla", efter: "Mina klasser → Hur går det? → Schack (på/av även under Vad eleverna ser)", del: "B" },
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
