// ============================================================================
// Hitta rätt! – topplistornas HTML (src/hitta-ratt/hr-topplista-vy.js) · #609
// ----------------------------------------------------------------------------
// Ren modul (ingen DOM, inget Firebase) så att den kan testas i Node.
// Spec §21–§22: bara HELA SKOLAN (ingen klasslista), Top 15, elevens egen rad
// under listan om eleven står utanför (aldrig dubbelt), klass direkt efter namnet.
//
//   radText(rad, typ, max, tiondelar?)  "Omar, 5E – 1943 p"
//                                       "Omar, 5E – 44/44 rätt – 1:39"
//   topplistaHtml(lista, max)           listan + egen rad – delas med
//                                       resultatskärmen (E #608), som får
//                                       samma { top, egen, plats, antal } av
//                                       hittaRattSubmit
//   topplisteGrupper(index, egna)       🏆-vyns grupper: "Från din lärare" (egna
//                                       pack med skoltopplistan PÅ, #635) först,
//                                       sedan officiella pack med topplista
//   topplistorVyHtml(grupper, valt, lista?)  🏆-vyn: välj pack + listan
// Raderna: { plats, n, k, s | r,t, jag? } (delat/rank.js topplista()).
// ============================================================================

import { EGNA_KATEGORI, esc, formatTid, grupperaPack } from "./hr-start-vy.js";

const MEDALJ = { 1: "🥇", 2: "🥈", 3: "🥉" };

/** Resultatdelen: "1943 p" · "44/44 rätt – 1:39". Punkt visar ALDRIG tid (§8). */
export function resultatText(rad, typ, max, tiondelar = false) {
  if (typ === "area") {
    const av = Number.isFinite(max) ? `/${max}` : "";
    return `${rad.r ?? 0}${av} rätt – ${formatTid(rad.t, tiondelar)}`;
  }
  return `${rad.s ?? 0} p`;
}

export function radText(rad, typ, max, tiondelar = false) {
  return `${rad.n || "Elev"}, ${rad.k || "?"} – ${resultatText(rad, typ, max, tiondelar)}`;
}

/** Områdesrader vars m:ss krockar med en annan rads får tiondelar (arkitektur §3.3). */
function tiondelsRader(rader, typ) {
  if (typ !== "area") return new Set();
  const per = new Map();
  for (const r of rader) {
    const k = formatTid(r.t);
    per.set(k, [...(per.get(k) || []), r]);
  }
  const ut = new Set();
  for (const grupp of per.values()) {
    if (grupp.length > 1 && new Set(grupp.map((r) => r.t)).size > 1) grupp.forEach((r) => ut.add(r));
  }
  return ut;
}

function radHtml(rad, typ, max, tiondelar, extraKlass = "") {
  const medalj = MEDALJ[rad.plats];
  return `<li class="hr-tl-rad${rad.jag ? " hr-tl-jag" : ""}${extraKlass}">
      <span class="hr-tl-plats${medalj ? " hr-tl-medalj" : ""}" aria-label="Plats ${rad.plats}">${medalj ? `${medalj}<span class="hr-sr">${rad.plats}.</span>` : `${rad.plats}.`}</span>
      <span class="hr-tl-namn">${esc(rad.n || "Elev")}, ${esc(rad.k || "?")}${rad.jag ? ' <span class="hr-tl-du">du</span>' : ""}</span>
      <span class="hr-tl-res">– ${esc(resultatText(rad, typ, max, tiondelar))}</span>
    </li>`;
}

/**
 * Top 15 + egen rad.
 * @param {{ typ: string, top: object[], egen: object|null, plats: number|null, antal: number }} lista
 * @param {number|null} max  antal frågor (område) – för "44/44"
 */
export function topplistaHtml(lista, max = null) {
  const typ = lista?.typ === "area" ? "area" : "point";
  const top = Array.isArray(lista?.top) ? lista.top : [];
  if (!top.length) {
    return `<p class="hr-tl-tom">Ingen har spelat den här kartan ännu – bli först på skolan!</p>`;
  }
  const tiondel = tiondelsRader([...top, ...(lista.egen ? [lista.egen] : [])], typ);
  const rader = top.map((r) => radHtml(r, typ, max, tiondel.has(r))).join("");
  const egen = lista.egen
    ? `<ol class="hr-tl-rader hr-tl-egen" aria-label="Din plats">${radHtml(lista.egen, typ, max, tiondel.has(lista.egen))}</ol>`
    : "";
  return `<ol class="hr-tl-rader" aria-label="Topp ${top.length} på skolan">${rader}</ol>
    ${egen ? `<div class="hr-tl-glapp" aria-hidden="true">⋯</div>${egen}` : ""}`;
}

/** "Ditt rekord" + plats, eller en uppmuntran om eleven inte spelat. */
export function egenSammanfattning(lista, max = null) {
  const typ = lista?.typ === "area" ? "area" : "point";
  const min = lista?.egen || (lista?.top || []).find((r) => r.jag);
  if (!min) return `<p class="hr-tl-mitt hint">Du har inte spelat den här kartan än.</p>`;
  return `<p class="hr-tl-mitt">Ditt rekord: <b>${esc(resultatText(min, typ, max))}</b> · Plats <b>${min.plats}</b> av ${lista.antal} på skolan</p>`;
}

/**
 * Grupperna i 🏆-vyn (arkitektur §11.5). `egna` = hr-egna.js egnaForElev (redan
 * filtrerade på elevens klasser) – bara de med topplistan PÅ visas. Ett pack
 * som slagits AV finns alltså inte i vyn, inte ens via en gammal länk.
 */
export function topplisteGrupper(index, egna = []) {
  const grupper = grupperaPack((Array.isArray(index) ? index : []).filter((x) => x.leaderboard !== false));
  const mina = (Array.isArray(egna) ? egna : []).filter((p) => p?.egen && p.leaderboard === true);
  return mina.length ? [{ ...EGNA_KATEGORI, pack: mina }, ...grupper] : grupper;
}

/**
 * Hela 🏆-vyn.
 * @param {Array<{ id, namn, ikon, pack: Array<{ id, title, type, antal }> }>} grupper  pack med topplista per kategori
 * @param {string|null} valt  valt packId
 * @param {object|null} lista  hamtaTopplista(valt) – null medan den laddas
 */
export function topplistorVyHtml(grupper, valt, lista = null) {
  const alla = grupper.flatMap((g) => g.pack);
  const pack = alla.find((p) => p.id === valt) || null;
  const val = grupper.map((g) => `<div class="hr-tl-grupp">
      <h2 class="hr-tl-grupp-namn"><span aria-hidden="true">${g.ikon}</span> ${esc(g.namn)}</h2>
      <div class="hr-tl-knappar">${g.pack.map((p) => `<button class="hr-tl-pack" data-pack="${esc(p.id)}" aria-pressed="${p.id === valt}">${esc(p.title)}</button>`).join("")}</div>
    </div>`).join("");
  let innehall;
  if (!pack) innehall = `<p class="hint hr-tl-tom">Välj en karta för att se skolans topplista.</p>`;
  else if (!lista) innehall = `<p class="hint hr-tl-tom">Laddar topplistan…</p>`;
  else if (lista.fel) innehall = `<p class="hr-tl-tom">${esc(lista.fel)}</p>`;
  else innehall = egenSammanfattning(lista, pack.antal) + topplistaHtml(lista, pack.antal);
  return `<div class="hr-topplistor">
    <div class="panel hr-huvud">
      <div class="hr-huvud-text">
        <h1>🏆 Topplistor</h1>
        <p class="hint">Hela skolans bästa – varje elevs personbästa räknas.</p>
      </div>
      <button class="btn hr-tillbaka" data-act="tillbaka">← Till kartorna</button>
    </div>
    <div class="hr-tl-layout">
      <nav class="panel hr-tl-val" aria-label="Välj karta">${val || '<p class="hint">Inga topplistor ännu.</p>'}</nav>
      <section class="panel hr-tl-lista" aria-live="polite">
        ${pack ? `<h2 class="hr-tl-rubrik">${esc(pack.title)}</h2><p class="hint hr-tl-regel">${pack.type === "area" ? "Flest rätt först – vid lika antal rätt vinner kortast tid." : "Högst poäng vinner. Lika poäng = delad plats."}</p>` : ""}
        ${innehall}
      </section>
    </div>
  </div>`;
}
