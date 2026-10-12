// ============================================================================
// Pluggporten – Hitta rätt! bilderna till lärarens egna pack (functions/hitta-ratt-bilder.js, #637)
// ----------------------------------------------------------------------------
// Arkitektur §11.8. Inget Storage: läraren skalar ned bilden i webbläsaren och
// skapar själv hittaRattBilder/{packId}--{8 tecken} (regeln kontrollerar ägare,
// mime, storlek). Servern (hitta-ratt-egna.js) ser till att packen bara pekar
// på egna, befintliga bilder och att inga föräldralösa bilder blir kvar:
//
//   kopieraBilder(deps, uid, pack, fran) → pack   (Duplicera, före transaktionen)
//     Bilder vars id börjar med "<fran>--" kopieras till nya id i packen
//     (ownerUid = anroparen). Saknas källbilden tas frågans bild bort.
//   bilderFraga(db, packId) → fråga för tx.get (bara ownerUid/bredd/hojd, aldrig data)
//   granskaBilder(snap, uid, pack) → { items, oanvanda }   (i sparaPack-transaktionen)
//     Varje bild.id måste finnas i packet OCH tillhöra anroparen – annars
//     invalid-argument. bredd/hojd tas från dokumentet. oanvanda = packens
//     bilder som ingen fråga använder längre (raderas i samma transaktion).
//   raderaPackBilder(db, packId, { bara }) → antal   (raderaPack, efter transaktionen)
//     bara = uid → bara den lärarens bilder (packet fanns inte).
// ============================================================================

import { randomBytes } from "node:crypto";
import { HrFel } from "./hitta-ratt/omgang.js";
import { EGEN_ID_RE } from "./hitta-ratt/egna.js";

const ALFABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const KOPIA_BATCH = 20; // ≤ 20 × 150 kB per batch (gränsen är 10 MiB per anrop)
const MAX_RADERA_TX = 400; // transaktionen har plats för 500 skrivningar – resten nästa sparning
const RADERA_BATCH = 400;

const bilder = (db) => db.collection("hittaRattBilder");
export const nyttBildId = (packId) => `${packId}--${Array.from(randomBytes(8), (b) => ALFABET[b % ALFABET.length]).join("")}`;
const fran = (it, prefix) => typeof it.bild?.id === "string" && it.bild.id.startsWith(prefix);

export async function kopieraBilder(deps, uid, pack, kalla) {
  if (typeof kalla !== "string" || !EGEN_ID_RE.test(kalla) || kalla === pack.id) return pack;
  const prefix = `${kalla}--`;
  const ids = [...new Set(pack.items.filter((it) => fran(it, prefix)).map((it) => it.bild.id))];
  if (!ids.length) return pack;
  const { db, FieldValue } = deps;
  const snaps = await db.getAll(...ids.map((id) => bilder(db).doc(id)));
  const nya = new Map();
  const skriv = [];
  for (const s of snaps) {
    const d = s.exists ? s.data() : null;
    if (!d || d.packId !== kalla) continue;
    const id = nyttBildId(pack.id);
    nya.set(s.id, id);
    skriv.push([bilder(db).doc(id), {
      ownerUid: uid, packId: pack.id, mime: d.mime, bredd: d.bredd, hojd: d.hojd, data: d.data,
      skapad: FieldValue.serverTimestamp(),
    }]);
  }
  for (let i = 0; i < skriv.length; i += KOPIA_BATCH) {
    const b = db.batch();
    skriv.slice(i, i + KOPIA_BATCH).forEach(([ref, d]) => b.create(ref, d));
    await b.commit();
  }
  return {
    ...pack,
    items: pack.items.map((it) => {
      if (!fran(it, prefix)) return it;
      const id = nya.get(it.bild.id);
      if (id) return { ...it, bild: { ...it.bild, id } };
      const { bild: _bort, ...utan } = it; // källbilden saknas – frågan blir utan bild
      return utan;
    }),
  };
}

export const bilderFraga = (db, packId) => bilder(db).where("packId", "==", packId).select("ownerUid", "bredd", "hojd");

export function granskaBilder(snap, uid, pack) {
  const finns = new Map(snap.docs.map((d) => [d.id, d.data()]));
  const anvanda = new Set();
  const items = pack.items.map((it) => {
    if (!it.bild?.id) return it;
    const d = finns.get(it.bild.id);
    if (!d || d.ownerUid !== uid) throw new HrFel("invalid-argument", `Bilden till "${it.name}" finns inte längre – välj en bild igen.`);
    anvanda.add(it.bild.id);
    const matt = Number.isInteger(d.bredd) && Number.isInteger(d.hojd) ? { bredd: d.bredd, hojd: d.hojd } : {};
    return { ...it, bild: { ...it.bild, ...matt } };
  });
  const oanvanda = snap.docs.filter((d) => !anvanda.has(d.id)).slice(0, MAX_RADERA_TX).map((d) => d.ref);
  return { items, oanvanda };
}

export async function raderaPackBilder(db, packId, { bara = null } = {}) {
  const s = await bilder(db).where("packId", "==", packId).select("ownerUid").get();
  const refs = s.docs.filter((d) => !bara || d.data().ownerUid === bara).map((d) => d.ref);
  for (let i = 0; i < refs.length; i += RADERA_BATCH) {
    const b = db.batch();
    refs.slice(i, i + RADERA_BATCH).forEach((r) => b.delete(r));
    await b.commit();
  }
  return refs.length;
}
