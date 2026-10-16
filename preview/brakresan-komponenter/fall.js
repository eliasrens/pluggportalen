// Förhandsvisningens fall (#707): varje komponent i första, normal och svåraste
// bildfall, med en riktig svarsyta (answer) och bedömningsregel (key) så att
// "Kontrollera" går genom schema/bedomning.js gradeWith.
import { fraction, mixed, decimal, percent, q } from "../../src/brakresan/math/index.js";

const ids = (n) => Array.from({ length: n }, (_, i) => `p${i}`);
const paint = (n, count) => ({ answer: { type: "paint", parts: ids(n) }, key: { type: "paint", count } });

export const FALL = [
  {
    id: "notation", namn: "1. Bråknotation och inmatning",
    fall: [
      { titel: "Första: ett bråk", view: { component: "notation", expr: [fraction(3, 4)] } },
      { titel: "Former: decimal = procent = bråk", view: { component: "notation", expr: [decimal(q(3, 4), 2), { op: "=" }, percent(75), { op: "=" }, fraction(3, 4), { op: "=" }, mixed(2, 3, 4), { op: "÷" }, fraction(11, 4)] } },
      { titel: "Normal: addera, skriv svaret", prompt: "Räkna ut.", view: { component: "notation", expr: [fraction(1, 2), { op: "+" }, fraction(1, 4), { op: "=" }, { input: true }] },
        answer: { type: "number", input: "fraction" }, key: { type: "number", value: q(3, 4), requirement: "value" } },
      { titel: "Svårast: blandad form krävs", prompt: "Svara i blandad form.", view: { component: "notation", expr: [mixed(2, 3, 4), { op: "−" }, fraction(5, 6), { op: "=" }, { input: true }] },
        answer: { type: "number", input: "mixed" }, key: { type: "number", value: q(23, 12), requirement: "mixed" } },
      { titel: "Jämför: <, = eller >", view: { component: "notation", expr: [fraction(3, 8), { relation: true }, decimal(q(2, 5), 1)] },
        answer: { type: "relation" }, key: { type: "relation", correct: "<" } },
      { titel: "Procent av", view: { component: "notation", expr: [percent(25), { text: "av 80 kr" }, { op: "=" }, { input: true }, { text: "kr" }] },
        answer: { type: "number", input: "integer" }, key: { type: "number", value: q(20), requirement: "value" } },
    ],
  },
  {
    id: "stav", namn: "2. Bråkstav",
    fall: [
      { titel: "Första: halv stav", view: { component: "stav", parts: 2, marked: 1 } },
      { titel: "Normal: måla 3/5", prompt: "Måla 3/5 av staven.", view: { component: "stav", parts: 5 }, ...paint(5, 3) },
      { titel: "Omdelning 1/2 → 2/4 → 4/8", prompt: "Tryck \"Dela om ×2\": samma längd är färgad.", view: { component: "stav", parts: 2, marked: 1 }, extra: ["regroup"] },
      { titel: "Jämför två staver (samma helhet)", view: { component: "stav", bars: [{ parts: 3, marked: 2, label: "A" }, { parts: 4, marked: 3, label: "B" }] } },
      { titel: "Flyttbara delar: bygg en hel", prompt: "Lägg delar i staven (klick, drag eller Enter).", view: { component: "stav", parts: 4, marked: 0, pieces: [{ id: "a", d: 2 }, { id: "b", d: 4 }, { id: "c", d: 4 }, { id: "d", d: 8 }, { id: "e", d: 8 }, { id: "f", d: 3 }] } },
      { titel: "Svårast: 7/4 på två staver", prompt: "Måla 7/4.", view: { component: "stav", parts: 4, wholes: 2 }, ...paint(8, 7) },
    ],
  },
  {
    id: "cirkel", namn: "3. Bråkcirkel",
    fall: [
      { titel: "Första: halv cirkel", view: { component: "cirkel", parts: 2, marked: 1 } },
      { titel: "Normal: måla 5/8", prompt: "Måla 5/8.", view: { component: "cirkel", parts: 8 }, ...paint(8, 5) },
      { titel: "Udda nämnare: 3/7 (exakt 360°/7)", view: { component: "cirkel", parts: 7, marked: 3 } },
      { titel: "Svårast: 29/12 på tre cirklar", prompt: "Måla 29/12 = 2 5/12.", view: { component: "cirkel", parts: 12, wholes: 3 }, ...paint(36, 29) },
    ],
  },
  {
    id: "rutnat", namn: "4. Rektangel / rutnät",
    fall: [
      { titel: "Första: 1/4 av en kvadrat", view: { component: "rutnat", rows: 2, cols: 2, marked: 1 } },
      { titel: "Lika stora delar, olika form", prompt: "Delarna har olika form men lika stor area. Måla 2/4.", view: { component: "rutnat", rows: 4, cols: 4, regions: [{ cells: [0, 1, 2, 3] }, { cells: [4, 5, 8, 9] }, { cells: [6, 7, 10, 11] }, { cells: [12, 13, 14, 15] }] }, ...paint(4, 2) },
      { titel: "Normal: måla 3/4 av 12 rutor", prompt: "Måla 3/4 av rektangeln.", view: { component: "rutnat", rows: 3, cols: 4 }, ...paint(12, 9) },
      { titel: "Svårast: 6 × 8 med andra färgen", prompt: "Lila streckade rutor = andra andelen. Måla 5/8.", view: { component: "rutnat", rows: 6, cols: 8, second: [0, 1, 2, 3, 8, 9, 10, 11, 16, 17, 18, 19] }, ...paint(48, 30) },
    ],
  },
  {
    id: "hundraruta", namn: "5. Hundraruta",
    fall: [
      { titel: "Första: 0,3 (visning)", view: { component: "hundraruta", marked: 30 } },
      { titel: "Normal: måla 37 %", prompt: "Måla 37 %. Svep över rutor, klicka rader eller använd knapparna.", view: { component: "hundraruta" }, ...paint(100, 37) },
      { titel: "Svårast: 1,25 på två hundrarutor", prompt: "Måla 1,25.", view: { component: "hundraruta", wholes: 2 }, ...paint(200, 125) },
    ],
  },
  {
    id: "tallinje", namn: "6. Tallinje",
    fall: [
      { titel: "Första: halvor (visning)", view: { component: "tallinje", min: 0, max: 1, ticks: 2, points: [{ id: "a", value: q(1, 2), label: "A" }] } },
      { titel: "Normal: placera 5/8", prompt: "Placera 5/8 (klick, drag eller pilar).", view: { component: "tallinje", min: 0, max: 1, ticks: 8 },
        answer: { type: "point", min: q(0), max: q(1), snap: 8 }, key: { type: "point", value: q(5, 8) } },
      { titel: "Välj punkten för 5/6", prompt: "Vilken punkt är 5/6?", view: { component: "tallinje", min: 0, max: 2, ticks: 6, labels: "hela", points: [{ id: "a", value: q(1, 3) }, { id: "b", value: q(5, 6) }, { id: "c", value: q(4, 3) }] },
        answer: { type: "choice", options: ["a", "b", "c"] }, key: { type: "choice", correct: "b" } },
      { titel: "Svårast: 9/4 på 0–3", prompt: "Placera 9/4.", view: { component: "tallinje", min: 0, max: 3, ticks: 4, labels: "hela" },
        answer: { type: "point", min: q(0), max: q(3), snap: 4 }, key: { type: "point", value: q(9, 4) } },
    ],
  },
  {
    id: "mangd", namn: "7. Mängdbild",
    fall: [
      { titel: "Första: 1/4 av 4 kulor", view: { component: "mangd", count: 4, marked: 1 } },
      { titel: "Normal: 3/4 av 12 (4 grupper)", prompt: "Måla 3/4 av kulorna.", view: { component: "mangd", count: 12, groups: 4 }, ...paint(12, 9) },
      { titel: "Svårast: 5/6 av 24 stjärnor", prompt: "Måla 5/6 av stjärnorna.", view: { component: "mangd", count: 24, groups: 6, item: "stjarna" }, ...paint(24, 20) },
    ],
  },
  {
    id: "kort", namn: "8. Matchningskort",
    fall: [
      { titel: "Vilket kort är fel?", prompt: "Tre kort visar samma värde. Vilket är fel?", view: { component: "kort", cards: [
        { id: "k1", face: fraction(1, 2) }, { id: "k2", face: { component: "cirkel", parts: 4, marked: 2 } }, { id: "k3", face: fraction(3, 5) }, { id: "k4", face: decimal(q(1, 2), 1) }] },
        answer: { type: "choice", options: ["k1", "k2", "k3", "k4"] }, key: { type: "choice", correct: "k3" } },
      { titel: "Normal: välj tre som hör ihop", prompt: "Välj tre kort med samma värde.", view: { component: "kort", cards: [
        { id: "k1", face: fraction(4, 6) }, { id: "k2", face: { component: "stav", parts: 4, marked: 3 } }, { id: "k3", face: { component: "stav", parts: 3, marked: 2 } },
        { id: "k4", face: decimal(q(1, 2), 1) }, { id: "k5", face: fraction(2, 3) }, { id: "k6", face: { component: "cirkel", parts: 8, marked: 3 } }] },
        answer: { type: "select", options: ["k1", "k2", "k3", "k4", "k5", "k6"], count: 3 }, key: { type: "select", groups: [{ ids: ["k1", "k3", "k5"] }] } },
      { titel: "Svårast: para ihop sex kort", prompt: "Para ihop korten två och två.", view: { component: "kort", cards: [
        { id: "k1", face: percent(50) }, { id: "k2", face: { component: "hundraruta", marked: 75 } }, { id: "k3", face: fraction(1, 4) },
        { id: "k4", face: fraction(1, 2) }, { id: "k5", face: decimal(q(1, 4), 2) }, { id: "k6", face: { text: "tre fjärdedelar" } }] },
        answer: { type: "pairs" }, key: { type: "pairs", cards: { k1: "1/2", k4: "1/2", k2: "3/4", k6: "3/4", k3: "1/4", k5: "1/4" } } },
    ],
  },
  {
    id: "sortering", namn: "9. Sorteringsyta",
    fall: [
      { titel: "Ordna från minst till störst", prompt: "Lägg korten i ordning. Klicka eller dra.", view: { component: "sortering", order: true, cards: [
        { id: "a", face: fraction(1, 2) }, { id: "b", face: fraction(1, 3) }, { id: "c", face: fraction(3, 4) }, { id: "d", face: decimal(q(3, 5), 1) }, { id: "e", face: fraction(5, 8) }] },
        answer: { type: "order" }, key: { type: "order", values: { a: q(1, 2), b: q(1, 3), c: q(3, 4), d: q(3, 5), e: q(5, 8) } } },
      { titel: "Kategorier: jämfört med en halv", prompt: "Sortera korten i facken.", view: { component: "sortering", bins: [{ id: "under", label: "Mindre än 1/2" }, { id: "lika", label: "Lika med 1/2" }, { id: "over", label: "Större än 1/2" }], cards: [
        { id: "a", face: fraction(2, 5) }, { id: "b", face: fraction(3, 6) }, { id: "c", face: fraction(5, 8) }, { id: "d", face: { component: "cirkel", parts: 4, marked: 1 } }, { id: "e", face: percent(50) }, { id: "f", face: decimal(q(7, 10), 1) }] },
        answer: { type: "categories", bins: ["under", "lika", "over"] }, key: { type: "categories", bins: { a: "under", b: "lika", c: "over", d: "under", e: "lika", f: "over" } } },
    ],
  },
  {
    id: "areamodell", namn: "10. Areal modell för produkt",
    fall: [
      { titel: "Första: 1/2 · 1/2", view: { component: "areamodell", vertical: q(1, 2), horizontal: q(1, 2) } },
      { titel: "Normal: 2/3 · 3/4, stegvis", prompt: "Måla rutorna som ligger i båda.", view: { component: "areamodell", vertical: q(2, 3), horizontal: q(3, 4), show: "lodratt" }, ...paint(12, 6), extra: ["steg"] },
      { titel: "Svårast: 5/6 · 7/8", view: { component: "areamodell", vertical: q(5, 6), horizontal: q(7, 8) } },
    ],
  },
];

/** En hel uppgift (mountTask + hjälp + återkoppling). */
export const UPPGIFT = {
  prompt: "Vilket bråk visar bilden?",
  view: { component: "stav", parts: 5, marked: 3 },
  answer: { type: "number", input: "fraction" },
  key: { type: "number", value: q(3, 5), requirement: "value" },
  help: [
    { step: "orientering", text: "Hela staven är 1. Räkna hur många lika stora delar den är delad i.", highlight: { whole: true } },
    { step: "princip", text: "Nämnaren säger hur många lika delar helheten har. Täljaren säger hur många av dem som är färgade.", highlight: { count: true } },
    { step: "modellering", text: "Här är ett exempel med andra tal: 2 av 3 delar är färgade, alltså 2/3.", view: { component: "stav", parts: 3, marked: 2 } },
    { step: "atergang", text: "Nu provar du själv på din stav." },
  ],
  feedback: { correct: "Ja! Tre av fem lika stora delar är tre femtedelar.", wrong: "Räkna alla lika stora delar – det är nämnaren. De färgade är täljaren." },
};
