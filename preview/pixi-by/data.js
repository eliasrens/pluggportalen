// Preview-stub för src/data.js (#420, Pixi-byn): allt RIKTIGT data-lager
// re-exporteras (import av "/src/data.js?real" – annan URL, så importmapen
// mappar inte om den), och bara det husvärlden läser vid by/hus/kompis
// skrivs över här med en 25-husby i minnet. Lokala exporter vinner över
// `export *`. Varje läsning räknas i window.__pvLasningar.
export * from "/src/data.js?real";
import { las } from "./lasningar.js";

const ME = "elev01";
const NAMN = ["Alva", "Bruno", "Cora", "Dante", "Ebba", "Frans", "Gun", "Hugo", "Ines", "Jack",
  "Kim", "Lova", "Malte", "Nora", "Olle", "Pia", "Rut", "Sam", "Tea", "Ulf",
  "Vera", "Wille", "Yra", "Zeb", "Åke"];
const AV = ["fox", "owl", "cat", "dog", "panda", "frog", "unicorn", "dragon", "lion", "penguin", "koala", "robot", "tiger"];
const PAL = ["persika", "mint", "himmel", "rosa", "sol", "lavendel", "korall", "skog", "hav", "korsbar", "plommon", "is"];
const SKAL = ["stuga", "slott", "svamphus", "skepp", "fotboll", "skyskrapa", "glasvilla", "cirkustalt", "raket", "godishus", "tradkoja", "akvariehus"];
const KLADER = [[], ["keps"], ["krona"], ["partyhatt", "glasogon"], ["vintermossa"], ["cowboyhatt", "mustasch"], ["trollkarlshatt"]];
const LASTA = new Set(["elev07", "elev15"]); // husLast → 🔒-bubbla, ingen resa

export const elever = NAMN.map((namn, i) => {
  const id = `elev${String(i + 1).padStart(2, "0")}`;
  return {
    id, namn, username: namn.toLowerCase(),
    avatarId: AV[i % AV.length], avatarItems: KLADER[i % KLADER.length],
    paletteId: PAL[i % PAL.length], husSkalId: SKAL[(i * 5) % SKAL.length],
    locked: LASTA.has(id), xp: 120 + i * 37, stars: 3 + (i % 7), completed: 4 + i,
  };
});
const klasser = [
  { id: "4a", name: "4A", by: "Björkby", order: 1, studentIds: elever.map((e) => e.id) },
  { id: "4b", name: "4B", by: "Ekdal", order: 2, studentIds: ["g1", "g2", "g3", "g4"] },
];
const jag = elever[0];
const sd = {
  avatarId: jag.avatarId, avatarItems: jag.avatarItems, paletteId: jag.paletteId, husSkalId: jag.husSkalId,
  coins: 250, ownedItems: [], rooms: null, garden: [], pets: [], husLast: false,
};

export const isLoggedIn = () => true;
export const getSession = () => ({ studentId: ME, namn: jag.namn, username: jag.username });
export const currentStudentId = () => ME;
export async function getStudentData() { las("getStudentData"); return sd; }
export async function getStats() { las("getStats"); return { stars: 12 }; }
export async function getClasses() { las("getClasses"); return klasser; }
export async function getOwnVillageOverview() {
  las("getOwnVillageOverview");
  await new Promise((r) => setTimeout(r, 150)); // känns som en riktig läsning
  return elever.map((e) => ({ ...e }));
}
export async function getClassOverview(_klassId, ids) {
  las("getClassOverview");
  return (ids || []).map((id, i) => ({ id, namn: `Granne ${i + 1}`, avatarId: AV[i], paletteId: PAL[i], husSkalId: SKAL[i] }));
}
export const isHouseLocked = (d) => !!(d && d.husLast === true);
export async function setHusLast(v) { sd.husLast = !!v; return !!v; }
export async function saveHusSkal(id) { sd.husSkalId = id; }
export async function saveAvatarItems(items) { sd.avatarItems = items; }
export async function saveGarden(g) { sd.garden = g; }
export async function saveRoomAt() {}
export function logout() {}
