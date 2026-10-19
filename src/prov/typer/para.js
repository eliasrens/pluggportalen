// ============================================================================
// Prov (#738) – frågetypen "para": eleven parar ihop begrepp och förklaringar
// (3–10 par). Läraren skriver `par: [{ vanster, hoger }]`. Eleven får
// vänsterleden i lärarens ordning och högerleden BLANDADE (stabilt per
// fråge-id, aldrig i facit-ordning – och sedan #763 en av `blandningar` per
// elev). Svar = lista med valt högerled per vänsterled ("" = inte parat).
// Delpoäng per rätt par.
// ============================================================================

import { forslagAv } from "../prov-rattning.js";
import { GRANS, blanda, blandningar, elevBlandning, elevFalt, strangLista, textLista, trimmad, valideraGemensamt } from "./delat.js";
import { elevKontext, h } from "../prov-vy.js";
import { dragbar } from "../prov-dra.js";
import { paraKoppla, paraStatus, paraTryck } from "../prov-ordna-para.js";
import { ingetSvar, mark, svarsVyer } from "../prov-svar-vy.js";

/** Valt högerled per vänsterled; okända val blir "". */
function rensaSvar(svar, f) {
  const giltiga = new Set(f.hoger);
  return strangLista(svar, f.vanster.length, GRANS.alternativ).map((s) => (giltiga.has(s) ? s : ""));
}

// Svaret efter provet (#741): elevens par, ✓/✗ per par och det rätta vid fel.
function visa(f, svar, o) {
  const lista = Array.isArray(svar) ? svar : [];
  if (!lista.some((s) => s)) return ingetSvar(o);
  return h("ul", { class: "provv-sv-par" }, f.vanster.map((v, i) => {
    const valt = lista[i] || "";
    const ratt = o.facit?.par?.[i]?.hoger;
    const ok = o.facit ? valt === ratt : null;
    return h("li", { class: `provv-sv-par-rad${o.facit ? (ok ? " provv-sv-ok" : " provv-sv-nej") : ""}` },
      h("span", { class: "provv-sv-par-v", text: v }),
      h("span", { class: "provv-sv-pil", "aria-hidden": "true", text: "→" }),
      valt ? h("span", { text: valt }) : h("span", { class: "provv-sv-inget", text: "inget valt" }),
      o.facit ? mark(ok) : null,
      o.facit && !ok && o.facitRad !== false ? h("span", { class: "provv-sv-luckfacit", text: `(${ratt})` }) : null);
  }));
}

export default {
  id: "para",
  namn: "Para ihop",
  ikon: "🔗",
  beskrivning: "Eleven parar ihop begrepp och förklaringar.",
  autoratt: true,

  validera(f) {
    const { fel, varningar, value } = valideraGemensamt(f);
    let par = [];
    if (!Array.isArray(f.par)) fel.push('"par" måste vara en lista med { "vanster": "…", "hoger": "…" }');
    else {
      par = f.par.map((p) => ({ vanster: trimmad(p?.vanster), hoger: trimmad(p?.hoger) }));
      const v = textLista(par.map((p) => p.vanster), { namn: "par", min: 3, max: 10, unika: true });
      const h = textLista(par.map((p) => p.hoger), { namn: "par", min: 3, max: 10, unika: true });
      fel.push(...v.fel.map((x) => x.replace(/^par (\d+)/, "par $1, vänster led,")));
      fel.push(...h.fel.filter((x) => !/krävs/.test(x)).map((x) => x.replace(/^par (\d+)/, "par $1, höger led,")));
    }
    return { ok: !fel.length, fel, varningar, value: { ...value, typ: "para", par } };
  },

  facit: (f) => ({ par: f.par.map((p) => ({ ...p })) }),
  utanFacit: (f) => ({
    ...elevFalt(f),
    vanster: f.par.map((p) => p.vanster),
    hoger: blanda(f.par.map((p) => p.hoger), `para:${f.id}`),
    blandningar: blandningar(f.par.map((p) => p.hoger), `para:${f.id}`),
  }),
  tomtSvar: (f) => Array(f.vanster.length).fill(""),
  arBesvarad: (svar) => Array.isArray(svar) && svar.some((s) => typeof s === "string" && s !== ""),
  rensaSvar,

  forslag(svar, facit, f) {
    const lista = Array.isArray(svar) ? svar : [];
    const ratt = facit.par.filter((p, i) => lista[i] === p.hoger).length;
    return forslagAv(ratt / facit.par.length, f.poang);
  },

  facitText: (f, facit) => (facit?.par || []).map((p) => `${p.vanster} → ${p.hoger}`).join(" · "),
  ...svarsVyer(visa),

  /**
   * Elevens svarsruta (#763, §2.3.1): tryck på ett begrepp och sedan på en
   * förklaring – paret får samma färg, samma siffra och en tunn linje (färgen
   * är aldrig ensam). Ett tryck på ett par tar isär det; att dra ett begrepp
   * till en förklaring (eller tvärtom) fungerar också. Inga menyer.
   */
  renderElev(f, svar, o) {
    const k = elevKontext(svar, o);
    const hoger = elevBlandning(f.hoger, f.blandningar, k.elevId, f.id);
    // Gamla svar (listrutorna före #763) kunde välja samma förklaring två gånger – rutan visar den första.
    let st = { svar: rensaSvar(k.svar, f).map((x, i, l) => (l.indexOf(x) === i ? x : "")), vald: null };
    const vKol = h("div", { class: "provv-para-kol", role: "group", "aria-label": "Begrepp" });
    const hKol = h("div", { class: "provv-para-kol", role: "group", "aria-label": "Förklaringar" });
    const linjer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    linjer.setAttribute("class", "provv-para-linjer");
    linjer.setAttribute("aria-hidden", "true");
    const yta = h("div", { class: "provv-para-yta" }, vKol, linjer, hKol);
    const status = h("div", { class: "provv-para-status", "aria-live": "polite" });
    const rot = h("div", { class: `provv-para${k.las ? " provv-last" : ""}` },
      k.las ? null : h("p", { class: "provv-para-hjalp", text: "Tryck på ett begrepp och sedan på det som hör ihop med det. Tryck på ett par för att ta isär det." }),
      yta, status);

    const ny = (nytt, fokus) => {
      const andrat = nytt.svar !== st.svar;
      st = nytt;
      if (andrat) {
        k.andra([...st.svar]);
        k.lamna();
      }
      rita(fokus);
    };
    const tryck = (sida, varde) => ny(paraTryck(st, sida, varde), [sida, varde]);
    // Dra ett begrepp till en förklaring (eller tvärtom) = koppla dem.
    const gorDragbar = (knapp, sida, varde) => {
      const andra = sida === "v" ? "[data-h]" : "[data-v]";
      let senast = null;
      const markera = (m) => { senast?.classList.remove("provv-para-over"); senast = m && rot.contains(m) ? m : null; senast?.classList.add("provv-para-over"); };
      dragbar(knapp, {
        onRor: ({ mal }) => markera(mal?.closest?.(andra)),
        onSlut: () => markera(null),
        onSlapp: ({ mal }) => {
          const m = mal?.closest?.(andra);
          if (!m || !rot.contains(m)) return;
          const [i, x] = sida === "v" ? [varde, hoger[Number(m.dataset.h)]] : [Number(m.dataset.v), varde];
          ny({ svar: paraKoppla(st.svar, i, x), vald: null }, [sida, varde]);
        },
      });
    };
    const knapp = (sida, varde, text, i, nr) => {
      const parat = nr > 0;
      const vald = st.vald?.sida === sida && st.vald.varde === varde;
      const motsvar = sida === "v" ? st.svar[i] : f.vanster[nr - 1];
      const b = h("button", {
        type: "button", class: `provv-para-sak${parat ? ` provv-par provv-par-f${(nr - 1) % 10}` : ""}${vald ? " provv-para-vald" : ""}`,
        [`data-${sida}`]: String(i), disabled: !!k.las, "aria-pressed": vald ? "true" : "false",
        "aria-label": parat ? `${text} – par ${nr} med ${motsvar}. Tryck för att ta isär.` : `${text}${vald ? " – vald" : ""}`,
        on: { click: () => tryck(sida, varde) },
      }, h("span", { class: "provv-para-nr", "aria-hidden": "true", text: parat ? String(nr) : "" }), h("span", { class: "provv-para-text", text }));
      if (!k.las) gorDragbar(b, sida, varde);
      return b;
    };
    const rita = (fokus) => {
      vKol.replaceChildren(...f.vanster.map((v, i) => knapp("v", i, v, i, st.svar[i] ? i + 1 : 0)));
      hKol.replaceChildren(...hoger.map((x, j) => knapp("h", x, x, j, st.svar.indexOf(x) + 1)));
      status.textContent = paraStatus(st.svar);
      if (fokus) (fokus[0] === "v" ? vKol.children[fokus[1]] : hKol.children[hoger.indexOf(fokus[1])])?.focus();
      ritaLinjer();
    };
    // Tunna linjer mellan paren, i paret färg (SVG över mellanrummet).
    const ritaLinjer = () => {
      if (typeof linjer.getBoundingClientRect !== "function") return;
      const r = yta.getBoundingClientRect();
      linjer.replaceChildren(...st.svar.flatMap((x, i) => {
        const j = x ? hoger.indexOf(x) : -1;
        if (j < 0) return [];
        const a = vKol.children[i].getBoundingClientRect();
        const b = hKol.children[j].getBoundingClientRect();
        const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
        l.setAttribute("class", `provv-par-f${i % 10}`);
        l.setAttribute("x1", a.right - r.left); l.setAttribute("y1", a.top + a.height / 2 - r.top);
        l.setAttribute("x2", b.left - r.left); l.setAttribute("y2", b.top + b.height / 2 - r.top);
        return [l];
      }));
    };
    if (typeof ResizeObserver === "function") new ResizeObserver(ritaLinjer).observe(yta);
    rita();
    return rot;
  },
};
