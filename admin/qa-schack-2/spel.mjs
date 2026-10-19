// ============================================================================
// Schack slut-QA Etapp 2 (#782): spelhandlingar som stegen delar – vänta/Spela! via
// lobbyns knappar, slutrutan, callables och Firestore direkt FRÅN elevens/lärarens
// sida (klient-SDK:t i sidan = reglerna och callable-grindarna gäller på riktigt).
// ============================================================================
import { db, parti, uidFor, tillLobby, vantaParti } from "./lib.mjs";

/** Partiets färger: { vit: u, svart: u } bland användarna. */
export async function farger(id, ...us) {
  const pt = await parti(id);
  return { vit: us.find((u) => u.uid === pt.vit), svart: us.find((u) => u.uid === pt.svart), pt };
}
/** Väntar (via lobbyns knapp) med ett klockval: "" = ingen, 5/10/15. */
export async function vantaMed(u, klocka) {
  await tillLobby(u);
  await u.klick(`[data-klocka="${klocka}"]`);
  await u.klick(`[data-act="vanta"]`);
  await u.vanta(`!!document.querySelector(".schack-lobby-vantar-du")`);
}
/** u2 trycker Spela! på u1:s väntar-kort → båda i partiet. */
export async function spelaMot(u2, u1, inte = "") {
  await tillLobby(u2);
  await u2.vanta(`!!document.querySelector('.schack-vantar-kort [data-act="spela"][data-uid="${u1.uid}"]')`);
  await u2.klick(`.schack-vantar-kort [data-act="spela"][data-uid="${u1.uid}"]`);
  const id = await vantaParti(u2, inte);
  const id1 = await vantaParti(u1, inte);
  return id === id1 ? id : null;
}
export const slutRubrik = (u) => u.text(".schack-kompis .schack-slut-rubrik");
export const slutSynlig = (u) => u.vanta(`(() => { const e = document.querySelector(".schack-kompis .schack-slut"); return e && !e.hidden; })()`, 15000);
export const callFran = (u, namn, data) => u.ev(`import("/src/schack/schack-moln.js").then(async (m) => {
  const map = { schackVanta: (d) => m.lobby.vanta(d.classId, d.klocka), schackGaMed: (d) => m.lobby.gaMed(d.classId, d.motstandare),
    schackUtmana: (d) => m.lobby.utmana(d.classId, d.till, d.klocka), schackSvara: (d) => m.lobby.svara(d.utmaningId, d.ja, d.classId),
    schackSlutaVanta: (d) => m.lobby.slutaVanta(d.classId), schackDrag: (d) => m.parti.drag(d.partiId, d),
    schackKravaVinst: (d) => m.parti.kravaVinst(d.partiId), schackGeUpp: (d) => m.parti.geUpp(d.partiId),
    schackRemi: (d) => m.parti.remi(d.partiId, d.handling),
    schackLarareAvsluta: (d) => m.larare.avsluta(d.partiId), schackLarareTopplista: (d) => m.larare.topplista(d.classId, d) };
  try { return { ok: true, data: await map[${JSON.stringify(namn)}](${JSON.stringify(data)}) }; }
  catch (e) { return { ok: false, code: e.code, msg: e.message }; } })`);
/** Rå callable med valfri payload (falska fält), via SDK:t i sidan. */
export const rawCall = (u, namn, data) => u.ev(`(async () => {
  const { app } = await import("/src/firebase-config.js");
  const f = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js");
  try { const r = await f.httpsCallable(f.getFunctions(app, globalThis.__PP_FUNCTIONS_URL || "europe-west1"), ${JSON.stringify(namn)})(${JSON.stringify(data)}); return { ok: true, data: r.data }; }
  catch (e) { return { ok: false, code: e.code, msg: e.message }; } })()`);
export const fsOp = (u, kod) => u.ev(`(async () => {
  const { db } = await import("/src/firebase-config.js");
  const F = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  try { const r = await (async () => { ${kod} })(); return { ok: true, r }; } catch (e) { return { ok: false, code: e.code }; } })()`);
export async function nollaKlass() {
  await db.doc("schackKlass/4a").delete();
  for (const u of ["4a01", "4a02", "4a03", "4a04"]) {
    const uid = await uidFor(u);
    await db.doc(`studentData/${uid}`).set({ schack: { aktivtParti: null } }, { merge: true });
  }
}
