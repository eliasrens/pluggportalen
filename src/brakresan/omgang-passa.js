// ============================================================================
// Bråkresan – uppgiften ryms i fönstret (src/brakresan/omgang-passa.js) · #753
// ----------------------------------------------------------------------------
// Uppgiften och knapparna ska rymmas i fönstret utan scroll: en hög modell
// skalas ner (aldrig under passaMin()). Räcker det inte får arbetsytan
// klassen brv-yta--trang och återkopplingen + knappraden nålas fast mot
// fönstrets underkant (omgang.css). Laddas bara av omgang.js (lat).
//
// bevakaPassning({ yta, modellRam, modellYta, besked, knapprad })
//   → { passa(), destroy() }. Skalan räknas om när modellen ändrar storlek
//   och när fönstret ändras – inte när återkopplingen byts (då ska raden stå still).
// ============================================================================

/** Minsta skala – mindre än så blir text och mål för små. Smal skärm: modellen
 *  är redan smal, så där litar vi mest på den fastnålade knappraden. */
const passaMin = () => (window.innerWidth <= 720 ? 0.85 : 0.62);
/** Beskedets reserverade höjd ovanför knappraden (= .brv-besked min-height i omgang.css). */
const BESKED_REM = 4.6;

export function bevakaPassning({ yta, modellRam, modellYta, besked, knapprad }) {
  const passa = () => {
    if (!modellYta.isConnected) return;
    const naturlig = modellYta.offsetHeight;
    if (!naturlig) return;
    const ram = modellRam.getBoundingClientRect();
    const b = besked.getBoundingClientRect();
    const topp = ram.top + window.scrollY;
    // Beskedets reserv räknas alltid med (fastnålad rad har ingen) – annars växlar läget fram och tillbaka.
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const under = (b.top - ram.bottom) + Math.max(b.height, BESKED_REM * rem) + (knapprad.getBoundingClientRect().bottom - b.bottom);
    const plats = window.innerHeight - topp - under - 12;
    const min = passaMin();
    const s = Math.min(1, Math.max(min, plats / naturlig));
    modellYta.style.transform = s < 1 ? `scale(${s.toFixed(3)})` : "";
    modellRam.style.height = s < 1 ? `${Math.round(naturlig * s)}px` : "";
    yta.classList.toggle("brv-yta--trang", plats / naturlig < min);
  };
  const obs = typeof ResizeObserver === "function" ? new ResizeObserver(() => passa()) : null;
  obs?.observe(modellYta);
  window.addEventListener("resize", passa);
  return {
    passa,
    destroy() {
      obs?.disconnect();
      window.removeEventListener("resize", passa);
    },
  };
}
