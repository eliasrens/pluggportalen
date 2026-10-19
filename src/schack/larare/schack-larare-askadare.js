// ============================================================================
// Schack – lärarens åskådarläge (#781, spec §10): ett pågående parti live.
//
// Samma bräde som Etapp 1 (schack-bradet.js) med ASKADAR_OPT: interaktiv:
// false och ingen beforeMove – läraren kan inte flytta något, dragen kommer
// bara från servern. Vit står nederst. EN onSnapshot på schackPartier/{id}
// (moln.lyssnaParti); den, klockans intervall och brädet stängs av stang() –
// som vakten (skapaVakt) också anropar när läraren lämnar sektionen.
// Klockorna räknas lokalt ur senastDragAt och serverNow() (moln.klockaVisning).
// ============================================================================

import { ASKADAR_OPT, klockText, slutInfo, synkaDrag, turText } from "./schack-larare-delar.js";
import { bekraftaHtml, esc } from "./schack-larare-markup.js";

const TICK_MS = 500;

/**
 * Öppna åskådarläget i `rot`.
 * @param {HTMLElement} rot
 * @param {object} o
 * @param {{id:string, vitNamn:string, svartNamn:string}} o.rad  raden ur partilistan
 * @param {object} o.moln         schack-moln.js (lyssnaParti, klockaVisning)
 * @param {object} o.vakt         skapaVakt(...) – stänger när sektionen lämnas
 * @param {Function} o.onTillbaka tillbaka till listan
 * @param {(id:string) => Promise<{ok:boolean, fel?:string}>} o.avsluta  lärarens Avsluta
 * @returns {Promise<() => void>} stäng (lyssnaren, intervallet och brädet)
 */
export async function oppnaAskadare(rot, { rad, moln, vakt, onTillbaka, avsluta }) {
  const { skapaSchackbrade } = await import("../schack-bradet.js");
  const namn = { w: rad.vitNamn, b: rad.svartNamn };
  rot.innerHTML = `<div class="sl-ask">
    <div class="sl-ask-huvud">
      <button type="button" class="btn ghost small" data-tillbaka="1">← Alla partier</button>
      <h4 class="sl-ask-titel">${esc(namn.w)} <span class="sl-mot">mot</span> ${esc(namn.b)}</h4>
      <span class="sl-live" data-live="1">Live</span>
    </div>
    <p class="sl-ask-info" role="status" aria-live="polite">Hämtar partiet…</p>
    <div class="sl-ask-bradet"></div>
    <div class="sl-ask-knappar">
      <button type="button" class="btn small ghost danger" data-ask-avsluta="1">Avsluta partiet</button>
      <span class="sl-ask-resultat" role="status"></span>
    </div>
    <div class="sl-ask-bekrafta"></div>
  </div>`;
  const $ = (s) => rot.querySelector(s);
  const info = $(".sl-ask-info");
  const bradeEl = $(".sl-ask-bradet");
  const avslutaKnapp = $("[data-ask-avsluta]");
  const bekraftaEl = $(".sl-ask-bekrafta");
  const resultatEl = $(".sl-ask-resultat");

  const brade = skapaSchackbrade(bradeEl, {
    ...ASKADAR_OPT,
    namn,
    etikett: `Schackbräde: ${namn.w} mot ${namn.b} (du tittar)`,
    slutKnappar: [{ text: "Alla partier", onClick: () => onTillbaka() }],
  });
  // Klockorna i spelarradernas rader (CSS-rutnätet i schack-larare.css): svart överst, vit nederst.
  const klockEl = {};
  for (const f of ["b", "w"]) {
    klockEl[f] = document.createElement("span");
    klockEl[f].className = `sl-klocka sl-klocka-${f}`;
    klockEl[f].hidden = true;
    bradeEl.appendChild(klockEl[f]);
  }

  let parti = null;
  let visade = null; // dragen brädet visar (null = inget laddat än)
  let slutVisat = false;
  let stangd = false;

  function ritaKlockor() {
    const k = parti ? moln.klockaVisning(parti) : null;
    bradeEl.classList.toggle("sl-med-klocka", !!k);
    for (const f of ["w", "b"]) {
      const el = klockEl[f];
      el.hidden = !k;
      if (!k) continue;
      const ms = f === "w" ? k.vitMs : k.svartMs;
      const gar = parti.status === "pagar" && parti.tur === f;
      el.textContent = klockText(ms);
      el.classList.toggle("gar", gar);
      el.classList.toggle("lite", gar && ms < 30_000);
      el.setAttribute("aria-label", `${f === "w" ? namn.w : namn.b}s tid: ${klockText(ms)}`);
    }
  }

  function ritaInfo() {
    if (!parti) return;
    const delar = [];
    if (parti.status === "pagar") {
      delar.push(turText(parti));
      if (parti.remiErbjudenAv) delar.push(`${parti.remiErbjudenAv === parti.vit ? namn.w : namn.b} erbjuder remi`);
    } else {
      delar.push(slutInfo(parti)?.text || "Partiet är slut.");
    }
    const antal = Array.isArray(parti.drag) ? parti.drag.length : 0;
    delar.push(antal ? `${Math.ceil(antal / 2)} drag` : "inga drag än");
    info.textContent = delar.filter(Boolean).join(" · ");
  }

  function synka(p) {
    const drag = Array.isArray(p.drag) ? p.drag : [];
    const steg = visade ? synkaDrag(visade, drag) : null;
    let ok = !!steg;
    if (steg) for (const san of steg.nya) if (!brade.move(san)) ok = false;
    if (!ok && !brade.loadGame({ drag })) console.warn("schack: partiet gick inte att ladda", p.id);
    visade = drag.slice();
  }

  function visaSlut(p) {
    if (slutVisat) return;
    slutVisat = true;
    const s = slutInfo(p);
    // Matt/patt/regelremi ser brädet själv; allt annat (avbrutet, gav upp, tid …) sätts utifrån.
    if (s && !brade.getState().slut) brade.avsluta(s);
    avslutaKnapp.hidden = true;
    bekraftaEl.innerHTML = "";
    $("[data-live]").hidden = true;
  }

  const stoppLyssna = moln.lyssnaParti(
    rad.id,
    (p) => {
      if (stangd) return;
      parti = p;
      if (!p) {
        info.textContent = "Partiet finns inte längre.";
        avslutaKnapp.hidden = true;
        $("[data-live]").hidden = true;
        ritaKlockor();
        return;
      }
      if (p.vitNamn && p.svartNamn && (p.vitNamn !== namn.w || p.svartNamn !== namn.b)) {
        namn.w = p.vitNamn;
        namn.b = p.svartNamn;
        brade.setSpelare({ namn: { ...namn } });
      }
      synka(p);
      if (p.status !== "pagar") visaSlut(p);
      ritaInfo();
      ritaKlockor();
    },
    (err) => {
      if (stangd) return;
      console.warn("schack: åskådarläget", err);
      info.textContent = "Du kan inte titta på det här partiet (behörighet saknas eller nätet är borta).";
      avslutaKnapp.hidden = true;
    },
  );
  const tick = setInterval(() => !stangd && parti?.status === "pagar" && ritaKlockor(), TICK_MS);

  // Lyssnaren sitter på vyns eget element (inte på rot, som återanvänds av listan och nästa åskådarvy).
  $(".sl-ask").addEventListener("click", async (e) => {
    if (stangd) return;
    if (e.target.closest("[data-tillbaka]")) return onTillbaka();
    if (e.target.closest("[data-ask-avsluta]")) {
      bekraftaEl.innerHTML = bekraftaHtml({
        fraga: `Avsluta partiet mellan ${namn.w} och ${namn.b}?`,
        text: "Det räknas som avbrutet – ingen vinner och topplistan påverkas inte.",
        ja: "Ja, avsluta",
        id: rad.id,
      });
      bekraftaEl.querySelector("[data-nej]")?.focus();
      return;
    }
    if (e.target.closest(".sl-ask-bekrafta [data-nej]")) {
      bekraftaEl.innerHTML = "";
      avslutaKnapp.focus();
      return;
    }
    const ja = e.target.closest(".sl-ask-bekrafta [data-ja]");
    if (ja) {
      ja.disabled = true;
      ja.textContent = "Avslutar…";
      const r = await avsluta(rad.id);
      if (stangd) return;
      bekraftaEl.innerHTML = "";
      resultatEl.innerHTML = r.ok
        ? `<span class="ok-inline">✓ Partiet är avslutat.</span>`
        : `<span class="err-inline">${esc(r.fel)}</span>`;
    }
  });

  function stang() {
    if (stangd) return;
    stangd = true;
    clearInterval(tick);
    stoppLyssna();
    brade.destroy();
  }
  return vakt.lagg(stang);
}
