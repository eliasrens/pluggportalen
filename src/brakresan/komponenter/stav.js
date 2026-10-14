// ============================================================================
// Bråkresan – 2. Bråkstav (komponenter/stav.js) · #707
// ----------------------------------------------------------------------------
// Spec §4 komponent 2: indelning, markering, omdelning, gruppering, flyttbara
// delar, sammansättning och borttagning. Varje del är exakt helhet/n lång
// (geometri.stavDelar). Omdelning 1/2 → 2/4 delar varje gammal del i k nya –
// helheten, nollpunkten och den markerade längden är oförändrade och de gamla
// gränserna ritas kraftigare (geometri.omdela).
//
// view = {
//   component: "stav",
//   parts, wholes?: 1, marked?: antal | [id],   wholes ≥ 2 = flera lika långa staver (bråk > 1)
//   bars?: [{ parts, marked?, label? }],         i stället: staver att jämföra (samma längd)
//   regroup?: k,                                 visa omdelad med k (gamla gränser kraftiga)
//   pieces?: [{ id, d }],                        flyttbara delar 1/d: lägg i/ta ur byggstaven
//   label?: "Hela staven = 1",
// }
// Svar: paint { selected } (delarnas id helhet för helhet, vänster → höger).
// Extra API: regroup(k) – omdelning som hjälpsteg/animation.
// ============================================================================

import { h, s, skapaBas, malning, pekaPaDelar, helhetsEtikett } from "./bas.js";
import { stavDelar, omdela, markeradeIds, delId } from "./geometri.js";

const B = 600;     // stavens längd i viewBox-enheter (samma för alla staver)
const H = 96;      // stavens höjd (≥ 44 px klickyta även i smal spalt)
const MELLAN = 26; // avstånd mellan staver
const VANSTER = 4;

export function createStav(host, view, opts = {}) {
  const harEtiketter = (view.bars || []).some((b) => b.label);
  const x0 = VANSTER + (harEtiketter ? 54 : 0);
  const bredd = B - (harEtiketter ? 54 : 0);
  // Stavarna: [{ parts, label, granser? }] – alla lika långa.
  const startStaver = () => (view.bars?.length
    ? view.bars.map((b) => ({ parts: b.parts, label: b.label || "" }))
    : Array.from({ length: Math.max(1, view.wholes || 1) }, () => ({ parts: view.parts, label: "" })));
  let staver = startStaver();
  const total = () => staver.reduce((a, b) => a + b.parts, 0);
  const startMark = view.bars?.length
    ? (() => {
      let off = 0;
      return view.bars.flatMap((b) => {
        const ids = markeradeIds(b.marked, b.parts).map((x) => delId(off + Number(x.slice(1))));
        off += b.parts;
        return ids;
      });
    })()
    : markeradeIds(view.marked, total());

  const svg = s("svg", { class: "br-stav-svg", role: "group", preserveAspectRatio: "xMidYMid meet" });
  const bygg = view.pieces?.length ? h("div", { class: "br-stav-bygg" }) : null;
  const rot = h("div", { class: "br-stav" },
    helhetsEtikett(view.label || (staver.length > 1 && !view.bars ? "Varje stav = 1 hel" : "Hela staven = 1")),
    svg, bygg);
  const bas = skapaBas(host, rot, view, opts);
  svg.setAttribute("aria-label", opts.label || (view.bars?.length ? "Bråkstavar att jämföra" : "Bråkstav"));
  let mal = null;

  /** Rita stavarna. `nya` = index för nytillkomna gränser (omdelning) som tonas in. */
  function rita(nya = null) {
    svg.replaceChildren();
    const hojd = staver.length * H + (staver.length - 1) * MELLAN + 8;
    svg.setAttribute("viewBox", `0 0 ${B + 8} ${hojd}`);
    svg.append(s("rect", { class: "br-helhetsram", x: x0 - 3, y: 1, width: bredd + 6, height: hojd - 2, rx: 8 }));
    const delar = [];
    let off = 0;
    staver.forEach((st, si) => {
      const y = 4 + si * (H + MELLAN);
      const g = s("g", { class: "br-stav-rad" });
      if (st.label) g.append(s("text", { class: "br-etikett", x: VANSTER + 22, y: y + H / 2 + 7, "text-anchor": "middle", text: st.label }));
      for (const d of stavDelar(st.parts, x0, bredd)) {
        const r = s("rect", { x: d.x, y, width: d.w, height: H, "data-del": delId(off + d.i), class: "br-yta" });
        delar.push(r);
        g.append(r);
      }
      // Gränser: tunna mellan alla delar, kraftiga där en gammal gräns fanns.
      const k = st.granser ? st.parts / (st.granser.length - 1) : 1;
      for (let i = 1; i < st.parts; i++) {
        const x = x0 + (i * bredd) / st.parts;
        const gammal = !st.granser || i % k === 0;
        const klass = gammal ? (st.granser ? "br-grans br-grans--gammal" : "br-grans") : `br-grans br-grans--ny${nya ? " br-tona-in" : ""}`;
        g.append(s("line", { class: klass, x1: x, x2: x, y1: y, y2: y + H }));
      }
      g.append(s("rect", { class: "br-kontur", x: x0, y, width: bredd, height: H, rx: 4 }));
      svg.append(g);
      off += st.parts;
    });
    if (!mal) {
      const namn = view.bars?.length ? `Stavar delade i ${staver.map((st) => st.parts).join(", ")} lika delar`
        : staver.length > 1 ? `${staver.length} stavar, var och en delad i ${staver[0].parts} lika delar` : `Stav delad i ${staver[0].parts} lika delar`;
      mal = malning(bas, delar, { etikett: (i, n) => `Del ${i + 1} av ${n}`, namn });
    }
    else mal.byt(delar);
  }

  /** Omdelning med k: valen följer med till sina nya delar (samma längd). */
  function regroup(k) {
    const markerade = mal ? [...mal.valda] : startMark;
    let off = 0;
    let nyOff = 0;
    const nyMark = [];
    staver = staver.map((st) => {
      const egna = markerade.filter((x) => {
        const i = Number(x.slice(1));
        return i >= off && i < off + st.parts;
      }).map((x) => delId(Number(x.slice(1)) - off));
      const r = omdela(st.parts, egna, k);
      nyMark.push(...r.markerade.map((x) => delId(Number(x.slice(1)) + nyOff)));
      off += st.parts;
      nyOff += r.parts;
      return { ...st, parts: r.parts, granser: r.gamlaGranser };
    });
    rita(true);
    mal.satt(nyMark);
    return nyMark;
  }

  const starta = () => {
    staver = startStaver();
    rita();
    mal.satt(startMark);
    if (view.regroup > 1) regroup(view.regroup);
  };
  starta();

  // --- Flyttbara delar: lägg i byggstaven med klick, drag eller Enter ---------
  if (bygg) {
    const lagda = [];
    const stavYta = h("div", { class: "br-byggstav", "aria-label": "Byggstav: hela staven = 1", role: "list" });
    const hog = h("div", { class: "br-hog", role: "list", "aria-label": "Delar att lägga" });
    const meddelande = h("div", { class: "br-inmatningshjalp", role: "status", "aria-live": "polite" });
    bygg.append(stavYta, hog, meddelande);
    const summa = () => lagda.reduce((a, p) => a + 1 / p.d, 0);
    const knapp = (p, iStaven) => h("button", {
      type: "button", class: "br-bit", "data-bit": p.id, style: `--br-bitbredd:${100 / p.d}%`,
      "aria-label": iStaven ? `Ta bort en del 1/${p.d}` : `Lägg en del 1/${p.d} i staven`,
    }, `1/${p.d}`);
    const ritaBygg = () => {
      stavYta.replaceChildren(...lagda.map((p) => knapp(p, true)));
      hog.replaceChildren(...view.pieces.filter((p) => !lagda.includes(p)).map((p) => knapp(p, false)));
    };
    const flytta = (bitId) => {
      if (bas.last || !bas.interaktiv) return;
      const p = view.pieces.find((x) => String(x.id) === bitId);
      const i = lagda.indexOf(p);
      if (i >= 0) lagda.splice(i, 1);
      else if (summa() + 1 / p.d > 1 + 1e-9) { meddelande.textContent = "Den delen får inte plats i staven."; return; }
      else lagda.push(p);
      meddelande.textContent = "";
      ritaBygg();
      bygg.querySelector(`[data-bit="${bitId}"]`)?.focus();
      bas.andrat();
    };
    // Drag: släpps biten över byggstaven läggs den dit; ett kort tryck = klick.
    let drag = null;
    bygg.addEventListener("pointerdown", (e) => {
      const b = e.target.closest(".br-bit");
      if (b) drag = { id: b.dataset.bit, x: e.clientX, y: e.clientY, uppe: !!b.closest(".br-byggstav") };
    });
    bygg.addEventListener("pointerup", (e) => {
      if (!drag) return;
      const flyttat = Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 12;
      const over = document.elementFromPoint(e.clientX, e.clientY)?.closest?.(".br-byggstav");
      if (!flyttat || (!!over !== drag.uppe)) flytta(drag.id);
      drag = null;
    });
    bygg.addEventListener("keydown", (e) => {
      const b = e.target.closest(".br-bit");
      if (b && (e.key === "Delete" || e.key === "Backspace") && b.closest(".br-byggstav")) { e.preventDefault(); flytta(b.dataset.bit); }
    });
    bygg.addEventListener("click", (e) => { if (e.detail === 0) { const b = e.target.closest(".br-bit"); if (b) flytta(b.dataset.bit); } });
    ritaBygg();
    bas.byggda = () => lagda.map((p) => p.id);
    bas.rensaBygg = () => { lagda.length = 0; ritaBygg(); };
  }

  Object.assign(bas.api, {
    getAnswer: () => mal.svar(),
    setAnswer(a) { mal.satt(a?.selected); },
    reset() {
      starta();
      bas.rensaBygg?.();
      bas.andrat();
    },
    highlight(target) {
      pekaPaDelar(bas, mal.delar, target, (d, i) => {
        const x = Number(d.getAttribute("x")) + Number(d.getAttribute("width")) / 2;
        const y = Number(d.getAttribute("y")) + H / 2 + 7;
        d.parentNode.append(s("text", { class: "br-nummer", x, y, "text-anchor": "middle", text: String(i + 1) }));
      });
    },
    regroup,
    /** Id:n på delarna som ligger i byggstaven (flyttbara delar). */
    pieces: () => bas.byggda?.() || [],
  });
  return bas.api;
}
