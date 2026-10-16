// ============================================================================
// Prov (#739, spec §5.1): listan "Mina prov" (src/prov/larare/provl-lista.js)
// ----------------------------------------------------------------------------
// Namn, antal frågor, senast ändrat och ägare. Knappar: Nytt prov, Redigera,
// Förhandsvisa, Kopiera, Radera. Kollegors prov (hopfällda) går att
// förhandsvisa och kopiera – inte ändra (samma regler som områdena, #680).
// Radera frågar i en ruta på sidan (inte confirm()).
// "Kör i klass" (§5.2) öppnar provtillfällets ruta (#740, korIKlass i
// src/prov/prov-tillfalle-larare.js) – laddas först vid klick.
// ============================================================================

import { el, emptyState, esc, icon } from "../../teacher-shared.js";
import { myRole } from "../../teacher-role.js";
import { datumText, delaProvlista } from "../prov-lista-ops.js";
import { felText, hamtaProv, listaProv, raderaProv } from "./provl-data.js";
import { HASH } from "./page-larare-prov.js";

/**
 * "Kör i klass" (§5.2): rutan ägs av provtillfället (#740). Laddas först vid
 * klick; saknas modulen (än) visas ett vänligt besked i `msg`.
 */
export async function korIKlass(ctx, provId, msg) {
  try {
    const { korIKlass: kor } = await import("../prov-tillfalle-larare.js");
    return await kor(ctx, provId);
  } catch (err) {
    console.warn("Kör i klass", err);
    if (msg) msg.innerHTML = `<div class="msg warn">Det går inte att köra provet i en klass just nu. Ladda om sidan och försök igen.</div>`;
  }
}

function radHtml(r, { kollega = false } = {}) {
  return `<tr data-prov="${esc(r.id)}">
    <td><b class="provl-rad-namn">${esc(r.namn)}</b>${r.amne ? `<span class="hint provl-rad-amne">${esc(r.amne)}</span>` : ""}</td>
    <td class="provl-tal">${r.antal}${r.textblock ? `<span class="hint"> + ${r.textblock} text</span>` : ""}</td>
    <td class="provl-datum">${esc(datumText(r.andrad))}</td>
    ${kollega ? `<td>${esc(r.agare)}</td>` : ""}
    <td class="provl-atgarder">
      ${r.kanAndra ? `<button type="button" class="btn small" data-act="redigera">${icon("pencil", 16)}<span>Redigera</span></button>` : ""}
      <button type="button" class="btn small ghost" data-act="kor">${icon("users", 16)}<span>Kör i klass</span></button>
      <button type="button" class="btn small ghost" data-act="forhand" title="Förhandsvisa som elev" aria-label="Förhandsvisa ${esc(r.namn)} som elev">${icon("eye", 16)}</button>
      <button type="button" class="btn small ghost" data-act="kopia" title="Kopiera" aria-label="Kopiera ${esc(r.namn)}">${icon("copy", 16)}${kollega ? "<span>Kopiera</span>" : ""}</button>
      ${r.kanAndra ? `<button type="button" class="btn small ghost danger" data-act="radera" title="Radera" aria-label="Radera ${esc(r.namn)}">${icon("trash", 16)}</button>` : ""}
    </td>
  </tr>`;
}

const tabell = (rader, { kollega = false } = {}) => `<div class="panel table-scroll"><table class="tbl provl-tbl">
  <thead><tr><th>Namn</th><th>Frågor</th><th>Senast ändrat</th>${kollega ? "<th>Ägare</th>" : ""}<th><span class="sr-only">Åtgärder</span></th></tr></thead>
  <tbody>${rader.map((r) => radHtml(r, { kollega })).join("")}</tbody>
</table></div>`;

export async function renderLista(ctx, host, { meddelande = "" } = {}) {
  host.replaceChildren(el(`<div class="spinner">Laddar proven…</div>`));
  let doks, role;
  try {
    [doks, role] = await Promise.all([listaProv(), myRole()]);
  } catch (err) {
    host.replaceChildren(el(`<p class="err-inline">Proven gick inte att läsa: ${esc(err?.message || err)}</p>`));
    return;
  }
  const { mina, andras } = delaProvlista(doks, role);
  const vy = el(`<div class="provl-lista">
    <div class="provl-msg" aria-live="polite">${meddelande}</div>
    <div class="provl-topp">
      <p class="hint provl-ingress">Prov med blandade frågetyper. Skapa ett prov här och kör det sedan i en klass.
        Frågor som går att rätta automatiskt får ett förslag – du bestämmer.</p>
      <button type="button" class="btn gron small" data-act="ny">${icon("plus", 16)}<span>Nytt prov</span></button>
    </div>
    <div class="provl-mina"></div>
    ${andras.length ? `<details class="panel provl-kollegor"${mina.length ? "" : " open"}>
      <summary><b>Kollegors prov</b> <span class="hint">(${andras.length}) – kör i klass, förhandsvisa eller kopiera</span></summary>
      ${tabell(andras, { kollega: true })}
    </details>` : ""}
  </div>`);

  const minaHost = vy.querySelector(".provl-mina");
  if (mina.length) minaHost.innerHTML = tabell(mina);
  else minaHost.replaceChildren(emptyState(null, {
    icon: "clipboard", title: "Inga prov ännu",
    text: "Skapa ett nytt prov – skriv frågorna själv eller låt en AI föreslå dem.",
  }));

  const go = (q) => ctx.go(`${HASH}?${q}`);
  const msg = vy.querySelector(".provl-msg");
  vy.querySelector('[data-act="ny"]').addEventListener("click", () => go("vy=ny"));
  const alla = [...mina, ...andras];
  vy.querySelectorAll("tr[data-prov]").forEach((tr) => {
    const id = tr.dataset.prov;
    const rad = alla.find((r) => r.id === id);
    const knapp = (act) => tr.querySelector(`[data-act="${act}"]`);
    knapp("redigera")?.addEventListener("click", () => go(`vy=ny&id=${encodeURIComponent(id)}`));
    knapp("kopia").addEventListener("click", () => go(`vy=ny&kopia=${encodeURIComponent(id)}`));
    knapp("forhand").addEventListener("click", async () => {
      const dok = doks.find((d) => d.id === id) || (await hamtaProv(id));
      const { visaForhandsvisning } = await import("./provl-forhandsvisa.js");
      visaForhandsvisning(dok);
    });
    knapp("kor").addEventListener("click", () => korIKlass(ctx, id, msg));
    knapp("radera")?.addEventListener("click", () => fragaRadera(tr, rad, async () => {
      try {
        await raderaProv(id);
        renderLista(ctx, host, { meddelande: `<div class="msg ok">"${esc(rad.namn)}" är raderat.</div>` });
      } catch (err) {
        msg.innerHTML = `<div class="msg error">${esc(felText(err, "Provet kunde inte raderas"))}</div>`;
      }
    }));
  });
  host.replaceChildren(vy);
}

/**
 * Bekräftelsen "Radera provet?" som en ruta på sidan (spec §3: ingen confirm()).
 * Avbryt tar bort rutan; Radera kör `radera()`.
 */
export function raderaRuta(namn, radera) {
  const ruta = el(`<div class="msg warn provl-bekrafta-ruta" role="alertdialog" aria-label="Radera provet">
    <span>Radera provet <b>${esc(namn)}</b>? Det går inte att ångra. Provtillfällen som redan körts finns kvar.</span>
    <span class="provl-knappar">
      <button type="button" class="btn small danger" data-act="ja">${icon("trash", 15)}<span>Radera</span></button>
      <button type="button" class="btn small ghost" data-act="nej">Avbryt</button>
    </span>
  </div>`);
  const ja = ruta.querySelector('[data-act="ja"]');
  ruta.querySelector('[data-act="nej"]').addEventListener("click", () => (ruta.closest(".provl-bekrafta") || ruta).remove());
  ja.addEventListener("click", async () => {
    ja.disabled = true;
    ja.lastElementChild.textContent = "Raderar…";
    await radera();
  });
  return ruta;
}

/** Rutan som en tabellrad direkt under provets rad i listan. */
function fragaRadera(tr, rad, radera) {
  tr.parentElement.querySelector(".provl-bekrafta")?.remove();
  const ny = document.createElement("tr");
  ny.className = "provl-bekrafta";
  const td = document.createElement("td");
  td.colSpan = tr.children.length;
  td.appendChild(raderaRuta(rad.namn, radera));
  ny.appendChild(td);
  tr.after(ny);
  ny.querySelector('[data-act="ja"]').focus();
}
