// ============================================================================
// Pluggporten – lärarsidan: Materialets underflikar (teacher-material-flikar.js, #806)
// ----------------------------------------------------------------------------
// Epic #802 DEL 4. EN rad per underflik under Material (#/larare/material?flik=…):
//   key    – ?flik=-värdet
//   label  – fliktexten, icon – linje-ikon ur teacher-shared.js
//   admin  – bara admin (en flik utan innehåll för rollen visas inte)
//   hint   – hjälptexten överst (1–2 meningar, hopfällbar via teacher-hjalptext.js, DEL 8): vad fliken är till och var klassinställningarna finns (markup med data-hash-länkar)
//   helsida(params) – true = vyn tar hela sidan (utan Materialets ram), t.ex. provspelet i Hitta rätt!
//   rita(sub, params) – laddar vyn med import() och ritar den i sub.app; får returnera { destroy }
// Ren data med lata importer – laddas av teacher-material.js, aldrig i bootgrafen (#271).
// test/lararsida-material.test.js kräver att varje rad finns i placeringskartan.
// ============================================================================

// Var klassinställningarna finns (Mina klasser, #804): ?flik= = fliken, &del= = Hur går det?-underfliken. Byter adresserna ändras bara raderna här.
export const LANK = {
  vadEleverna: { hash: "#/larare/mina-klasser?flik=ser", text: "Mina klasser → Vad eleverna ser" },
  lasresan: { hash: "#/larare/mina-klasser?flik=hur&del=lasresan", text: "Mina klasser → Hur går det? → Läsresan" },
  ekvationsresan: { hash: "#/larare/mina-klasser?flik=hur&del=ekvationsresan", text: "Mina klasser → Hur går det? → Ekvationsresan" },
  brakresan: { hash: "#/larare/mina-klasser?flik=hur&del=brakresan", text: "Mina klasser → Hur går det? → Bråkresan" },
  schack: { hash: "#/larare/mina-klasser?flik=hur&del=schack", text: "Mina klasser → Hur går det? → Schack" },
};
const lank = (k) => `<a href="${LANK[k].hash}" data-hash="${LANK[k].hash}">${LANK[k].text}</a>`;

export const MATERIAL_FLIKAR = [
  {
    key: "plugga", label: "Plugga-områden", icon: "book", admin: false,
    hint: `Här skapar och redigerar du arbetsområden med frågor, par och texter. Vilka områden en klass ser väljer du under ${lank("vadEleverna")}.`,
    rita: async (sub) => (await import("./teacher-content.js")).pageLarareInnehall(sub),
  },
  {
    key: "lasresan", label: "Läsresan", icon: "book", admin: false,
    hint: `Här ser du hur Läsresan är uppbyggd. Elevernas nivåer ändrar du under ${lank("lasresan")}.`,
    rita: async (sub) => (await import("./teacher-material-lasresan.js")).renderLasresanInfo(sub),
  },
  {
    key: "ekvationsresan", label: "Ekvationsresan", icon: "sliders", admin: false,
    hint: `Här provar du uppgifterna som en elev; inget sparas. Elevernas nivåer ändrar du under ${lank("ekvationsresan")}.`,
    rita: async (sub) => (await import("./ekvationsresan/larare-testlage.js")).renderEkvationsTestlage(sub),
  },
  {
    key: "brakresan", label: "Bråkresan", icon: "brak", admin: false,
    hint: `Här testar du utmaningarna med facit; inget sparas. Elevernas framsteg och rekommendationer finns under ${lank("brakresan")}.`,
    rita: async (sub) => (await import("./brakresan/larare/testlage.js")).pageLarareBrakresan(sub),
  },
  {
    key: "hitta-ratt", label: "Hitta rätt!", icon: "pin", admin: true,
    hint: `Här hanterar du kartområden och bilder. Vilka klasser som har Hitta rätt! slår du på under ${lank("vadEleverna")}.`,
    // Provspelet (?prov=) är elevens helskärmsvy och styr hela sidan, som förut.
    helsida: (p) => Boolean(p.prov),
    rita: async (sub) => (await import("./hitta-ratt/larare/page-larare-hitta-ratt.js")).pageLarareHittaRatt(sub),
  },
  {
    key: "schack", label: "Schack", icon: "grad", admin: false,
    hint: `Här provar du att spela mot datorn; inget sparas. Du slår på schack för en klass under ${lank("vadEleverna")}, och klassens partier och topplista finns under ${lank("schack")}.`,
    rita: async (sub, params) => (await import("./schack/larare-prova.js")).renderSchackProva(sub, params),
  },
];

/** Flikarna rollen ser (admin = true/false). */
export const materialFlikar = (admin) => MATERIAL_FLIKAR.filter((f) => !f.admin || admin);

/** ?flik=-värdet → flikens rad, annars null. */
export const materialFlik = (key) => MATERIAL_FLIKAR.find((f) => f.key === key) || null;
