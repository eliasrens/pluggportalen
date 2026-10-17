// Stubb för src/prov/prov-mynt-data.js (#746-preview): den RIKTIGA utbetalningen
// (prov-mynt-pay.js betalaProvMynt) mot ett minnes-SDK över S – saldon i
// S.mynt.saldo, kvitton i S.mynt.kvitton, rättningarna i S.rattning.
import { S } from "./state.js";
import { betalaProvMynt } from "../../src/prov/prov-mynt-pay.js";

const vanta = () => new Promise((r) => setTimeout(r, 150));
const snap = (v) => ({ exists: () => v != null, data: () => structuredClone(v) });

// Vägarna som prov-mynt-pay.js använder → läs/skriv i S.
// studentData/{uid}[/provMynt/{t}] och provTillfallen/{t}/(rattning|svar)/{uid}.
function las(v) {
  const [a, x, b, y] = v;
  if (a === "studentData" && b === "provMynt") return S.mynt.kvitton[x] ?? null;
  if (a === "studentData") return { coins: S.mynt.saldo[x] ?? 0 };
  if (b === "rattning") return S.rattning[y] ?? null;
  if (b === "svar") return S.svar[y] ?? null;
  return null;
}
function skriv(v, d, sammanfoga) {
  const [a, x, b, y] = v;
  if (a === "studentData" && b === "provMynt") S.mynt.kvitton[x] = { ...d, at: Date.now() };
  else if (a === "studentData") S.mynt.saldo[x] = d.coins;
  else if (b === "rattning") S.rattning[y] = sammanfoga ? { ...S.rattning[y], ...d } : d;
}
const sdk = {
  doc: (_db, ...v) => v,
  getDoc: async (v) => snap(las(v)),
  serverTimestamp: () => "nu",
  async runTransaction(_db, fn) {
    await vanta();
    if (S.natfel) throw Object.assign(new Error("Nätverksfel (simulerat)"), { code: "unavailable" });
    const skrivningar = [];
    const res = await fn({
      get: async (v) => snap(las(v)),
      set: (v, d) => skrivningar.push([v, d, false]),
      update: (v, d) => skrivningar.push([v, d, true]),
    });
    for (const [v, d, m] of skrivningar) skriv(v, d, m);
    S.lasningar += 4;
    S.skrivningar += skrivningar.length;
    return res;
  },
};

export async function betalaMynt(tf, elever) {
  if (!elever?.length) return [];
  const ut = await betalaProvMynt(sdk, null, { t: tf.id, tf, elever, by: "larare" });
  S.spara();
  S.logg(ut.map((b) => `${S.namn[b.uid]}: ${b.status} ${b.total} (saldo ${S.mynt.saldo[b.uid]})`).join(" · "));
  return ut;
}
