// Preview-stub för src/data.js – all lagring i minnet (ingen Firebase). Räcker
// för att köra läsförståelse-läget: framsteg, coins, XP och text-rotationen.
const mem = {
  coins: 0,
  progress: {},
  rotation: {},
};

export async function getProgress() {
  return mem.progress;
}

export async function addCoins(n) {
  mem.coins += n;
  console.log("[preview] +coins", n, "→", mem.coins);
  return mem.coins;
}

export async function saveProgress(area, mode, node) {
  mem.progress[area] = mem.progress[area] || {};
  mem.progress[area][mode] = { ...(mem.progress[area][mode] || {}), ...node };
}

export async function getQuestionRotation(areaId, mode) {
  return mem.rotation?.[areaId]?.[mode] || [];
}

export async function saveQuestionRotation(areaId, mode, keys) {
  mem.rotation[areaId] = mem.rotation[areaId] || {};
  mem.rotation[areaId][mode] = Array.isArray(keys) ? keys : [];
  console.log("[preview] rotation sparad", areaId, mode, keys);
}

export function isLoggedIn() {
  return true;
}
