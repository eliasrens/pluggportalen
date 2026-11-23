// Startdata för preview-jul-909-app.html (#909, kopia av #908:s): en by med 20
// hus i olika husskal (även legendariska och Halloween-hus) + elev1 med
// laggård och odlingsbädd. config/season: ?sasong=vinter|host|sommar|bort
// (vinter default) + ?jul=0|1 (1 default) + ?halloween=1. Antal hus ?elever=N.
const q = new URLSearchParams(typeof location === "undefined" ? "" : location.search);
const sasong = q.get("sasong") || "vinter";
const jul = q.get("jul") !== "0";
const halloween = q.get("halloween") === "1";

const NAMN = ["Elev Ett", "Noah", "Alice", "Elsa", "Hugo", "Liam", "Oskar", "Wilma", "Ella", "Maja",
  "Leo", "Saga", "Ebbe", "Vincent", "Alva", "Theo", "Freja", "Ines", "Stella", "Siri"];
const PAL = ["mint", "persika", "himmel", "lavendel", "solgul", "rosa", "skog", "hav"];
const AV = ["fox", "bear", "cat", "rabbit", "panda", "owl", "frog", "mouse"];
const SKAL = [null, "slott", "svamphus", null, "godishus", "tradkoja", null, "cirkustalt", "glasvilla", null,
  "kristallgrotta", "myst-molnslott", null, "hw-spokhus", "drakgrotta", null, "fruktpalats", "raket", null, "skyskrapa"];

// ?elever=N (1–20) = färre hus → mer mark (bländtestets värsta fall).
const antal = Math.max(1, Math.min(20, Number(q.get("elever")) || 20));
const ids = NAMN.slice(0, antal).map((_, i) => (i === 0 ? "elev1" : `e${i}`));

export const SEED = {
  "classes/4a": { name: "4A", by: "Björkby", order: 1, studentIds: ids },
};
if (sasong !== "bort") {
  SEED["config/season"] = {
    season: ["vinter", "host", "sommar"].includes(sasong) ? sasong : "vinter",
    halloween, halloweenUntil: null,
    jul, julUntil: null,
  };
}
ids.forEach((id, i) => {
  SEED[`students/${id}`] = { namn: NAMN[i], username: id, classId: "4a", avatarId: AV[i % AV.length] };
  SEED[`studentData/${id}`] = {
    coins: 2000, xp: 120 + i * 40, progress: {}, questionRotation: {},
    ownedItems: SKAL[i] ? [SKAL[i]] : [], ownedCounts: {},
    avatarItems: [], avatarId: AV[i % AV.length], avatarChosen: true,
    room: { paletteId: PAL[i % PAL.length], placements: {} },
    husSkalId: SKAL[i], husLast: false, readingLevel: 2,
    pets: [], roomAnimals: [],
    farm: { barnLevel: 2, gardenTier: 2, gardenSlots: [], inventoryHarvest: {}, animals: [], placedAnimals: [] },
    appleCount: 0, floorApples: [],
  };
});
