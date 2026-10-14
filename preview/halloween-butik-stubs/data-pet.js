// Preview-stub för src/data-pet.js (#692, #695): bara det butiken behöver.
// buyEgg drar mynt och lägger ägget (även Halloween-djurens pumpaägg) i MEM.pets.
export const EGG_ITEM_ID = "mystery-egg";
export const LAMP_ITEM_ID = "varmelampa";
export const cleanPetName = (s) => String(s || "");
export async function buyEgg(price, _studentId, eggSpecies = null) {
  const MEM = globalThis.__MEM;
  if (MEM.coins < price) return { ok: false, coins: MEM.coins };
  MEM.coins -= price;
  (MEM.pets ||= []).push({ id: "p" + MEM.pets.length, eggBoughtAt: Date.now(), hatchedAt: null, ...(eggSpecies ? { eggSpecies } : {}) });
  console.log("[preview] buyEgg", price, eggSpecies);
  return { ok: true, coins: MEM.coins, pets: MEM.pets };
}
export const buyHeatLamp = async () => ({ ok: false, coins: globalThis.__MEM.coins });
