// Stubb för src/prov/prov-tillfalle-data.js (#740-preview): samma API, i minnet.
// Varje läsning av svaren räknas (S.lasningar) så budgeten syns i kontrollraden.
import { S } from "./state.js";
import { delaUppProv } from "../../src/prov/prov-modell.js";
import { attOppnaIgen, attStangaIn } from "../../src/prov/prov-tillfalle-logik.js";

const vanta = () => new Promise((r) => setTimeout(r, 250));
const kopia = (x) => structuredClone(x);
export async function listaProv() { await vanta(); return kopia(S.prov); }
export async function hamtaProv(id) {
  const eget = S.prov.find((p) => p.id === id);
  if (eget) return kopia(eget);
  // I B:s preview ligger proven i dess stubb (localStorage).
  const b = await import("/src/prov/larare/provl-data.js");
  const p = await b.hamtaProv(id);
  if (p) S.prov.push({ id, ...p });
  return p ? { id, ...p } : null;
}
export async function hamtaTillfalle(t) { await vanta(); S.lasningar++; return S.tillfallen[t] ? kopia(S.tillfallen[t]) : null; }
export async function listaTillfallen(classIds) { await vanta(); return kopia(Object.values(S.tillfallen).filter((t) => classIds.includes(t.classId))); }
export async function hamtaSvar(t) {
  await vanta();
  const s = S.svar[t] || {};
  S.lasningar += Math.max(1, Object.keys(s).length);
  window.dispatchEvent(new CustomEvent("pv-logg", { detail: `läste ${Object.keys(s).length} svar` }));
  return kopia(s);
}
export async function skapaTillfalle({ prov, classId, tidsgransMin, fokus, extraTid, elevIds, omprovAv }) {
  await vanta();
  const id = `tf-${Date.now()}`;
  S.tillfallen[id] = {
    id, provId: prov.id, provNamn: prov.namn, classId, status: "forberett", fragor: [], tidsgransMin, fokus, skapad: Date.now(),
    ...(extraTid && Object.keys(extraTid).length ? { extraTid } : {}), ...(elevIds ? { elevIds, omprovAv } : {}),
  };
  S.logg(`Skapade ${id} (förberett${elevIds ? `, omprov för ${elevIds.length}` : ""}${extraTid && Object.keys(extraTid).length ? `, extra tid ${JSON.stringify(extraTid)}` : ""})`);
  return id;
}
// #748: extra tid per elev (hela mapen).
export async function sparaExtraTid(t, extraTid) {
  await vanta();
  S.tillfallen[t].extraTid = extraTid;
  S.logg(`Extra tid sparad: ${JSON.stringify(extraTid)}`);
}
export async function oppnaTillfalle(tf, las) {
  await vanta();
  const t = S.tillfallen[tf.id];
  if (t.status === "forberett") Object.assign(t, { fragor: delaUppProv(S.prov.find((p) => p.id === t.provId)).fragor, status: "oppet", oppnad: Date.now() });
  else {
    t.status = "oppet";
    for (const id of attOppnaIgen(Object.values(S.svar[t.id] || {}))) Object.assign(S.svar[t.id][id], { inlamnad: false, inlamnadNar: undefined });
  }
  if (las) S.las[t.classId] = { mal: { typ: "prov", id: t.id, namn: t.provNamn }, till: las.till, doljOvrigt: las.doljOvrigt, efter: las.efter };
  S.logg(`Öppnade ${t.provNamn}${las ? ` + fokuslås (efter: ${JSON.stringify(las.efter)})` : ""}`);
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
