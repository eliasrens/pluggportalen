// ============================================================================
// Bråkresan – verkstadens stavar (src/brakresan/verkstad-stav.js) · #711 F
// ----------------------------------------------------------------------------
// Stavarna i view.component "verkstad" (omgang-verkstad.js): egen SVG så att
// verktygen kan rita om samma helhet – dela (25, 35), slå ihop (21), ta bort
// (32, 35), markera (29) och flytta till mallen (31). Varje del är exakt
// helhet/n lång; omdelning och gruppering ändrar aldrig helheten, nollpunkten
// eller den färgade längden. Mallen (31) tar emot de flyttade bitarna.
// En del = { id, el, svar, satt, rensa, las, validera, fokus, highlight }.
// ctx = { bas, interaktiv, opts, specFor(id), andrat() } (omgang-verkstad.js).
// ============================================================================

import { h, s, helhetsEtikett, malning } from "./komponenter/bas.js";
import { formNod } from "./komponenter/notation.js";

const B = 600; //   stavens längd i viewBox-enheter
const H = 72; //    stavens höjd
const X0 = 4;
const ETIKETT = 44; // plats ovanför staven för etiketter (30)
const delId = (i) => `p${i}`;

/** Ränder för det andra mönstret (andra addenden, det som tas bort) – ett mönster i dokumentet. */
export function ensureRander() {
  if (document.getElementById("bvk-rander")) return;
  const defs = s("svg", { width: 0, height: 0, "aria-hidden": "true", style: "position:absolute;width:0;height:0;overflow:hidden" },
    s("defs", null, s("pattern", { id: "bvk-rander", width: 12, height: 12, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" },
      s("rect", { width: 12, height: 12, fill: "#9b51e0" }),
      s("rect", { width: 5, height: 12, fill: "#ffffff", "fill-opacity": ".45" }))));
  document.body.prepend(defs);
}

// ---------------------------------------------------------------------------
// Stavar
// ---------------------------------------------------------------------------

export function skapaStav(rot, def, ctx) {
  const { bas, interaktiv } = ctx;
  const verktyg = new Set(interaktiv ? def.verktyg || [] : []);
  const st = { k: 1, g: 1, flyttad: false };
  const topp = def.etiketter?.length ? ETIKETT : 4;
  const svg = s("svg", { class: "bvk-stav-svg", role: "img", preserveAspectRatio: "xMidYMid meet" });
  const yta = h("div", { class: "bvk-stav-yta" }, def.helhet ? helhetsEtikett(def.helhet) : null, svg);
  const status = h("span", { class: "bvk-status", "aria-live": "polite" });
  const verktygRad = h("div", { class: "bvk-verktyg" });
  const el = h("div", { class: `bvk-stav${def.iHjalp ? " bvk-ihjalp" : ""}`, "data-stav": def.id },
    def.namn ? h("div", { class: "bvk-namn" }, formNod(def.namn)) : h("div", { class: "bvk-namn" }), yta, verktygRad);
  if (def.iHjalp) el.hidden = true;
  rot.append(el);
  let mal = null; //    malning för "bort"/"mala"
  let byt = null; //    "flytta"-knappen
  const lyssnare = { flytta: new Set() };

  const P = () => def.parts * st.k;
  const M = () => def.marked * st.k;
  const xAv = (i) => X0 + (i * B) / P();

  function rita() {
    svg.replaceChildren();
    const hojd = topp + H + 6;
    svg.setAttribute("viewBox", `0 0 ${B + 2 * X0} ${hojd}`);
    svg.append(s("rect", { class: "br-helhetsram", x: X0 - 3, y: topp - 3, width: B + 6, height: H + 6, rx: 8 }));
    const g = s("g", { class: "bvk-rad" });
    const delarEl = [];
    for (let i = 0; i < P(); i++) {
      const markerad = i < M() && !(st.flyttad);
      const klass = ["br-yta", "bvk-del", markerad ? (def.monster === "b" ? "bvk-b" : "bvk-a") : "", st.flyttad && i < M() ? "bvk-flyttad" : ""].filter(Boolean).join(" ");
      const r = s("rect", { x: xAv(i), y: topp, width: B / P(), height: H, class: klass, "data-del": verktyg.has("mala") ? delId(i) : null });
      g.append(r);
      delarEl.push(r);
    }
    // Gränser: omdelning (gamla kraftiga, nya tunna streckade), gruppering (gruppgränser kraftiga).
    for (let i = 1; i < P(); i++) {
      const x = xAv(i);
      let klass = "br-grans";
      if (st.k > 1) klass = i % st.k === 0 ? "br-grans br-grans--gammal" : "br-grans br-grans--ny";
      else if (st.g > 1) klass = i % st.g === 0 ? "br-grans br-grans--gammal" : "br-grans bvk-grans--inre";
      g.append(s("line", { class: klass, x1: x, x2: x, y1: topp, y2: topp + H }));
    }
    // Delvis färgade grupper (ihop): markeras med streckad ram – ingen färdig förkortning påstås.
    if (st.g > 1) {
      for (let gi = 0; gi < P() / st.g; gi++) {
        const fran = gi * st.g;
        const farg = Math.max(0, Math.min(st.g, M() - fran));
        if (farg > 0 && farg < st.g) g.append(s("rect", { class: "bvk-delvis", x: xAv(fran) + 3, y: topp + 3, width: (st.g * B) / P() - 6, height: H - 6, rx: 6 }));
      }
    }
    g.append(s("rect", { class: "br-kontur", x: X0, y: topp, width: B, height: H, rx: 4 }));
    // Borttagning: genomskinliga ytor över de färgade bitarna; valda = borttagna.
    const bortYtor = [];
    if (verktyg.has("bort") && !st.flyttad) {
      for (let i = 0; i < M(); i++) {
        const r = s("rect", { class: "bvk-bortyta", x: xAv(i) + 2, y: topp + 2, width: B / P() - 4, height: H - 4, rx: 4, "data-del": delId(i) });
        g.append(r);
        bortYtor.push(r);
      }
    }
    svg.append(g);
    for (const e of def.etiketter || []) {
      const x1 = xAv(e.fran * st.k) + 4;
      const x2 = xAv(e.till * st.k) - 4;
      svg.append(s("path", { class: "bvk-klammer", d: `M${x1} ${topp - 6} V${topp - 14} H${x2} V${topp - 6}` }),
        s("text", { class: "bvk-etikett", x: (x1 + x2) / 2, y: topp - 20, "text-anchor": "middle", text: e.text }));
    }
    svg.setAttribute("aria-label", beskriv());
    if (verktyg.has("bort")) {
      if (!mal) mal = malning(bas, bortYtor, { etikett: (i, n) => `Färgad bit ${i + 1} av ${n} – ta bort`, namn: "Färgade bitar" });
      else { mal.byt(bortYtor); mal.rensa(); }
    } else if (verktyg.has("mala")) {
      if (!mal) mal = malning(bas, delarEl, { etikett: (i, n) => `Del ${i + 1} av ${n}` });
      else mal.byt(delarEl);
    }
    return delarEl;
  }
  const beskriv = () => `Stav delad i ${P()} lika delar${st.g > 1 ? `, i grupper om ${st.g}` : ""}${M() && !st.flyttad ? `, ${M()} färgade` : ""}`;

  // --- verktyg ----------------------------------------------------------------
  const knapp = (text, etikett, fn) => h("button", { type: "button", class: "br-knapp br-verktygknapp", "aria-label": etikett, onclick: () => { if (!bas.last) fn(); } }, text);
  if (verktyg.has("dela")) {
    const minus = knapp("−", "Färre nya bitar", () => { if (st.k > 1) { st.k--; uppdatera(); } });
    const plus = knapp("+", "Fler nya bitar", () => { if (st.k < (def.maxDela || 1)) { st.k++; uppdatera(); } });
    const visa = () => {
      status.textContent = st.k === 1 ? "1 (som nu)" : `${st.k} → ${P()} bitar`;
      minus.disabled = bas.last || st.k <= 1;
      plus.disabled = bas.last || st.k >= (def.maxDela || 1);
    };
    verktygRad.append(h("div", { class: "bvk-verktyg-grupp", role: "group", "aria-label": "Dela staven" }, h("span", null, "Dela varje bit i"), minus, status, plus));
    st.visaVerktyg = visa;
  }
  if (verktyg.has("ihop")) {
    const val = [1, ...(def.ihop || [])];
    const minus = knapp("−", "Mindre grupper", () => { const i = val.indexOf(st.g); if (i > 0) { st.g = val[i - 1]; uppdatera(); } });
    const plus = knapp("+", "Större grupper", () => { const i = val.indexOf(st.g); if (i < val.length - 1) { st.g = val[i + 1]; uppdatera(); } });
    const medd = h("p", { class: "bvk-ihop-medd", "aria-live": "polite" });
    const visa = () => {
      const delvis = st.g > 1 && M() % st.g !== 0;
      status.textContent = st.g === 1 ? "1 (som nu)" : `${st.g} små bitar`;
      medd.textContent = st.g === 1 ? "" : delvis
        ? `Med grupper om ${st.g} blir någon grupp bara delvis färgad. Då går det inte att slå ihop så – prova ett annat antal.`
        : `Varje grupp om ${st.g} är helt färgad eller helt ofärgad. Räkna grupperna.`;
      el.classList.toggle("bvk-delvis-aktiv", delvis);
      const i = val.indexOf(st.g);
      minus.disabled = bas.last || i <= 0;
      plus.disabled = bas.last || i >= val.length - 1;
    };
    verktygRad.append(h("div", { class: "bvk-verktyg-grupp", role: "group", "aria-label": "Slå ihop bitar" }, h("span", null, "Slå ihop"), minus, status, plus, h("span", null, "till en")), medd);
    st.visaVerktyg = visa;
  }
  if (verktyg.has("bort")) verktygRad.append(h("p", { class: "bvk-tips" }, "Klicka på färgade bitar för att ta bort dem. Klicka igen för att ångra."));
  if (verktyg.has("flytta")) {
    byt = h("button", { type: "button", class: "br-knapp bvk-flytta" }, "Flytta till den tomma staven");
    byt.addEventListener("click", () => { if (!bas.last) satFlyttad(!st.flyttad); });
    verktygRad.append(byt);
    // Drag: dra staven och släpp över mallen (klick fungerar alltid också).
    let drag = null;
    svg.addEventListener("pointerdown", (e) => { if (!bas.last && !st.flyttad) drag = { x: e.clientX, y: e.clientY }; });
    window.addEventListener("pointerup", slapp);
    function slapp(e) {
      if (!drag) return;
      const flyttat = Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 12;
      drag = null;
      if (flyttat && document.elementFromPoint(e.clientX, e.clientY)?.closest?.(".bvk-mall")) satFlyttad(true);
    }
    bas.stad(() => window.removeEventListener("pointerup", slapp));
  }
  function satFlyttad(v, tyst = false) {
    st.flyttad = v;
    if (byt) byt.textContent = v ? "Flytta tillbaka" : "Flytta till den tomma staven";
    rita();
    for (const cb of lyssnare.flytta) cb();
    if (!tyst) ctx.andrat();
  }
  function uppdatera() {
    rita();
    st.visaVerktyg?.();
    ctx.andrat();
  }
  rita();
  st.visaVerktyg?.();

  const svarsid = verktyg.has("bort") || verktyg.has("mala") ? def.id : null;
  // 35: borttagningen är ett verktyg (bedöms inte) – bara 32 lämnar den som delsvar.
  const bedoms = svarsid && ctx.specFor(def.id)?.type === "paint";
  return {
    id: bedoms ? svarsid : null,
    el,
    stav: def,
    get flyttad() { return st.flyttad; },
    onFlytta(cb) { lyssnare.flytta.add(cb); },
    satFlyttad,
    svar: () => (mal?.valda.size ? { selected: [...mal.valda] } : null),
    satt(a) {
      if (!mal) return;
      if (st.k !== 1 && a?.selected) { st.k = 1; rita(); st.visaVerktyg?.(); }
      mal.satt(a?.selected);
    },
    rensa() { st.k = 1; st.g = 1; if (st.flyttad) satFlyttad(false, true); rita(); mal?.rensa(); st.visaVerktyg?.(); },
    las(l) {
      st.visaVerktyg?.();
      if (byt) byt.disabled = l;
      void l;
    },
    validera() {
      if (!bedoms) return null;
      return mal?.valda.size ? null : verktyg.has("bort") ? "Klicka bort färgade bitar först." : "Markera delar i bandet först.";
    },
    fokus() { svg.querySelector("[tabindex='0']")?.focus(); },
    highlight(t) {
      if (def.iHjalp) el.hidden = !t?.stavar;
      svg.querySelectorAll(".br-nummer").forEach((x) => x.remove());
      if (t?.count) {
        for (let i = 0; i < P(); i++) {
          svg.append(s("text", { class: "br-nummer", x: xAv(i) + B / P() / 2, y: topp + H / 2 + 8, "text-anchor": "middle", text: String(i + 1) }));
        }
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Mallen (31): bitarna flyttas hit; delsvar = de fyllda delarna
// ---------------------------------------------------------------------------

export function skapaMall(rot, def, stavar, ctx) {
  const kallor = def.kallor.map((id) => stavar.find((x) => x.stav.id === id)).filter(Boolean);
  const ordning = []; // flyttade källor i flyttordning
  const svg = s("svg", { class: "bvk-stav-svg", role: "img", preserveAspectRatio: "xMidYMid meet" });
  const el = h("div", { class: "bvk-stav bvk-mall", "data-stav": def.id },
    h("div", { class: "bvk-namn bvk-mall-namn", "aria-hidden": "true" }, "="), h("div", { class: "bvk-stav-yta" }, helhetsEtikett(def.helhet || "Hela staven = 1"), svg), h("div"));
  rot.append(el);
  const fyllda = () => ordning.reduce((sum, k) => sum + k.stav.marked, 0);
  function rita() {
    svg.replaceChildren();
    svg.setAttribute("viewBox", `0 0 ${B + 2 * X0} ${H + 10}`);
    svg.append(s("rect", { class: "br-helhetsram", x: X0 - 3, y: 1, width: B + 6, height: H + 6, rx: 8 }));
    let i = 0;
    const w = B / def.parts;
    for (const k of ordning) {
      for (let j = 0; j < k.stav.marked; j++, i++) {
        svg.append(s("rect", { x: X0 + i * w, y: 4, width: w, height: H, class: `br-yta bvk-del ${k.stav.monster === "b" ? "bvk-b" : "bvk-a"} br-tona-in` }));
      }
    }
    for (; i < def.parts; i++) svg.append(s("rect", { x: X0 + i * w, y: 4, width: w, height: H, class: "br-yta bvk-del" }));
    for (let j = 1; j < def.parts; j++) svg.append(s("line", { class: "br-grans", x1: X0 + j * w, x2: X0 + j * w, y1: 4, y2: 4 + H }));
    svg.append(s("rect", { class: "br-kontur", x: X0, y: 4, width: B, height: H, rx: 4 }));
    svg.setAttribute("aria-label", `Tom stav delad i ${def.parts} lika delar${fyllda() ? `, ${fyllda()} fyllda` : ""}`);
  }
  for (const k of kallor) {
    k.onFlytta(() => {
      const i = ordning.indexOf(k);
      if (k.flyttad && i < 0) ordning.push(k);
      if (!k.flyttad && i >= 0) ordning.splice(i, 1);
      rita();
    });
  }
  rita();
  return {
    id: def.id,
    el,
    svar: () => (ordning.length ? { selected: Array.from({ length: fyllda() }, (_, i) => delId(i)) } : null),
    satt(a) {
      const n = a?.selected?.length || 0;
      const vill = n === kallor.reduce((x, k) => x + k.stav.marked, 0) ? kallor
        : kallor.filter((k) => k.stav.marked === n).slice(0, 1);
      for (const k of kallor) if (k.flyttad !== vill.includes(k)) k.satFlyttad(vill.includes(k), true);
    },
    rensa() { ordning.length = 0; rita(); },
    las() {},
    validera: () => (fyllda() === kallor.reduce((x, k) => x + k.stav.marked, 0) ? null : "Flytta båda bitarna till den tomma staven först."),
    highlight() {},
  };
}
