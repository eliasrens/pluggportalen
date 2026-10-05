// Preview-stub för src/data.js (issue #391) – klasserna lever i minnet (ingen
// Firebase). setClassHiddenVillages speglar den riktiga skrivvägens semantik
// (normalisering + klassens eget id rensas bort) och meddelar sidan via ett
// event så elevens områdesvy ritas om direkt.
import { normalizeHiddenVillages } from "/src/gamemode-visibility.js";

export const classes = [
  { id: "4a", name: "4A", by: "Björkby", order: 1, studentIds: ["alva", "bruno", "cora", "dante", "ebba", "frans"] },
  { id: "4b", name: "4B", by: "Ekdal", order: 2, studentIds: ["gun", "hugo", "ines", "jack"] },
  { id: "5a", name: "5A", order: 3, studentIds: ["kim", "lova", "malte", "nora", "olle"] },
  { id: "spec", name: "Specgrupp", by: "Lugna hörnet", order: 4, studentIds: ["pia", "rut"] },
  { id: "6a", name: "6A", by: "Sjöstad", order: 5, studentIds: ["sam", "tea", "ulf", "vera", "wille", "yra", "zeb"] },
];

export async function getClasses() {
  return classes;
}

export async function setClassHiddenVillages(classId, hiddenVillages) {
  await new Promise((r) => setTimeout(r, 250)); // känns som en riktig skrivning
  const list = normalizeHiddenVillages(hiddenVillages).filter((id) => id !== classId);
  const cls = classes.find((c) => c.id === classId);
  if (cls) cls.hiddenVillages = list;
  window.dispatchEvent(new CustomEvent("pv-classes-changed"));
  return list;
}

export async function getClassHiddenVillages(classId) {
  const cls = classes.find((c) => c.id === classId);
  return normalizeHiddenVillages(cls?.hiddenVillages);
}
