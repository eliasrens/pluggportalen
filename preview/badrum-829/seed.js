// Startdata för preview-badrum-829-app.html (#829): elev1 med ett badrum
// bredvid sängen, soffan och kylskåpet (storleksjämförelse) och 2000 mynt.
// Tvättmaskinen ägs inte – köp den i butiken (Möbler & prylar) och placera.
//   Rum 1: badrumsmatta (platt, under badkaret), badkar, dusch, toalett,
//          handfat, handdukstork, tvättkorg + säng, soffa, kylskåp
export const SEED = {
  "students/elev1": { namn: "Elev Ett", username: "elev1", classId: "4a" },
  "classes/4a": { name: "4A", by: "Björkby", order: 1, studentIds: ["elev1"] },
  "studentData/elev1": {
    coins: 2000, xp: 120, progress: {}, questionRotation: {},
    ownedItems: [
      "badrumsmatta", "badkar", "dusch", "toalett", "handfat", "handdukstork", "tvattkorg",
      "sang", "soffa", "kylskap",
    ],
    ownedCounts: {},
    avatarItems: [], avatarId: "fox", avatarChosen: true,
    room: {
      paletteId: "mint",
      placements: {
        badrumsmatta: { x: 28, y: 84 },
        badkar: { x: 28, y: 80 },
        dusch: { x: 8, y: 62 },
        toalett: { x: 50, y: 66 },
        handfat: { x: 62, y: 62 },
        handdukstork: { x: 74, y: 64 },
        tvattkorg: { x: 52, y: 88 },
        sang: { x: 74, y: 92 },
        soffa: { x: 88, y: 76 },
        kylskap: { x: 92, y: 60 },
      },
    },
    husSkalId: null, husLast: false, readingLevel: 2,
    pets: [], roomAnimals: [],
    farm: { barnLevel: 1, gardenTier: 1, gardenSlots: [], inventoryHarvest: {}, animals: [], placedAnimals: [] },
    appleCount: 0, floorApples: [],
  },
};
