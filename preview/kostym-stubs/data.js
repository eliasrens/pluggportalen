// Preview-stub för src/data.js (#693) – elevens påklädnad i minnet, så att den
// RIKTIGA klädlådan (src/varld-rum-wear.js) kan köras utan Firebase.
export const MEM = (globalThis.__MEM = globalThis.__MEM || { ownedItems: [], avatarItems: [], skrivningar: 0 });
export async function saveAvatarItems(items) {
  MEM.avatarItems = [...items];
  MEM.skrivningar++;
  console.log("[preview] saveAvatarItems", items);
}
