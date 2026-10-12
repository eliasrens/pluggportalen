// ============================================================================
// Hitta rätt! – route-skal (src/hitta-ratt/page-hitta-ratt.js) · #605
// ----------------------------------------------------------------------------
//   #/elev/hitta-ratt                 startsidan: kort per kategori + 🏆-knapp
//   #/elev/hitta-ratt?pack=<packId>   en omgång: alla frågor, resultatskärm (#608, hr-spel.js)
//   #/elev/hitta-ratt?pack=e-…        lärarens egna pack (#633): läses ur
//                                     hittaRattPacks (1 läsning) och spelas likadant
//   #/elev/hitta-ratt?vy=topplistor[&lista=<packId>]   🏆-vyn (#609): skolans
//                                     Top 15 + egen rad per pack, EN läsning per valt pack;
//                                     gruppen "Från din lärare" = egna pack med
//                                     skoltopplistan PÅ (#635, samma cachade katalog)
//
// Routen ligger i app.js med DYNAMISK import (som Läsresan, #271), så inget
// här hamnar i bootgrafen. Synligheten (opt-in per klass, enabledModules)
// sköts av modul-grinden i app.js/ui.js – en elev vars klass inte aktiverat
// Hitta rätt! kommer aldrig hit, inte ens via direktlänk.
// ============================================================================

import { app, el, go, getParams, loading, renderTopbar } from "../ui.js";
import { startsidaHtml } from "./hr-start-vy.js";
import { topplisteGrupper, topplistorVyHtml } from "./hr-topplista-vy.js";
import { hamtaPersonbasta } from "./hr-best.js";
import { arEget } from "./hr-egna.js";

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
  const p = getParams();
  const start = !p.pack && !p.vy;
  const tl = p.vy === "topplistor";
  // Startsidan: index (statisk) + personbästa (1) + katalogen över egna pack (1).
  // 🏆-vyn: index + katalogen (samma 60 s-cache som startsidan).
  const [, index, bast, egna] = await Promise.all([
    ensureStyles(),
    laddaPackIndex(),
    start ? hamtaPersonbasta() : null,
    start || tl ? import("./hr-egna-data.js").then((m) => m.egnaForMig()).catch(() => []) : null,
    renderTopbar(),
  ]);
  if (tl) return visaTopplistor(topplisteGrupper(index, egna), p.lista);
  if (arEget(p.pack)) return visaEgetSpel(p.pack);
  if (p.pack) return visaSpel(index.find((x) => x.id === p.pack));
  visaStart(index, bast, egna);
}

function visaStart(index, bast, egna) {
  const vy = el(startsidaHtml(index, bast, egna));
  vy.querySelector(".hr-topplistor-knapp").addEventListener("click", () => go(`${HASH}?vy=topplistor`));
  vy.querySelectorAll(".hr-spela").forEach((b) =>
    b.addEventListener("click", () => go(`${HASH}?pack=${encodeURIComponent(b.dataset.pack)}`))
  );
  app.replaceChildren(vy);
}

// 🏆-vyn (§22): välj ett pack med skoltopplista → Top 15 + egen rad. Byte av
// pack ritas om på plats (ingen ny route-rendering); hashen följer med via
// replaceState så att en omladdning visar samma lista.
async function visaTopplistor(grupper, lista) {
  const alla = grupper.flatMap((g) => g.pack);
  let valt = alla.some((x) => x.id === lista) ? lista : alla[0]?.id || null;
  const { hamtaTopplista } = await import("./hr-data.js");
  let senast = 0;

  const rita = (data) => {
    const vy = el(topplistorVyHtml(grupper, valt, data));
    vy.querySelector('[data-act="tillbaka"]').addEventListener("click", () => go(HASH));
    vy.querySelectorAll(".hr-tl-pack").forEach((b) =>
      b.addEventListener("click", () => {
        if (b.dataset.pack !== valt) valj(b.dataset.pack);
      })
    );
    const fokus = document.activeElement?.dataset?.pack;
    app.replaceChildren(vy);
    if (fokus) vy.querySelector(`.hr-tl-pack[data-pack="${CSS.escape(fokus)}"]`)?.focus();
  };

  async function valj(id) {
    valt = id;
    const nr = ++senast;
    history.replaceState(null, "", `${HASH}?vy=topplistor&lista=${encodeURIComponent(id)}`);
    rita(null);
    let data;
    try {
      data = await hamtaTopplista(id);
    } catch {
      data = { fel: "Topplistan gick inte att hämta just nu. Försök igen om en stund." };
    }
    // Ett senare val vinner; har eleven hunnit lämna vyn ritas inget.
    if (nr === senast && location.hash.startsWith(`${HASH}?vy=topplistor`)) rita(data);
  }

  if (valt) await valj(valt);
  else rita(null);
}

// En omgång (#608). Okänt pack → tillbaka till startsidan.
async function visaSpel(pack) {
  if (!pack) return go(HASH);
  const { spelaPack } = await import("./hr-spel.js");
  await spelaPack(pack);
}

// Lärarens eget pack (#633): packen läses (och läses om vid "ändrad karta")
// av hr-spel.js via deps.pack. Borttaget eller inte delat med elevens klass
// → "Kartan finns inte längre".
async function visaEgetSpel(id) {
  const [{ spelaPack }, { hamtaEgetPack }] = await Promise.all([import("./hr-spel.js"), import("./hr-egna-data.js")]);
  await spelaPack({ id }, { pack: () => hamtaEgetPack(id) });
}
