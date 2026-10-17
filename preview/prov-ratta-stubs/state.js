// ============================================================================
// #741-preview (rättningen): 4A med 8 påhittade elever som har skrivit ett
// stängt prov med alla frågetyper. Alva är redan tillbakalämnad, Bo är
// färdigrättad – de andra rättas från förslagen. Allt i minnet + localStorage
// (pp:preview741), så att en omladdning behåller rättningen. ?nollstall = börja om.
// #746: provet ger 2 pluggmynt per poäng; saldon och kvitton i S.mynt
// (prov-mynt-data.js kör den riktiga utbetalningen mot dem). Alva lämnades
// tillbaka "före" mynten – hon får sina när rättningen öppnas (betalaKvar).
// ============================================================================
import { stavfelFor, validateProv } from "../../src/prov/prov-validera.js";
import { pvInstallningar, pvNollstall, pvNyckel } from "../prov-installningar-pv.js";
import { delaUppProv } from "../../src/prov/prov-modell.js";
import { nyRattning, bedom, godkannAlla, aterlamnadDok, sparDok } from "../../src/prov/prov-rattning-logik.js";

// #759: ?stavfel=sjalv, ?granser=50-75, ?gammalt (prov-installningar-pv.js) – egen nyckel per val.
const NYCKEL = pvNyckel("pp:preview741-746");
export const PROV = validateProv({
  namn: "Vikingatiden – prov",
  installningar: { poang: true, nivaer: true, visaFacit: true, mynt: { typ: "poang", antal: 2 } },
  fragor: [
    { id: "t1", typ: "text", titel: "Birka", brodtext: "Birka var en handelsstad på Björkö i Mälaren. Dit kom köpmän från många länder." },
    { id: "q1", typ: "flerval", fraga: "Var låg Birka?", alternativ: ["Björkö", "Gotland", "Öland"], ratt: 0 },
    { id: "q2", typ: "flerval-flera", fraga: "Vilka är vikingastäder?", alternativ: ["Birka", "Hedeby", "Paris", "Rom"], ratt: [0, 1], poang: 2 },
    { id: "q3", typ: "santfalskt", fraga: "Vikingar hade horn på hjälmarna.", ratt: false },
    { id: "q4", typ: "kortsvar", fraga: "Vad hette handelsstaden på Björkö?", godkanda: ["Birka"], exaktStavning: false },
    { id: "q5", typ: "lucktext", fraga: "Fyll i luckorna.", lucktext: "Vikingarna seglade till [[Miklagård|Konstantinopel]] och [[Bagdad]].", poang: 2 },
    { id: "q6", typ: "para", fraga: "Para ihop guden med det hen styr över.", poang: 3,
      par: [{ vanster: "Tor", hoger: "Åska" }, { vanster: "Oden", hoger: "Visdom" }, { vanster: "Freja", hoger: "Kärlek" }] },
    { id: "q7", typ: "ordna", fraga: "Sätt tidsåldrarna i ordning.", saker: ["Stenåldern", "Bronsåldern", "Järnåldern", "Vikingatiden"], poang: 4 },
    { id: "q8", typ: "fritext", fraga: "Beskriv livet på en vikingagård.", poang: 4, bedomningsstod: "Nämner djur, hus och arbete. 4 p = alla tre med exempel." },
  ],
}).value;

const NAMN = ["Alva", "Bo", "Cleo", "Dante", "Ebba", "Filip", "Greta", "Hugo"];
const IDS = NAMN.map((_, i) => `e${i}`);
const SVAR = [
  { q1: 0, q2: [0, 1], q3: false, q4: "Birka", q5: ["Miklagård", "Bagdad"], q6: ["Åska", "Visdom", "Kärlek"], q7: ["Stenåldern", "Bronsåldern", "Järnåldern", "Vikingatiden"], q8: "På gården fanns kor och grisar. Huset kallades långhus. Alla hjälptes åt att arbeta på åkern." },
  { q1: 0, q2: [0], q3: false, q4: "birka.", q5: ["Konstantinopel", "Bagdad"], q6: ["Åska", "Kärlek", "Visdom"], q7: ["Stenåldern", "Järnåldern", "Bronsåldern", "Vikingatiden"], q8: "De hade djur och bodde i långhus." },
  { q1: 1, q2: [0, 1, 2], q3: true, q4: "Birkka", q5: ["Mikelgård", "Bagdad"], q6: ["Åska", "Visdom", "Kärlek"], q7: ["Stenåldern", "Bronsåldern", "Järnåldern", "Vikingatiden"], q8: "Man jobbade mycket." },
  { q1: 0, q2: [1], q3: false, q4: "Birka", q5: ["Miklagård", ""], q6: ["Visdom", "Åska", "Kärlek"], q7: [], q8: "" },
  { q1: 0, q2: [0, 1], q3: false, q4: " BIRKA", q5: ["miklagård", "bagdad"], q6: ["Åska", "Visdom", "Kärlek"], q7: ["Bronsåldern", "Stenåldern", "Järnåldern", "Vikingatiden"], q8: "Vikingarna hade kor, får och höns. De bodde i långhus av trä och torv. Barnen fick hjälpa till att mjölka och skörda." },
  { q1: 2, q2: [], q3: null, q4: "Bjärka", q5: ["", ""], q6: ["", "", ""], q7: [], q8: "vet inte" },
  { q1: 0, q2: [0, 1], q3: false, q4: "Birka", q5: ["Konstantinopel", "Bagdad"], q6: ["Åska", "Visdom", "Kärlek"], q7: ["Stenåldern", "Bronsåldern", "Vikingatiden", "Järnåldern"], q8: "Det fanns djur. Man odlade korn." },
  { q1: 0, q2: [0, 1], q3: false, q4: "", q5: ["Miklagård", "Bagdad"], q6: ["Åska", "Visdom", "Kärlek"], q7: ["Stenåldern", "Bronsåldern", "Järnåldern", "Vikingatiden"], q8: "Långhus, djur och mycket arbete på åkrarna." },
];

function start() {
  const nu = Date.now();
  const { fragor, facit, bedomningsstod } = delaUppProv(PROV);
  const tf = {
    id: "tf-r", provId: "p1", provNamn: PROV.namn, classId: "4a", status: "stangt", fragor,
    installningar: pvInstallningar(PROV.installningar), tidsgransMin: 40, oppnad: nu - 2 * 86_400_000, stangd: nu - 2 * 86_400_000 + 45 * 60_000,
  };
  const svar = Object.fromEntries(IDS.map((id, i) => [id, {
    id, elevId: id, classId: "4a", startad: tf.oppnad + 60_000, svar: SVAR[i], inlamnad: true, inlamnadNar: i === 7 ? "stangt" : "elev",
    // #748: två elever lämnade provfliken – syns diskret under Per elev.
    ...(i === 1 ? { flikbyten: 2 } : i === 4 ? { flikbyten: 1 } : {}),
  }]));
  // Alva: rättad och tillbakalämnad (med facit). Bo: färdigrättad, inte tillbakalämnad.
  const rattning = {};
  const ny = (uid) => nyRattning({ elevId: uid, classId: "4a", provNamn: tf.provNamn, fragor, svar: svar[uid].svar, facit, stavfel: stavfelFor(tf.installningar) });
  const q8 = fragor.find((f) => f.id === "q8");
  let alva = bedom(godkannAlla(ny("e0"), fragor), q8, { poang: 4, kommentar: "Tydligt och med bra exempel!" }, fragor);
  alva = { ...alva, niva: "MG", helhetskommentar: "Mycket bra jobbat, Alva! Du kan vikingatiden väl." };
  rattning.e0 = { ...aterlamnadDok(sparDok(alva, fragor), { visaFacit: true, facit }), aterlamnadAt: nu - 3_600_000 };
  rattning.e1 = sparDok(bedom(godkannAlla(ny("e1"), fragor), q8, { poang: 2, kommentar: "Berätta mer om arbetet på gården." }, fragor), fragor);
  const mynt = { saldo: Object.fromEntries(IDS.map((id) => [id, 100])), kvitton: {} };
  return { tf, facit, bedomningsstod, svar, rattning, rattStatus: null, mynt };
}

function las() {
  pvNollstall(NYCKEL);
  try {
    const s = JSON.parse(localStorage.getItem(NYCKEL) || "null");
    if (s?.tf?.id === "tf-r") return s;
  } catch {}
  return start();
}

const data = las();
export const S = {
  ...data,
  klasser: [{ id: "4a", name: "4A", studentIds: IDS }],
  namn: Object.fromEntries(IDS.map((id, i) => [id, NAMN[i]])),
  lasningar: 0,
  skrivningar: 0,
  natfel: false,
  spara() {
    const { tf, facit, bedomningsstod, svar, rattning, mynt } = S;
    localStorage.setItem(NYCKEL, JSON.stringify({ tf, facit, bedomningsstod, svar, rattning, mynt }));
  },
  logg: (t) => window.dispatchEvent(new CustomEvent("pv-logg", { detail: t })),
};
window.__prov741 = S;
