// ============================================================================
// Ekvationsresan – route-skal (src/ekvationsresan/page-ekvationsresan.js) · #618
// ----------------------------------------------------------------------------
//   #/elev/ekvationsresan   direkt in i nästa uppgift (E1.1) – ingen karta,
//                           ingen lobby, inga mellanskärmar
//
// Routen ligger i app.js med DYNAMISK import, så Ekvationsresan aldrig hamnar
// i bootgrafen (#271). Modulen är opt-in per klass (gamemode-visibility.js,
// TOGGLABLE_MODULES) – routern släpper bara in elever vars klass slagit på den.
// Stilarna (ekvationsresan.css + vågens vag.css) laddas härifrån.
// ============================================================================

import { app, el, loading, renderTopbar } from "../ui.js";
import { enterEkvationsresan, completeTask, startTask } from "./ekv-data.js";
import { createSpelvy } from "./spelvy.js";
import { ensureVagCss } from "./vag.js";

let aktiv = null;

function ensureStyles() {
  if (document.querySelector("link[data-ekv-css]")) return Promise.resolve();
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./ekvationsresan.css", import.meta.url).href;
  link.dataset.ekvCss = "1";
  const ready = new Promise((resolve) => {
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", resolve, { once: true });
    setTimeout(resolve, 1500);
  });
  document.head.appendChild(link);
  return ready;
}

/** Avmonteras när eleven lämnar routen (vågens animationer, fokusvakten). */
function stadaVidByte() {
  const stada = () => {
    if (!location.hash.startsWith("#/elev/ekvationsresan")) {
      aktiv?.destroy();
      aktiv = null;
      window.removeEventListener("hashchange", stada);
    }
  };
  window.addEventListener("hashchange", stada);
}

export async function pageEkvationsresan() {
  aktiv?.destroy();
  aktiv = null;
  loading();
  const [start] = await Promise.all([enterEkvationsresan(), renderTopbar(), ensureStyles(), ensureVagCss()]);
  const host = el(`<div class="ekv-rot"></div>`);
  app.replaceChildren(host);
  aktiv = createSpelvy(host, {
    progress: start.progress,
    current: start.current,
    save: async (payload) => {
      const res = await completeTask(payload);
      if (res.coins > 0) renderTopbar().catch(() => {}); // nytt saldo i sidomenyn
      return res;
    },
    retry: (task) => startTask(task),
    reenter: () => pageEkvationsresan(),
  });
  stadaVidByte();
}
