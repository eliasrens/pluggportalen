// ============================================================================
// Matchdagen (#869, #872): RUTAN EFTER MATCHEN (spec §5, §7.2, §9) – resultatet,
// rätt svar, skott, lyckade pass och pengarna; kvalets uppflyttning; cupens
// "Vidare!" / "Silverpokalen är er!" / "Utslagna"; nya rekord direkt ("Nytt
// rekord: 5 mål i en match!", md-rekord.js); och pauspåminnelsen (§1.2).
// Etapp 3 (#873): Mästarcupens "Vidare!" / "Mästarcupen är er!" / "Ute", mästarna i Superligan
// (§10.1) och – efter en vunnen final – valet "Starta en legendklubb" eller "Fortsätt i Superligan"
// (§10.3, knappens id "legend"). Pokalen ritas i rutan (md-pokal-svg.js).
// Allt ur dokumentet som tal eller esc() – rekordens text är byggd av tal.
//
//   efterMatchen(S, { res, klar, mot, sparad, signal, typ }) → Promise<knappens id | null>
//     klar = matchKlar / kvalKlar / cupKlar (md-sasong.js, md-kval.js, md-cup.js)
// ============================================================================

import { CUP, MASTARCUP } from "../delat/md-config.js";
import { legendErbjudande } from "../delat/md-legend.js";
import { esc, ruta } from "./md-vy-delat.js";
import { kvalResultat, sasongSlutText } from "./md-vy-match.js";
import { mastareText, mcEfter } from "./md-vy-mastarcup.js";
import { pokalSvg } from "./md-pokal-svg.js";

/** Rubrik och rad för cupen: vidare till nästa runda, pokalen, eller utslagna. */
export function cupEfter(klar) {
  if (klar.vannCupen) return { rubrik: `${CUP.namn} är er!`, rad: `Ni vann finalen! Pokalen finns under Statistik och prispengarna går till klubbkassan.` };
  if (klar.vann) {
    const nasta = CUP.rundor[klar.runda + 1] || CUP.rundor.at(-1);
    return { rubrik: "Vidare!", rad: `Ni är klara för ${nasta.toLowerCase()}en i ${CUP.namn}.` };
  }
  return { rubrik: "Utslagna – nästa säsong igen!", rad: `${CUP.namn} är slut för den här säsongen. Ligan fortsätter!` };
}

/** "Nytt rekord: …" – en rad per nytt rekord. */
export const rekordHtml = (nya = []) => (nya.length
  ? `<div class="md-nya-rekord" role="status">${nya.map((t) => `<p class="md-nytt-rekord"><span class="md-pokal" aria-hidden="true"></span>${esc(t)}</p>`).join("")}</div>`
  : "");

export function efterMatchen(S, { res, klar, mot, sparad, signal, typ = "liga" }) {
  const st = res.stat;
  const kval = typ === "kval";
  const cup = typ === "cup" ? cupEfter(klar) : typ === "mastarcup" ? mcEfter(klar) : null;
  const mastare = klar.mastare ? mastareText() : null;
  const rubrik = kval ? (res.vann ? "Uppflyttning!" : "Nära!") : cup ? cup.rubrik : mastare ? mastare.rubrik
    : res.utfall === "vinst" ? "Seger!" : res.utfall === "oavgjort" ? "Oavgjort" : "Förlust – nästa gång!";
  const rad = kval ? esc(sasongSlutText(S.K, 1, 0).text) : cup ? esc(cup.rad) : mastare ? esc(mastare.text) : "";
  const pokal = klar.vannCupen && typ === "mastarcup" ? "mastarcup" : klar.mastare ? "superliga" : null;
  const legend = typ === "mastarcup" && klar.vannCupen && legendErbjudande(S.K);
  const paus = S.inst.paus > 0 && Date.now() - S.sessionStart >= S.inst.paus * 60000;
  if (paus) S.sessionStart = Date.now();
  return ruta(S.host, {
    rubrik: kval || cup ? `${esc(rubrik)} ${esc(kvalResultat(res))}` : `${esc(rubrik)} ${Number(res.oss)} – ${Number(res.dem)}`,
    klass: `md-efter${klar.vannCupen ? " md-cupvinst" : ""}${pokal ? " md-titel" : ""}`,
    html: `${pokal ? `<div class="md-efter-pokal">${pokalSvg(pokal, { id: "efter" })}</div>` : ""}
      <p class="md-svag">mot ${esc(mot.namn)}${kval ? " (kval)" : typ === "cup" ? ` (${esc(CUP.namn)})` : typ === "mastarcup" ? ` (${esc(MASTARCUP.namn)})` : ""}</p>${rad ? `<p class="md-kvalrad">${rad}</p>` : ""}
      ${legend ? `<p class="md-tips">Nu kan ni starta en <b>legendklubb</b>: en ny klubb från Division 6 – pokalskåpet och rekorden följer med. Eller fortsätt i Superligan och försvara titeln. Valet finns kvar under Match resten av säsongen.</p>` : ""}
      ${rekordHtml(klar.rekord)}
      <div class="md-siffror">
        <div><b>${Number(st.ratt)}/${Number(st.fragor)}</b>rätt svar</div><div><b>${Number(st.skott)}</b>skott</div>
        <div><b>${Number(st.passOk)}/${Number(st.pass)}</b>lyckade pass</div><div><b>+${Number(klar.pengar).toLocaleString("sv-SE")}</b>kr till klubbkassan</div>
      </div>
      ${paus ? `<p class="md-paus">Bra jobbat! Dags för en paus.</p>` : ""}
      ${sparad ? "" : `<p class="md-svag">Matchen sparas så fort det går – den finns kvar på den här datorn.</p>`}`,
    knappar: legend
      ? [{ id: "legend", text: "Starta en legendklubb" }, { id: "vidare", text: "Fortsätt i Superligan" }]
      : [{ id: "vidare", text: kval ? "Starta nästa säsong" : klar.sasongKlar ? "Se hur säsongen slutade" : "Till tabellen" }],
  }, signal);
}
