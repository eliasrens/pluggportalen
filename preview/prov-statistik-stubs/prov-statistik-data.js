// Stubb för src/prov/prov-statistik-data.js (#742-preview): EN "collection
// group-fråga" – klassens äldre prov + det aktuella tillfällets rättningar.
import { S } from "./state.js";

export async function hamtaKlassensRattningar(classId) {
  await new Promise((r) => setTimeout(r, 200));
  S.fragorMotDb++;
  const nu = Object.values(S.rattning).map((r) => ({ ...structuredClone(r), t: S.tf.id }));
  const lista = [...S.aldre, ...nu].filter((r) => r.classId === classId);
  S.lasningar += Math.max(1, lista.length);
  S.logg(`EN collection group-fråga: ${lista.length} rättningar`);
  return lista;
}
