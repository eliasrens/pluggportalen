// ============================================================================
// Hitta rätt! – "Mina områden" (src/hitta-ratt/larare/lhr-mina.js) · #634
// ----------------------------------------------------------------------------
// #/larare/hitta-ratt?vy=mina. Katalogen hittaRattMeta/egnaPack (EN läsning, #231)
// delad på ägare (lhr-modell.js delaKatalog):
//   • Mina: tabell med namn, karta, typ, frågor, klasser och topplista PÅ/AV.
//     Redigera, Provspela, Duplicera, Radera (bekräftelse + varning om topplistan).
//   • Kollegors områden (hopfällda): läsa ("Visa innehåll", 1 läsning per
//     område), provspela och duplicera – inte redigera.
// ============================================================================

import { el, esc, icon, emptyState } from "../../teacher-shared.js";
import { auth } from "../../firebase-config.js";
import { getClasses } from "../../data-classes.js";
import { TYPER, delaKatalog, geoNamn, klassText, raderaText } from "./lhr-modell.js";
import { hamtaKatalog, hamtaPack, raderaPack } from "./lhr-data.js";
import { kopplaInnehall } from "./lhr-fardiga.js";

const HASH = "#/larare/material?flik=hitta-ratt"; // Material → Hitta rätt! (#806)

const typText = (p) => `${(TYPER[p.type] || TYPER.point).ikon} ${(TYPER[p.type] || TYPER.point).namn}`;

function minRad(p, klasser) {
  const klass = klassText(p.classIds, klasser);
  return `<tr data-pack="${esc(p.id)}">
    <td><span class="lhr-rad-namn"><span aria-hidden="true">${esc(p.ikon || "🗺️")}</span> <b>${esc(p.title)}</b></span>
      ${p.description ? `<span class="hint lhr-rad-beskr">${esc(p.description)}</span>` : ""}</td>
    <td>${esc(geoNamn(p.geo))}</td>
    <td>${typText(p)}</td>
    <td class="lhr-tal">${p.antal}</td>
    <td>${klass ? esc(klass) : `<span class="hint">Inte delad</span>`}</td>
    <td><span class="lhr-chip ${p.leaderboard ? "pa" : ""}">${p.leaderboard ? "PÅ" : "AV"}</span></td>
    <td class="lhr-atgarder">
      <button type="button" class="btn small" data-act="redigera">${icon("pencil", 16)}<span>Redigera</span></button>
      <button type="button" class="btn small ghost" data-act="prov" title="Provspela" aria-label="Provspela ${esc(p.title)}">${icon("eye", 16)}</button>
      <button type="button" class="btn small ghost" data-act="kopia" title="Duplicera" aria-label="Duplicera ${esc(p.title)}">${icon("copy", 16)}</button>
      <button type="button" class="btn small ghost danger" data-act="radera" title="Radera" aria-label="Radera ${esc(p.title)}">${icon("trash", 16)}</button>
    </td>
  </tr>`;
}

function kollegaRad(p) {
  return `<li class="lhr-kollega" data-pack="${esc(p.id)}">
    <div class="lhr-kollega-rad">
      <span class="lhr-rad-namn"><span aria-hidden="true">${esc(p.ikon || "🗺️")}</span> <b>${esc(p.title)}</b></span>
      <span class="hint">${esc(p.ownerNamn || "Lärare")} · ${esc(geoNamn(p.geo))} · ${typText(p)} · ${p.antal} frågor</span>
      <span class="lhr-knappar">
        <button type="button" class="btn small ghost" data-act="innehall" aria-expanded="false">${icon("book", 16)}<span>Visa innehåll</span></button>
        <button type="button" class="btn small ghost" data-act="prov">${icon("eye", 16)}<span>Provspela</span></button>
        <button type="button" class="btn small" data-act="kopia">${icon("copy", 16)}<span>Duplicera</span></button>
      </span>
    </div>
    <div class="lhr-innehall-ruta" hidden></div>
  </li>`;
}

export async function renderMina(ctx, host, { meddelande = "" } = {}) {
  host.replaceChildren(el(`<div class="spinner">Laddar…</div>`));
  let katalog, klasser;
  try {
    [katalog, klasser] = await Promise.all([hamtaKatalog(), getClasses().catch(() => [])]);
  } catch (err) {
    host.replaceChildren(el(`<p class="err-inline">Områdena gick inte att läsa: ${esc(err?.message || err)}</p>`));
    return;
  }
  const { mina, kollegor } = delaKatalog(katalog, auth.currentUser?.uid || "");
  const vy = el(`<div class="lhr-mina">
    <div class="lhr-msg" aria-live="polite">${meddelande}</div>
    <div class="lhr-mina-topp">
      <p class="hint lhr-ingress">Egna kartor med orter, sevärdheter eller områden. Eleverna i klasserna du väljer hittar dem
        under "Från din lärare".</p>
      <button type="button" class="btn gron small" data-act="ny">${icon("plus", 16)}<span>Skapa nytt område</span></button>
    </div>
    <div class="lhr-mina-lista"></div>
    ${kollegor.length ? `<details class="panel lhr-kollegor">
      <summary><b>Kollegors områden</b> <span class="hint">(${kollegor.length}) – provspela eller duplicera</span></summary>
      <ul class="lhr-kollega-lista">${kollegor.map(kollegaRad).join("")}</ul>
    </details>` : ""}
  </div>`);

  const lista = vy.querySelector(".lhr-mina-lista");
  if (mina.length) {
    lista.replaceChildren(el(`<div class="panel table-scroll"><table class="tbl lhr-tbl">
      <thead><tr><th>Namn</th><th>Karta</th><th>Typ</th><th>Frågor</th><th>Klasser</th><th>Topplista</th><th><span class="sr-only">Åtgärder</span></th></tr></thead>
      <tbody>${mina.map((p) => minRad(p, klasser)).join("")}</tbody>
    </table></div>`));
  } else {
    lista.replaceChildren(emptyState(null, {
      icon: "pin", title: "Inga egna områden ännu",
      text: "Skapa ett nytt område, eller duplicera ett av de färdiga och ändra det.",
    }));
  }

  const go = (q) => ctx.go(`${HASH}&${q}`);
  vy.querySelector('[data-act="ny"]').addEventListener("click", () => go("vy=ny"));
  vy.querySelectorAll("[data-pack]").forEach((rad) => {
    const id = rad.dataset.pack;
    const knapp = (act) => rad.querySelector(`[data-act="${act}"]`);
    knapp("redigera")?.addEventListener("click", () => go(`vy=ny&id=${encodeURIComponent(id)}`));
    knapp("prov").addEventListener("click", () => go(`prov=${encodeURIComponent(id)}&fran=mina`));
    knapp("kopia").addEventListener("click", () => go(`vy=ny&kopia=${encodeURIComponent(id)}`));
    if (knapp("innehall")) kopplaInnehall(knapp("innehall"), rad.querySelector(".lhr-innehall-ruta"), () => hamtaPack(id));
    knapp("radera")?.addEventListener("click", async () => {
      const post = mina.find((p) => p.id === id);
      if (!confirm(raderaText(post))) return;
      knapp("radera").disabled = true;
      try {
        await raderaPack(id);
        renderMina(ctx, host, { meddelande: `<div class="msg ok">"${esc(post.title)}" är raderat.</div>` });
      } catch (err) {
        knapp("radera").disabled = false;
        vy.querySelector(".lhr-msg").innerHTML = `<div class="msg error">${esc(err?.message || "Området kunde inte raderas.")}</div>`;
      }
    });
  });
  host.replaceChildren(vy);
}
