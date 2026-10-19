// ============================================================================
// Schacksådd för preview/preview-schack-larare.html (#781), ovanpå #440-sådden
// (preview/larare-klasser/seed.js: 5E = Alva … Ines). Klass 5E har schack på,
// två pågående partier (Alva–Bo med 10 min-klocka, Cleo–Dino utan), en elev i
// lobbyn, en topplista och datorpartier i studentData.schack. "Saga" står i
// tabellen men har lämnat klassen – namnet kommer ur klassprojektionen.
// ============================================================================

import { byggParti } from "../../src/schack/schack-server-parti.js";
import { nyKlocka } from "../../src/schack/schack-server-delat.js";

const sid = (n) => `stub-${n.toLowerCase()}`;
export const PARTI_KLOCKA = "pv-alva-bo";
export const PARTI_UTAN = "pv-cleo-dino";

/** @param {{setDoc, updateDoc, doc:(path:string)=>object}} fs */
export async function schackSadd({ setDoc, updateDoc, doc }) {
  const nu = Date.now();
  await updateDoc(doc("classes/5e"), { enabledModules: ["schack"] });
  const partier = [
    [PARTI_KLOCKA, "Alva", "Bo", 10, ["e4", "e5", "Nf3", "Nc6", "Bc4"], nu - 4 * 60_000],
    [PARTI_UTAN, "Cleo", "Dino", null, ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5"], nu - 9 * 60_000],
  ];
  const lista = {};
  for (const [id, vit, svart, min, drag, start] of partier) {
    const chess = byggParti(drag);
    const senast = nu - 20_000;
    const klocka = min ? { ...nyKlocka(min, start), vitMs: 8.4 * 60_000, svartMs: 8.9 * 60_000, senastDragAt: senast } : null;
    await setDoc(doc(`schackPartier/${id}`), {
      classId: "5e", vit: sid(vit), svart: sid(svart), vitNamn: vit, svartNamn: svart,
      fen: chess.fen(), drag, tur: chess.turn(), status: "pagar", resultat: null, orsak: null,
      klocka, remiErbjudenAv: null, senastDragAt: senast, skapad: start, uppdaterad: senast,
    });
    lista[id] = { vit: sid(vit), svart: sid(svart), vitNamn: vit, svartNamn: svart, klocka: min, start };
  }
  const rad = (poang, vinster, forluster, remier) => ({ poang, vinster, forluster, remier, partier: vinster + forluster + remier });
  await setDoc(doc("schackKlass/5e"), {
    vantar: { [sid("Ella")]: { namn: "Ella", klocka: 5, sedan: nu - 30_000 } },
    utmaningar: {},
    partier: lista,
    tabell: {
      [sid("Greta")]: rad(1046, 3, 1, 0), [sid("Hugo")]: rad(1012, 2, 1, 1), [sid("Alva")]: rad(1008, 1, 1, 1),
      [sid("Bo")]: rad(983, 1, 2, 0), [sid("Ines")]: rad(970, 0, 2, 0), "stub-saga": rad(1020, 2, 0, 0),
    },
    dold: false,
  });
  await setDoc(doc("classProjections/5e"), { members: { "stub-saga": { namn: "Saga" } } }, { merge: true });
  const dator = { Alva: 4, Bo: 1, Cleo: 7, Filip: 2, Greta: 3, Ines: 12 };
  for (const [n, antal] of Object.entries(dator)) {
    await updateDoc(doc(`studentData/${sid(n)}`), { schack: { datorPartier: antal, aktivtParti: null } });
  }
}
