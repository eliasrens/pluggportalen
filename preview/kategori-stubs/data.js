// Preview-stub för src/data.js (#445). Framsteg går via den RIKTIGA
// src/data-progress.js (saveProgress/getProgress) mot minnes-Firestore-stubben,
// så kategori-sammanslagningen som körs här är exakt produktionskoden.
import { MEM } from "./firestore.js";
export { getProgress, saveProgress } from "/src/data-progress.js";

const rotation = {};

export function currentStudentId() {
  return "elev-preview";
}
export async function getStudentData() {
  return MEM;
}
export function invalidateStudentData() {}
export async function addCoins(n) {
  MEM.coins += n;
  return MEM.coins;
}
export async function updateStudentProjectionAllClasses() {}
export async function getQuestionRotation(areaId, mode) {
  return rotation?.[areaId]?.[mode] || [];
}
export async function saveQuestionRotation(areaId, mode, keys) {
  rotation[areaId] = rotation[areaId] || {};
  rotation[areaId][mode] = Array.isArray(keys) ? keys : [];
}
export function isLoggedIn() {
  return true;
}
