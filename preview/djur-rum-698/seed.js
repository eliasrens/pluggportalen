// Startdata för preview-djur-rum-698.html (#698): elev1 med ett hus i TRE rum
// och djur utspridda via farm.placedAnimals ("room:N", ingen post = rum 1):
//   Rum 1: Fjärlis (ingen post), Robban (sparat "room:5" – huset har bara 3
//          rum → visas i rum 1), Pluto (hund, ingen post), 1 Mysterymat
//   Rum 2: Spökis (Halloween-djur, "room:1"), 1 Mysterymat (room: 1)
//   Rum 3: kattungen ("room:2")
//   Hagen: hästen Blixten ("paddock") – oförändrat gårdsflöde
// 5 Mysterymat i förrådet. Fjärlis och Spökis är hungriga (feedCount < 30).
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
    ownedItems: ["rum-2", "rum-3", "sang", "bokhylla", "lampa", "tv", "stol", "hund", "katt"],
    ownedCounts: {},
    avatarItems: [], avatarId: "fox", avatarChosen: true,
    room: {
      paletteId: "persika",
      placements: { sang: { x: 22, y: 74 }, bokhylla: { x: 84, y: 52 }, lampa: { x: 64, y: 62 } },
    },
    extraRooms: {
      0: { paletteId: "mint", placements: { tv: { x: 50, y: 58 } } },
      1: { paletteId: "lavendel", placements: { stol: { x: 30, y: 78 } } },
    },
    garden: { placements: {} },
    husSkalId: null, husLast: false, readingLevel: 2,
    pets: [
      mystery("p-fjarlis", "butterfly", 3, "Fjärlis", { x: 40, y: 80 }),
      mystery("p-spokis", "spokis", 12, "Spökis", { x: 58, y: 84 }),
      mystery("p-robob", "robob", 25, "Robban", { x: 76, y: 78 }),
    ],
    roomAnimals: [
      { uid: "hund", id: "hund", pos: { x: 30, y: 88 }, name: "Pluto", stowed: false },
      { uid: "katt", id: "katt", pos: { x: 70, y: 86 }, name: null, stowed: false },
    ],
    farm: {
      barnLevel: 1, gardenTier: 1, gardenSlots: [], inventoryHarvest: {},
      animals: [{ uid: "animal_horse#1", id: "animal_horse", name: "Blixten", pos: null, trivsel: 80, lastFedAt: null, lastGiftAt: null }],
      placedAnimals: [
        { petId: "p-spokis", location: "room:1" },
        { petId: "p-robob", location: "room:5" },
        { petId: "katt", location: "room:2" },
        { petId: "animal_horse#1", location: "paddock" },
      ],
    },
    appleCount: 5,
    floorApples: [{ id: "a-rum1", x: 50, y: 86 }, { id: "a-rum2", x: 30, y: 84, room: 1 }],
  },
};
