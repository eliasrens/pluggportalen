// ============================================================================
// Hitta rätt! – route-skal (src/hitta-ratt/page-hitta-ratt.js) · #605
// ----------------------------------------------------------------------------
//   #/elev/hitta-ratt                 startsidan: kort per kategori + 🏆-knapp
//   #/elev/hitta-ratt?pack=<packId>   en omgång (E #608 – stubb tills dess)
//   #/elev/hitta-ratt?vy=topplistor   topplistevyn (F #609 – stubb tills dess)
//
// Routen ligger i app.js med DYNAMISK import (som Läsresan, #271), så inget
// här hamnar i bootgrafen. Synligheten (opt-in per klass, enabledModules)
// sköts av modul-grinden i app.js/ui.js – en elev vars klass inte aktiverat
// Hitta rätt! kommer aldrig hit, inte ens via direktlänk.
// ============================================================================

import { app, el, go, getParams, loading, renderTopbar } from "../ui.js";
import { startsidaHtml, esc } from "./hr-start-vy.js";
import { hamtaPersonbasta } from "./hr-best.js";

const HASH = "#/elev/hitta-ratt";

/** Ladda hitta-ratt.css en gång (högst en kort väntan, fel = kör vidare). */
function ensureStyles() {
  if (document.querySelector("link[data-hitta-ratt-css]")) return Promise.resolve();
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./hitta-ratt.css", import.meta.url).href;
  link.dataset.hittaRattCss = "1";
  const ready = new Promise((resolve) => {
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", resolve, { once: true });
    setTimeout(resolve, 1500);
  });
  document.head.appendChild(link);
  return ready;
}

let indexP = null;
/** Packlistan (content/packs/index.json), cachad per session. */
export function laddaPackIndex() {
  if (!indexP) {
    indexP = fetch(new URL("./content/packs/index.json", import.meta.url))
      .then((r) => {
        if (!r.ok) throw new Error(`index.json ${r.status}`);
        return r.json();
      })
      .catch((err) => {
        indexP = null; // nästa besök försöker igen
        throw err;
      });
  }
  return indexP;
}

export async function pageHittaRatt() {
  loading();
  const [, index, bast] = await Promise.all([
    ensureStyles(),
    laddaPackIndex(),
    hamtaPersonbasta(),
    renderTopbar(),
  ]);
  const p = getParams();
  if (p.vy === "topplistor") return visaTopplistorStubb();
  if (p.pack) return visaSpelStubb(index.find((x) => x.id === p.pack));
  visaStart(index, bast);
}

function visaStart(index, bast) {
  const vy = el(startsidaHtml(index, bast));
  vy.querySelector(".hr-topplistor-knapp").addEventListener("click", () => go(`${HASH}?vy=topplistor`));
  vy.querySelectorAll(".hr-spela").forEach((b) =>
    b.addEventListener("click", () => go(`${HASH}?pack=${encodeURIComponent(b.dataset.pack)}`))
  );
  app.replaceChildren(vy);
}

function stubb(emoji, rubrik, text) {
  const vy = el(`<div class="panel center hr-stub">
    <div class="big-emoji">${emoji}</div>
    <h2>${rubrik}</h2>
    <p class="hint">${text}</p>
    <button class="btn" data-act="tillbaka">Tillbaka till kartorna</button>
  </div>`);
  vy.querySelector('[data-act="tillbaka"]').addEventListener("click", () => go(HASH));
  app.replaceChildren(vy);
}

// Stubbe tills topplistevyn (F #609) finns.
function visaTopplistorStubb() {
  stubb("🏆", "Topplistor", "Här kommer skolans topplistor att visas – Top 15, ditt rekord och din plats.");
}

// Stubbe tills spelflödet (E #608) finns.
function visaSpelStubb(pack) {
  if (!pack) return go(HASH);
  stubb("🗺️", esc(pack.title), "Den här kartan går snart att spela. Kika tillbaka lite senare!");
}
