// ============================================================================
// Hitta rätt! – lärarfliken (src/hitta-ratt/larare/page-larare-hitta-ratt.js) · #634
// ----------------------------------------------------------------------------
//   #/larare/material?flik=hitta-ratt&vy=fardiga   de officiella områdena (lhr-fardiga.js)
//   #/larare/material?flik=hitta-ratt[&vy=mina]    mina + kollegors områden (lhr-mina.js)
//   #/larare/material?flik=hitta-ratt&vy=ny[&id=|&kopia=]  skapa / redigera / duplicera (lhr-redigera.js)
//   #/larare/material?flik=hitta-ratt&prov=<packId>&fran=<vy>  provspel (lhr-provspel.js)
// Förr #/larare/hitta-ratt (omdirigeras, ?prov= följer med, #806). Ritas som underfliken
// Hitta rätt! i Material (teacher-material.js); allt i src/hitta-ratt/larare/ laddas
// DYNAMISKT, bootgrafen ändras inte (#271).
// Arkitektur §11.9.
// ============================================================================

import { el, icon, isTeacher, renderGate, teacherHead, teacherNav } from "../../teacher-shared.js";
import { getParams } from "../../ui.js";

const HASH = "#/larare/material?flik=hitta-ratt"; // Material → Hitta rätt! (#806)
const FLIKAR = [
  { vy: "fardiga", namn: "Färdiga områden", ikon: "book" },
  { vy: "mina", namn: "Mina områden", ikon: "pin" },
  { vy: "ny", namn: "Skapa nytt", ikon: "plus" },
];

/** Ladda ett stilark en gång (högst en kort väntan, fel = kör vidare). */
function laddaCss(rel, attr) {
  if (document.querySelector(`link[${attr}]`)) return Promise.resolve();
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL(rel, import.meta.url).href;
  link.setAttribute(attr, "1");
  const klar = new Promise((resolve) => {
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", resolve, { once: true });
    setTimeout(resolve, 1500);
  });
  document.head.appendChild(link);
  return klar;
}

export async function pageLarareHittaRatt(ctx) {
  ctx.renderTopbar();
  if (!isTeacher()) return renderGate(ctx);
  const p = getParams();
  // hitta-ratt.css (elevens) behövs för provspelet och delas med elevsidan.
  await Promise.all([
    laddaCss("./hitta-ratt-larare.css", "data-hitta-ratt-larare-css"),
    p.prov ? laddaCss("../hitta-ratt.css", "data-hitta-ratt-css") : null,
  ]);

  if (p.prov) {
    const fran = FLIKAR.some((f) => f.vy === p.fran) ? p.fran : "mina";
    const { provspela } = await import("./lhr-provspel.js");
    return provspela(ctx, p.prov, `${HASH}&vy=${fran}`);
  }

  const vy = FLIKAR.some((f) => f.vy === p.vy) ? p.vy : p.id || p.kopia ? "ny" : "mina";
  const sida = el(`<div class="teacher-page teacher-dark lhr-sida"></div>`);
  if (!ctx.embedded) {
    sida.appendChild(teacherNav(ctx, "material"));
    sida.appendChild(teacherHead(ctx, "material"));
  }
  const flikar = el(`<nav class="lhr-flikar" aria-label="Hitta rätt!">
    ${FLIKAR.map((f) => {
      const namn = f.vy === "ny" && p.id ? "Redigera" : f.vy === "ny" && p.kopia ? "Kopia" : f.namn;
      return `<a class="lhr-flik ${f.vy === vy ? "active" : ""}" href="${HASH}&vy=${f.vy}" data-vy="${f.vy}"${
        f.vy === vy ? ' aria-current="page"' : ""}>${icon(f.ikon, 16)}<span>${namn}</span></a>`;
    }).join("")}
  </nav>`);
  flikar.querySelectorAll("[data-vy]").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    ctx.go(`${HASH}&vy=${a.dataset.vy}`);
  }));
  const host = el(`<div class="lhr-innehall-host"></div>`);
  sida.append(flikar, host);
  ctx.app.replaceChildren(sida);

  if (vy === "fardiga") {
    const { renderFardiga } = await import("./lhr-fardiga.js");
    return renderFardiga(ctx, host);
  }
  if (vy === "ny") {
    const { renderRedigera } = await import("./lhr-redigera.js");
    return renderRedigera(ctx, host, { id: p.id, kopia: p.kopia });
  }
  const { renderMina } = await import("./lhr-mina.js");
  return renderMina(ctx, host);
}
