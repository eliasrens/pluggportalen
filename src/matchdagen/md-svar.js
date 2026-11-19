// ============================================================================
// Matchdagen (#868, Etapp 1b): frågekortet – svaret på EN fråga (spec §2).
// createQuestionFlow (live/kistspel/ks-fraga.js) passar inte: det skickar varje
// svar till servern (Live) och tar sina frågor ur ett GameMode. Det här är en
// liten komponent med samma beteende:
//   • stora knappar (minst 48 px) och tangenterna 1–N (flerval), ett svarsfält
//     med Enter (skriv själv – tomt eller ogiltigt räknas inte som svar)
//   • rätt svar visas grönt
//   • fel svar visar det rätta svaret i 1,5 sekunder innan spelet fortsätter
//   • klockan (lärarens val 30/60 s, 0 = av): tiden ute räknas som fel
//
//   visaFraga(host, fraga, { ratta, klocka?, signal? })
//     → Promise<{ ratt, svar, sekunder, tidenUte? } | { avbruten: true }>
//   fraga: md-fragor.js nasta(), ratta: strömmens ratta(fraga, svar)
// Ingen Firebase, inga importer – 1c ritar kortet under planen. Laddas med import().
// ============================================================================

export const FEL_MS = 1500;
export const RATT_MS = 600;
export const MAX_TANGENT = 6;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const vanta = (ms) => new Promise((r) => setTimeout(r, ms));

function kortHtml(fraga, klocka) {
  const flerval = fraga.typ === "flerval";
  const svar = flerval
    ? `<div class="md-fraga-alt" role="group" aria-label="Svarsalternativ">${fraga.alternativ.map((a, i) =>
      `<button type="button" class="md-alt" data-i="${i}">${i < MAX_TANGENT ? `<kbd aria-hidden="true">${i + 1}</kbd>` : ""}<span>${esc(a)}</span></button>`).join("")}</div>`
    : `<form class="md-fraga-skriv" autocomplete="off">
        <input class="md-fraga-input" type="text" inputmode="${esc(fraga.inputMode || "text")}" enterkeyhint="done"
          aria-label="Ditt svar" spellcheck="false" />
        <button type="submit" class="md-skicka">Svara</button>
      </form>`;
  return `<div class="md-fraga" tabindex="-1" data-typ="${flerval ? "flerval" : "skriv"}">
    ${klocka ? `<div class="md-fraga-klocka" role="timer" aria-label="Tid kvar"><span data-kvar>${klocka}</span> s</div>` : ""}
    <p class="md-fraga-text">${esc(fraga.text)}</p>
    ${svar}
    <p class="md-fraga-facit" aria-live="polite"></p>
  </div>`;
}

/**
 * Visa frågan i `host` och vänta på svaret.
 * @param {HTMLElement} host
 * @param {object} fraga
 * @param {{ ratta: Function, klocka?: number, signal?: AbortSignal, nu?: () => number }} o
 */
export function visaFraga(host, fraga, { ratta, klocka = 0, signal, nu = () => performance.now() }) {
  host.innerHTML = kortHtml(fraga, klocka);
  const kort = host.querySelector(".md-fraga");
  const facit = kort.querySelector(".md-fraga-facit");
  const knappar = [...kort.querySelectorAll(".md-alt")];
  const input = kort.querySelector(".md-fraga-input");
  const start = nu();
  let klar = false;
  let timer = 0;

  return new Promise((resolve) => {
    const stada = () => {
      clearInterval(timer);
      document.removeEventListener("keydown", tangent);
      signal?.removeEventListener("abort", avbryt);
    };
    const avbryt = () => {
      if (klar) return;
      klar = true;
      stada();
      resolve({ avbruten: true });
    };
    async function avgor(svar, tidenUte = false) {
      if (klar) return;
      const r = tidenUte ? { giltig: true, ratt: false, facit: fraga.facit } : ratta(fraga, svar);
      if (!r.giltig) {
        if (input) { input.select(); kort.dataset.ogiltig = ""; setTimeout(() => delete kort.dataset.ogiltig, 400); }
        return;
      }
      klar = true;
      stada();
      const sekunder = Math.round((nu() - start) / 100) / 10;
      knappar.forEach((b) => { b.disabled = true; });
      if (input) input.disabled = true;
      kort.querySelector(".md-skicka")?.setAttribute("disabled", "");
      if (fraga.typ === "flerval") {
        knappar[fraga.ratt]?.classList.add("ratt");
        if (!r.ratt && Number.isInteger(svar)) knappar[svar]?.classList.add("fel");
      }
      kort.dataset.utfall = r.ratt ? "ratt" : "fel";
      facit.innerHTML = r.ratt ? "Rätt!" : `${tidenUte ? "Tiden är ute. " : ""}Rätt svar: <b>${esc(r.facit)}</b>`;
      await vanta(r.ratt ? RATT_MS : FEL_MS);
      resolve({ ratt: r.ratt, svar: tidenUte ? null : svar, sekunder, ...(tidenUte ? { tidenUte: true } : {}) });
    }
    function tangent(e) {
      if (fraga.typ !== "flerval" || e.altKey || e.ctrlKey || e.metaKey) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= Math.min(MAX_TANGENT, knappar.length)) {
        e.preventDefault();
        avgor(n - 1);
      }
    }
    if (signal?.aborted) return avbryt();
    signal?.addEventListener("abort", avbryt);
    knappar.forEach((b) => b.addEventListener("click", () => avgor(Number(b.dataset.i))));
    document.addEventListener("keydown", tangent);
    kort.querySelector("form")?.addEventListener("submit", (e) => { e.preventDefault(); avgor(input.value); });
    // Flerval: kortet får fokus (inte första knappen – Enter ska inte råka svara 1).
    (input || kort).focus({ preventScroll: true });
    if (klocka > 0) {
      const kvar = kort.querySelector("[data-kvar]");
      timer = setInterval(() => {
        const s = Math.max(0, Math.ceil(klocka - (nu() - start) / 1000));
        kvar.textContent = s;
        if (s <= 5) kort.dataset.brattom = "";
        if (s === 0) avgor(null, true);
      }, 250);
    }
  });
}
