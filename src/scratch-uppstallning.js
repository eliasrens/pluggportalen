// ============================================================================
// Pluggporten – kladdytans UPPSTÄLLNING (scratch-uppstallning.js, issue #392)
// ----------------------------------------------------------------------------
// En TOM rutmall för uppställning (lodrät räkning) som läggs på ritytan från
// knappsatsens "Uppställning"-knapp. Eleven ställer SJÄLV upp talen – mallen
// förifylls aldrig med uppgiftens tal (Elias beslut). Rader uppifrån:
//   • minnessiffror (små rutor)   • tal 1   • räknesätt + tal 2
//   • ett streck                  • svar
// 5 kolumner från start; chipet "+ kolumn" (överst, så det inte kan förväxlas med
// räknesättet) lägger till en kolumn till VÄNSTER (talen växer åt vänster). En
// siffra – eller decimalkomma, som tar en egen kolumn – per ruta.
//
// Räknesätt (+ − × ÷, från knappsatsen eller tangentbordet) i en sifferruta
// hamnar i mallens räknesättsruta. Står man i tal 1 går markören vidare till
// första tomma rutan i tal 2 (man har skrivit "347 +" och fortsätter med nästa
// tal); annars stannar den där man var (t.ex. i svarsraden).
//
// Markören hoppar automatiskt efter varje siffra. Riktning per rad:
//   • talraderna → åt HÖGER: man skriver ett tal som man läser det ("347" = 3,4,7).
//   • minnes- och svarsraden ← åt VÄNSTER: uppställningen räknas från entalen och
//     uppåt (ental, tiotal, hundratal …), så nästa svarssiffra hamnar till vänster.
// Backsteg i en tom ruta går ett steg bakåt (mot skrivriktningen) och tömmer den
// rutan; piltangenterna flyttar fritt i rutnätet (fysiskt tangentbord).
//
// Mallen placeras i PROCENT av ytan (som textlapparna i scratch-text.js) så den
// följer med vid förstora/förminska. I rit-lägena släpper mallen igenom pekaren
// (CSS, som lapparna) och är genomskinlig → man RITAR rakt över den och strecken
// syns. Suddet suddar bara bläck; mallen tas bort med Rensa eller sin ×-knapp
// (synlig i Text-läget). HELT FLYKTIG: finns bara i DOM:en, sparas ALDRIG.
//
// Samma pad-gränssnitt ({setTool, clear, resize, destroy} + setKeypad) så
// createScratchCard når lagret via sin pads-lista.
//
// BOOT-SÄKERHET: import-fri, laddas bara via scratchpad.js som i sin tur bara nås
// dynamiskt (games-rakna.js / adventure/generator-modal.js). Får ALDRIG statiskt
// importeras av en bootfil (jfr #271/#290).
// ============================================================================

const START_COLS = 5;
const MAX_COLS = 9;
const ROW_MEM = 0, ROW_A = 1, ROW_B = 2, ROW_SUM = 3;
// Skrivriktning per rad: +1 = åt höger, -1 = åt vänster (se kommentaren ovan).
const DIR = [-1, 1, 1, -1];
const ROW_NAMES = ["Minnessiffra", "Tal 1", "Tal 2", "Svar"];
const DIGIT_RE = /[0-9,]/;
// Räknesätten – fysiskt tangentbord ger -, *, x, /, : → skrivs som riktiga tecken.
const OP_MAP = { "+": "+", "-": "−", "−": "−", "*": "×", "x": "×", "X": "×", "×": "×", "/": "÷", ":": "÷", "÷": "÷" };

/**
 * Koppla uppställnings-lagret på `surface` (ritytans behållare, position:relative).
 * @param {HTMLElement} surface
 * @param {{document?:Document}} [opts]
 */
export function attachUppstallning(surface, opts = {}) {
  // Globala document först: kort byggda ur ui.js el() har ett inert ownerDocument.
  const doc = opts.document || (typeof document !== "undefined" ? document : surface.ownerDocument);
  const layer = doc.createElement("div");
  layer.className = "scratch-uppst-layer";
  surface.appendChild(layer);

  let keypadOpen = false;
  let box = null; // mallens rot-element (null = ingen mall)
  let gridEl = null;
  let addBtn = null;
  let cols = START_COLS;
  let cells = []; // cells[rad][kolumn] – kolumn 0 = räknesättets kolumn (bara rad B)

  const allCells = () => cells.flat().filter(Boolean);

  function applyInputMode(cell) {
    // Knappsatsen öppen → inget skärmtangentbord; annars sifferbordet (räknesätts-
    // rutan får vanligt bord, där finns + − osv.).
    cell.setAttribute("inputmode", keypadOpen ? "none" : cell.dataset.op ? "text" : "numeric");
  }

  function makeCell(r, c) {
    const cell = doc.createElement("input");
    cell.type = "text";
    cell.className = r === ROW_MEM ? "uppst-cell uppst-mem" : c === 0 ? "uppst-cell uppst-op" : "uppst-cell";
    cell.dataset.r = String(r);
    cell.dataset.c = String(c);
    if (c === 0) cell.dataset.op = "1";
    cell.setAttribute("autocomplete", "off");
    cell.setAttribute("autocorrect", "off");
    cell.setAttribute("autocapitalize", "off");
    cell.setAttribute("spellcheck", "false");
    cell.setAttribute("enterkeyhint", "next");
    cell.setAttribute("aria-label", c === 0 ? "Räknesätt" : `${ROW_NAMES[r]}, kolumn ${c}`);
    cell.style.gridRow = String(r === ROW_SUM ? r + 2 : r + 1); // +1 rad för strecket
    cell.style.gridColumn = String(c + 1);
    applyInputMode(cell);
    cell.addEventListener("focus", () => onFocus(cell));
    cell.addEventListener("input", () => onInput(cell));
    cell.addEventListener("keydown", (e) => onKey(e, cell));
    return cell;
  }

  const posOf = (cell) => [Number(cell.dataset.r), Number(cell.dataset.c)];
  const at = (r, c) => (cells[r] && cells[r][c]) || null;

  function focusCell(cell) {
    if (!cell) return;
    try { cell.focus({ preventScroll: true }); } catch { cell.focus(); }
  }

  function onFocus(cell) {
    // Markera innehållet → nästa siffra ERSÄTTER den gamla (en siffra per ruta).
    try { cell.select(); } catch {}
  }

  function onInput(cell) {
    const v = String(cell.value || "");
    // Det nyss skrivna tecknet sitter strax före markören; annars sista giltiga.
    const pos = typeof cell.selectionStart === "number" ? cell.selectionStart : v.length;
    const valid = (ch) => (cell.dataset.op ? OP_MAP[ch] : DIGIT_RE.test(ch) ? ch : "");
    const typed = v.charAt(pos - 1) || "";
    let ch = valid(typed);
    if (!ch) for (let i = v.length - 1; i >= 0 && !ch; i--) ch = valid(v.charAt(i));
    cell.value = ch || "";
    const [r, c] = posOf(cell);
    // Skärmtangentbord utan keydown-tecken (Android): räknesätt hamnar här i stället.
    if (!cell.dataset.op && OP_MAP[typed]) { setOperator(OP_MAP[typed], r); return; }
    if (!ch || cell.dataset.op) return;
    const next = at(r, c + DIR[r]);
    if (next && !next.dataset.op) focusCell(next);
  }

  function onKey(e, cell) {
    const [r, c] = posOf(cell);
    if (e.key === "Enter") { e.preventDefault(); return; } // skickar ALDRIG svarsformuläret
    // Tecken-tangenter avgörs HÄR (före input), annars skulle ett ogiltigt tecken
    // ersätta den markerade siffran. Gäller fysiskt tangentbord OCH knappsatsen
    // (som skickar keydown före varje tecken).
    if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const op = OP_MAP[e.key];
      if (cell.dataset.op) {
        e.preventDefault();
        if (op) cell.value = op;
        return;
      }
      if (op) { e.preventDefault(); setOperator(op, r); return; }
      if (!DIGIT_RE.test(e.key)) { e.preventDefault(); return; }
    }
    if (e.key === "Backspace" && !cell.value) {
      // Tom ruta: ett steg bakåt (mot skrivriktningen) och töm den.
      const prev = at(r, c - DIR[r]);
      if (prev && !prev.dataset.op) { e.preventDefault(); prev.value = ""; focusCell(prev); }
      return;
    }
    const moves = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
    const m = moves[e.key];
    if (!m) return;
    const [dr, dc] = m;
    let nr = r + dr;
    // Upp/ner hoppar över rader som saknar ruta i kolumnen (räknesättets kolumn).
    while (dr && nr >= ROW_MEM && nr <= ROW_SUM && !at(nr, c + dc)) nr += dr;
    const target = at(nr, c + dc);
    if (target) { e.preventDefault(); focusCell(target); }
  }

  // Räknesätt skrivet i en sifferruta → till räknesättsrutan (se filhuvudet).
  function setOperator(op, fromRow) {
    const opCell = at(ROW_B, 0);
    if (!opCell) return;
    opCell.value = op;
    if (fromRow !== ROW_A) return;
    const next = cells[ROW_B].find((c) => c && !c.dataset.op && !c.value);
    if (next) focusCell(next);
  }

  // Bygg rutnätet från `values` (bevarar innehåll när en kolumn läggs till).
  function build(values) {
    const grid = gridEl;
    while (grid.firstChild) grid.removeChild(grid.firstChild);
    grid.style.setProperty("--uppst-cols", String(cols + 1));
    cells = [];
    for (let r = ROW_MEM; r <= ROW_SUM; r++) {
      cells[r] = [];
      for (let c = 0; c <= cols; c++) {
        if (c === 0 && r !== ROW_B) { cells[r][c] = null; continue; }
        const cell = makeCell(r, c);
        cell.value = (values && values[r] && values[r][c]) || "";
        cells[r][c] = cell;
        grid.appendChild(cell);
      }
    }
    const line = doc.createElement("div");
    line.className = "uppst-line";
    line.style.gridRow = String(ROW_SUM + 1);
    grid.appendChild(line);
  }

  function addColumn() {
    if (!box || cols >= MAX_COLS) return;
    const active = doc.activeElement;
    const focusPos = active && allCells().includes(active) ? posOf(active) : null;
    // Ny kolumn till VÄNSTER: befintliga värden flyttas ett steg åt höger.
    const values = cells.map((row) => {
      const out = [];
      row.forEach((cell, c) => { if (cell) out[c === 0 ? 0 : c + 1] = cell.value; });
      return out;
    });
    cols++;
    build(values);
    if (focusPos) focusCell(at(focusPos[0], focusPos[1] + (focusPos[1] > 0 ? 1 : 0)));
    if (cols >= MAX_COLS) addBtn.hidden = true;
  }

  // Knappar i mallen tar inte fokus från rutan man skriver i (som knappsatsen).
  const keepFocus = (e) => e.preventDefault();
  function headBtn(head, cls, label, aria, onClick) {
    const b = doc.createElement("button");
    b.type = "button";
    b.className = cls;
    b.textContent = label;
    b.title = aria;
    b.setAttribute("aria-label", aria);
    b.addEventListener("pointerdown", keepFocus);
    b.addEventListener("mousedown", keepFocus);
    b.addEventListener("click", onClick);
    head.appendChild(b);
    return b;
  }

  /**
   * Lägg en TOM mall (finns den redan: fokusera den). Returnerar tal 1:s första ruta.
   * `obstacles` (klientrektanglar, t.ex. lappar): krockar mallen med någon flyttas
   * den ned under dem.
   */
  function create(obstacles = []) {
    if (!box) {
      cols = START_COLS;
      box = doc.createElement("div");
      box.className = "uppst";
      box.setAttribute("role", "group");
      box.setAttribute("aria-label", "Uppställning");
      box.style.left = "4%";
      box.style.top = "6%";
      // Huvud: "+ kolumn" (vänster) och × ta bort (höger) – ovanför rutnätet, så
      // plusset aldrig ser ut som ett räknesätt i talet.
      const head = doc.createElement("div");
      head.className = "uppst-head";
      addBtn = headBtn(head, "uppst-add", "+ kolumn", "Lägg till en kolumn", addColumn);
      headBtn(head, "uppst-close", "×", "Ta bort uppställningen", remove);
      gridEl = doc.createElement("div");
      gridEl.className = "uppst-grid";
      box.appendChild(head);
      box.appendChild(gridEl);
      layer.appendChild(box);
      build(null);
      avoid(obstacles);
    }
    // Start i tal 1:s första ruta: eleven börjar med att skriva upp talet.
    const first = at(ROW_A, 1);
    focusCell(first);
    return first;
  }

  // Krockar mallen med en lapp: prova under lapparna, sedan till höger om dem –
  // första som ryms på ytan vinner. Annars ligger den kvar där den lades.
  function avoid(obstacles) {
    const br = box.getBoundingClientRect();
    const lr = layer.getBoundingClientRect();
    const hits = obstacles.filter((o) =>
      o && br.left < o.right && br.right > o.left && br.top < o.bottom && br.bottom > o.top);
    if (!hits.length || !(lr.height > 0) || !(lr.width > 0)) return;
    const w = br.right - br.left, h = br.bottom - br.top;
    const below = Math.max(...hits.map((o) => o.bottom)) - lr.top + 8;
    const right = Math.max(...hits.map((o) => o.right)) - lr.left + 8;
    const pct = (px, total) => `${((px / total) * 100).toFixed(2)}%`;
    if (below + h <= lr.height) box.style.top = pct(below, lr.height);
    else if (right + w <= lr.width) box.style.left = pct(right, lr.width);
  }

  function remove() {
    if (box && box.parentNode) box.parentNode.removeChild(box);
    box = null;
    cells = [];
  }

  return {
    layer,
    create,
    /** Mallens rot (eller null) – för test/inspektion. */
    template: () => box,
    cells: () => cells,
    // Text-läget: mallen tar emot tryck (rutor, knappar). Rit-lägena: pekaren
    // släpps igenom (CSS) så man ritar rakt över mallen.
    setTool(t) {
      layer.classList.toggle("is-text", t === "text");
      if (t !== "text" && box && box.contains(doc.activeElement)) doc.activeElement.blur();
    },
    /** Knappsatsen öppnas/stängs: växla skärmtangentbordet av/på för rutorna. */
    setKeypad(open) { keypadOpen = !!open; allCells().forEach(applyInputMode); },
    clear: remove,
    resize() {}, // procent-placering → följer ytan av sig själv
    destroy() {}, // inga lyssnare utanför mallen (den rivs med kortet)
  };
}
