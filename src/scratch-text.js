// ============================================================================
// Pluggporten – kladdytans TEXT-verktyg (scratch-text.js, issue #392)
// ----------------------------------------------------------------------------
// Ett text-lager OVANPÅ rit-canvasen: i Text-läget trycker eleven var som helst
// på ytan → en liten skrivlapp (<input>) dyker upp där och får fokus, så både
// fysiskt tangentbord och mobilens skärmtangentbord funkar (fokus sätts direkt i
// click-hanteraren = användargest, annars öppnar iOS inget tangentbord).
//
// Lapparna placeras i PROCENT av ytan (left/top), så de följer med automatiskt
// när kortet förstoras/förminskas – exakt som ritningen, som skalas om till nya
// ytan (scratchpad.js fit()). Ingen JS behövs vid resize. Suddet suddar bara
// bläck (canvasen), inte lappar; Rensa tar bort alla, tomma lappar städas bort
// när de tappar fokus. addFreeNote() lägger en lapp på första lediga plats uppe
// till vänster (knappsatsen, scratch-keypad.js, när den saknar skrivmål).
//
// HELT FLYKTIGT som ritningen: lapparna finns bara i DOM:en, sparas ALDRIG (noll
// DB-kostnad) och rivs med kortet.
//
// Samma gränssnitt som en rit-pad ({setTool, clear, resize, destroy}) så
// createScratchCard kan lägga lagret i sin pads-lista: verktygsval, Rensa och
// destroy når det utan specialfall.
//
// BOOT-SÄKERHET: import-fri, laddas bara via scratchpad.js som i sin tur bara nås
// dynamiskt (games-rakna.js / adventure/generator-modal.js). Får ALDRIG statiskt
// importeras av en bootfil (jfr #271/#290).
// ============================================================================

// Platsen en ny "ledig" lapp reserverar (px) när den letar efter en fri yta.
const FREE_W = 110;
const FREE_H = 44;
const FREE_PAD = 12;

/**
 * Koppla ett text-lager på `surface` (ritytans behållare, position:relative).
 * @param {HTMLElement} surface
 * @param {{document?:Document}} [opts]
 * @returns {{layer:HTMLElement, setTool:(t:string)=>void, clear:()=>void, resize:()=>void, destroy:()=>void, notes:()=>HTMLElement[]}}
 */
export function attachTextLayer(surface, opts = {}) {
  // Globala document först: kortet byggs ofta ur en <template> (ui.js el()), vars
  // ownerDocument är ett inert dokument utan fönster (getComputedStyle saknas).
  const doc = opts.document || (typeof document !== "undefined" ? document : surface.ownerDocument);
  const layer = doc.createElement("div");
  layer.className = "scratch-text-layer";
  surface.appendChild(layer);

  let tool = "pen";
  let keypadOpen = false; // knappsatsen (scratch-keypad.js) öppen → inget skärmtangentbord
  let measureCtx = null;

  const notes = () => [...layer.querySelectorAll(".scratch-note")];

  // Bredd efter innehållet (field-sizing:content finns inte överallt): mät texten
  // i lappens egen font. Fallback i ch om canvas-mätning inte finns.
  function autosize(note) {
    const txt = note.value || note.placeholder || "";
    let w = 0;
    try {
      measureCtx = measureCtx || doc.createElement("canvas").getContext("2d");
      const cs = doc.defaultView.getComputedStyle(note);
      measureCtx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      w = measureCtx.measureText(txt).width;
    } catch { w = 0; }
    note.style.width = w > 0 ? `${Math.ceil(w) + 18}px` : `${Math.max(2, txt.length) + 1}ch`;
  }

  function removeNote(note) {
    if (note.parentNode) note.parentNode.removeChild(note);
  }

  function addNote(fx, fy) {
    const note = doc.createElement("input");
    note.type = "text";
    note.className = "scratch-note";
    note.setAttribute("autocomplete", "off");
    note.setAttribute("autocorrect", "off");
    note.setAttribute("autocapitalize", "off");
    note.setAttribute("spellcheck", "false");
    note.setAttribute("enterkeyhint", "done");
    note.setAttribute("aria-label", "Text på kladdytan");
    if (keypadOpen) note.setAttribute("inputmode", "none");
    note.placeholder = "…";
    note.style.left = `${(fx * 100).toFixed(2)}%`;
    note.style.top = `${(fy * 100).toFixed(2)}%`;
    // Aldrig utanför ytans högerkant – blir texten längre skrollar den i lappen.
    note.style.maxWidth = `calc(${((1 - fx) * 100).toFixed(2)}% - 4px)`;
    note.addEventListener("input", () => autosize(note));
    note.addEventListener("keydown", (e) => {
      // Enter avslutar lappen (och får aldrig skicka svarsformuläret).
      if (e.key === "Enter") { e.preventDefault(); note.blur(); }
    });
    note.addEventListener("blur", () => { if (!note.value.trim()) removeNote(note); });
    layer.appendChild(note);
    autosize(note);
    return note;
  }

  // Text-läget: tryck på en tom del av ytan → ny lapp där. Tryck på en befintlig
  // lapp → vanligt fokus (redigera). click täcker både mus och touch-tap.
  function onClick(e) {
    if (tool !== "text" || e.target !== layer) return;
    const r = layer.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const fx = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 0.94);
    const fy = Math.min(Math.max((e.clientY - r.top) / r.height, 0.04), 0.96);
    const note = addNote(fx, fy);
    try { note.focus({ preventScroll: true }); } catch { note.focus(); }
  }

  const overlaps = (a, b) =>
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

  /**
   * Ny fokuserad lapp på första LEDIGA plats uppifrån vänster: krockar inte med
   * befintliga lappar eller `obstacles` (t.ex. uppställningsmallen, klientkoord.).
   * Hittas ingen ledig plats hamnar den överst till vänster ändå.
   */
  function addFreeNote(obstacles = []) {
    const r = layer.getBoundingClientRect();
    const taken = [...notes().map((n) => n.getBoundingClientRect()), ...obstacles].filter(Boolean);
    let spot = null;
    for (let y = FREE_PAD; !spot && y + FREE_H <= r.height; y += FREE_H) {
      for (let x = FREE_PAD; x + FREE_W <= r.width; x += FREE_W / 2) {
        const box = { left: r.left + x, top: r.top + y, right: r.left + x + FREE_W, bottom: r.top + y + FREE_H };
        if (!taken.some((t) => overlaps(box, t))) { spot = { x, y }; break; }
      }
    }
    const w = r.width || 1, h = r.height || 1;
    const fx = spot ? spot.x / w : 0.04;
    const fy = spot ? (spot.y + FREE_H / 2) / h : 0.08;
    const note = addNote(Math.min(fx, 0.94), Math.min(Math.max(fy, 0.04), 0.96));
    try { note.focus({ preventScroll: true }); } catch { note.focus(); }
    return note;
  }

  layer.addEventListener("click", onClick);

  return {
    layer,
    notes,
    addFreeNote,
    setTool(t) {
      tool = t;
      layer.classList.toggle("is-text", t === "text");
      // Lämnar man Text-läget mitt i en lapp: avsluta den (tom → bort).
      if (t !== "text" && layer.contains(doc.activeElement)) doc.activeElement.blur();
    },
    /** Knappsatsen öppnas/stängs: lapparna visar inget skärmtangentbord medan den är öppen. */
    setKeypad(open) {
      keypadOpen = !!open;
      notes().forEach((n) => (keypadOpen ? n.setAttribute("inputmode", "none") : n.removeAttribute("inputmode")));
    },
    clear() { notes().forEach(removeNote); },
    resize() {}, // procent-placering → följer ytan av sig själv
    destroy() {
      layer.removeEventListener("click", onClick);
    },
  };
}
