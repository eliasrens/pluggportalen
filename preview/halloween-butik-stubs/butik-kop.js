// Preview-stub för src/butik-kop.js (#854): i stället för callablen butikKop körs den
// RIKTIGA kärnan kopVara (src/butik-core.js) mot minnes-eleven MEM – samma pris,
// samma säsongskontroll och samma svar som servern ger.
import { butikVara, kopVara } from "/src/butik-core.js";
import { MEM } from "/preview/halloween-butik-stubs/data.js";

export async function kop(itemId) {
  const sasong = { halloween: !!globalThis.__season?.get().halloweenActive };
  const r = kopVara(MEM, butikVara(itemId), { sasong });
  for (const [k, v] of Object.entries(r.patch || {})) {
    const delar = k.split(".");
    let o = MEM;
    for (const d of delar.slice(0, -1)) o = o[d] ??= {};
    o[delar.at(-1)] = structuredClone(v);
  }
  console.log("[preview] butikKop", itemId, r.result);
  return r.result;
}
