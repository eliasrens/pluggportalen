// ============================================================================
// Matchdagen (#873, Etapp 3): SUPERLIGAN och MÄSTARCUPEN i elevens vyer (spec
// §10.1, §10.2). Rena strängar, ingen Firebase:
//   mcText(c)          "Mästarcupen · Kvartsfinal · Real Solvik" (rutan före avspark)
//   mcFore(K, n)       vad som står på spel före en match i Mästarcupen
//   mcEfter(klar)      rubrik och rad i rutan efter matchen
//   mcHtml(K, uid)     Mästarcupens tre rundor under tabellen (Tabell-fliken)
//   mastareText()      rubrik och text när Superligan är vunnen
//   finalIntro(S, el, n)  "FINALEN" över planen före finalen (DOM, väntar tills introt är klart)
// Allt ur dokumentet med esc() eller som tal (eleven skriver dokumentet).
// ============================================================================

import { DIVISIONER, KASSA, MASTARCUP, TOPP_DIV } from "../delat/md-config.js";
import { mcLage, mcLottning, mcSchema } from "../delat/md-mastarcup.js";
import { chip, esc, vanta } from "./md-vy-delat.js";

const tal = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const rundaNamn = (i) => MASTARCUP.rundor[i].toLowerCase();
const resultat = (m) => `${tal(m.oss)}–${tal(m.dem)}${Array.isArray(m.straffar) ? ` (str. ${tal(m.straffar[0])}–${tal(m.straffar[1])})` : ""}`;

/** "Mästarcupen · Kvartsfinal · Real Solvik" */
export const mcText = (c) => `${MASTARCUP.namn} · ${c.namn} · ${c.mot.namn}`;

/** Prispengarna för en vunnen final. */
export const mcPris = (K) => Math.round(MASTARCUP.seger * (1 + (Number(K.div) || 0) * KASSA.perDiv));

/** Rutan före en match i Mästarcupen: finalen eller nästa runda – oavgjort avgörs på straffar. */
export function mcFore(K, n) {
  const c = n.mc;
  return `<p>${c.final
    ? `<b>FINALEN</b> i ${esc(MASTARCUP.namn)}! Vinner ni lyfter ni den största pokalen i spelet och får <b>${mcPris(K).toLocaleString("sv-SE")} kr</b> till klubbkassan.`
    : `Vinner ni går ni vidare till <b>${esc(rundaNamn(c.runda + 1))}en</b> – förlorar ni är Mästarcupen slut för i år.`}
    Blir det oavgjort avgörs det på straffar.</p>
    <p class="md-tips">${esc(c.mot.namn)} är en av de bästa klubbarna i ett annat land – det här är det tuffaste motståndet i spelet.</p>`;
}

/** Rubrik och rad för rutan efter matchen. */
export function mcEfter(klar) {
  if (klar.vannCupen) return { rubrik: `${MASTARCUP.namn} är er!`, rad: "Ni vann finalen och lyfter den största pokalen i spelet! Den står i Pokalskåpet." };
  if (klar.vann) return { rubrik: "Vidare!", rad: `Ni är klara för ${rundaNamn(klar.runda + 1)}en i ${MASTARCUP.namn}.` };
  return { rubrik: "Ute – men vilken resa!", rad: `${MASTARCUP.namn} är slut för i år. Vinn Superligan igen så blir ni inbjudna nästa säsong.` };
}

/** Superligan vunnen (§10.1): mästare – och inbjudan till Mästarcupen nästa säsong. */
export function mastareText() {
  return {
    rubrik: "Mästare!",
    text: `Ni vann ${DIVISIONER[TOPP_DIV]} – ni är bäst av alla! Klubbmärket får en guldkant, och nästa säsong är ni inbjudna till ${MASTARCUP.namn}. Nu gäller det att försvara titeln.`,
  };
}

/** Mästarcupens läge i en mening. */
export function mcStatus(K) {
  const L = mcLage(K);
  if (L.vann) return `Ni vann ${MASTARCUP.namn}!`;
  if (L.ute) return `Utslagna i ${rundaNamn(L.spelade - 1)}en.`;
  const omg = tal(K.liga?.omg);
  const antal = tal(K.liga?.schema?.length);
  if (omg >= antal) return `${MASTARCUP.namn} är slut för i år.`;
  const efter = mcSchema(antal)[L.spelade];
  return omg >= efter ? `${MASTARCUP.rundor[L.spelade]}en väntar – den spelas före nästa ligamatch.` : `${MASTARCUP.rundor[L.spelade]}en spelas efter omgång ${efter} i ligan.`;
}

/** Mästarcupens tre rundor den här säsongen (under tabellen) – bara när klubben är inbjuden. */
export function mcHtml(K, uid = "") {
  const L = mcLage(K);
  if (!L.inbjuden) return "";
  const sasong = tal(K.sasong) || 1;
  const spelade = (Array.isArray(K.senaste) ? K.senaste : []).filter((m) => m?.typ === "mastarcup" && tal(m.sasong) === sasong);
  const efter = mcSchema(K.liga?.schema?.length);
  const lott = mcLottning(K, uid);
  const kvar = !L.ute && !L.vann;
  const rader = MASTARCUP.rundor.map((namn, i) => {
    let klass = "";
    let info = "";
    let mot = `${chip(lott[i].farg, "liten")} ${esc(lott[i].namn)}`;
    if (i < L.spelade) {
      const m = spelade.find((x) => tal(x.omg) === i + 1);
      const ute = L.ute && i === L.spelade - 1;
      klass = ute ? "ute" : "vidare";
      info = `${m ? `${resultat(m)} · ` : ""}${ute ? "utslagna" : i === MASTARCUP.rundor.length - 1 ? "vinnare!" : "vidare"}`;
    } else if (kvar) {
      klass = i === L.spelade ? "nu" : "";
      info = `efter omgång ${tal(efter[i])}`;
    } else mot = `<span class="md-svag">–</span>`;
    return `<li class="${klass}"${klass === "nu" ? ' aria-current="step"' : ""}><b>${esc(namn)}</b><span class="md-cup-mot">${mot}</span><span class="md-cup-info">${info}</span></li>`;
  }).join("");
  return `<section class="md-cup md-mc${L.vann ? " vunnen" : ""}" aria-label="${esc(MASTARCUP.namn)}">
    <h3><span class="md-pokal guld" aria-hidden="true"></span>${esc(MASTARCUP.namn)} – säsong ${sasong}</h3>
    <ol class="md-cup-rundor">${rader}</ol>
    <p class="md-svag">${esc(mcStatus(K))} Toppklubbar från andra länder – oavgjort avgörs på straffar, förlust betyder ute.</p>
  </section>`;
}

/**
 * Introt före finalen i Mästarcupen (§10.2): "FINALEN" över planen med lagen – i lugnt läge
 * och med prefers-reduced-motion utan rörelse och kortare.
 */
export async function finalIntro(S, el, n) {
  const d = document.createElement("div");
  d.className = `md-finalintro${S.lugnt ? " lugnt" : ""}`;
  d.setAttribute("role", "status");
  d.innerHTML = `<small>Mästarcupen</small><b>FINALEN</b><span>${esc(S.K.klubb.namn)} – ${esc(n.mot.namn)}</span>`;
  el.querySelector(".md-plan")?.appendChild(d);
  await vanta(S.lugnt ? 1200 : 3200);
  d.remove();
}
