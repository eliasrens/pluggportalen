// Stubb för src/prov/prov-rattning-data.js (#741-preview): samma API, i minnet
// (+ localStorage). Läsningar och skrivningar räknas så budgeten syns i kontrollraden.
import { S } from "./state.js";

const vanta = () => new Promise((r) => setTimeout(r, 200));
const kopia = (x) => structuredClone(x);
async function natet() {
  await vanta();
  if (S.natfel) throw Object.assign(new Error("Nätverksfel (simulerat)"), { code: "unavailable" });
}

export async function laddaRattning(t) {
  await vanta();
  if (t !== S.tf.id) return null;
  S.lasningar += 2 + Object.keys(S.svar).length + Math.max(1, Object.keys(S.rattning).length);
  S.logg(`läste tillfället, facit, ${Object.keys(S.svar).length} svar och ${Object.keys(S.rattning).length} rättningar`);
  return kopia({ tf: S.tf, facit: S.facit, bedomningsstod: S.bedomningsstod, svar: S.svar, rattningar: S.rattning });
}
export async function sparaRattningar(t, dok, rattStatus) {
  await natet();
  for (const [uid, d] of Object.entries(dok)) S.rattning[uid] = kopia(d);
  if (rattStatus) S.tf.rattStatus = kopia(rattStatus);
  const n = Object.keys(dok).length + (rattStatus ? 1 : 0);
  S.skrivningar += n;
  S.spara();
  S.logg(`sparade ${Object.keys(dok).length} rättningar${rattStatus ? " + räknaren" : ""}`);
}
export async function lamnaTillbaka(t, dok, rattStatus) {
  await natet();
  for (const [uid, d] of Object.entries(dok)) S.rattning[uid] = { ...kopia(d), aterlamnadAt: Date.now() };
  if (rattStatus) S.tf.rattStatus = kopia(rattStatus);
  S.skrivningar += Object.keys(dok).length + (rattStatus ? 1 : 0);
  S.spara();
  S.logg(`lämnade tillbaka till ${Object.keys(dok).map((u) => S.namn[u]).join(", ")}`);
}
export async function angraTillbaka(t, uid, rattStatus) {
  await natet();
  const { facit: _f, aterlamnadAt: _a, ...rest } = S.rattning[uid];
  S.rattning[uid] = { ...rest, aterlamnad: false };
  if (rattStatus) S.tf.rattStatus = kopia(rattStatus);
  S.skrivningar += rattStatus ? 2 : 1;
  S.spara();
  S.logg(`ångrade tillbakalämningen för ${S.namn[uid]}`);
}
// #742: färggränserna i fliken Översikt.
export async function sparaGranser(t, granser) {
  await natet();
  S.tf.installningar = { ...S.tf.installningar, granser: kopia(granser) };
  S.skrivningar++;
  S.spara();
  S.logg(`sparade färggränserna gul ${granser.gul} % / grön ${granser.gron} %`);
}
