// Seed för preview-pixi-gard.html (#423): EN elev med full gård – mogna grödor
// i odlingsbädden, häst/ko i hagen (ko + gris med väntande 🎁), gris i ladan,
// ägda lada-skins (byts i "🛖 Ny lada") och en klass så byn/klasskylten finns.
export const SEED_UID = "pv-elev1";

export function seed() {
  const nu = Date.now();
  const igar = nu - 26 * 3600 * 1000;
  return {
    [`students/${SEED_UID}`]: { namn: "Elev Ett", username: "elev1", avatarId: "fox", classIds: ["pv-klass"] },
    "students/pv-elev2": { namn: "Kompis Två", username: "elev2", avatarId: "cat", classIds: ["pv-klass"] },
    "classes/pv-klass": { name: "4A (preview)", studentIds: [SEED_UID, "pv-elev2"], teacherIds: [] },
    "studentData/pv-elev2": { coins: 10, xp: 0, ownedItems: [], avatarItems: [], avatarId: "cat", farm: {} },
    [`studentData/${SEED_UID}`]: {
      coins: 500,
      xp: 1200,
      progress: {},
      ownedItems: ["lada-bla", "lada-godis", "lada-rymd", "animal_horse", "animal_cow", "animal_pig", "crop_carrot", "crop_clover"],
      ownedCounts: { crop_carrot: 3, crop_clover: 2 },
      avatarItems: [],
      room: { placements: {} },
      garden: { placements: {} },
      husSkalId: null,
      husLast: false,
      readingLevel: 1,
      avatarId: "fox",
      avatarChosen: true,
      farm: {
        barnLevel: 2,
        barnSkin: null,
        gardenTier: 2,
        gardenSlots: [
          { slotIndex: 0, cropId: "crop_carrot", growthStage: 3, plantedAt: igar },
          { slotIndex: 1, cropId: "crop_clover", growthStage: 3, plantedAt: igar },
          { slotIndex: 2, cropId: "crop_carrot", growthStage: 1, plantedAt: nu },
        ],
        inventoryHarvest: { crop_carrot: 2, crop_clover: 1 },
        placedAnimals: [
          { petId: "h1", location: "paddock" },
          { petId: "k1", location: "paddock" },
          { petId: "g1", location: "barn" },
          { petId: "k2", location: "barn" },
        ],
        animals: [
          { uid: "h1", id: "animal_horse", name: "Blixten", trivsel: 80, lastFedAt: igar, lastGiftAt: null },
          { uid: "k1", id: "animal_cow", name: "Mjölka", trivsel: 90, lastFedAt: nu, lastGiftAt: null },
          { uid: "g1", id: "animal_pig", name: "Nasse", trivsel: 75, lastFedAt: nu, lastGiftAt: null },
          { uid: "k2", id: "animal_cow", name: "Rosa", trivsel: 40, lastFedAt: igar, lastGiftAt: null },
        ],
      },
    },
  };
}
