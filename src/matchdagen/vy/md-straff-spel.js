// ============================================================================
// Matchdagen (#870, Etapp 2a): STRAFFLÄGGNINGEN i matchvyn (spec §7.4) – efter
// slutsignalen i ett oavgjort kval eller en oavgjord cupmatch (#872). Rutan "Straffläggning!", sedan en fråga per
// straff: vår straff (rätt svar → säkrare) eller "Kan målvakten rädda?" på deras.
// Ställningen "Straffar 3 – 2" syns hela tiden på skylten, och kameran visar
// straffpunkten (3D och 2D, md-plan.js). Motorn är md-straffar.js (ren). Den
// pågående straffläggningen sparas lokalt efter varje straff, som matchen.
//
//   spelaStraffar(S, ctx) → Promise<boolean>   true = avgjord, false = avbruten
//     ctx: { m, v, plan, fr, signal, sag, sparaLokalt, satt(m) }
// ============================================================================

import { straffa, straffLage, straffStallning } from "../delat/md-straffar.js";
import { ruta, vanta } from "./md-vy-delat.js";

/** "Straffar 3 – 2" på skylten. */
export const straffText = (m) => {
  const [a, b] = straffStallning(m);
  return `Straffar ${a} – ${b}`;
};

export async function spelaStraffar(S, ctx) {
  const { v, plan, fr, signal, sag } = ctx;
  let m = ctx.m;
  const visa = () => {
    v.straff.hidden = false;
    v.straff.textContent = straffText(m);
  };
  v.kort.innerHTML = "";
  const borjat = !!m.straffar;
  const svar = await ruta(S.host, {
    rubrik: borjat ? "Straffläggningen fortsätter" : "Straffläggning!",
    html: `<p>Det står <b>${Number(m.oss)} – ${Number(m.dem)}</b> efter full tid. Nu avgörs ${S.spel?.post?.typ === "cup" ? "cupmatchen" : "kvalet"} på straffar – fem var, sedan sudden death.</p>
      <p class="md-svag">Varje straff ger en fråga. När motståndarna skjuter: svara rätt så räddar målvakten oftare.</p>`,
    knappar: [{ id: "vidare", text: "Till straffpunkten" }],
  }, signal);
  if (!svar) return false;
  visa();
  for (let l = straffLage(m); l; l = straffLage(m)) {
    if (signal?.aborted) return false;
    sag(l.rad);
    await plan.straffStall(l.lag);
    const f = fr.nasta();
    const { visaFraga } = await import("../md-svar.js");
    // Straffen avgörs och sparas lokalt direkt vid svaret, före pausen med rätt svar
    // (en omladdning då ger ingen ny fråga för samma straff, #870 F1).
    let ut = null;
    const r = await visaFraga(v.kort, f, {
      ratta: fr.ratta, klocka: S.inst.klocka, signal,
      vidSvar: (x) => {
        ut = straffa(m, [{ ratt: x.ratt, kalla: f.kalla }], Math.random, Date.now());
        m = ut.m;
        ctx.satt(m);
        ctx.sparaLokalt();
      },
    });
    if (r.avbruten || !ut) return false;
    v.kort.innerHTML = "";
    sag(ut.h.rad);
    await plan.straff(ut.h, m);
    visa();
  }
  await vanta(S.lugnt ? 200 : 600);
  plan.straffSlut(m);
  return true;
}
