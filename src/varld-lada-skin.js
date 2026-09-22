// ============================================================================
// Pluggporten – lada-skin-väljaren "🛖 Ny lada" (issue #353)
// ----------------------------------------------------------------------------
// Väljaren som byter laggårdens UTSEENDE (farm.barnSkin) oberoende av nivån –
// spegling av husvärldens beprövade "🏠 Nytt hus"-panel (renderHusSkalPicker i
// art-hus-ute.js): visar den klassiska nivå-fasaden (default, alltid med) +
// de lada-skins eleven ÄGER (ownedItems, köpta i shoppen, kategori hus +
// `barnSkin:true`), med tätt beskurna fasad-förhandsvisningar (ladaPreview).
// Val skrivs med setBarnSkin (data-farm.js) och gårds-grenen ritar om scenerna
// via onChanged. Återanvänder .hus-skal-*-klasserna → ingen ny CSS behövs.
//
// Trigger-knappen monteras i scenens topp-rad och visas BARA på gårds-grenens
// nivåer (gard/laggard) – varld-gard.js anropar visa(nivaId) vid varje
// nivåbyte, precis som foder-/odlings-panelerna stängs där.
//
// OBS BOOTGRAFEN (incident #271): modulen importeras BARA av varld-gard.js
// (som själv är dynamisk) – håll den utanför statiska bootkedjor.
// ============================================================================

import { el, flash } from "./ui.js";
import { getStudentData } from "./data.js";
import { getFarm, setBarnSkin } from "./data-farm.js";
import { LADA_SKINS } from "./art-lada-skins.js";
import { ladaPreview } from "./art-gard.js";

/**
 * Montera väljaren (EN gång, från varld-gard.js bygg()).
 * @param {object} o
 * @param {HTMLElement} o.stage  scenen (.varld-stage) med .varld-ui/.varld-ui-topp
 * @param {() => void} [o.onChanged]  körs efter ett SPARAT byte (rita om scenerna)
 * @returns {{ visa: (nivaId: string) => void, stang: () => void }}
 */
export function mountLadaSkin({ stage, onChanged }) {
  const ui = stage.querySelector(".varld-ui");
  const btn = el(`<button class="varld-knapp" id="lada-skin-btn" hidden
    title="Byt laggårdens utseende">🛖 <span>Ny lada</span></button>`);
  (ui.querySelector(".varld-ui-topp") || ui).appendChild(btn);
  const panel = el(`<div class="varld-panel" id="panel-lada-skin" hidden>
    <button type="button" class="varld-panel-stang" aria-label="Stäng panelen">✕</button>
    <h3>Ny lada 🛖</h3>
    <p class="hint">Byt laggårdens utseende! Hur många djur som får plats styrs
      av nivån – fler lador (och uppgraderingar) köper du i shoppen 🛍️</p>
    <div class="hus-skal-rad" id="ladaskinrad"></div>
  </div>`);
  ui.appendChild(panel);
  const rad = panel.querySelector("#ladaskinrad");
  let upptagen = false;

  function stang() {
    panel.hidden = true;
  }
  panel.querySelector(".varld-panel-stang").addEventListener("click", stang);

  /** Rita om knapparna ur färskt tillstånd (ägda skins + aktivt val + nivå). */
  async function rita() {
    const [sd, farm] = await Promise.all([getStudentData(), getFarm()]);
    const owned = new Set(sd.ownedItems || []);
    const vald = farm.barnSkin && LADA_SKINS[farm.barnSkin] ? farm.barnSkin : "";
    // Klassikern (skin "" = null) alltid först – den följer nivån gratis.
    const alternativ = [
      { id: "", namn: "Klassisk lada", emoji: "🛖" },
      ...Object.entries(LADA_SKINS)
        .filter(([id]) => owned.has(id))
        .map(([id, s]) => ({ id, namn: s.namn, emoji: s.emoji })),
    ];
    rad.innerHTML = alternativ
      .map(
        (s) => `<button class="hus-skal-knapp${s.id === vald ? " vald" : ""}"
          data-skal="${s.id}" aria-pressed="${s.id === vald}" title="${s.namn}">
          <span class="hus-skal-bild" aria-hidden="true">${ladaPreview(s.id || null, farm.barnLevel)}</span>
          <span class="hus-skal-namn">${s.emoji} ${s.namn}${s.id === vald ? " ✓" : ""}</span>
        </button>`
      )
      .join("");
  }

  rad.addEventListener("click", async (e) => {
    const knapp = e.target.closest("[data-skal]");
    if (!knapp || upptagen) return;
    upptagen = true;
    try {
      const res = await setBarnSkin(knapp.dataset.skal || null);
      if (res.ok) {
        onChanged?.();
        await rita(); // markera det nya valet (läser färskt – cachen invaliderad)
      } else {
        flash("Det gick inte att byta lada just nu.", true);
      }
    } catch (err) {
      flash("Kunde inte spara ladbytet: " + err.message, true);
    } finally {
      upptagen = false;
    }
  });

  btn.addEventListener("click", () => {
    if (!panel.hidden) return stang();
    panel.hidden = false;
    rad.innerHTML = `<p class="hint">Hämtar dina lador… 🛖</p>`;
    rita().catch(() => {
      rad.innerHTML = `<p class="hint">Kunde inte hämta ladorna just nu.</p>`;
    });
  });

  /** Visa/dölj triggern per nivå – knappen hör bara hemma på gårds-grenen. */
  function visa(nivaId) {
    const pa = nivaId === "gard" || nivaId === "laggard";
    btn.hidden = !pa;
    if (!pa) stang();
  }

  return { visa, stang };
}
