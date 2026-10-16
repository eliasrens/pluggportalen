// ============================================================================
// Bråkdraken – stadietabellen (#718, spec §9)
// ----------------------------------------------------------------------------
// En rad per stadium: ägg (0) + nivå 1–15. Varje nivå har en egen pose och egna
// detaljer (inte bara skala/färg) – kroppen beskrivs som ett litet skelett i en
// rityta där draken står på marken y = 200 och tittar åt höger.
//
//   faktor   logisk kroppsstorlek mot en häst i huset (spec-tabellen)
//   familj   unge (1–4) · ungdom (5–9) · vuxen (10–14) · legend (15)
//            – styr vilka tomgångsgester som delas (art-drake-anim.js)
//   gester   nivåns egna tomgångsgester (spec-tabellens "Rörelse/effekt")
//
// Ritytan är normerad per nivå (figuren fyller sin ruta); visningsstorlek
// räknas ur faktor av den som visar draken (drakeMatt i art-drake.js).
// ============================================================================

const B = (hx, hy, kx, ky, fx, fy, w, lar = null, hase = null) => ({ hoft: [hx, hy], kna: [kx, ky], fot: [fx, fy], w, lar, hase });
// Bortre ben = samma ben lite förskjutet bakåt-uppåt.
const far = (b, dx = 9, dy = -3) => ({
  ...b, hoft: [b.hoft[0] + dx, b.hoft[1] + dy], kna: [b.kna[0] + dx, b.kna[1] + dy],
  fot: [b.fot[0] + dx, b.fot[1] + dy - 1], hase: b.hase ? [b.hase[0] + dx, b.hase[1] + dy] : null, lar: b.lar ? [b.lar[0] + dx, b.lar[1] + dy, ...b.lar.slice(2)] : null,
});

export const AGG = {
  niva: 0, namn: "Ägg", stjarnor: [0, 9], faktor: 0.35, familj: "agg",
  text: "Turkost ägg med lila skimrande mönster och liten guldruna. Vid 5–9 stjärnor syns fina sprickor.",
  gester: ["vicka", "puls"],
};

// Stående ungdoms-/vuxendrakar får hasled på bakbenet (knä fram, has bak)
// i stället för raka pelarben.
const STAENDE = new Set([5, 6, 8, 10, 11, 12, 13, 15]);
function hasled(n) {
  if (!STAENDE.has(n.niva) || n.bak.hase) return n;
  const k = (b) => ({ ...b, kna: [b.hoft[0] + 5, b.hoft[1] + 16], hase: [b.fot[0] - 9, b.fot[1] - 9], fot: [b.fot[0] + 3, b.fot[1]] });
  return { ...n, bak: k(n.bak), farBak: n.farBak ? k(n.farBak) : n.farBak };
}

// Uppåtriktade halsar får en mjuk S-form (bröstet fram, nacken bak under
// huvudet) i stället för ett rakt rör.
function svanhals(n) {
  if (!n.hals || n.hals.rak) return n;
  const [p0, , , p3] = n.hals.c;
  const dx = p3[0] - p0[0], dy = p3[1] - p0[1];
  if (dy > -30) return n;
  const c1 = [p0[0] + dx * 0.2 + 10, p0[1] + dy * 0.3], c2 = [p3[0] - 8, p3[1] - dy * 0.35];
  return { ...n, hals: { ...n.hals, c: [p0, c1, c2, p3] } };
}

export const NIVAER = [
  { // 1 – rund drakunge, sitter
    niva: 1, faktor: 0.43, familj: "unge", gester: ["blink", "lut"],
    text: "Rund drakunge: stort huvud, kort svans, små vingknoppar, mjuk ljus mage.",
    lw: 3, kropp: [100, 166, 31, 30, 0],
    huvud: { x: 106, y: 116, s: 1.42, tilt: 10, v: 0, oron: 1, horn: 0, kinder: 0.85, runa: 0.4 },
    bak: B(86, 176, 90, 186, 100, 193, 15, [86, 177, 17, 15, -10]),
    fram: B(117, 172, 120, 182, 121, 192, 11),
    svans: { c: [[74, 182], [56, 196], [40, 197], [33, 186]], w0: 14, w1: 6, spets: "rund" },
    knopp: [[80, 148, 9], [86, 143, 7]],
  },
  { // 2 – hornknoppar, längre svans lindad framför fötterna, tittar upp
    niva: 2, faktor: 0.5, familj: "unge", gester: ["blink", "svansvick", "nos"],
    text: "Två små hornknoppar, längre svans, tydligare öron och ansiktsprofil.",
    lw: 3, kropp: [98, 163, 31, 33, -6],
    huvud: { x: 110, y: 110, s: 1.34, tilt: -10, v: 0.06, oron: 2, horn: 1, kinder: 0.8, runa: 0.45 },
    bak: B(84, 174, 88, 186, 98, 193, 15, [84, 175, 17, 16, -12]),
    fram: B(116, 170, 119, 182, 121, 192, 11),
    svans: { c: [[72, 182], [64, 206], [128, 208], [146, 190]], w0: 14, w1: 5, spets: "rund", fram: true },
    knopp: [[78, 144, 11], [85, 139, 8]],
  },
  { // 3 – sträcker ena vingen (lila insida), första ryggfjällen
    niva: 3, faktor: 0.6, familj: "unge", gester: ["blink", "vingstrack", "sitt"],
    text: "Små öppningsbara vingar med lila insida, de första ryggfjällen.",
    lw: 3, kropp: [100, 160, 33, 33, -8],
    huvud: { x: 116, y: 104, s: 1.26, tilt: 4, v: 0.12, oron: 2, horn: 1, kinder: 0.75, runa: 0.5 },
    bak: B(84, 172, 88, 185, 98, 193, 16, [84, 173, 18, 17, -12]),
    fram: B(118, 168, 121, 181, 123, 192, 11),
    svans: { c: [[70, 180], [46, 194], [28, 196], [20, 180]], w0: 15, w1: 5, spets: "rund" },
    rygg: { c: [[70, 176], [62, 150], [74, 132], [96, 128]], n: 4, s: 5 },
    vingar: { nar: { s: [92, 136], L: 58, o: 1, fingrar: 3 }, far: { s: [99, 131], L: 38, o: 0.15, fingrar: 3 } },
  },
  { // 4 – står på fyra ben, tar ett steg, tittar omkring
    niva: 4, faktor: 0.72, familj: "unge", gester: ["blink", "steg", "titta"],
    text: "Längre kropp och ben, fler ryggfjäll, blåare svansspets.",
    lw: 3, kropp: [100, 150, 40, 26, -4],
    hals: { c: [[124, 140], [132, 130], [136, 122], [140, 114]], w0: 24, w1: 18 },
    huvud: { x: 144, y: 100, s: 1.14, tilt: 6, v: 0.18, oron: 2, horn: 1, kinder: 0.65, runa: 0.55 },
    bak: B(74, 158, 72, 177, 70, 193, 13, [76, 156, 17, 20, -15]),
    fram: { ...B(124, 160, 134, 172, 136, 184, 11), klass: "bd-ben-steg" },
    farBak: B(84, 154, 88, 175, 90, 192, 12), farFram: B(116, 156, 118, 175, 118, 192, 10),
    svans: { c: [[64, 150], [38, 150], [22, 176], [6, 164]], w0: 15, w1: 5, spets: "bla" },
    rygg: { c: [[58, 152], [68, 124], [104, 118], [128, 128]], n: 6, s: 6 },
    vingar: { nar: { s: [96, 130], L: 42, o: 0.12, fingrar: 3 }, far: { s: [103, 126], L: 36, o: 0.2, fingrar: 3 } },
  },
  { // 5 – ungdomsdrake, stolt hållning, större vingar halvt lyfta, första guldet
    niva: 5, faktor: 0.86, familj: "ungdom", gester: ["blink", "fladder", "stolt"],
    text: "Tydlig ungdomsdrake med större vingar och den första fina guldmarkeringen.",
    lw: 2.8, kropp: [100, 146, 42, 27, -12],
    hals: { c: [[126, 130], [134, 116], [140, 104], [146, 94]], w0: 26, w1: 18 },
    huvud: { x: 150, y: 80, s: 1.16, tilt: -4, v: 0.26, oron: 2, horn: 2, hornL: 0.45, kinder: 0.5, runa: 0.75, guld: 1 },
    bak: B(72, 156, 70, 176, 68, 193, 14, [74, 154, 18, 22, -15]),
    fram: B(126, 156, 130, 174, 132, 193, 12),
    farBak: B(82, 152, 86, 174, 88, 192, 13), farFram: B(118, 152, 120, 174, 122, 192, 11),
    svans: { c: [[62, 150], [32, 156], [16, 186], [0, 176]], w0: 16, w1: 5, spets: "bla" },
    rygg: { c: [[56, 152], [66, 118], [104, 108], [130, 120]], n: 7, s: 6.5 },
    vingar: { nar: { s: [96, 122], L: 64, o: 0.55 }, far: { s: [104, 118], L: 58, o: 0.6 } },
    guld: { skuldra: true },
  },
  { // 6 – bredare bröst, markerade horn, första svansfenan; svansen svängd i S
    niva: 6, faktor: 1.02, familj: "ungdom", gester: ["blink", "svanssving", "puff"],
    text: "Mer markerade horn, bredare bröst och den första svansfenan.",
    lw: 2.8, kropp: [98, 146, 44, 29, -8],
    hals: { c: [[124, 132], [134, 120], [142, 112], [150, 106]], w0: 30, w1: 19 },
    huvud: { x: 156, y: 94, s: 1.14, tilt: 10, v: 0.32, oron: 2, horn: 2, hornL: 0.75, kinder: 0.4, runa: 0.8, guld: 1 },
    bak: B(70, 156, 68, 177, 66, 193, 15, [72, 154, 19, 23, -15]),
    fram: B(126, 158, 130, 176, 133, 193, 14),
    farBak: B(80, 152, 84, 174, 86, 192, 14), farFram: B(117, 154, 119, 174, 121, 192, 12),
    svans: { c: [[58, 146], [16, 120], [10, 196], [-26, 168]], w0: 18, w1: 5, spets: "fena", fena: 11 },
    rygg: { c: [[52, 148], [62, 114], [100, 108], [128, 122]], n: 8, s: 7 },
    vingar: { nar: { s: [94, 126], L: 60, o: 0.2 }, far: { s: [102, 122], L: 56, o: 0.3 } },
    guld: { skuldra: true },
  },
  { // 7 – vilar liggande med hopvikta vingar, guldkant på vissa fjäll
    niva: 7, faktor: 1.2, familj: "ungdom", gester: ["langsamblink", "andas"],
    text: "Vingspannet ökar, guldkant på vissa fjäll, mer uttrycksfull ansiktsform.",
    lw: 2.8, kropp: [100, 172, 52, 24, -2],
    hals: { c: [[136, 164], [150, 150], [160, 140], [168, 134]], w0: 30, w1: 20 },
    huvud: { x: 176, y: 122, s: 1.12, tilt: 2, v: 0.4, oron: 2, horn: 2, hornL: 0.85, kinder: 0.3, runa: 0.85, guld: 1 },
    bak: B(70, 178, 82, 190, 96, 196, 14, [70, 176, 22, 18, -5]),
    fram: B(138, 184, 154, 192, 172, 194, 13),
    farBak: null, farFram: B(130, 182, 146, 188, 162, 190, 12),
    svans: { c: [[54, 176], [20, 200], [-10, 198], [-26, 180]], w0: 18, w1: 5, spets: "fena", fena: 11 },
    rygg: { c: [[48, 176], [62, 140], [118, 138], [140, 156]], n: 9, s: 7, guld: 1 },
    vingar: { nar: { s: [100, 154], L: 82, o: 0 }, far: { s: [108, 150], L: 76, o: 0.06 } },
    guld: { skuldra: true },
  },
  { // 8 – längre hals, huvudet lyft, vingsträck; sekundära horn börjar synas
    niva: 8, faktor: 1.4, familj: "ungdom", gester: ["blink", "huvudlyft", "vingstrack"],
    text: "Längre hals, ett sekundärt hornpar börjar synas, tydligare ryggkam.",
    lw: 2.7, kropp: [96, 146, 46, 27, -10],
    hals: { c: [[124, 128], [134, 106], [140, 86], [146, 70]], w0: 28, w1: 17 },
    huvud: { x: 152, y: 56, s: 1.12, tilt: -8, v: 0.48, oron: 2, horn: 2, hornL: 0.95, horn2: 1, kinder: 0.2, runa: 0.9, guld: 1 },
    bak: B(68, 156, 66, 177, 64, 193, 15, [70, 154, 20, 24, -15]),
    fram: B(124, 156, 128, 176, 130, 193, 13),
    farBak: B(78, 152, 82, 174, 84, 192, 14), farFram: B(115, 152, 117, 174, 119, 192, 12),
    svans: { c: [[54, 148], [20, 150], [0, 190], [-30, 182]], w0: 18, w1: 5, spets: "fena", fena: 12 },
    rygg: { c: [[48, 150], [58, 110], [110, 96], [138, 82]], n: 10, s: 8.5, guld: 1 },
    vingar: { nar: { s: [92, 122], L: 86, o: 1, lyft: 8 }, far: { s: [100, 118], L: 62, o: 0.25 } },
    guld: { skuldra: true },
  },
  { // 9 – stolt resning på bakbenen, kraftiga ben, större svansfena, lila vingmönster
    niva: 9, faktor: 1.62, familj: "ungdom", gester: ["blink", "resning", "glod"],
    text: "Kraftigare ben, större svansfena och distinkta lila vingmönster.",
    lw: 2.7, kropp: [96, 138, 30, 44, 16],
    hals: { c: [[110, 100], [118, 84], [126, 74], [134, 66]], w0: 30, w1: 18 },
    huvud: { x: 142, y: 54, s: 1.1, tilt: -4, v: 0.56, oron: 2, horn: 2, hornL: 1, horn2: 1, kinder: 0, runa: 0.95, guld: 1 },
    bak: B(86, 162, 100, 180, 92, 193, 20, [84, 160, 24, 28, -20]),
    fram: B(118, 126, 134, 136, 142, 124, 13),
    farBak: B(98, 160, 112, 178, 106, 192, 18), farFram: B(112, 120, 128, 126, 136, 114, 12),
    svans: { c: [[76, 172], [40, 196], [6, 200], [-24, 178]], w0: 22, w1: 6, spets: "storfena", fena: 15 },
    rygg: { c: [[80, 176], [64, 128], [86, 86], [122, 68]], n: 10, s: 8.5, guld: 1 },
    vingar: { nar: { s: [90, 112], L: 88, o: 0.6, monster: 1 }, far: { s: [98, 106], L: 80, o: 0.7, monster: 1 } },
    guld: { skuldra: true, klor: true },
  },
  { // 10 – vuxen form, stora vikbara vingar halvöppna, guldhornspetsar
    niva: 10, faktor: 1.85, familj: "vuxen", gester: ["blink", "svav"],
    text: "Vuxen drakform med stora men vikbara vingar och tydliga guldhornspetsar.",
    lw: 2.6, kropp: [96, 144, 48, 28, -8],
    hals: { c: [[126, 130], [136, 108], [140, 90], [146, 76]], w0: 30, w1: 18 },
    huvud: { x: 154, y: 64, s: 1.12, tilt: 4, v: 0.66, oron: 2, horn: 2, hornL: 1.1, horn2: 1, guldHorn: true, runa: 1, guld: 1 },
    bak: B(68, 154, 66, 177, 64, 193, 17, [70, 152, 21, 25, -15]),
    fram: B(126, 156, 130, 176, 132, 193, 15),
    farBak: B(78, 150, 82, 174, 84, 192, 16), farFram: B(117, 152, 119, 174, 121, 192, 14),
    svans: { c: [[52, 146], [10, 150], [-6, 194], [-40, 184]], w0: 20, w1: 6, spets: "storfena", fena: 15 },
    rygg: { c: [[46, 148], [58, 112], [112, 102], [140, 86]], n: 11, s: 8.5, guld: 1 },
    vingar: { nar: { s: [92, 122], L: 96, o: 0.22, monster: 1 }, far: { s: [100, 117], L: 88, o: 0.3, monster: 1 } },
    guld: { skuldra: true, klor: true },
  },
  { // 11 – fler guldfjäll, magiska vinglinjer, starkare silhuett
    niva: 11, faktor: 2.08, familj: "vuxen", gester: ["blink", "partiklar"],
    text: "Fler guldfjäll, magiska vinglinjer och en starkare silhuett.",
    lw: 2.6, kropp: [96, 142, 50, 29, -10],
    hals: { c: [[126, 126], [138, 104], [144, 86], [152, 72]], w0: 32, w1: 18 },
    huvud: { x: 160, y: 60, s: 1.1, tilt: -2, v: 0.72, oron: 2, horn: 2, hornL: 1.15, horn2: 1, guldHorn: true, runa: 1, guld: 1 },
    bak: B(66, 152, 64, 176, 62, 193, 18, [68, 150, 22, 26, -15]),
    fram: B(126, 154, 132, 175, 136, 193, 16),
    farBak: B(76, 148, 80, 173, 82, 192, 17), farFram: B(117, 150, 121, 173, 125, 192, 15),
    svans: { c: [[50, 144], [4, 140], [-10, 196], [-46, 186]], w0: 21, w1: 6, spets: "storfena", fena: 16, guldkant: true },
    rygg: { c: [[44, 146], [56, 106], [114, 96], [144, 80]], n: 12, s: 9, guld: 1 },
    vingar: { nar: { s: [92, 118], L: 104, o: 0.78, monster: 2, guldkant: true }, far: { s: [100, 113], L: 94, o: 0.82, monster: 2 } },
    guld: { skuldra: true, klor: true, fjall: 6 },
  },
  { // 12 – sänkt huvud med diskret magisk andedräkt, fullt sekundärt hornpar, svansornament
    niva: 12, faktor: 2.31, familj: "vuxen", gester: ["blink", "ande"],
    text: "Fullt sekundärt hornpar, sammanhängande fjällmönster och svansornament.",
    lw: 2.5, kropp: [94, 140, 52, 30, -4],
    hals: { c: [[128, 130], [146, 116], [158, 108], [170, 106]], w0: 32, w1: 19 },
    huvud: { x: 180, y: 100, s: 1.08, tilt: 14, v: 0.8, oron: 2, horn: 2, hornL: 1.2, horn2: 2, guldHorn: true, runa: 1, guld: 1, mun: "oppen" },
    bak: B(62, 150, 60, 175, 58, 193, 18, [64, 148, 23, 27, -12]),
    fram: B(128, 154, 136, 175, 140, 193, 16),
    farBak: B(72, 146, 76, 172, 78, 192, 17), farFram: B(119, 150, 125, 173, 129, 192, 15),
    svans: { c: [[46, 140], [0, 128], [-14, 194], [-52, 184]], w0: 22, w1: 6, spets: "ornament", fena: 16, ringar: [0.72, 0.8] },
    rygg: { c: [[40, 142], [52, 102], [116, 96], [160, 104]], n: 13, s: 9, guld: 2 },
    vingar: { nar: { s: [90, 116], L: 104, o: 0.5, monster: 2, guldkant: true }, far: { s: [98, 111], L: 96, o: 0.58, monster: 2 } },
    guld: { skuldra: true, klor: true, fjall: 8, mage: true },
    ande: true,
  },
  { // 13 – majestätisk hals och huvud, stora vingsegel, rikare guld, aura
    niva: 13, faktor: 2.54, familj: "vuxen", gester: ["blink", "vingoppning"],
    text: "Majestätisk hals och huvud, rikare guldmönster och större vingsegel.",
    lw: 2.5, kropp: [96, 142, 52, 30, -12],
    hals: { c: [[128, 124], [142, 98], [146, 76], [150, 56]], w0: 34, w1: 18 },
    huvud: { x: 156, y: 42, s: 1.08, tilt: -6, v: 0.88, oron: 2, horn: 2, hornL: 1.3, horn2: 2, guldHorn: true, runa: 1, guld: 1 },
    bak: B(66, 152, 64, 176, 62, 193, 19, [68, 150, 23, 27, -15]),
    fram: B(128, 156, 134, 176, 138, 193, 17),
    farBak: B(76, 148, 80, 173, 82, 192, 18), farFram: B(119, 152, 123, 173, 127, 192, 16),
    svans: { c: [[50, 144], [6, 146], [-14, 198], [-54, 186]], w0: 22, w1: 6, spets: "ornament", fena: 17, ringar: [0.7, 0.78] },
    rygg: { c: [[44, 146], [56, 104], [118, 92], [146, 66]], n: 14, s: 9.5, guld: 2 },
    vingar: { nar: { s: [92, 116], L: 118, o: 1, monster: 2, guldkant: true }, far: { s: [104, 110], L: 104, o: 1, monster: 2, lyft: -26 } },
    guld: { skuldra: true, klor: true, fjall: 10, mage: true },
    aura: 1,
  },
  { // 14 – sitter upprätt som en vapensköld, kronlika horn, glödande runor i vingarna
    niva: 14, faktor: 2.77, familj: "vuxen", gester: ["blink", "ljussvep"],
    text: "Nästan legendarisk: kronlik hornstruktur och glödande runor i vingarna.",
    lw: 2.5, kropp: [100, 140, 34, 46, 12],
    hals: { c: [[114, 104], [120, 84], [124, 68], [128, 54]], w0: 32, w1: 18 },
    huvud: { x: 134, y: 40, s: 1.08, tilt: 0, v: 0.94, oron: 2, horn: 2, hornL: 1.3, horn2: 2, guldHorn: true, krona: 1, runa: 1, guld: 1 },
    bak: B(86, 168, 104, 178, 116, 193, 20, [84, 166, 28, 24, -10]),
    fram: B(122, 138, 128, 164, 132, 193, 15),
    farBak: null, farFram: B(112, 136, 116, 164, 118, 192, 14),
    svans: { c: [[76, 182], [30, 206], [-10, 196], [-36, 172]], w0: 22, w1: 6, spets: "ornament", fena: 17, ringar: [0.68, 0.76] },
    rygg: { c: [[74, 178], [56, 128], [80, 80], [118, 56]], n: 13, s: 9.5, guld: 2 },
    vingar: { nar: { s: [92, 106], L: 112, o: 0.92, monster: 3, guldkant: true, lyft: 6 }, far: { s: [100, 100], L: 104, o: 0.95, monster: 3, lyft: 6 } },
    guld: { skuldra: true, klor: true, fjall: 10, mage: true },
    aura: 1,
  },
  { // 15 – legendarisk: full kronsilhuett, stora turkos-lila vingar utfällda, guldornament
    niva: 15, faktor: 3, familj: "legend", gester: ["blink", "magi"],
    text: "Legendarisk vuxen drake: full kronsilhuett, stora turkos-lila vingar och balanserade guldornament.",
    lw: 2.4, kropp: [96, 140, 54, 31, -12],
    hals: { c: [[128, 122], [142, 96], [148, 74], [154, 54]], w0: 36, w1: 18 },
    huvud: { x: 160, y: 40, s: 1.1, tilt: -4, v: 1, oron: 2, horn: 2, hornL: 1.4, horn2: 2, guldHorn: true, krona: 2, diadem: true, runa: 1, guld: 1 },
    bak: B(64, 152, 62, 176, 60, 193, 20, [66, 150, 24, 28, -15]),
    fram: { ...B(130, 150, 146, 158, 152, 146, 17), klass: "bd-ben-lyft" },
    farBak: B(74, 148, 78, 173, 80, 192, 19), farFram: B(119, 152, 123, 173, 127, 192, 17),
    svans: { c: [[48, 144], [2, 140], [-16, 198], [-60, 186]], w0: 24, w1: 6, spets: "ornament", fena: 18, ringar: [0.62, 0.7, 0.78] },
    rygg: { c: [[42, 146], [54, 100], [120, 92], [150, 66]], n: 15, s: 10, guld: 2 },
    vingar: { nar: { s: [92, 114], L: 128, o: 1, monster: 3, guldkant: true, lyft: 4 }, far: { s: [104, 108], L: 116, o: 1, monster: 3, lyft: -30 } },
    guld: { skuldra: true, klor: true, fjall: 12, mage: true, brost: true },
    aura: 2,
  },
].map(hasled).map(svanhals).map((n) => ({
  ...n,
  stjarnor: n.niva === 15 ? [150, 150] : [n.niva * 10, n.niva * 10 + 9],
  farBak: n.farBak === undefined ? far(n.bak) : n.farBak,
  farFram: n.farFram === undefined ? far(n.fram, 8, -2) : n.farFram,
}));

/** Alla 16 stadier: index 0 = ägg, 1–15 = nivåer. */
export const STADIER = [AGG, ...NIVAER];
