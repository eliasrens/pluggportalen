// ============================================================================
// Matchdagen (#869): TABELL-fliken (spec §5) – placering, lag, spelade, vunna,
// oavgjorda, förlorade, mål och poäng (3, 1, 0), sorterad på poäng, målskillnad
// och gjorda mål. Det egna laget markeras. Efter sista omgången: hur säsongen
// slutade och "Starta nästa säsong" (startar den direkt och går till Match).
// Etapp 2a (#870, §7.1): stegen Division 6 → … → Superligan överst, med den
// nuvarande divisionen markerad; ligavinnaren går vidare till kvalmatchen.
// Etapp 2c (#872, §9.1): Silverpokalen under tabellen (md-vy-cup.js) – rundorna,
// motståndarna och resultaten; "Till cupmatchen" när en väntar.
// ============================================================================

import { DIVISIONER, TOPP_DIV } from "../delat/md-config.js";
import { dubbelSkott } from "../delat/md-motor.js";
import { kvalMatch, stegen } from "../delat/md-kval.js";
import { cupMatch } from "../delat/md-cup.js";
import { cupHtml } from "./md-vy-cup.js";
import { nastaMatch, tabellRader } from "../delat/md-sasong.js";
import { chip, esc } from "./md-vy-delat.js";

/** Stegen (§7.1): alla åtta nivåer, den nuvarande markerad. Ligans division – efter ett vunnet kval den gamla tills nästa säsong. */
export function stegHtml(div) {
  return `<ol class="md-stege" aria-label="Divisionerna, från Division 6 upp till Superligan">${stegen(div).map((s) =>
    `<li${s.nu ? ' class="nu" aria-current="step"' : s.div < div ? ' class="klar"' : ""}><b>${esc(s.namn)}</b><small>${s.lag} lag</small></li>`).join("")}</ol>`;
}

export function visaTabell(S, el) {
  const K = S.K;
  const rader = tabellRader(K);
  const antal = K.liga.schema.length;
  const klar = !nastaMatch(K);
  const kval = kvalMatch(K);
  const cup = cupMatch(K, S.uid);
  const plac = rader.findIndex((r) => r.vi) + 1;
  // Ligans division: efter ett spelat kval står K.div redan på nästa division.
  const div = K.kval?.spelad ? Number(K.kval.div) || 0 : K.div;
  const slutText = plac === 1
    ? `Ni vann ${esc(DIVISIONER[div])}!${kval ? ` Nu väntar kvalmatchen mot ${esc(kval.mot.namn)} från ${esc(DIVISIONER[kval.till])}.` : div >= TOPP_DIV ? " Ni är bäst av alla." : ""}`
    : `Säsongen är slut – ni kom på plats ${plac} av ${rader.length}.`;
  el.innerHTML = `<div class="md-panel">
    <h2>${esc(DIVISIONER[div])} – säsong ${Number(K.sasong) || 1}</h2>
    ${stegHtml(div)}
    <p class="md-svag">Ettan får kvala upp. Man kan bara gå uppåt – ju högre upp, desto fler lag att slå och tuffare motstånd.${dubbelSkott(div) ? " Här krävs två rätt i rad för ett riktigt bra skott." : ""}</p>
    ${klar
      ? `<p class="md-slut${plac === 1 ? " vinst" : ""}">${slutText}</p>`
      : `<p class="md-svag">${K.liga.omg ? `Omgång ${K.liga.omg} av ${antal} spelad` : `Säsongen har inte börjat – ${antal} omgångar`} · ${rader.length} lag · Vinst 3 poäng, oavgjort 1.</p>`}
    <div class="md-scroll"><table class="md-tabell">
      <thead><tr><th scope="col">#</th><th scope="col">Lag</th><th scope="col" title="Spelade">S</th><th scope="col" title="Vunna">V</th><th scope="col" title="Oavgjorda">O</th><th scope="col" title="Förlorade">F</th><th scope="col">Mål</th><th scope="col" title="Målskillnad">+/−</th><th scope="col" title="Poäng">P</th></tr></thead>
      <tbody>${rader.map((r) => `<tr class="${r.vi ? "vi" : ""}${r.plac === 1 ? " etta" : ""}"${r.vi ? ' aria-current="true"' : ""}>
        <td>${r.plac}</td><td>${chip(r.farg, "liten")} ${esc(r.namn)}</td><td>${r.s}</td><td>${r.v}</td><td>${r.o}</td><td>${r.f}</td>
        <td>${r.gm}–${r.im}</td><td>${r.md > 0 ? "+" : ""}${r.md}</td><td><b>${r.p}</b></td></tr>`).join("")}</tbody>
    </table></div>
    <div class="md-rad"><button type="button" class="md-stor" data-match>${cup ? "Till cupmatchen" : kval ? "Till kvalmatchen" : klar ? "Starta nästa säsong" : "Nästa match"}</button></div>
    ${cupHtml(K, S.uid)}
  </div>`;
  // Efter sista omgången: "Se hur säsongen slutade" → hit → nästa säsong direkt (en väg, ingen
  // extra "Säsongen är slut"-ruta på Match-fliken).
  el.querySelector("[data-match]").addEventListener("click", async () => {
    if (klar && !kval && !cup) (await import("./md-vy-match.js")).startaNastaSasong(S);
    S.visa("match");
  });
}
