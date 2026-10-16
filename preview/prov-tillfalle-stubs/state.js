// ============================================================================
// #740-preview (lärare): 4A med 25 påhittade elever, ett öppet prov där
// eleverna skriver, ett förberett och ett stängt – allt i minnet.
// ============================================================================
import { validateProv } from "../../src/prov/prov-validera.js";
import { delaUppProv } from "../../src/prov/prov-modell.js";

const NAMN = ["Alva", "Bo", "Cleo", "Dante", "Ebba", "Filip", "Greta", "Hugo", "Ines", "Jamal", "Klara", "Leo", "Maja",
  "Noah", "Olivia", "Pim", "Quinn", "Rut", "Sami", "Tilde", "Ulf", "Vera", "Wilma", "Yusuf", "Zara"];
const prov = (namn, n) => validateProv({
  namn,
  fragor: Array.from({ length: n }, (_, i) => ({ typ: i % 3 ? "kortsvar" : "flerval", fraga: `Fråga ${i + 1}`, godkanda: ["x"], alternativ: ["a", "b", "c"], ratt: 0 })),
}).value;
const P1 = { id: "p1", ...prov("Vikingatiden – prov", 12) };
const P2 = { id: "p2", ...prov("Stenåldern – läxförhör", 6) };

const logg = document.createElement("div");
export const S = {
  prov: [P1, P2],
  klasser: [
    { id: "4a", name: "4A", studentIds: NAMN.map((_, i) => `e${i}`) },
    { id: "4b", name: "4B", studentIds: ["e100", "e101"] },
    // B:s preview (preview-prov-larare.html): årskurskontot "Anna" har klassen k4a.
    { id: "k4a", name: "4A (Anna)", studentIds: NAMN.slice(0, 22).map((_, i) => `e${i}`) },
  ],
  namn: Object.fromEntries([...NAMN.map((n, i) => [`e${i}`, n]), ["e100", "Ada"], ["e101", "Bea"]]),
  tillfallen: {},
  svar: {},
  las: {},
  lasningar: 0,
  logg: (t) => window.dispatchEvent(new CustomEvent("pv-logg", { detail: t })),
};
const nu = Date.now();
const fr = delaUppProv(P1).fragor;
S.tillfallen["tf-oppet"] = { id: "tf-oppet", provId: "p1", provNamn: P1.namn, classId: "4a", status: "oppet", fragor: fr, tidsgransMin: 40, oppnad: nu - 12 * 60_000, skapad: nu - 15 * 60_000 };
S.tillfallen["tf-forb"] = { id: "tf-forb", provId: "p2", provNamn: P2.namn, classId: "4a", status: "forberett", fragor: [], tidsgransMin: null, skapad: nu - 3_600_000, fokus: { pa: true, doljOvrigt: true } };
S.tillfallen["tf-stangt"] = { id: "tf-stangt", provId: "p2", provNamn: P2.namn, classId: "4b", status: "stangt", fragor: delaUppProv(P2).fragor, tidsgransMin: 20, oppnad: nu - 7 * 86_400_000 };
S.las["4a"] = { mal: { typ: "prov", id: "tf-oppet", namn: P1.namn }, till: nu + 38 * 60_000, doljOvrigt: true };
// 4A skriver: några har inte börjat, de flesta skriver, tre har lämnat in.
const svar = {};
NAMN.forEach((_, i) => {
  if (i % 8 === 7) return;
  const besvarade = Math.min(12, 3 + ((i * 5) % 10));
  const s = {};
  fr.forEach((f, j) => { if (j < besvarade) s[f.id] = f.typ === "flerval" ? 0 : "svar"; });
  svar[`e${i}`] = { id: `e${i}`, elevId: `e${i}`, classId: "4a", startad: nu - (12 - (i % 5)) * 60_000, svar: s, inlamnad: i % 6 === 0, inlamnadNar: i % 6 === 0 ? "elev" : undefined };
});
S.svar["tf-oppet"] = svar;
window.__prov = S;
