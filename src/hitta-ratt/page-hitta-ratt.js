// ============================================================================
// Hitta rätt! – route-skal (src/hitta-ratt/page-hitta-ratt.js) · #605
// ----------------------------------------------------------------------------
//   #/elev/hitta-ratt                 startsidan: kort per kategori + 🏆-knapp
//   #/elev/hitta-ratt?pack=<packId>   en omgång: alla frågor, resultatskärm (#608, hr-spel.js)
//   #/elev/hitta-ratt?vy=topplistor[&lista=<packId>]   🏆-vyn (#609): skolans
//                                     Top 15 + egen rad per pack, EN läsning per valt pack
//
// Routen ligger i app.js med DYNAMISK import (som Läsresan, #271), så inget
// här hamnar i bootgrafen. Synligheten (opt-in per klass, enabledModules)
// sköts av modul-grinden i app.js/ui.js – en elev vars klass inte aktiverat
// Hitta rätt! kommer aldrig hit, inte ens via direktlänk.
// ============================================================================

import { app, el, go, getParams, loading, renderTopbar } from "../ui.js";
import { startsidaHtml, grupperaPack } from "./hr-start-vy.js";
import { topplistorVyHtml } from "./hr-topplista-vy.js";
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
  const p = getParams();
  const [, index, bast] = await Promise.all([
    ensureStyles(),
    laddaPackIndex(),
    p.pack || p.vy ? null : hamtaPersonbasta(),
    renderTopbar(),
  ]);
  if (p.vy === "topplistor") return visaTopplistor(index, p.lista);
  if (p.pack) return visaSpel(index.find((x) => x.id === p.pack));
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

// 🏆-vyn (§22): välj ett pack med skoltopplista → Top 15 + egen rad. Byte av
// pack ritas om på plats (ingen ny route-rendering); hashen följer med via
// replaceState så att en omladdning visar samma lista.
async function visaTopplistor(index, lista) {
  const grupper = grupperaPack(index.filter((x) => x.leaderboard !== false));
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
