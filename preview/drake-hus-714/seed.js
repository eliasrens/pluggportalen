// Startdata för preview-drake-hus-714.html (#714): elev1 med Bråkdraken på
// nivå 6 i rum 1 (studentData.brakdrake + brakresa/state), ett hus i TVÅ rum,
// en häst i rum 1 som storleksreferens (spec §9: drakens storlek mot en häst),
// en hund och Fjärlis. Byt nivå med ?niva=N (0 = ägg, ingen drake i huset).
const nu = Date.now();
const dag = 24 * 60 * 60 * 1000;

export const SEED = {
  "students/elev1": { namn: "Elev Ett", username: "elev1", classId: "4a" },
  "classes/4a": { name: "4A", by: "Björkby", order: 1, studentIds: ["elev1", "elev2"] },
  "students/elev2": { namn: "Elev Två", username: "elev2", classId: "4a" },
  "studentData/elev1": {
    coins: 900, xp: 120, progress: {}, questionRotation: {},
    ownedItems: ["rum-2", "sang", "bokhylla", "lampa", "stol", "hund"],
    ownedCounts: {},
    avatarItems: [], avatarId: "fox", avatarChosen: true,
    room: {
      paletteId: "persika",
      placements: { sang: { x: 18, y: 74 }, bokhylla: { x: 88, y: 50 }, lampa: { x: 70, y: 60 } },
    },
    extraRooms: { 0: { paletteId: "mint", placements: { stol: { x: 30, y: 78 } } } },
    garden: { placements: {} },
    husSkalId: null, husLast: false, readingLevel: 2,
    pets: [{
      id: "p-fjarlis", name: "Fjärlis", speciesId: "butterfly", eggBoughtAt: nu - 3 * dag, hasHeatLamp: false,
      hatchedAt: nu - 2 * dag, stage: 3, feedCount: 25, lastFedAt: nu - dag, pos: { x: 38, y: 82 }, stowed: false,
    }],
    roomAnimals: [{ uid: "hund", id: "hund", pos: { x: 26, y: 88 }, name: "Pluto", stowed: false }],
    farm: {
      barnLevel: 1, gardenTier: 1, gardenSlots: [], inventoryHarvest: {},
      animals: [{ uid: "animal_horse#1", id: "animal_horse", name: "Blixten", pos: { x: 82, y: 80 }, trivsel: 80, lastFedAt: null, lastGiftAt: null }],
      placedAnimals: [{ petId: "animal_horse#1", location: "room" }],
    },
    appleCount: 0, floorApples: [],
    brakdrake: { id: "drake-elev1", level: 6, name: "Bråkis" },
  },
  "studentData/elev1/brakresa/state": {
    schema: 1, totalStars: 64, mastered: 12, challenges: {},
    dragon: { id: "drake-elev1", hatchedAt: nu - 5 * dag, levelShown: 6, name: "Bråkis" },
    hunts: { count: 4, coins: 38, lastDate: null },
  },
  // Klasskamraten (läsläget i pages-klasskamrat): en vuxen drake på nivå 12.
  "studentData/elev2": {
    coins: 0, ownedItems: [], avatarId: "fox", avatarChosen: true,
    room: { paletteId: "mint", placements: {} },
    brakdrake: { id: "drake-elev2", level: 12, name: "Glimra", pos: { x: 50, y: 88 } },
  },
};
