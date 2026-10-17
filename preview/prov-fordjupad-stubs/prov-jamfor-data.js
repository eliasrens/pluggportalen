// Stubb för src/prov/prov-jamfor-data.js (#747-preview): samma prov i lärarens
// andra klasser – 4A (starkare) och 4C (svagare) – påhittade rättningar.
// Räknar läsningarna som den riktiga filen skulle göra (tillfällena + rättningarna).
import { S } from "../prov-statistik-stubs/state.js";

function slump(fro) {
  let s = fro >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function klass(id, namn, antal, niva, fro) {
  const r = slump(fro);
  const tf = { ...structuredClone(S.tf), id: `tf-${id}`, classId: id, oppnad: S.tf.oppnad - 7 * 86_400_000 };
  const rattningar = {};
  for (let i = 0; i < antal; i++) {
    const kan = Math.max(0.05, Math.min(0.98, niva + (r() - 0.5) * 0.6));
    const fragor = {};
    for (const f of tf.fragor.filter((x) => x.typ !== "text")) {
      if (i === antal - 1 && r() < 0.5) continue; // en elev är inte färdigrättad
      const x = r();
      const max = Number(f.poang) || 0;
      const ratt = x < kan ? true : x < kan + 0.12 && max > 1 ? "delvis" : false;
      fragor[f.id] = { ratt, poang: ratt === true ? max : ratt === "delvis" ? Math.floor(max / 2) : 0, auto: false };
    }
    rattningar[`${id}-${i}`] = { elevId: `${id}-${i}`, classId: id, provNamn: tf.provNamn, fragor, aterlamnad: false };
  }
  return { tf, klassNamn: namn, rattningar };
}

export async function hamtaJamforelse() {
  await new Promise((res) => setTimeout(res, 300));
  const ut = [klass("4a", "4A", 23, 0.78, 11), klass("4c", "4C", 19, 0.5, 23)];
  S.lasningar += 1 + ut.reduce((n, k) => n + Object.keys(k.rattningar).length, 0);
  S.logg(`jämförelsen: läste lärarens tillfällen och ${ut.length} andra klassers rättningar`);
  return ut;
}
