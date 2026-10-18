// ============================================================================
// Prov (#763): klistra in flera rader i formulärets radlistor (alternativ,
// saker, par) – en rad var, nedåt. tolkaKlistrat är DOM-fri (testad i
// test/prov-763-kantfall.test.js), kopplaKlistra sitter på listan.
//   - en numrerad lista ("1. Steg", "2) Steg") tappar siffrorna – eleverna
//     ska inte se facit-numren (F4)
//   - para: rader med "begrepp – förklaring" (–, -, :, tab) fyller båda leden;
//     rader UTAN avskiljare fyller bara kolumnen man klistrade i, nedåt i den,
//     och den andra kolumnen står kvar (F3)
//   - rader som inte får plats (högst max) räknas och visas i ett meddelande
// ============================================================================

const NUMMER = /^\s*\d+[.)]\s+/;
const AVSKILJARE = /\s+[–—-]\s+|\t|:\s+/;

/** Begrepp – förklaring på en rad, eller null utan avskiljare. */
export function delaPar(t) {
  const [v, ...h] = t.split(AVSKILJARE);
  return h.length ? [v.trim(), h.join(" – ").trim()] : null;
}

/**
 * Inklistrad text → raderna att fördela. `par` = para-listan: `hela` är sant
 * när någon rad har en avskiljare (då fylls båda leden, rader utan avskiljare
 * blir bara ett begrepp).
 * @returns {{ rader: (string | [string, string])[], hela: boolean } | null} null = en enda rad (vanlig inklistring)
 */
export function tolkaKlistrat(text, { par = false } = {}) {
  const rader = String(text || "").split(/\r?\n/).map((t) => t.replace(NUMMER, "").trim()).filter(Boolean);
  if (rader.length < 2) return null;
  const delade = par ? rader.map(delaPar) : [];
  const hela = delade.some(Boolean);
  return { rader: hela ? delade.map((d, i) => d || [rader[i], ""]) : rader, hela };
}

/**
 * @param {HTMLElement} lista  .provl-rader-lista
 * @param {{ max: number, namn: string, par?: boolean, nyRad: () => HTMLElement, uppdatera: () => void, meddelande: HTMLElement }} o
 */
export function kopplaKlistra(lista, { max, namn, par = false, nyRad, uppdatera, meddelande }) {
  lista.addEventListener("paste", (e) => {
    const inp = e.target.closest?.("input[type=text]");
    const radEl = inp?.closest(".provl-rad");
    const t = tolkaKlistrat(e.clipboardData?.getData("text"), { par });
    if (!t || !radEl) return;
    e.preventDefault();
    // Kolumnen man klistrade i (para utan avskiljare), annars hela raden.
    const kol = t.hela || !par ? "input[type=text]" : inp.matches("[data-h]") ? "[data-h]" : "[data-v]";
    const ledig = (r) => [...r.querySelectorAll(kol)].every((x) => !x.value.trim());
    let r = radEl;
    let utanPlats = 0;
    t.rader.forEach((rad, i) => {
      if (i > 0) {
        let nasta = r.nextElementSibling;
        while (nasta && !ledig(nasta)) nasta = nasta.nextElementSibling;
        if (!nasta) {
          if (lista.children.length >= max) return void utanPlats++;
          nasta = nyRad();
          lista.appendChild(nasta);
        }
        r = nasta;
      }
      if (t.hela) [r.querySelector("[data-v]").value, r.querySelector("[data-h]").value] = rad;
      else r.querySelector(kol).value = rad;
    });
    uppdatera();
    meddelande.textContent = utanPlats
      ? `${utanPlats} ${utanPlats === 1 ? "rad" : "rader"} fick inte plats – högst ${max} ${namn}.`
      : "";
  });
}

export const meddelandeHtml = `<p class="hint provl-rader-meddelande" role="status"></p>`;
