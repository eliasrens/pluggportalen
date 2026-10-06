// ============================================================================
// Sådd för preview-pixi-hus.html (#419): EN klass med stub-eleven + 6 kamrater
// med husskal ur olika art-hus-*-register, olika paletter och avatarer.
// Stub-eleven äger alla hus, kläder och trädgårdssaker (så Måla om, Nytt hus,
// Kläder och Trädgård har något att välja) och har två saker utplacerade.
// ============================================================================

import { SHOP_ITEMS } from "../../src/shop-items.js";

export const ME_ID = "stub-elev1";
const KLASS = "stub-klass";

const KAMRATER = [
  ["stub-k1", "Alva", "cat", "skepp", "mint", ["keps"]],
  ["stub-k2", "Bo", "bjorn", "svamphus", "rosa", []],
  ["stub-k3", "Cleo", "panda", "skyskrapa", "lavendel", ["krona"]],
  ["stub-k4", "Dino", "frog", "slott", "sol", []],
  ["stub-k5", "Ella", "rabbit", "fotboll", "hav", ["partyhatt"]],
  ["stub-k6", "Filip", "owl", null, "korall", []],
];

const studentData = (o) => ({
  coins: 5000, xp: 1200, progress: {}, questionRotation: {}, ownedItems: [], ownedCounts: {},
  avatarItems: [], room: { placements: {} }, garden: { placements: {} }, husSkalId: null, husLast: false,
  readingLevel: 2, avatarId: "fox", avatarChosen: true, ...o,
});

/** @param {(path:string, data:object) => void} satt */
export function seed(satt) {
  const ager = SHOP_ITEMS.filter((i) => ["hus", "klader", "tradgard"].includes(i.category)).map((i) => i.id);
  satt(`students/${ME_ID}`, { namn: "Elev Ett", username: "elev1", avatarId: "fox", classIds: [KLASS] });
  satt(`studentData/${ME_ID}`, studentData({
    ownedItems: ager,
    avatarItems: ["keps"],
    room: { placements: {}, paletteId: "persika" },
    garden: { placements: { trad: { x: 82, y: 70 }, cykel: { x: 18, y: 80 } } },
  }));
  for (const [id, namn, avatarId, husSkalId, paletteId, klader] of KAMRATER) {
    satt(`students/${id}`, { namn, username: namn.toLowerCase(), avatarId, classIds: [KLASS] });
    satt(`studentData/${id}`, studentData({ avatarId, husSkalId, avatarItems: klader, ownedItems: klader, room: { placements: {}, paletteId } }));
  }
  satt(`classes/${KLASS}`, { name: "4B", order: 1, studentIds: [ME_ID, ...KAMRATER.map((k) => k[0])] });
}
