// ============================================================================
// Pluggporten – lärarsidan: Material → Läsresan (teacher-material-lasresan.js, #806)
// ----------------------------------------------------------------------------
// Epic #802 DEL 4: "Bläddra bland texterna och frågorna per nivå, om det finns en
// lärarvy för det. Annars en förklaring och en länk till nivåerna under Mina klasser."
// Det finns ingen lärarvy för Läsresans texter (de ligger i src/lasresan/content/ och
// serveras till eleven efter nivå), så fliken förklarar hur nivåerna och världarna
// fungerar och länkar till där läraren ändrar elevernas nivåer. Inga läsningar.
// Laddas med import() från teacher-material-flikar.js (#271).
// ============================================================================

import { LEVEL_MAX, LEVEL_MIN, LEVEL_WORD_RANGES, START_LEVEL } from "./lasresan/config.js";
import { el, esc, icon, wireHashLinks } from "./teacher-shared.js";
import { LANK } from "./teacher-material-flikar.js";

export async function renderLasresanInfo(sub) {
  const { WORLDS } = await import("./lasresan/worlds/index.js");
  const rader = [];
  for (let n = LEVEL_MIN; n <= LEVEL_MAX; n++) {
    const [a, b] = LEVEL_WORD_RANGES[n] || [];
    rader.push(`<tr><td>Nivå ${n}${n === START_LEVEL ? ` <span class="hint">· startnivå</span>` : ""}</td><td>${a ? `${a}–${b} ord` : "–"}</td></tr>`);
  }
  const sida = el(`<div class="panel mat-info">
    <h2>${icon("book", 20)} Läsresan</h2>
    <p>Läsresan är elevernas läsförståelse på en karta. Eleven läser en text i taget och svarar på frågor om den.
      Texterna väljs automatiskt efter elevens dolda nivå (${LEVEL_MIN}–${LEVEL_MAX}), som går upp och ner efter hur det går.
      Resan går genom ${WORLDS.length} världar: ${WORLDS.map((w) => esc(w.name)).join(", ")}.</p>
    <p>Det finns ingen lärarvy för att bläddra bland texterna; de är färdiga och granskade. Det du styr är <b>vilken nivå eleverna ligger på</b>.</p>
    <p><a class="btn gron" href="${LANK.lasresan.hash}" data-hash="${LANK.lasresan.hash}">${esc(LANK.lasresan.text)}</a></p>
    <h3>Nivåerna</h3>
    <div class="table-scroll"><table class="mat-niva-tabell"><thead><tr><th scope="col">Nivå</th><th scope="col">Textlängd (riktvärde)</th></tr></thead>
      <tbody>${rader.join("")}</tbody></table></div>
  </div>`);
  wireHashLinks(sub, sida);
  sub.app.replaceChildren(sida);
}
