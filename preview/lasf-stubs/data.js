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

export async function saveReadingProgress(areaId, textId, result) {
  mem.progress[areaId] = mem.progress[areaId] || {};
  mem.progress[areaId].reading = mem.progress[areaId].reading || {};
  mem.progress[areaId].reading[textId] = { ...result };
  console.log("[preview] reading-progress", areaId, textId, result);
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

// Overview-harnessen sätter området via globalThis.__PREVIEW_AREA.
export async function getArea() {
  return globalThis.__PREVIEW_AREA || null;
}

// Test-hjälpare för overview-harnessen (byt seed mellan scenarier).
export function __setProgress(p) {
  mem.progress = p || {};
}
export function __getProgress() {
  return mem.progress;
}
