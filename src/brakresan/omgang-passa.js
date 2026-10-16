// ============================================================================
// Bråkresan – uppgiften ryms i fönstret (src/brakresan/omgang-passa.js) · #753
// ----------------------------------------------------------------------------
// Uppgiften och knapparna ska rymmas i fönstret utan scroll: en hög modell
// skalas ner (aldrig under passaMin()). Räcker det inte får arbetsytan
// klassen brv-yta--trang och återkopplingen + knappraden nålas fast mot
// fönstrets underkant (omgang.css). Laddas bara av omgang.js (lat).
//
// bevakaPassning({ yta, modellRam, modellYta, besked, knapprad, huvudKnapp })
//   → { passa(), las(), destroy() }. Skalan räknas om när modellen ändrar
//   storlek och när fönstret ändras.
//   las() (före kontrollen, #754): huvudknappen står still resten av uppgiften.
//   Växer eller krymper modellen, återkopplingen eller knappraden tar
//   modellens ram upp skillnaden (modellen skalas inom ramen) – musen ligger
//   kvar på Fortsätt. Trängt läge: ramen fylls ut så att raden redan före
//   kontrollen sitter fastnålad mot fönstrets underkant; där låses bara
//   ramens höjd (huvudknappen ligger sist i raden och står still när raden
//   växer uppåt). Trängt läge byts inte medan låset gäller.
// ============================================================================

/** Minsta skala – mindre än så blir text och mål för små. Smal skärm: modellen
 *  är redan smal, så där litar vi mest på den fastnålade knappraden. */
const passaMin = () => (window.innerWidth <= 720 ? 0.85 : 0.62);
/** Minsta skala när knappen hålls still – hellre att raden flyttar sig än en oläslig modell. */
const LAST_MIN = 0.5;
/** Beskedets reserverade höjd ovanför knappraden (= .brv-besked min-height i omgang.css). */
const BESKED_REM = 4.6;

export function bevakaPassning({ yta, modellRam, modellYta, besked, knapprad, huvudKnapp }) {
  // Låst: { y } = huvudknappens topp i dokumentet (fritt läge) eller { ram } = ramens höjd (trängt läge).
  let last = null;
  const handling = knapprad.parentElement;
  /** Mät så som raden ligger i flödet (sticky ger inte flödets plats). */
  const iFlodet = (fn) => {
    handling.style.position = "static";
    const v = fn();
    handling.style.position = "";
    return v;
  };
  const knappY = () => iFlodet(() => huvudKnapp.getBoundingClientRect().top) + window.scrollY;

  const skala = (s, ramHojd) => {
    modellYta.style.transform = s < 1 ? `scale(${s.toFixed(3)})` : "";
    modellRam.style.height = ramHojd == null ? "" : `${Math.round(ramHojd)}px`;
  };

  const passaLast = (naturlig) => {
    const ram = last.ram ?? modellRam.getBoundingClientRect().height + last.y - knappY();
    const s = Math.min(1, Math.max(LAST_MIN, ram / naturlig));
    skala(s, Math.max(ram, naturlig * s));
  };

  const passa = () => {
    if (!modellYta.isConnected) return;
    const naturlig = modellYta.offsetHeight;
    if (!naturlig) return;
    if (last != null) return passaLast(naturlig);
    // Beskedets reserv räknas alltid med (fastnålad rad har ingen) – annars växlar läget fram och tillbaka.
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    let topp = 0;
    const under = iFlodet(() => {
      const ram = modellRam.getBoundingClientRect();
      const b = besked.getBoundingClientRect();
      topp = ram.top + window.scrollY;
      return (b.top - ram.bottom) + Math.max(b.height, BESKED_REM * rem) + (knapprad.getBoundingClientRect().bottom - b.bottom)
    });
    const plats = window.innerHeight - topp - under - 12;
    const min = passaMin();
    const s = Math.min(1, Math.max(min, plats / naturlig));
    const trang = plats / naturlig < min;
    yta.classList.toggle("brv-yta--trang", trang);
    skala(s, s < 1 ? naturlig * s : null);
    if (!trang) return;
    // Raden ska sitta fastnålad redan nu – annars hoppar den ner dit när återkopplingen växer.
    const luft = window.innerHeight - iFlodet(() => handling.getBoundingClientRect().bottom);
    if (luft > 1) skala(s, naturlig * s + luft);
  };

  const las = () => {
    if (last != null || !modellYta.isConnected) return;
    last = yta.classList.contains("brv-yta--trang")
      ? { ram: modellRam.getBoundingClientRect().height }
      : { y: knappY() };
  };

  // Nytt fönster = ny plats: passa om fritt och lås på nytt där.
  const andrat = () => {
    const varLast = last != null;
    last = null;
    passa();
    if (varLast) las();
  };

  const obs = typeof ResizeObserver === "function" ? new ResizeObserver(() => passa()) : null;
  for (const el of [modellYta, besked, knapprad]) obs?.observe(el);
  window.addEventListener("resize", andrat);
  return {
    passa,
    las,
    destroy() {
      obs?.disconnect();
      window.removeEventListener("resize", andrat);
    },
  };
}
