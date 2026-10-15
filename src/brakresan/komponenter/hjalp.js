// ============================================================================
// Bråkresan – 11. Hjälppanel (komponenter/hjalp.js) · #707
// ----------------------------------------------------------------------------
// Spec §4 komponent 11 + §5 "Hjälp i fyra steg": orientering → princip →
// modellering → återgång. Stegen visas ett i taget ("Nästa ledtråd") – de är
// möjliga ledtrådar, inget tvång. Kort text, komponentnära: ett steg kan peka
// på elevens modell (`highlight`, t.ex. { whole: true }) och visa en egen
// liten modell med ANDRA tal (`view`). Hjälpen fyller aldrig i facit.
// "Tillbaka till uppgiften" stänger och lämnar tillbaka fokus (spec §14).
// En enkel ordlista (täljare, nämnare, helhet …) nås från panelen (spec §11).
//
// createHjalp(host, help, opts)
//   help = task.help: [{ step, text, view?, highlight? }]
//   opts = { model, returnFocus, onStep(step), onClose() }
//     model       – uppgiftens komponent (för highlight)
//     onStep      – anropas när ett steg visas första gången (hjälp före/efter fel registreras av sidan)
// → { el, open(), next(), close(), isOpen(), shownSteps(), destroy() }
// ============================================================================

import { h, ensureCss } from "./bas.js";

export const STEG_RUBRIK = Object.freeze({
  orientering: "Titta på helheten",
  princip: "Så fungerar det",
  modellering: "Ett exempel",
  atergang: "Nu provar du själv",
});

export const ORDLISTA = Object.freeze([
  ["Täljare", "Talet ovanför bråkstrecket. Det säger hur många delar vi har."],
  ["Nämnare", "Talet under bråkstrecket. Det säger hur många lika stora delar helheten är delad i."],
  ["Helhet", "Det som är 1 – hela staven, hela cirkeln eller hela samlingen."],
  ["Andel", "Hur stor del av helheten något är, till exempel tre fjärdedelar."],
  ["Tiondel", "En av tio lika stora delar: 1/10 = 0,1."],
  ["Hundradel", "En av hundra lika stora delar: 1/100 = 0,01."],
  ["Procent", "Hundradelar. 1 % = 1/100, 50 % = hälften."],
]);

export function createHjalp(host, help = [], opts = {}) {
  ensureCss();
  const steg = help.filter((x) => x && STEG_RUBRIK[x.step]);
  const visade = [];
  let oppen = false;
  const rubrik = h("h3", { class: "br-hjalp-rubrik", tabindex: "-1" }, "Hjälp");
  const lista = h("ol", { class: "br-hjalp-steg" });
  const nasta = h("button", { type: "button", class: "br-knapp br-knapp--hjalp" }, "Nästa ledtråd");
  const tillbaka = h("button", { type: "button", class: "br-knapp br-knapp--tillbaka" }, "Tillbaka till uppgiften");
  const ordlista = h("details", { class: "br-ordlista" }, h("summary", null, "Ordlista"),
    h("dl", null, ORDLISTA.flatMap(([ord, forklaring]) => [h("dt", null, ord), h("dd", null, forklaring)])));
  const el = h("section", { class: "br-hjalp", "aria-label": "Hjälp", hidden: true },
    rubrik, lista, h("div", { class: "br-hjalp-knappar" }, nasta, tillbaka), ordlista);
  host.append(el);
  const mini = [];

  /** Vad stegets markering på elevens modell är (orienteringen pekar på helheten). */
  const markering = (x) => x.highlight || (x.step === "orientering" ? { whole: true } : null);

  function visaSteg(i) {
    const x = steg[i];
    const li = h("li", { class: `br-hjalp-ett br-hjalp--${x.step}` },
      h("strong", { class: "br-hjalp-stegnamn" }, STEG_RUBRIK[x.step]), h("p", null, x.text));
    if (x.view?.component) {
      const yta = h("div", { class: "br-hjalp-modell" });
      li.append(yta);
      import("./index.js").then(({ createComponent }) => createComponent(yta, x.view, { interactive: false, size: "kort" }))
        .then((k) => mini.push(k)).catch(() => yta.remove());
    }
    lista.append(li);
    visade.push(x.step);
    opts.model?.highlight?.(markering(x));
    opts.onStep?.(x.step);
    nasta.hidden = visade.length >= steg.length;
    li.setAttribute("tabindex", "-1");
    li.focus({ preventScroll: false });
  }

  nasta.addEventListener("click", () => api.next());
  tillbaka.addEventListener("click", () => api.close());
  el.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); api.close(); } });

  const api = {
    el,
    /** Öppna panelen; första gången visas första steget. */
    open() {
      el.hidden = false;
      oppen = true;
      if (!visade.length && steg.length) visaSteg(0);
      else {
        // Öppnad igen: senaste stegets markering tillbaka på modellen (t.ex. 12:s jämförelsestavar).
        if (visade.length) opts.model?.highlight?.(markering(steg[visade.length - 1]));
        rubrik.focus();
      }
      nasta.hidden = visade.length >= steg.length;
    },
    next() {
      if (!oppen) return api.open();
      if (visade.length < steg.length) visaSteg(visade.length);
    },
    close() {
      el.hidden = true;
      oppen = false;
      opts.model?.highlight?.(null);
      opts.onClose?.();
      opts.returnFocus?.focus?.();
    },
    isOpen: () => oppen,
    shownSteps: () => [...visade],
    destroy() { for (const k of mini) k.destroy?.(); el.remove(); },
  };
  return api;
}
