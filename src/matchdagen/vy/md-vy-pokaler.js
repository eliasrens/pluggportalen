// ============================================================================
// Matchdagen (#873, Etapp 3): POKALSKÅPET (spec §10.4) – en egen flik med en
// tecknad pokal per sort (divisionsvinst, uppflyttning genom kval, Silverpokalen,
// Superligan, Mästarcupen): hur många gånger och vilka säsonger. Överst
// klubbmärket med guldkant (mästare i Superligan, §10.1) och guldstjärnorna
// (legendklubbar, §10.3). Kostar inga läsningar – allt står i karriären (§13).
//
//   marke(K, klass?)        klubbmärket som HTML (sidhuvudet, skåpet, Statistik)
//   historikHtml(K)         de gamla klubbarna (klubbhistorik) – Statistik
//   skapHtml(K, { erbjud }) skåpet som HTML (fliken och förhandsvisningen)
//   visaPokaler(S, el)      fliken
// Allt ur dokumentet med esc() eller som tal.
// ============================================================================

import { guldkant, historikRader, legendErbjudande, POKAL_SORTER, skapet } from "../delat/md-legend.js";
import { klubbMarke, pokalSvg } from "./md-pokal-svg.js";
import { esc } from "./md-vy-delat.js";

const tal = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : 0);
const initialer = (namn) => String(namn ?? "").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 3);
const ANTAL_SAS = 12; // högst så många säsonger utskrivna per pokal ("säsong 2, 5, 7 …")

/** Klubbmärket med guldkanten och stjärnorna – titeln säger samma sak för skärmläsaren. */
export function marke(K, klass = "") {
  const k = K?.klubb || {};
  const st = tal(k.legendStjarnor);
  const guld = guldkant(K);
  const titel = `Klubbmärket för ${k.namn || "klubben"}${guld ? ", mästare i Superligan" : ""}${st ? `, ${st} ${st === 1 ? "guldstjärna" : "guldstjärnor"}` : ""}`;
  return `<span class="md-marke-ram${klass ? ` ${klass}` : ""}">${klubbMarke({ farg: k.farg, guld, stjarnor: st, initialer: initialer(k.namn), titel })}</span>`;
}

const sasText = (s) => {
  const lista = s.sasonger.slice(-ANTAL_SAS).join(", ");
  return `säsong ${s.sasonger.length > ANTAL_SAS ? `… ${lista}` : lista}`;
};
const TOM = {
  liga: "Vinn en division",
  kval: "Vinn ett kval",
  cup: "Vinn Silverpokalens final",
  superliga: "Vinn Superligan",
  mastarcup: "Vinn Mästarcupen",
};

/** Skåpet: fem hyllor, den största pokalen sist. */
export function skapHtml(K, { erbjud = false } = {}) {
  const hyllor = skapet(K?.pokaler);
  const totalt = hyllor.reduce((a, s) => a + s.antal, 0);
  const st = tal(K?.klubb?.legendStjarnor);
  const gamla = historikRader(K?.klubbhistorik).length;
  return `<div class="md-panel md-skap">
    <div class="md-skap-huvud">${marke(K, "stor")}<div>
      <h2>Pokalskåpet</h2>
      <p class="md-svag">${totalt ? `${totalt} ${totalt === 1 ? "pokal" : "pokaler"}` : "Inga pokaler än – här ställs de upp när ni vinner."}${st
        ? ` · ${st} ${st === 1 ? "guldstjärna" : "guldstjärnor"} på klubbmärket – en för varje klubb ni tagit hela vägen.` : ""}${gamla
        ? ` Pokalerna från ${gamla === 1 ? "den gamla klubben" : `${gamla} gamla klubbar`} står också här.` : ""}</p>
    </div></div>
    <ul class="md-hyllor">${hyllor.map((s) => `<li class="md-hylla ${esc(s.id)}${s.antal ? "" : " tom"}">
      ${pokalSvg(s.id, { tom: !s.antal, id: `skap-${s.id}` })}
      <div class="md-hylla-text"><b>${esc(s.namn)}</b>
        ${s.antal ? `<span class="md-hylla-antal">${s.antal} ${s.antal === 1 ? "gång" : "gånger"}</span><small>${esc(sasText(s))}</small>`
          : `<small class="md-svag">${esc(TOM[s.id])} för den här pokalen.</small>`}</div>
    </li>`).join("")}</ul>
    ${erbjud ? `<p class="md-tips">Ni har vunnit Mästarcupen! Under <b>Match</b> kan ni starta en legendklubb – pokalskåpet följer med.</p>` : ""}
  </div>`;
}

/** De gamla klubbarna (§10.3): namn, säsonger och pokaler – i Statistik. */
export function historikHtml(K) {
  const h = historikRader(K?.klubbhistorik);
  if (!h.length) return "";
  const pokalText = (p) => POKAL_SORTER.filter((s) => p[s.id]).map((s) => `${tal(p[s.id])} × ${s.namn.toLowerCase()}`).join(", ") || "inga pokaler";
  return `<h3>Klubbhistorik</h3>
    <ul class="md-lista md-historik">${h.map((x) => `<li>${klubbMarke({ farg: x.farg, guld: x.pokaler.superliga > 0, initialer: initialer(x.namn), titel: x.namn })}
      <span><b>${esc(x.namn)}</b> · säsong ${tal(x.fran)}–${tal(x.till)} (${tal(x.sasonger)} ${x.sasonger === 1 ? "säsong" : "säsonger"}) · ${esc(pokalText(x.pokaler))}</span></li>`).join("")}</ul>`;
}

export function visaPokaler(S, el) {
  el.innerHTML = skapHtml(S.K, { erbjud: legendErbjudande(S.K) });
}
