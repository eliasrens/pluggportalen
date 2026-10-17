// Stubb för src/prov/prov-elev-data.js (#740-preview): svaren i minnet, med
// påhittad fördröjning och de nätfel kontrollraden slår på.
import { S } from "./state.js";

const vanta = (ms) => new Promise((r) => setTimeout(r, ms));
async function natet() {
  await vanta(350);
  while (S.hanger) await vanta(250); // "offline": skrivningen köas tills nätet är tillbaka
  if (S.natfel) throw Object.assign(new Error("Nätverksfel (simulerat)"), { code: "unavailable" });
}
const visa = () => window.dispatchEvent(new CustomEvent("prov-stub"));

export async function hamtaTillfalle(t) { return t === S.tf.id ? { ...S.tf } : null; }
export async function hamtaMittSvar() { return S.svar ? structuredClone(S.svar) : null; }
export async function startaProv(t, uid, classId, svar = {}) {
  await natet();
  S.svar = { elevId: uid, classId, startad: Date.now(), uppdaterad: Date.now(), svar, inlamnad: false };
  visa();
  return structuredClone(S.svar);
}
export async function sparaSvar(t, uid, svar, flikbyten = 0) {
  await natet();
  if (S.tf.status !== "oppet" || S.svar?.inlamnad) throw Object.assign(new Error("nekad"), { code: "permission-denied" });
  S.skrivningar++;
  Object.assign(S.svar, { svar, uppdaterad: Date.now(), ...(flikbyten ? { flikbyten } : {}) });
  visa();
}
export async function lamnaIn(t, uid, svar, nar, flikbyten = 0) {
  await natet();
  if (S.tf.status !== "oppet" || S.svar?.inlamnad) throw Object.assign(new Error("nekad"), { code: "permission-denied" });
  S.skrivningar++;
  Object.assign(S.svar, { svar, uppdaterad: Date.now(), inlamnad: true, inlamnadNar: nar, inlamnadAt: Date.now(), ...(flikbyten ? { flikbyten } : {}) });
  visa();
}
// #741: elevens rättning (resultatvyn) – bara när den är tillbakalämnad, som reglerna.
export async function hamtaMinRattning() { return S.rattning?.aterlamnad ? structuredClone(S.rattning) : null; }
