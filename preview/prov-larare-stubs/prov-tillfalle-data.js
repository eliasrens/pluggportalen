// Stubb för src/prov/prov-tillfalle-data.js (#740-preview): samma API, i minnet.
// Varje läsning av svaren räknas (S.lasningar) så budgeten syns i kontrollraden.
import { S } from "./state.js";
import { delaUppProv } from "../../src/prov/prov-modell.js";
import { attOppnaIgen, attStangaIn } from "../../src/prov/prov-tillfalle-logik.js";

const vanta = () => new Promise((r) => setTimeout(r, 250));
const kopia = (x) => structuredClone(x);
export async function listaProv() { await vanta(); return kopia(S.prov); }
export async function hamtaProv(id) { return kopia(S.prov.find((p) => p.id === id) || null); }
export async function hamtaTillfalle(t) { await vanta(); S.lasningar++; return S.tillfallen[t] ? kopia(S.tillfallen[t]) : null; }
export async function listaTillfallen(classIds) { await vanta(); return kopia(Object.values(S.tillfallen).filter((t) => classIds.includes(t.classId))); }
export async function hamtaSvar(t) {
  await vanta();
  const s = S.svar[t] || {};
  S.lasningar += Math.max(1, Object.keys(s).length);
  window.dispatchEvent(new CustomEvent("pv-logg", { detail: `läste ${Object.keys(s).length} svar` }));
  return kopia(s);
}
export async function skapaTillfalle({ prov, classId, tidsgransMin, fokus }) {
  await vanta();
  const id = `tf-${Date.now()}`;
  S.tillfallen[id] = { id, provId: prov.id, provNamn: prov.namn, classId, status: "forberett", fragor: [], tidsgransMin, fokus, skapad: Date.now() };
  S.logg(`Skapade ${id} (förberett)`);
  return id;
}
export async function oppnaTillfalle(tf, las) {
  await vanta();
  const t = S.tillfallen[tf.id];
  if (t.status === "forberett") Object.assign(t, { fragor: delaUppProv(S.prov.find((p) => p.id === t.provId)).fragor, status: "oppet", oppnad: Date.now() });
  else {
    t.status = "oppet";
    for (const id of attOppnaIgen(Object.values(S.svar[t.id] || {}))) Object.assign(S.svar[t.id][id], { inlamnad: false, inlamnadNar: undefined });
  }
  if (las) S.las[t.classId] = { mal: { typ: "prov", id: t.id, namn: t.provNamn }, till: las.till, doljOvrigt: las.doljOvrigt };
  S.logg(`Öppnade ${t.provNamn}${las ? " + fokuslås" : ""}`);
}
export async function stangTillfalle(tf) {
  await vanta();
  const t = S.tillfallen[tf.id];
  t.status = "stangt";
  const inte = attStangaIn(Object.values(S.svar[t.id] || {}));
  for (const id of inte) Object.assign(S.svar[t.id][id], { inlamnad: true, inlamnadNar: "stangt" });
  if (S.las[t.classId]?.mal.id === t.id) delete S.las[t.classId];
  S.logg(`Stängde ${t.provNamn}: ${inte.length} markerade inlämnade, låset borta`);
  return inte.length;
}
export async function raderaTillfalle(tf) {
  await vanta();
  delete S.tillfallen[tf.id];
  delete S.svar[tf.id];
  S.logg(`Raderade ${tf.provNamn}`);
}
