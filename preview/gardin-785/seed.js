// Startdata för preview-gardin-785.html (#785): två rum, spökgardin placerad vid fönstret.
export const SEED = {
  "students/elev1": { namn: "Elev Ett", username: "elev1", classId: "4a" },
  "classes/4a": { name: "4A", by: "Björkby", order: 1, studentIds: ["elev1"] },
  "studentData/elev1": {
    coins: 900, xp: 120, progress: {}, questionRotation: {},
    ownedItems: ["rum-2", "soffa", "sang", "hw-spokgardin"],
    ownedCounts: {},
    avatarItems: [], avatarId: "fox", avatarChosen: true,
    room: {
      paletteId: "persika",
      placements: { "hw-spokgardin": { x: 50, y: 40 }, soffa: { x: 30, y: 78 } },
    },
    extraRooms: { 0: { paletteId: "mint", placements: { "hw-spokgardin": { x: 50, y: 40 }, sang: { x: 70, y: 80 } } } },
    garden: { placements: {} },
    husSkalId: null, husLast: false, readingLevel: 2,
    pets: [], roomAnimals: [],
    farm: { barnLevel: 1, gardenTier: 1, gardenSlots: [], inventoryHarvest: {}, animals: [], placedAnimals: [] },
    appleCount: 0, floorApples: [],
  },
};
