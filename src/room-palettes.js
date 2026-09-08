// ============================================================================
// Pluggportalen – färgpaletter för hus & väggar (Husdjur & Hem 2.0)
// ----------------------------------------------------------------------------
// Delad datamodell för hus-vyn (pages-hus.js) och rummets väggfärg: eleven
// väljer en PALETT (inga fria färgval) som sparas som `room.paletteId` i
// studentData. Varje palett har fyra roller: husfasad, tak, vägg, väggpanel.
// Golv, möbler och husdjur färgas ALDRIG om.
// Källa: design/DESIGNBESLUT-husdjur-hem-2.0.md ("Paletter (hus & väggar)").
// ============================================================================

export const DEFAULT_PALETTE_ID = "persika";

export const ROOM_PALETTES = {
  persika: { namn: "Persika", house: "#F49E4C", roof: "#EF6F6C", wall: "#FFE9CC", wall2: "#FBD9A6" },
  mint: { namn: "Mintgrön", house: "#58C6A9", roof: "#46557A", wall: "#D7F2E4", wall2: "#AFE3CB" },
  himmel: { namn: "Himmelsblå", house: "#7FC7E8", roof: "#46557A", wall: "#DDF0FB", wall2: "#B7E0F5" },
  rosa: { namn: "Rosa dröm", house: "#F890B7", roof: "#B79BE0", wall: "#FDE4EE", wall2: "#F9C8DD" },
  sol: { namn: "Solgul", house: "#F7C948", roof: "#F08A3C", wall: "#FDF0C8", wall2: "#FAE29B" },
  // Nya paletter (issue #130) – samma egentecknade stil, fyra roller per palett.
  lavendel: { namn: "Lavendel", house: "#A98BD6", roof: "#6E5AA0", wall: "#EFE7FA", wall2: "#DCCBF2" },
  korall: { namn: "Korall", house: "#FF8A65", roof: "#E85B4A", wall: "#FFE7DE", wall2: "#FFCBB8" },
  skog: { namn: "Skogsgrön", house: "#5FA45C", roof: "#3C6E4F", wall: "#E1F1DC", wall2: "#BFE0B4" },
  hav: { namn: "Havsblå", house: "#3FA8B8", roof: "#2E6D82", wall: "#DCF1F3", wall2: "#B0E0E6" },
  korsbar: { namn: "Körsbär", house: "#E7607A", roof: "#A63A55", wall: "#FCE3E9", wall2: "#F7C0CD" },
  plommon: { namn: "Plommon", house: "#8E5A8C", roof: "#5C3A63", wall: "#F0E4EF", wall2: "#DCC3DB" },
  is: { namn: "Isblå", house: "#9FB8CC", roof: "#5F7488", wall: "#ECF3F8", wall2: "#CDDEEA" },
};

/** Hämta en palett med säkert fallback till default (okänt/saknat id). */
export function getPalette(paletteId) {
  return ROOM_PALETTES[paletteId] || ROOM_PALETTES[DEFAULT_PALETTE_ID];
}

/** Palett-id ur studentData (rummets sparade val). */
export function paletteIdFromStudentData(sd) {
  return (sd && sd.room && sd.room.paletteId) || DEFAULT_PALETTE_ID;
}

// --- Palettväljaren (delas av Mitt rum och hus-vyn) -------------------------
// Barnvänligt: bara förvalda paletter, inga fria färgval. Varje knapp visar
// palettens fyra färgroller (fasad/tak/vägg/panel) som ett litet färgprov.

/**
 * Rita palettväljaren i `container` och lyssna på klick.
 * @param {HTMLElement} container tomt element (t.ex. <div class="palett-rad">)
 * @param {string} activeId       elevens nuvarande palett-id
 * @param {(id: string, palette: object) => void} onPick körs vid NYTT val
 */
export function renderPalettePicker(container, activeId, onPick) {
  const draw = () => {
    container.innerHTML = Object.entries(ROOM_PALETTES)
      .map(
        ([id, p]) => `<button class="palett-knapp${id === activeId ? " vald" : ""}"
          data-palette="${id}" aria-pressed="${id === activeId}" title="${p.namn}">
          <span class="palett-farger" aria-hidden="true">
            <span style="background:${p.house}"></span><span style="background:${p.roof}"></span>
            <span style="background:${p.wall}"></span><span style="background:${p.wall2}"></span>
          </span>
          <span class="palett-namn">${p.namn}${id === activeId ? " ✓" : ""}</span>
        </button>`
      )
      .join("");
  };
  draw();
  container.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-palette]");
    if (!btn || btn.dataset.palette === activeId) return;
    activeId = btn.dataset.palette;
    draw();
    onPick(activeId, getPalette(activeId));
  });
}
