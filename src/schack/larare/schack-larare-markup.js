// ============================================================================
// Schack – lärarens sektion, markupen (#781). Rena strängfunktioner: modul-
// raden, partilistan med bekräftelserutan, topplistan och statistiktabellen.
// schack-larare.js sätter in dem; inga lyssnare här.
// ============================================================================

import { klockTyp, statistikSumma } from "./schack-larare-delar.js";

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const tid = (ms) => {
  try {
    return new Date(ms).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

const farg = (f) => `<span class="sl-farg sl-farg-${f}" aria-hidden="true"></span>`;

/** Bekräftelserutan på sidan (aldrig confirm()). */
/** Resultatraden efter en handling: { ok, text } | null. */
const resultatHtml = (r) => (r ? `<span class="${r.ok ? "ok-inline" : "err-inline"}">${r.ok ? "✓ " : ""}${esc(r.text)}</span>` : "");

export function bekraftaHtml({ fraga, text, ja, id = "", upptagen = false }) {
  return `<div class="sl-bekrafta msg warn" role="group" aria-label="${esc(fraga)}">
    <p><b>${esc(fraga)}</b> ${esc(text)}</p>
    <div class="row-inline">
      <button type="button" class="btn small danger" data-ja="${esc(id)}"${upptagen ? " disabled" : ""}>${esc(ja)}</button>
      <button type="button" class="btn ghost small" data-nej="1">Avbryt</button>
    </div>
  </div>`;
}

/** Modulraden: på/av för klassen. */
export function modulHtml({ pa, klassNamn, antalPartier = 0, resultat = null }) {
  const text = pa
    ? `<span><b>Schack är på</b> för ${esc(klassNamn)} – eleverna hittar Schack i menyn under Öva.</span>`
    : `<span><b>Schack är av</b> för ${esc(klassNamn)}. Slå på det så hittar eleverna Schack i menyn under Öva.</span>`;
  const varning = !pa && antalPartier
    ? `<p class="hint sl-varning">${antalPartier === 1 ? "Ett parti" : `${antalPartier} partier`} pågår fortfarande men kan inte fortsätta när schack är av – avsluta ${antalPartier === 1 ? "det" : "dem"} gärna nedan.</p>`
    : "";
  return `<p class="sl-modul-text"><span class="sl-prick ${pa ? "pa" : "av"}" aria-hidden="true"></span>${text}</p>${varning}
    <div class="row-inline">
      <button type="button" class="btn small ${pa ? "ghost" : "gron"}" data-modul="${pa ? "av" : "pa"}">${pa ? "Stäng av schack" : "Slå på schack"}</button>
      <span class="sl-modul-resultat" role="status">${resultatHtml(resultat)}</span>
    </div>
    <p class="hint">Samma val finns under Synlighet. Inga pluggmynt delas ut för schack.</p>`;
}

/** Partilistan (pågående); `bekrafta` = partiId vars bekräftelseruta är öppen. */
export function partiListaHtml(rader, { bekrafta = null, vantar = 0, upptagen = null, fel = "" } = {}) {
  const lobby = vantar ? `<p class="hint">${vantar === 1 ? "En elev väntar" : `${vantar} elever väntar`} i lobbyn på en motståndare.</p>` : "";
  const felRad = fel ? `<p class="err-inline sl-fel" role="alert">${esc(fel)}</p>` : "";
  if (!rader.length) return `${felRad}<p class="hint sl-tomt">Inga partier pågår just nu.</p>${lobby}`;
  const li = rader.map((r) => {
    const fraga = `Avsluta partiet mellan ${r.vitNamn} och ${r.svartNamn}?`;
    return `<li class="sl-parti" data-id="${esc(r.id)}">
      <div class="sl-parti-text">
        <span class="sl-parti-namn">${farg("w")}${esc(r.vitNamn)} <span class="sl-mot">mot</span> ${farg("b")}${esc(r.svartNamn)}</span>
        <span class="hint sl-parti-info">${esc(klockTyp(r.klocka))}${r.start ? ` · startade ${esc(tid(r.start))}` : ""}</span>
      </div>
      <div class="sl-parti-knappar">
        <button type="button" class="btn small" data-titta="${esc(r.id)}" aria-label="Titta på partiet ${esc(r.vitNamn)} mot ${esc(r.svartNamn)}">Titta</button>
        <button type="button" class="btn ghost small danger" data-avsluta="${esc(r.id)}"${upptagen === r.id ? " disabled" : ""}>Avsluta</button>
      </div>
      ${bekrafta === r.id ? bekraftaHtml({ fraga, text: "Det räknas som avbrutet – ingen vinner och topplistan påverkas inte.", ja: upptagen === r.id ? "Avslutar…" : "Ja, avsluta", id: r.id, upptagen: upptagen === r.id }) : ""}
    </li>`;
  }).join("");
  return `${felRad}<ul class="sl-partier">${li}</ul>${lobby}`;
}

/** Topplistan som läraren ser den (samma ordning som elevernas). */
export function topplistaHtml(lista, { dold, bekrafta = false, upptagen = false, resultat = null } = {}) {
  const status = dold
    ? `<p class="sl-topp-status"><span class="sl-prick av" aria-hidden="true"></span><span><b>Dold för eleverna.</b> Du ser den, eleverna gör det inte.</span></p>`
    : `<p class="sl-topp-status"><span class="sl-prick pa" aria-hidden="true"></span><span><b>Synlig för eleverna.</b></span></p>`;
  const knappar = `<div class="row-inline">
      <button type="button" class="btn small ghost" data-dold="${dold ? "visa" : "dolj"}"${upptagen ? " disabled" : ""}>${dold ? "Visa för eleverna" : "Dölj för eleverna"}</button>
      <button type="button" class="btn small ghost danger" data-nollstall="1"${upptagen || !lista.length ? " disabled" : ""}>Nollställ topplistan</button>
      <span class="sl-topp-resultat" role="status">${resultatHtml(resultat)}</span>
    </div>`;
  const fraga = bekrafta
    ? bekraftaHtml({ fraga: "Nollställa topplistan?", text: "Alla börjar om på 1000 poäng och räknarna för vinster, förluster, remier och kompispartier töms. Det går inte att ångra.", ja: upptagen ? "Nollställer…" : "Ja, nollställ", id: "nollstall", upptagen })
    : "";
  const tabell = lista.length
    ? `<div class="table-scroll"><table class="tbl sl-tbl">
        <thead><tr><th scope="col">Plats</th><th scope="col">Namn</th><th scope="col">Poäng</th>
          <th scope="col"><abbr title="Vinster">V</abbr></th><th scope="col"><abbr title="Förluster">F</abbr></th><th scope="col"><abbr title="Remier">R</abbr></th></tr></thead>
        <tbody>${lista.map((r) => `<tr><td>${r.plats}</td><td>${esc(r.namn)}</td><td><b>${r.poang}</b></td>
          <td>${r.vinster}</td><td>${r.forluster}</td><td>${r.remier}</td></tr>`).join("")}</tbody></table></div>`
    : `<p class="hint sl-tomt">Ingen har spelat färdigt ett parti mot en kompis än.</p>`;
  return status + knappar + fraga + tabell;
}

/** Statistiken per elev; `dator` null i raderna = inte hämtat än. */
export function statistikHtml(rader, { datorHamtad, hamtar = false, fel = "" } = {}) {
  const summa = statistikSumma(rader);
  const knapp = `<div class="row-inline">
      <button type="button" class="btn small ghost" data-dator="1"${hamtar ? " disabled" : ""}>${hamtar ? "Hämtar…" : datorHamtad ? "Uppdatera partier mot datorn" : "Hämta partier mot datorn"}</button>
      <span class="hint">Läser ett elevdokument per elev (${rader.length} läsningar) – bara när du trycker.</span>
    </div>${fel ? `<p class="err-inline">${esc(fel)}</p>` : ""}`;
  if (!rader.length) return `<p class="hint sl-tomt">Klassen har inga elever.</p>`;
  const d = (v) => (v == null ? `<span class="hint" aria-label="inte hämtat">–</span>` : String(v));
  return `${knapp}<div class="table-scroll"><table class="tbl sl-tbl sl-stat-tbl">
    <thead><tr><th scope="col">Elev</th><th scope="col">Mot kompisar</th><th scope="col">Mot datorn</th><th scope="col">Totalt</th></tr></thead>
    <tbody>${rader.map((r) => `<tr><td>${esc(r.namn)}</td>
      <td>${r.kompis}${r.kompis ? ` <span class="hint sl-vfr">(${r.vinster}–${r.forluster}–${r.remier})</span>` : ""}</td>
      <td>${d(r.dator)}</td><td>${r.dator == null ? d(null) : r.totalt}</td></tr>`).join("")}</tbody>
    <tfoot><tr><th scope="row">Klassen</th><td>${summa.kompis} ${summa.kompis === 1 ? "parti" : "partier"}</td><td>${d(summa.dator)}</td><td></td></tr></tfoot>
  </table></div>
  <p class="hint">Mot kompisar = färdigspelade partier i topplistan (vinster–förluster–remier; nollställs med topplistan,
    avbrutna partier räknas inte). Mot datorn = avslutade partier mot datorn, räknade på elevens dator.</p>`;
}
