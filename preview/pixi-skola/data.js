// Preview-stub för src/data.js (#421, epic #396): klasser + elever i minnet,
// ingen Firebase. Bara det husvärlden läser i by/skola/grannby-flödet stubbas;
// resten är den riktiga modulen (laddad som /src/data.js?real). Varje stubbad
// läsning loggas i scenario.lasningar → klick-testet bevisar att hover/
// förvärmning inte läser något.
import { ME, classes, entry, lasning } from "./scenario.js";
import { defaultStudentData } from "/src/data.js?real";
export * from "/src/data.js?real";

export { getSession, currentStudentId, isLoggedIn } from "./auth.js";

const sd = {
  ...defaultStudentData("fox"),
  coins: 120,
  avatarItems: ["keps"],
  room: { placements: {}, paletteId: "himmel" },
};

export async function getStudentData() {
  lasning("getStudentData", ME);
  return sd;
}
export async function getStats() {
  return { stars: 3 };
}
export async function getClasses() {
  lasning("getClasses");
  return classes;
}
const boende = (c) => c.studentIds.map((id, i) => entry(id, i));
export async function getOwnVillageOverview({ meId }) {
  lasning("getOwnVillageOverview", meId);
  const egen = classes.filter((c) => c.studentIds.includes(meId));
  return egen.flatMap(boende).map((e) => (e.id === meId ? { ...e, locked: false } : e));
}
export async function getClassOverview(classId) {
  lasning("getClassOverview", classId);
  await new Promise((r) => setTimeout(r, 120)); // känns som 1 projektions-dok
  const c = classes.find((k) => k.id === classId);
  return c ? boende(c) : [];
}
export const isHouseLocked = async () => false;
export const getHusLast = async () => false;
export const setHusLast = async () => {};
export const saveHusSkal = async () => {};
export const saveRoom = async () => {};
export const saveGarden = async () => {};
