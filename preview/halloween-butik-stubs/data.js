// Preview-stub för src/data.js (#692) – ett studentData-dokument i minnet så att
// den RIKTIGA src/pages-shop.js kan köra köp-flödet utan Firebase.
import { isMultiItem } from "/src/shop-items.js";
import { farmFromData } from "/src/farm-core.js";

export const MEM = (globalThis.__MEM = globalThis.__MEM || {
  coins: 5000, ownedItems: [], ownedCounts: {}, appleCount: 0, farm: {},
});
export { farmFromData };
export const isLoggedIn = () => true;
export const currentStudentId = () => "elev-preview";
export const invalidateStudentData = () => {};
export async function getStudentData() {
  return JSON.parse(JSON.stringify(MEM));
}
export function ownedCount(data, id) {
  const c = data && data.ownedCounts;
  if (c && Object.prototype.hasOwnProperty.call(c, id)) return Math.max(0, Math.round(c[id] || 0));
  return data && Array.isArray(data.ownedItems) && data.ownedItems.includes(id) ? 1 : 0;
}
export async function buyItem(itemId, price) {
  const multi = isMultiItem(itemId);
  if (!multi && MEM.ownedItems.includes(itemId)) return { ok: true, coins: MEM.coins, owned: MEM.ownedItems, counts: MEM.ownedCounts };
  if (MEM.coins < price) return { ok: false, coins: MEM.coins, owned: MEM.ownedItems, counts: MEM.ownedCounts };
  MEM.coins -= price;
  if (multi) MEM.ownedCounts[itemId] = ownedCount(MEM, itemId) + 1;
  if (!MEM.ownedItems.includes(itemId)) MEM.ownedItems.push(itemId);
  console.log("[preview] buyItem", itemId, price);
  return { ok: true, coins: MEM.coins, owned: [...MEM.ownedItems], counts: { ...MEM.ownedCounts } };
}
