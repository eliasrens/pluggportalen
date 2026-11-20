// ============================================================================
// Matchdagen (#872, Etapp 2c): SILVERPOKALEN och REKORDEN i elevens vyer (spec
// §9). Rena strängar, ingen Firebase:
//   cupHtml(K, uid)   cupens fyra rundor under tabellen (Tabell-fliken): motståndaren,
//                     resultatet eller när rundan spelas, vidare/ute/pokalen
//   rekordLista(text) rekorden i Statistik (md-rekord.js rekordRader – bara tal)
// Allt ur dokumentet med esc() eller som tal (eleven skriver dokumentet).
// ============================================================================

import { CUP, DIVISIONER } from "../delat/md-config.js";
import { cupLage, cupLottning, cupSchema } from "../delat/md-cup.js";
import { rekordRader } from "../delat/md-rekord.js";
import { chip, esc } from "./md-vy-delat.js";

const tal = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const resultat = (m) => `${tal(m.oss)}–${tal(m.dem)}${Array.isArray(m.straffar) ? ` (str. ${tal(m.straffar[0])}–${tal(m.straffar[1])})` : ""}`;
const rundaNamn = (i) => CUP.rundor[i].toLowerCase();
/** Var motståndarna kommer ifrån: ±CUP.spridning, aldrig under Division 6 eller över Superligan. */
const spannText = (K) => {
  const div = tal(K.div);
  const [lo, hi] = [Math.max(0, div - CUP.spridning), Math.min(DIVISIONER.length - 1, div + CUP.spridning)];
  return `Motståndarna kommer från ${DIVISIONER[lo]} till ${DIVISIONER[hi]}`;
};

/** Ligan är slut utan att cupen blev klar (ett dokument från före 2c) – då väntar ingen cupmatch. */
const ligaSlut = (K) => Number(K.liga?.omg) >= (Number(K.liga?.schema?.length) || 0);

/** Cupens läge i en mening. */
export function cupStatus(K) {
  const L = cupLage(K);
  if (L.vann) return `Ni vann ${CUP.namn}!`;
  if (L.ute) return `Utslagna i ${rundaNamn(L.spelade - 1)}en – ny chans nästa säsong.`;
  if (ligaSlut(K)) return `${CUP.namn} spelas igen nästa säsong.`;
  const efter = cupSchema(K.liga?.schema?.length)[L.spelade];
  return Number(K.liga?.omg) >= efter
    ? `${CUP.rundor[L.spelade]}en väntar – den spelas före nästa ligamatch.`
    : `${CUP.rundor[L.spelade]}en spelas efter omgång ${efter} i ligan.`;
}

/** Cupens fyra rundor den här säsongen (under tabellen). */
export function cupHtml(K, uid = "") {
  const L = cupLage(K);
  const sasong = tal(K.sasong) || 1;
  const spelade = (Array.isArray(K.senaste) ? K.senaste : []).filter((m) => m?.typ === "cup" && tal(m.sasong) === sasong);
  const efter = cupSchema(K.liga?.schema?.length);
  const kvar = !L.ute && !L.vann && !ligaSlut(K);
  const lott = kvar ? cupLottning(K, uid) : [];
  const rader = CUP.rundor.map((namn, i) => {
    let klass = "";
    let mot = `<span class="md-svag">–</span>`;
    let info = "";
    if (i < L.spelade) {
      const m = spelade.find((x) => tal(x.omg) === i + 1);
      const ute = L.ute && i === L.spelade - 1;
      klass = ute ? "ute" : "vidare";
      if (m) mot = esc(m.mot);
      info = `${m ? `${resultat(m)} · ` : ""}${ute ? "utslagna" : i === CUP.rundor.length - 1 ? "vinnare!" : "vidare"}`;
    } else if (kvar) {
      const t = lott[i];
      klass = i === L.spelade ? "nu" : "";
      mot = `${chip(t.farg, "liten")} ${esc(t.namn)} <small class="md-svag">${esc(DIVISIONER[t.div] || "")}</small>`;
      info = `efter omgång ${tal(efter[i])}`;
    }
    return `<li class="${klass}"${klass === "nu" ? ' aria-current="step"' : ""}><b>${esc(namn)}</b><span class="md-cup-mot">${mot}</span><span class="md-cup-info">${info}</span></li>`;
  }).join("");
  return `<section class="md-cup${L.vann ? " vunnen" : ""}" aria-label="${esc(CUP.namn)}">
    <h3><span class="md-pokal silver" aria-hidden="true"></span>${esc(CUP.namn)} – säsong ${sasong}</h3>
    <ol class="md-cup-rundor">${rader}</ol>
    <p class="md-svag">${esc(cupStatus(K))} ${esc(spannText(K))} – oavgjort avgörs på straffar, förlust betyder ute.</p>
  </section>`;
}

/** Rekorden (§9.2) som en lista i Statistik. */
export function rekordLista(text) {
  return `<dl class="md-dl md-rekordlista">${rekordRader(text).map((r) => `<div><dt>${esc(r.namn)}</dt><dd>${r.varde == null
    ? `<span class="md-svag">–</span>` : esc(r.varde)}${r.sasong ? ` <small class="md-svag">säsong ${tal(r.sasong)}</small>` : ""}</dd></div>`).join("")}</dl>`;
}
