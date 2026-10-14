// Preview-stub för src/data-pet.js (#692): bara det butiken behöver.
export const EGG_ITEM_ID = "mystery-egg";
export const LAMP_ITEM_ID = "varmelampa";
export const cleanPetName = (s) => String(s || "");
export const buyEgg = async () => ({ ok: false, coins: globalThis.__MEM.coins });
export const buyHeatLamp = buyEgg;
