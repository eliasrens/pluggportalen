// ============================================================================
// Pluggportalen – områdesnivån (skolan: alla klassers byar, YTTERST i kameran)
// ----------------------------------------------------------------------------
// En zoomnivå OVANFÖR klassbyn (varld-by.js): zoomar man ut ur den egna byn
// hamnar man i "skolan" – en översikt där VARJE klass syns som en liten egen by
// (en klunga generiska hus på en gräsplätt) med klassens namn, ev. by-namn och
// antal hus. Den egna klassen är markerad "Din klass".
//
// INTEGRITET (issue #37): den här nivån läser BARA klass-dokumenten
// (classes-kollektionen, som alla inloggade får läsa enligt firestore.rules) –
// namn, ev. by-fält och studentIds.length (antal hus). Den läser ALDRIG andra
// klassers elever eller deras studentData (avatarer, paletter, framsteg, rum) –
// husen här är rent generiska silhuetter. Ingen privat elevdata exponeras.
//
// Klick på den EGNA klassens by zoomar in till klassbyn (#/elev/by); klick på en
// ANNAN klass zoomar in till dess ÖVERSIKT (varld-grannby.js) – aldrig in i
// enskilda elevers rum.
//
// Modulen är ren layout-matte + generisk by-art + rendering; klick-hanteringen
// kopplas av pages-varld.js via .omrade-by[data-id].
// ============================================================================

/** Kamerazoom skola → by (en klass-by fyller ~1/5 av skolan → zoom ≈ 5). */
export const OMRADE_ZOOM = 5;

/** Minimal HTML-escape för klassnamn/by-namn/id:n som kommer från Firestore. */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/**
 * Deterministisk kulör (0–359) per klass, så varje by får en igenkännbar färg –
 * bara kosmetiskt, härlett ur klassens PUBLIKA fält (id/namn/order).
 */
export function hueForKlass(c) {
  const s = String(c?.id || c?.name || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return (h + (Number(c?.order) || 0) * 40) % 360;
}

/**
 * Placera N klass-byar i ett centrerat rutnät (procent av lagret, samma
 * konvention som kamerans fokuspunkter). Max 4 per rad; en ofull sista rad
 * centreras.
 * @param {number} antal
 * @returns {{platser:Array<{x:number,y:number}>, cellW:number, cellH:number}}
 */
export function omradeLayout(antal) {
  const n = Math.max(1, antal);
  const kol = Math.min(4, Math.ceil(Math.sqrt(n)));
  const rader = Math.ceil(n / kol);
  const margX = 12;
  const margY = 15;
  const cellW = (100 - margX * 2) / kol;
  const cellH = (100 - margY * 2) / rader;
  const platser = [];
  for (let i = 0; i < n; i++) {
    const rad = Math.floor(i / kol);
    const paRad = Math.min(kol, n - rad * kol);
    const k = i % kol;
    const x = margX + cellW * (k + 0.5) + (cellW * (kol - paRad)) / 2;
    const y = margY + cellH * (rad + 0.5);
    platser.push({ x, y });
  }
  return { platser, cellW, cellH };
}

/** Ett generiskt litet hus (inga elevfärger/avatarer) i by-silhuetten. */
function husSvg(x, y, w, hue) {
  const bh = w * 0.62;
  const topp = y - bh;
  const f = (n) => n.toFixed(1);
  const wall = `hsl(${hue} 58% 74%)`;
  const roof = `hsl(${hue} 48% 46%)`;
  const dorr = `hsl(${hue} 42% 40%)`;
  return `<g stroke="#3b3350" stroke-width="1.1" stroke-linejoin="round">
    <rect x="${f(x - w / 2)}" y="${f(topp)}" width="${f(w)}" height="${f(bh)}" rx="1.5" fill="${wall}"/>
    <path d="M${f(x - w * 0.62)} ${f(topp)} L${f(x)} ${f(topp - w * 0.5)} L${f(x + w * 0.62)} ${f(topp)} Z" fill="${roof}"/>
    <rect x="${f(x - w * 0.14)}" y="${f(y - bh * 0.5)}" width="${f(w * 0.28)}" height="${f(bh * 0.5)}" fill="${dorr}" stroke="none"/>
  </g>`;
}

/**
 * En klass-by som generisk silhuett: en gräsplätt med `antal` små hus (visuellt
 * kapat till `max` – etiketten bär det exakta antalet). INGEN elevdata, bara
 * antal hus + en kulör.
 * @param {number} antal  antal elever (= antal hus)
 * @param {number} hue    kulör (hueForKlass)
 * @param {number} [max]  hur många hus som ritas (default 5)
 */
export function byMiniSvg(antal, hue, max = 5) {
  const n = Math.max(1, Math.min(max, Math.round(antal) || 1));
  const rad2 = n > 4 ? Math.floor(n / 2) : 0;
  const rad1 = n - rad2;
  const husar = [];
  const w = rad2 ? 15 : 17;
  const radHus = (count, y) => {
    for (let i = 0; i < count; i++) {
      const x = 50 + (i - (count - 1) / 2) * (w + 3);
      husar.push(husSvg(x, y, w, (hue + (i % 3) * 5) % 360));
    }
  };
  radHus(rad1, rad2 ? 48 : 56);
  if (rad2) radHus(rad2, 62);
  return `<svg viewBox="0 0 100 70" preserveAspectRatio="xMidYMid meet"
      aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="62" rx="47" ry="11" fill="#8FCB74"/>
    <ellipse cx="50" cy="60" rx="43" ry="9" fill="#A8DA8F"/>
    ${husar.join("")}
  </svg>`;
}

/**
 * Rita områdesnivån (skolan) i `lager`: en gräsyta med en klass-by per klass.
 *
 * @param {object} o
 * @param {HTMLElement} o.lager       skol-lagret (töms och fylls)
 * @param {string|null} o.meClassId   den egna klassens id (märks "Din klass")
 * @param {Array<{id:string, name?:string, by?:string, order?:number,
 *   studentIds?:string[]}>} o.classes  alla klasser (från classes-kollektionen)
 * @returns {{fokus:{x:number,y:number}, fokusById:Record<string,{x:number,y:number}>}}
 *   kamerafokus (den egna byn) + en karta klass-id → byfokus (grannby-nivån
 *   zoomar mot en klickad klass by).
 */
export function mountOmradeScen({ lager, meClassId, classes }) {
  const lista = Array.isArray(classes) ? classes : [];
  const layout = omradeLayout(lista.length || 1);

  // Marken: himmelsrand + gräs (samma stämning som klassbyns mark).
  const mark = `<svg class="omrade-mark" viewBox="0 0 100 100" preserveAspectRatio="none"
      aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
    <rect x="-2" y="-2" width="104" height="104" fill="#A8DA8F"/>
    <ellipse cx="28" cy="30" rx="24" ry="10" fill="#B4E19B" opacity="0.55"/>
    <ellipse cx="76" cy="66" rx="26" ry="11" fill="#B4E19B" opacity="0.5"/>
    <ellipse cx="46" cy="90" rx="20" ry="8" fill="#9ED584" opacity="0.5"/>
    <rect x="-2" y="-2" width="104" height="10" fill="#9AD3F0"/>
    <path d="M-2 8 Q25 6 50 8 Q75 10 102 7.5 L102 11 L-2 11 Z" fill="#8FCB74"/>
  </svg>`;

  const byar = lista
    .map((c, i) => {
      const p = layout.platser[i];
      if (!p) return "";
      const me = c.id === meClassId;
      const antal = Array.isArray(c.studentIds) ? c.studentIds.length : 0;
      const hue = hueForKlass(c);
      const namn = esc(c.name || c.id);
      const by = esc(c.by || "");
      const etikett = `${namn}${by ? ` · ${by}` : ""}`;
      const aria = me
        ? `Din klass ${namn} – zooma in till er by`
        : `Klass ${namn}${by ? `, ${by}` : ""}, ${antal} hus – titta på deras by`;
      return `<div class="omrade-by${me ? " du" : ""}" role="button" tabindex="0"
        data-id="${esc(c.id)}"${me ? ` data-me="1"` : ""} aria-label="${aria}"
        style="left:${p.x.toFixed(2)}%;top:${p.y.toFixed(2)}%;width:${layout.cellW.toFixed(2)}%;height:${layout.cellH.toFixed(2)}%">
        ${me ? '<span class="omrade-du">Din klass</span>' : ""}
        <div class="omrade-by-hus">${byMiniSvg(antal, hue)}</div>
        <span class="omrade-by-namn">${etikett} <b>${antal} 🏠</b></span>
      </div>`;
    })
    .join("");

  lager.innerHTML = mark + byar;

  const fokusById = {};
  lista.forEach((c, i) => {
    const p = layout.platser[i];
    if (p) fokusById[c.id] = { x: p.x, y: p.y };
  });
  const meP =
    (meClassId && fokusById[meClassId]) || layout.platser[0] || { x: 50, y: 50 };
  return { fokus: { x: meP.x, y: meP.y }, fokusById };
}
