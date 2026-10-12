// ============================================================================
// Hitta rätt! – startsidans HTML (src/hitta-ratt/hr-start-vy.js) · #605
// ----------------------------------------------------------------------------
// Ren modul (ingen DOM, inget Firebase) så att den kan testas i Node.
// Spec §23: kort per kategori (Sverige, Europa, Världen, Kända platser). Varje
// kort: namn, ikon, typ, antal frågor, svårighet (§15), diskret personbästa och
// "Spela". Inga topplistor på sidan – bara en 🏆-knapp (§22). Inget är låst.
// Lärarens egna pack (#633, arkitektur §11.3) visas FÖRST i gruppen "Från din
// lärare" med packens egen ikon och taggen "Egen karta" i stället för
// svårighet. Personbästa visas bara om det gäller packens nuvarande version.
// ============================================================================

/** Kategorierna i visningsordning (packens `category` i index.json). */
export const KATEGORIER = [
  { id: "sverige", namn: "Sverige", ikon: "🌲" }, // inte 🇸🇪: Windows ritar flaggor som "SE"
  { id: "europa", namn: "Europa", ikon: "🏰" },
  { id: "varlden", namn: "Världen", ikon: "🌍" },
  { id: "kanda-platser", namn: "Kända platser", ikon: "🗼" },
];

/** Gruppen för lärarens egna pack (hr-egna.js egnaForElev). */
export const EGNA_KATEGORI = { id: "egna", namn: "Från din lärare", ikon: "🧑‍🏫" };

/** Svårighet (§15): grön/gul/röd. Okänd nivå visas som Medel. */
export const SVARIGHET = {
  grund: { namn: "Grund", farg: "gron" },
  medel: { namn: "Medel", farg: "gul" },
  utmaning: { namn: "Utmaning", farg: "rod" },
};

/** Typ (§3): punkt = sätt en nål, område = klicka på rätt land/landskap. */
export const TYP = {
  point: { namn: "Punkt", ikon: "📍", hint: "Sätt nålen" },
  area: { namn: "Område", ikon: "🗺️", hint: "Klicka på området" },
};

/** Packens egen ikon (lite variation inom kategorin). */
export const PACK_IKON = {
  "sverige-stader": "🏙️", "sverige-landskap": "🌲", "sverige-lan": "🧭", "sverige-geografi": "⛰️",
  "europa-lander-20": "🗺️", "europa-lander-alla": "🗺️",
  "europa-huvudstader-20": "🏛️", "europa-huvudstader-alla": "🏛️",
  "varlden-lander-30": "🌎", "varlden-huvudstader-30": "🏙️",
  "europa-kanda-platser": "🏰", "varlden-kanda-platser": "🗽",
};

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

/**
 * Tid i tiondelar av sekunder → "1:58" (aktiv tid, §11), som ett stoppur
 * (påbörjad sekund räknas inte). `medTiondelar` → "1:58,4" – topplistan
 * använder det när två rader annars ser lika ut (arkitektur §3.3).
 */
export function formatTid(tiondelar, medTiondelar = false) {
  const t = Math.max(0, Math.round(Number(tiondelar) || 0));
  const sek = Math.floor(t / 10);
  const mss = `${Math.floor(sek / 60)}:${String(sek % 60).padStart(2, "0")}`;
  return medTiondelar ? `${mss},${t % 10}` : mss;
}

/**
 * Personbästa som kort text, eller "" om eleven inte spelat packen.
 * Formatet i hittaRattBest/{uid}.packs[packId] (arkitektur §3.2):
 * punkt { s, max } · område { r, t, max }.
 */
export function formatBast(b, pack) {
  if (!b || typeof b !== "object") return "";
  const typ = b.typ || pack?.type;
  if (typ === "area") {
    if (!Number.isFinite(b.r)) return "";
    const max = Number.isFinite(b.max) ? b.max : pack?.antal;
    const tid = Number.isFinite(b.t) ? ` · ${formatTid(b.t)}` : "";
    return `${b.r}/${max} rätt${tid}`;
  }
  return Number.isFinite(b.s) ? `${b.s} p` : "";
}

/** Gruppera packen per kategori i KATEGORIER-ordning (tomma kategorier bort). */
export function grupperaPack(index) {
  const lista = Array.isArray(index) ? index : [];
  return KATEGORIER.map((k) => ({ ...k, pack: lista.filter((p) => p.category === k.id) }))
    .filter((k) => k.pack.length > 0);
}

/** Ett packkort. `bast` = elevens post för packen (eller undefined). */
export function packKortHtml(p, bast) {
  const sv = SVARIGHET[p.difficulty] || SVARIGHET.medel;
  const typ = TYP[p.type] || TYP.point;
  const b = formatBast(p.egen && bast?.v !== p.version ? null : bast, p); // gammal version = inget rekord
  const niva = p.egen
    ? '<span class="hr-tagg hr-egen-tagg">Egen karta</span>'
    : `<span class="hr-tagg hr-niva hr-niva-${sv.farg}"><span class="hr-prick" aria-hidden="true"></span>${sv.namn}</span>`;
  return `<article class="hr-kort" data-pack="${esc(p.id)}">
    <div class="hr-kort-topp">
      <span class="hr-kort-ikon" aria-hidden="true">${p.egen ? esc(p.ikon) : PACK_IKON[p.id] || typ.ikon}</span>
      <h3 class="hr-kort-namn">${esc(p.title)}</h3>
    </div>
    <div class="hr-kort-meta">
      <span class="hr-tagg hr-typ" title="${typ.hint}">${typ.ikon} ${typ.namn}</span>
      <span class="hr-tagg">${Number(p.antal) || 0} frågor</span>
      ${niva}
    </div>
    <p class="hr-kort-bast">${b ? `Ditt bästa: <b>${esc(b)}</b>` : "&nbsp;"}</p>
    <button class="btn gron hr-spela" data-pack="${esc(p.id)}" aria-label="Spela ${esc(p.title)}">Spela</button>
  </article>`;
}

/**
 * Hela startsidan.
 * @param {Array} index  packs/index.json
 * @param {Record<string, object>} bast  hittaRattBest/{uid}.packs ({} om inget)
 * @param {Array} egna  lärarens pack för elevens klasser (hr-egna.js egnaForElev)
 */
export function startsidaHtml(index, bast = {}, egna = []) {
  const grupper = grupperaPack(index);
  if (Array.isArray(egna) && egna.length) grupper.unshift({ ...EGNA_KATEGORI, pack: egna });
  const sektioner = grupper.map((k) => `<section class="hr-kategori" aria-labelledby="hr-kat-${k.id}">
      <h2 class="hr-kategori-namn" id="hr-kat-${k.id}"><span aria-hidden="true">${k.ikon}</span> ${k.namn}</h2>
      <div class="hr-kort-grid">${k.pack.map((p) => packKortHtml(p, bast?.[p.id])).join("")}</div>
    </section>`).join("");
  return `<div class="hr-start">
    <div class="panel hr-huvud">
      <div class="hr-huvud-text">
        <h1>Hitta rätt! 🗺️</h1>
        <p class="hint">Välj en karta och visa var platserna ligger. Spela hur många gånger du vill!</p>
      </div>
      <button class="btn hr-topplistor-knapp">🏆 Topplistor</button>
    </div>
    ${sektioner || '<p class="hint">Inga kartor ännu.</p>'}
  </div>`;
}
