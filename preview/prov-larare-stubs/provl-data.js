// Preview-stub för src/prov/larare/provl-data.js (#739): proven lever i
// localStorage ("pp-preview-prov") i stället för Firestore. Samma API.
import { FIXTUR } from "./fixtur.js";

const NYCKEL = "pp-preview-prov";
const las = () => JSON.parse(localStorage.getItem(NYCKEL) || "null") || structuredClone(FIXTUR);
const skriv = (alla) => localStorage.setItem(NYCKEL, JSON.stringify(alla));
const vanta = () => new Promise((r) => setTimeout(r, 120));

export async function listaProv() {
  await vanta();
  return las();
}
export async function hamtaProv(id) {
  await vanta();
  return las().find((p) => p.id === id) || null;
}
export async function sparaProv(id, dok, existing = null) {
  await vanta();
  const alla = las();
  const nyttId = id || `p${Date.now().toString(36)}`;
  const post = { ...dok, id: nyttId, skapad: existing?.skapad ?? Date.now(), uppdaterad: Date.now() };
  const i = alla.findIndex((p) => p.id === nyttId);
  if (i >= 0) alla[i] = post;
  else alla.push(post);
  skriv(alla);
  return nyttId;
}
export async function raderaProv(id) {
  await vanta();
  skriv(las().filter((p) => p.id !== id));
}
export function felText(err, vad = "Provet") {
  return `${vad}: något gick fel (${err?.message || err}).`;
}
export function aterstall() {
  localStorage.removeItem(NYCKEL);
}
