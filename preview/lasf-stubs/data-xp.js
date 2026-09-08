// Preview-stub för src/data-xp.js – XP-ackumulering i minnet.
let xp = 0;
export async function getXp() { return xp; }
export async function addXp(amount) {
  xp += amount;
  console.log("[preview] +XP", amount, "→", xp);
  return xp;
}
