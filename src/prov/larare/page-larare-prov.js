// ============================================================================
// Prov (#739, spec §5.1/§8): lärarfliken "Mina prov" (src/prov/larare/page-larare-prov.js)
// ----------------------------------------------------------------------------
//   #/larare/prov[?vy=mina]              listan: mina prov + kollegors (provl-lista.js),
//                                        med rutan "Att rätta" överst (prov-att-ratta.js, #807)
//   #/larare/prov?vy=ny                  nytt prov (provl-redigera.js)
//   #/larare/prov?vy=ny&id=<provId>      redigera (bara ägaren/admin – andra kopierar)
//   #/larare/prov?vy=ny&kopia=<provId>   kopiera → osparat utkast
// Registreras i TEACHER_TABS (teacher-shared.js, gruppen "Prov") med lazyPage –
// allt i src/prov/ laddas DYNAMISKT, bootgrafen ändras inte (#271).
// ============================================================================

import { el, isTeacher, renderGate, teacherHead, teacherNav } from "../../teacher-shared.js";
import { getParams } from "../../ui.js";

export const HASH = "#/larare/prov";

/** Ladda lärarvyns stilark en gång (högst en kort väntan, fel = kör vidare). */
export function laddaCss() {
  if (document.querySelector("link[data-prov-larare-css]")) return Promise.resolve();
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./prov-larare.css", import.meta.url).href;
  link.setAttribute("data-prov-larare-css", "1");
  const klar = new Promise((resolve) => {
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", resolve, { once: true });
    setTimeout(resolve, 1500);
  });
  document.head.appendChild(link);
  return klar;
}

export async function pageLarareProv(ctx) {
  ctx.renderTopbar();
  if (!isTeacher()) return renderGate(ctx);
  await laddaCss();
  const p = getParams();
  const sida = el(`<div class="teacher-page teacher-dark provl-sida"></div>`);
  sida.appendChild(teacherNav(ctx, "prov"));
  sida.appendChild(teacherHead(ctx, "prov"));
  const host = el(`<div class="provl-host"></div>`);
  sida.appendChild(host);
  ctx.app.replaceChildren(sida);

  if (p.vy === "ny" || p.id || p.kopia) {
    const { renderRedigera } = await import("./provl-redigera.js");
    return renderRedigera(ctx, host, { id: p.id, kopia: p.kopia });
  }
  // "Att rätta" överst (#807, epic #802 DEL 5) – ur tillfällenas räknare, väntar inte in listan.
  const attRatta = el(`<div class="provl-att-ratta"></div>`);
  sida.insertBefore(attRatta, host);
  import("../prov-att-ratta.js").then((m) => m.renderAttRatta(ctx, attRatta), () => {});
  const { renderLista } = await import("./provl-lista.js");
  return renderLista(ctx, host);
}
