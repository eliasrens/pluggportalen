// Startdata för preview-pixi-rum.html (#422): elev1 i klass 4A med ett
// möblerat grundrum (persika), Rum 2 (mint, annan väggfärg), 3 mystery-djur i
// olika steg (ett odöpt → ✏️), 2 vanliga djur och 5 Mysterymat att lägga ut.
const nu = Date.now();
const dag = 24 * 60 * 60 * 1000;
const mystery = (id, speciesId, feedCount, name, pos) => ({
  id, name, speciesId, eggBoughtAt: nu - 3 * dag, hasHeatLamp: false, hatchedAt: nu - 2 * dag,
  stage: feedCount >= 20 ? 3 : feedCount >= 10 ? 2 : 1, feedCount, lastFedAt: nu - dag, pos, stowed: false,
});

export const SEED = {
  "students/elev1": { namn: "Elev Ett", username: "elev1", classId: "4a" },
  "classes/4a": { name: "4A", by: "Björkby", order: 1, studentIds: ["elev1"] },
  "studentData/elev1": {
    coins: 900, xp: 120, progress: {}, questionRotation: {},
    ownedItems: ["rum-2", "sang", "bokhylla", "lampa", "tv", "stol", "hund", "katt"],
    ownedCounts: {},
    avatarItems: [], avatarId: "fox", avatarChosen: true,
    room: {
      paletteId: "persika",
      placements: { sang: { x: 22, y: 74 }, bokhylla: { x: 84, y: 52 }, lampa: { x: 64, y: 62 } },
    },
    extraRooms: { 0: { paletteId: "mint", placements: { tv: { x: 50, y: 58 }, stol: { x: 30, y: 78 } } } },
    garden: { placements: {} },
    husSkalId: null, husLast: false, readingLevel: 2,
    pets: [
      mystery("p-fjarlis", "butterfly", 3, null, { x: 40, y: 80 }),
      mystery("p-eldis", "eldis", 12, "Gnistan", { x: 58, y: 84 }),
      mystery("p-robob", "robob", 25, "Robban", { x: 76, y: 78 }),
    ],
    roomAnimals: [
      { uid: "hund", id: "hund", pos: { x: 30, y: 88 }, name: "Pluto", stowed: false },
      { uid: "katt", id: "katt", pos: { x: 86, y: 86 }, name: null, stowed: false },
    ],
    appleCount: 5,
    floorApples: [],
  },
};
