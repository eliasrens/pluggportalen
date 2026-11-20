// ============================================================================
// Matchdagen (#869): TABELL-fliken (spec §5) – placering, lag, spelade, vunna,
// oavgjorda, förlorade, mål och poäng (3, 1, 0), sorterad på poäng, målskillnad
// och gjorda mål. Det egna laget markeras. Efter sista omgången: hur säsongen
// slutade och "Starta nästa säsong" (startar den direkt och går till Match).
// ============================================================================

import { DIVISIONER } from "../delat/md-config.js";
import { nastaMatch, tabellRader } from "../delat/md-sasong.js";
import { chip, esc } from "./md-vy-delat.js";

export function visaTabell(S, el) {
  const K = S.K;
  const rader = tabellRader(K);
  const antal = K.liga.schema.length;
  const klar = !nastaMatch(K);
  const plac = rader.findIndex((r) => r.vi) + 1;
  el.innerHTML = `<div class="md-panel">
    <h2>${esc(DIVISIONER[K.div])} – säsong ${K.sasong}</h2>
    ${klar
      ? `<p class="md-slut${plac === 1 ? " vinst" : ""}">${plac === 1 ? `Ni vann ${esc(DIVISIONER[K.div])}!` : `Säsongen är slut – ni kom på plats ${plac} av ${rader.length}.`}</p>`
      : `<p class="md-svag">${K.liga.omg ? `Omgång ${K.liga.omg} av ${antal} spelad` : `Säsongen har inte börjat – ${antal} omgångar`} · ${rader.length} lag · Vinst 3 poäng, oavgjort 1.</p>`}
    <div class="md-scroll"><table class="md-tabell">
      <thead><tr><th scope="col">#</th><th scope="col">Lag</th><th scope="col" title="Spelade">S</th><th scope="col" title="Vunna">V</th><th scope="col" title="Oavgjorda">O</th><th scope="col" title="Förlorade">F</th><th scope="col">Mål</th><th scope="col" title="Målskillnad">+/−</th><th scope="col" title="Poäng">P</th></tr></thead>
      <tbody>${rader.map((r) => `<tr class="${r.vi ? "vi" : ""}${r.plac === 1 ? " etta" : ""}"${r.vi ? ' aria-current="true"' : ""}>
        <td>${r.plac}</td><td>${chip(r.farg, "liten")} ${esc(r.namn)}</td><td>${r.s}</td><td>${r.v}</td><td>${r.o}</td><td>${r.f}</td>
        <td>${r.gm}–${r.im}</td><td>${r.md > 0 ? "+" : ""}${r.md}</td><td><b>${r.p}</b></td></tr>`).join("")}</tbody>
    </table></div>
    <div class="md-rad"><button type="button" class="md-stor" data-match>${klar ? "Starta nästa säsong" : "Nästa match"}</button></div>
  </div>`;
  // Efter sista omgången: "Se hur säsongen slutade" → hit → nästa säsong direkt (en väg, ingen
  // extra "Säsongen är slut"-ruta på Match-fliken).
  el.querySelector("[data-match]").addEventListener("click", async () => {
    if (klar) (await import("./md-vy-match.js")).startaNastaSasong(S);
    S.visa("match");
  });
}
