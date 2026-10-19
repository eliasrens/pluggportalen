// ============================================================================
// Förhandsvisnings-STUB av firebase-functions för preview/preview-schack-larare.html
// (#781): lärarens två callables mot minnes-Firestore (samma regler som
// functions/schack-larare.js i det som syns: avsluta = avbrutet utan tabell,
// topplistan = dold/nollställ). Andra callables svarar unimplemented.
// ============================================================================

import { deleteField, doc, getDoc, runTransaction, updateDoc } from "./fb-firestore.js";

const fel = (code, message) => Object.assign(new Error(message), { code: `functions/${code}` });
const vila = () => new Promise((r) => setTimeout(r, 350)); // en callable tar en stund

const HANDLERS = {
  async schackLarareAvsluta({ partiId }) {
    const ref = doc(null, `schackPartier/${partiId}`);
    const p = (await getDoc(ref)).data();
    if (!p) throw fel("not-found", "Partiet finns inte.");
    if (p.status !== "pagar") throw fel("failed-precondition", "Partiet är redan slut.");
    const nu = Date.now();
    await runTransaction(null, async (tx) => {
      tx.update(ref, { status: "slut", resultat: null, orsak: "avbrutet", remiErbjudenAv: null, uppdaterad: nu });
      tx.update(doc(null, `schackKlass/${p.classId}`), { [`partier.${partiId}`]: deleteField() });
    });
    return { slut: { resultat: null, orsak: "avbrutet" } };
  },
  async schackLarareTopplista({ classId, dold, nollstall }) {
    if (typeof dold !== "boolean" && nollstall !== true) throw fel("invalid-argument", "Ange dold och/eller nollstall.");
    const ref = doc(null, `schackKlass/${classId}`);
    const k = (await getDoc(ref)).data() || {};
    const ny = { dold: typeof dold === "boolean" ? dold : k.dold === true };
    if (nollstall === true) ny.tabell = {};
    await updateDoc(ref, ny);
    return { dold: ny.dold, nollstalld: nollstall === true };
  },
};

export function getFunctions(app, region) {
  return { app, region };
}
export function httpsCallable(_fns, name) {
  return async (data) => {
    await vila();
    const h = HANDLERS[name];
    if (!h) throw fel("unimplemented", `${name} finns inte i förhandsvisningen.`);
    return { data: await h(data || {}) };
  };
}
