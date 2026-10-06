// Preview-stub för src/data.js (issue #412) – klasser + inloggad elev lever i
// minnet (ingen Firebase). setClassHiddenModules speglar den riktiga
// skrivvägens semantik (normalisering) och meddelar sidan via ett event så
// elevens sidomeny ritas om direkt. Övriga funktioner = det renderTopbar behöver.
import { normalizeHiddenModules } from "/src/gamemode-visibility.js";

export const classes = [
  { id: "4a", name: "4A", order: 1, studentIds: ["alva", "bruno"] },
  { id: "5a", name: "5A", order: 2, studentIds: ["kim", "lova"] },
  { id: "spec", name: "Specgrupp", order: 3, studentIds: ["pia", "alva"] },
];

let me = { id: "alva", namn: "Alva" };
export function loginAs(id, namn) {
  me = { id, namn };
}

export function getSession() {
  return { role: "student", id: me.id, namn: me.namn };
}
export function currentStudentId() {
  return me.id;
}
export function logout() {}
export async function getStudentData() {
  return { coins: 120, avatarId: undefined, avatarItems: [] };
}
export async function getStats() {
  return { stars: 14 };
}
export async function getClasses() {
  return classes;
}

export async function setClassHiddenModules(classId, hiddenModules) {
  await new Promise((r) => setTimeout(r, 250)); // känns som en riktig skrivning
  const list = normalizeHiddenModules(hiddenModules);
  const cls = classes.find((c) => c.id === classId);
  if (cls) cls.hiddenModules = list;
  window.dispatchEvent(new CustomEvent("pv-classes-changed"));
  return list;
}

export async function getClassHiddenModules(classId) {
  return normalizeHiddenModules(classes.find((c) => c.id === classId)?.hiddenModules);
}
