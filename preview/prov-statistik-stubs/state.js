// ============================================================================
// #742-preview (statistiken): 4B med 25 påhittade elever som har skrivit ett
// stängt prov med 12 frågor. De flesta är färdigrättade (några tillbakalämnade,
// några med nivå), två har bara förslag ("ej rättade") och en är halvrättad.
// Klassen har också tre äldre prov – fliken "Prov" i klassens statistik visar
// dem över tid. Allt i minnet + localStorage (pp:preview742). ?nollstall = börja om.
// ============================================================================
import { validateProv } from "../../src/prov/prov-validera.js";
import { delaUppProv } from "../../src/prov/prov-modell.js";
import { aterlamnadDok, bedom, godkann, godkannAlla, nyRattning, sparDok } from "../../src/prov/prov-rattning-logik.js";
import { provInfoDok } from "../../src/prov/prov-statistik.js";

const NYCKEL = "pp:preview742";
export const PROV = validateProv({
  namn: "Vikingatiden – kapitelprov",
  installningar: { poang: true, nivaer: true, visaFacit: true },
  fragor: [
    { id: "q1", typ: "flerval", fraga: "Var låg Birka?", alternativ: ["Björkö", "Gotland", "Öland"], ratt: 0 },
    { id: "q2", typ: "flerval", fraga: "Vad kallades vikingarnas skrivtecken?", alternativ: ["Runor", "Hieroglyfer", "Kilskrift"], ratt: 0 },
    { id: "q3", typ: "santfalskt", fraga: "Vikingar hade horn på hjälmarna.", ratt: false },
    { id: "q4", typ: "santfalskt", fraga: "Vikingarna handlade med silver från Arabien.", ratt: true },
    { id: "q5", typ: "kortsvar", fraga: "Vad hette handelsstaden på Björkö?", godkanda: ["Birka"], exaktStavning: false },
    { id: "q6", typ: "kortsvar", fraga: "Vad hette åskguden?", godkanda: ["Tor", "Thor"], exaktStavning: false },
    { id: "q7", typ: "flerval-flera", fraga: "Vilka är vikingastäder?", alternativ: ["Birka", "Hedeby", "Paris", "Rom"], ratt: [0, 1], poang: 2 },
    { id: "q8", typ: "lucktext", fraga: "Fyll i luckorna.", lucktext: "Vikingarna seglade till [[Miklagård|Konstantinopel]] och [[Bagdad]].", poang: 2 },
    { id: "q9", typ: "para", fraga: "Para ihop guden med det hen styr över.", poang: 3,
      par: [{ vanster: "Tor", hoger: "Åska" }, { vanster: "Oden", hoger: "Visdom" }, { vanster: "Freja", hoger: "Kärlek" }] },
    { id: "q10", typ: "ordna", fraga: "Sätt tidsåldrarna i ordning.", saker: ["Stenåldern", "Bronsåldern", "Järnåldern", "Vikingatiden"], poang: 3 },
    { id: "q11", typ: "fritext", fraga: "Beskriv livet på en vikingagård.", poang: 4, bedomningsstod: "Djur, hus och arbete. 4 p = alla tre med exempel." },
    { id: "q12", typ: "fritext", fraga: "Varför reste vikingarna?", poang: 2, bedomningsstod: "Handel, plundring, ny mark." },
  ],
}).value;

const NAMN = ["Alva", "Bo", "Cleo", "Dante", "Ebba", "Filip", "Greta", "Hugo", "Ines", "Jamal", "Klara", "Liam", "Maja",
  "Nils", "Olivia", "Pelle", "Rut", "Sami", "Tilde", "Ugo", "Vera", "William", "Ylva", "Zara", "Åke"];
const IDS = NAMN.map((_, i) => `e${i}`);
// Elevernas "kunnande" 0–1 (spridd så att alla tre färgerna syns).
const KAN = [0.95, 0.82, 0.35, 0.6, 0.9, 0.25, 0.75, 0.55, 0.88, 0.45, 0.7, 0.65, 0.98, 0.4, 0.8, 0.3, 0.68, 0.5, 0.85, 0.15, 0.72, 0.58, 0.92, 0.62, 0.38];

// Liten deterministisk slump (samma klass varje gång).
function slump(fro) {
  let s = fro >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function svarFor(f, ratt, r) {
  switch (f.id) {
    case "q1": return ratt ? 0 : 1 + Math.floor(r() * 2);
    case "q2": return ratt ? 0 : 2;
    case "q3": return ratt ? false : true;
    case "q4": return ratt ? true : false;
    case "q5": return ratt ? (r() < 0.5 ? "Birka" : "birka.") : r() < 0.5 ? "Birkka" : "Sigtuna";
    case "q6": return ratt ? (r() < 0.5 ? "Tor" : "Thor") : "Oden";
    case "q7": return ratt ? [0, 1] : r() < 0.5 ? [0] : [0, 2];
    case "q8": return ratt ? ["Miklagård", "Bagdad"] : r() < 0.6 ? ["Konstantinopel", "Rom"] : ["Paris", "Rom"];
    case "q9": return ratt ? ["Åska", "Visdom", "Kärlek"] : ["Visdom", "Åska", "Kärlek"];
    case "q10": return ratt ? ["Stenåldern", "Bronsåldern", "Järnåldern", "Vikingatiden"] : ["Bronsåldern", "Stenåldern", "Vikingatiden", "Järnåldern"];
    case "q11": return ratt ? "De hade kor och får, bodde i långhus och arbetade på åkern." : "De hade djur.";
    case "q12": return ratt ? "För att handla och hitta ny mark." : "För att de ville.";
    default: return null;
  }
}

function start() {
  const nu = Date.now();
  const { fragor, facit, bedomningsstod } = delaUppProv(PROV);
  const tf = {
    id: "tf-s", provId: "p1", provNamn: PROV.namn, classId: "4b", status: "stangt", fragor,
    installningar: PROV.installningar, tidsgransMin: 40, oppnad: nu - 86_400_000, stangd: nu - 86_400_000 + 45 * 60_000,
  };
  const r = slump(742);
  const svar = {};
  IDS.forEach((id, i) => {
    const s = {};
    for (const f of fragor) {
      if (r() < 0.05 + (1 - KAN[i]) * 0.08) continue; // obesvarad
      s[f.id] = svarFor(f, r() < KAN[i], r);
    }
    svar[id] = { id, elevId: id, classId: "4b", startad: tf.oppnad + 60_000, svar: s, inlamnad: true, inlamnadNar: i === 19 ? "stangt" : "elev" };
  });
  const rattning = {};
  const fritext = fragor.filter((f) => f.typ === "fritext");
  const dok = (x) => sparDok(x, fragor, provInfoDok(x, fragor, tf));
  IDS.forEach((uid, i) => {
    let x = nyRattning({ elevId: uid, classId: "4b", provNamn: tf.provNamn, fragor, svar: svar[uid].svar, facit });
    if (uid === "e7" || uid === "e17") { rattning[uid] = dok(x); return; } // bara förslag = ej rättade
    if (uid === "e13") { // halvrättad: fyra frågor godkända
      for (const id of ["q1", "q2", "q3", "q4"]) x = godkann(x, id);
      rattning[uid] = dok(x);
      return;
    }
    x = godkannAlla(x, fragor);
    for (const f of fritext) {
      if (svar[uid].svar[f.id] == null) continue;
      x = bedom(x, f, { poang: Math.round(KAN[i] * f.poang * 2) / 2 }, fragor);
    }
    if (i % 3 === 0) x = { ...x, niva: KAN[i] >= 0.8 ? "MG" : KAN[i] >= 0.45 ? "G" : "EG" };
    if (uid === "e2") x = bedom(x, fragor.find((f) => f.id === "q5"), { ratt: "delvis", kommentar: "Nästan – kolla stavningen." }, fragor);
    if (i < 6) x = { ...x, helhetskommentar: "Bra kämpat! Läs om gudarna en gång till." };
    rattning[uid] = i < 5 ? { ...aterlamnadDok(dok(x), { visaFacit: true, facit }), aterlamnadAt: nu - 3_600_000 } : dok(x);
  });
  return { tf, facit, bedomningsstod, svar, rattning };
}

// Tre äldre prov (bara rättningsdokument, som collection group-frågan ger dem).
function aldre() {
  const r = slump(17);
  const nu = Date.now();
  const prov = [
    { t: "tf-a1", provNamn: "Stenåldern", dagar: 70, svar: -0.12 },
    { t: "tf-a2", provNamn: "Bronsåldern", dagar: 42, svar: -0.05 },
    { t: "tf-a3", provNamn: "Järnåldern", dagar: 16, svar: 0.02 },
  ];
  const ut = [];
  for (const p of prov) {
    IDS.forEach((uid, i) => {
      if (r() < 0.06) return; // var sjuk
      const andel = Math.max(0, Math.min(1, KAN[i] + p.svar + (r() - 0.5) * 0.2));
      ut.push({
        t: p.t, elevId: uid, classId: "4b", provNamn: p.provNamn, aterlamnad: true, niva: i % 4 === 0 ? (andel >= 0.8 ? "MG" : andel >= 0.45 ? "G" : "EG") : null,
        provInfo: { datum: nu - p.dagar * 86_400_000, granser: { gul: 40, gron: 70 }, andel: Math.round(andel * 20) / 20 },
      });
    });
  }
  return ut;
}

function las() {
  if (new URLSearchParams(location.search).has("nollstall")) {
    localStorage.removeItem(NYCKEL);
    history.replaceState(null, "", location.pathname + location.hash);
  }
  try {
    const s = JSON.parse(localStorage.getItem(NYCKEL) || "null");
    if (s?.tf?.id === "tf-s") return s;
  } catch {}
  return start();
}

const data = las();
export const S = {
  ...data,
  aldre: aldre(),
  klasser: [{ id: "4b", name: "4B", studentIds: IDS }],
  namn: Object.fromEntries(IDS.map((id, i) => [id, NAMN[i]])),
  lasningar: 0,
  skrivningar: 0,
  fragorMotDb: 0,
  natfel: false,
  spara() {
    const { tf, facit, bedomningsstod, svar, rattning } = S;
    localStorage.setItem(NYCKEL, JSON.stringify({ tf, facit, bedomningsstod, svar, rattning }));
  },
  logg: (t) => window.dispatchEvent(new CustomEvent("pv-logg", { detail: t })),
};
window.__prov742 = S;
