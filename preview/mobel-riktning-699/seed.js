// Startdata för preview-mobel-riktning-699-app.html (#699): elev1 med två rum
// fulla av möbler – några redan vridna/vända (rot/flip) så omladdning och
// "befintliga rum ser likadana ut" går att prova – och en trädgård med bil,
// träd och parkeringsruta (P-skylten = text → ingen ↔ Vänd).
//   Rum 1: soffa, fåtölj (rot 1), TV (rot 2), bokhylla, lampa, väggklocka (text),
//          tavla (flip), matta, säng (flip)
//   Rum 2: skrivbord, byrå (rot 3), garderob, kylskåp, gungstol, nattduksbord
export const SEED = {
  "students/elev1": { namn: "Elev Ett", username: "elev1", classId: "4a" },
  "classes/4a": { name: "4A", by: "Björkby", order: 1, studentIds: ["elev1"] },
  "studentData/elev1": {
    coins: 900, xp: 120, progress: {}, questionRotation: {},
    ownedItems: [
      "rum-2", "soffa", "fatolj", "tv", "bokhylla", "lampa", "vaggklocka", "tavla", "matta", "sang",
      "skrivbord", "byra", "garderob", "kylskap", "gungstol", "nattduksbord", "dator", "enkelsang",
      "bil", "trad", "parkering", "cykel",
    ],
    ownedCounts: { bil: 1, trad: 2, parkering: 1, cykel: 1 },
    avatarItems: [], avatarId: "fox", avatarChosen: true,
    room: {
      paletteId: "persika",
      placements: {
        matta: { x: 50, y: 86 },
        soffa: { x: 30, y: 72 },
        fatolj: { x: 58, y: 74, rot: 1 },
        tv: { x: 78, y: 70, rot: 2 },
        bokhylla: { x: 90, y: 56 },
        lampa: { x: 12, y: 64 },
        vaggklocka: { x: 60, y: 22 },
        tavla: { x: 32, y: 28, flip: true },
        sang: { x: 44, y: 90, flip: true },
      },
    },
    extraRooms: {
      0: {
        paletteId: "mint",
        placements: {
          skrivbord: { x: 24, y: 70 }, byra: { x: 48, y: 66, rot: 3 }, garderob: { x: 66, y: 58 },
          kylskap: { x: 84, y: 60 }, gungstol: { x: 36, y: 86 }, nattduksbord: { x: 60, y: 86 },
        },
      },
    },
    garden: {
      placements: {
        bil: { x: 22, y: 82, flip: true }, trad: { x: 82, y: 74 }, "trad#2": { x: 12, y: 70 },
        parkering: { x: 30, y: 90 },
      },
    },
    husSkalId: null, husLast: false, readingLevel: 2,
    pets: [], roomAnimals: [],
    farm: { barnLevel: 1, gardenTier: 1, gardenSlots: [], inventoryHarvest: {}, animals: [], placedAnimals: [] },
    appleCount: 0, floorApples: [],
  },
};
