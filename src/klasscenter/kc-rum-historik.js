// ============================================================================
// Klasscentrets rum – Historik/Återställ-panelen (#490, epic #475).
// ----------------------------------------------------------------------------
// Laddas bara dynamiskt (via kc-rum-vy.js, #271). Listar de senaste ~10
// sparningarna (listHistory, nyast först): "när" för alla, "vem" bara för
// läraren (elevernas namn läses inte för klasskamrater). Återställ = en NY
// version (restoreLayout), så även en återställning kan ångras härifrån.
// ============================================================================

const MANAD = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function tillDate(t) {
  if (!t) return null;
  if (typeof t.toDate === "function") return t.toDate();
  if (t instanceof Date) return t;
  const ms = typeof t === "number" ? t : typeof t.seconds === "number" ? t.seconds * 1000 : NaN;
  return Number.isFinite(ms) ? new Date(ms) : null;
}

/** "idag 14:05" / "igår 09:30" / "3 okt 14:05" (saknas → "nyss"). */
export function narText(t, nu = new Date()) {
  const d = tillDate(t);
  if (!d) return "nyss";
  const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const dag = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((dag(nu) - dag(d)) / 86400000);
  if (diff === 0) return `idag ${hhmm}`;
  if (diff === 1) return `igår ${hhmm}`;
  return `${d.getDate()} ${MANAD[d.getMonth()]} ${hhmm}`;
}

/**
 * En rad i listan (ren sträng – testas i Node).
 * @param {{slot:number, version:number, savedBy:string|null, savedAt:any,
 *   placedItems:object}} post
 * @param {{aktuell:boolean, vem?:string, nu?:Date}} o
 */
export function historikRadHtml(post, { aktuell = false, vem = "", nu } = {}) {
  const antal = Object.keys(post.placedItems || {}).length;
  const saker = antal === 1 ? "1 sak" : `${antal} saker`;
  return `<li class="kc-historik-rad${aktuell ? " aktuell" : ""}">
    <span class="kc-historik-info"><b>${esc(narText(post.savedAt, nu))}</b>
      <span>${saker}${vem ? ` · ${esc(vem)}` : ""}</span></span>
    ${aktuell
      ? `<span class="kc-historik-nu">Visas nu</span>`
      : `<button type="button" class="varld-knapp kc-historik-btn" data-slot="${post.slot}">↩ <span>Återställ</span></button>`}
  </li>`;
}

/**
 * Fyll historik-panelens lista. Returnerar ett löfte (listan hämtas färskt
 * varje gång panelen öppnas – historiken ändras när någon sparar).
 * @param {object} o
 * @param {HTMLElement} o.lista   <ul>
 * @param {HTMLElement} o.hint
 * @param {() => Promise<Array>} o.hamta   listHistory(classId)
 * @param {() => number} o.aktuellVersion
 * @param {boolean} o.visaVem     läraren ser vem som sparade
 * @param {(uids:string[]) => Promise<Map<string,string>>} [o.namnFor]
 */
export async function ritaHistorik({ lista, hint, hamta, aktuellVersion, visaVem, namnFor }) {
  lista.innerHTML = "";
  hint.textContent = "Hämtar tidigare versioner…";
  let poster;
  try {
    poster = await hamta();
  } catch (err) {
    console.warn("[klasscenter] historik", err?.code || err);
    hint.textContent = "Historiken gick inte att hämta just nu.";
    return;
  }
  if (!poster.length) {
    hint.textContent = "Ingen har sparat rummet än – historiken fylls på när klassen sparar.";
    return;
  }
  let namn = new Map();
  if (visaVem && namnFor) {
    try {
      namn = await namnFor([...new Set(poster.map((p) => p.savedBy).filter(Boolean))]);
    } catch { /* namnen är en bonus */ }
  }
  hint.textContent = "De senaste sparningarna. Återställ lägger tillbaka en tidigare version – den blir en ny sparning, så den går att ångra.";
  const nu = aktuellVersion();
  lista.innerHTML = poster.map((p) => historikRadHtml(p, {
    aktuell: p.version === nu,
    vem: visaVem ? namn.get(p.savedBy) || (p.savedBy ? "okänd" : "") : "",
  })).join("");
}
