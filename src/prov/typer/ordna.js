// ============================================================================
// Prov (#738) – frågetypen "ordna": eleven sätter 3–10 saker i rätt ordning
// (händelser i tid, steg i en process). Läraren skriver `saker` i RÄTT
// ordning; eleven får dem blandade (stabilt per fråge-id, aldrig i facit-
// ordning – och sedan #763 en av `blandningar` per elev). Svar = elevens
// ordning som lista med texterna, [] = inte rörd. Sedan #763 sparas även en
// påbörjad ordning (de placerade först), men besvarad är den först när alla
// platser är fyllda. Delpoäng per sak på rätt plats.
// ============================================================================

import { forslagAv } from "../prov-rattning.js";
import { blanda, blandningar, elevBlandning, elevFalt, textLista, valideraGemensamt } from "./delat.js";
import { elevKontext, h } from "../prov-vy.js";
import { dragbar } from "../prov-dra.js";
import { ordnaKvar, ordnaLagg, ordnaSlapp, ordnaStatus, ordnaTaBort } from "../prov-ordna-para.js";
import { facitRad, ingetSvar, mark, svarsVyer } from "../prov-svar-vy.js";

const ordningText = (facit) => (facit?.ordning || []).map((s, i) => `${i + 1}. ${s}`).join("  ");

/** Provets saker, var och en högst en gång – annars "inte rörd". En påbörjad ordning (#763) godtas. */
function rensaSvar(svar, f) {
  if (!Array.isArray(svar) || svar.length > f.saker.length) return [];
  const kvar = new Set(f.saker);
  return svar.every((s) => kvar.delete(s)) ? [...svar] : [];
}

// Svaret efter provet (#741): elevens ordning, ✓/✗ per plats och rätt ordning.
function visa(f, svar, o) {
  const lista = Array.isArray(svar) ? svar : [];
  if (!lista.length) return h("div", {}, ingetSvar(o), facitRad(o, "Rätt ordning", ordningText(o.facit)));
  return h("div", {},
    h("ol", { class: "provv-sv-ordna" }, lista.map((s, i) => {
      const ok = o.facit ? o.facit.ordning?.[i] === s : null;
      return h("li", { class: o.facit ? (ok ? "provv-sv-ok" : "provv-sv-nej") : "" }, h("span", { text: s }), o.facit ? mark(ok) : null);
    })),
    facitRad(o, "Rätt ordning", ordningText(o.facit)));
}

export default {
  id: "ordna",
  namn: "Sätt i ordning",
  ikon: "🔢",
  beskrivning: "Eleven sätter saker i rätt ordning.",
  autoratt: true,

  validera(f) {
    const { fel, varningar, value } = valideraGemensamt(f);
    const saker = textLista(f.saker, { namn: "saker", min: 3, max: 10, unika: true });
    fel.push(...saker.fel.map((x) => x.replace(/^saker (\d+)/, "sak $1")));
    return { ok: !fel.length, fel, varningar, value: { ...value, typ: "ordna", saker: saker.value } };
  },

  facit: (f) => ({ ordning: [...f.saker] }),
  utanFacit: (f) => ({ ...elevFalt(f), saker: blanda(f.saker, `ordna:${f.id}`), blandningar: blandningar(f.saker, `ordna:${f.id}`) }),
  tomtSvar: () => [],
  /** Besvarad först när alla platser är fyllda (#763) – annars "3 av 5 placerade". */
  arBesvarad: (svar, f) => Array.isArray(svar) && svar.length > 0 && (!f?.saker || svar.length === f.saker.length),
  rensaSvar,

  forslag(svar, facit, f) {
    const lista = Array.isArray(svar) ? svar : [];
    // En påbörjad ordning är obesvarad (#763) – 0 p överallt, som i "Rätta alla".
    if (lista.length !== facit.ordning.length) return forslagAv(0, f.poang);
    const ratt = facit.ordning.filter((s, i) => lista[i] === s).length;
    return forslagAv(ratt / facit.ordning.length, f.poang);
  },

  facitText: (f, facit) => ordningText(facit),
  ...svarsVyer(visa),

  /**
   * Elevens svarsruta (#763, §2.3.1): "tryck i tur och ordning". Sakerna
   * ligger blandade i "Kvar"; ett tryck lägger saken på nästa lediga plats i
   * "Ditt svar" (n saker = n tryck), ett tryck i svaret lägger tillbaka den
   * och sakerna under flyttar upp. Dra och släpp är ett extra sätt. Tab +
   * Enter fungerar (vanliga knappar). Logiken: prov-ordna-para.js.
   */
  renderElev(f, svar, o) {
    const k = elevKontext(svar, o);
    const alla = elevBlandning(f.saker, f.blandningar, k.elevId, f.id);
    const n = alla.length;
    let placerade = rensaSvar(k.svar, f);
    const svarLista = h("ol", { class: "provv-ordna-svar", "aria-label": "Ditt svar" });
    const kvarRuta = h("div", { class: "provv-ordna-kvar", role: "group", "aria-label": "Kvar", "data-kvar": "" });
    const status = h("span", { class: "provv-ordna-status", "aria-live": "polite" });
    const borjaOm = h("button", { type: "button", class: "provv-knapp-liten", text: "Börja om" });
    const rot = h("div", { class: `provv-ordna${k.las ? " provv-last" : ""}` },
      k.las ? null : h("p", { class: "provv-ordna-hjalp", text: "Tryck på den som kommer först, sedan nästa … Tryck på en sak i ditt svar för att ta bort den." }),
      h("div", { class: "provv-ordna-rubrik", text: "Ditt svar" }), svarLista,
      h("div", { class: "provv-ordna-rubrik", text: "Kvar" }), kvarRuta,
      h("div", { class: "provv-ordna-fot" }, k.las ? null : borjaOm, status));

    const valj = (ny, fokus) => {
      if (ny === placerade) return;
      placerade = ny;
      k.andra([...placerade]);
      k.lamna();
      rita(fokus);
    };
    // Dra: släpp på en plats i svaret, eller tillbaka i "Kvar".
    const gorDragbar = (knapp, sak) => {
      const over = (mal) => mal?.closest?.("[data-plats], [data-kvar]");
      let senast = null;
      const markera = (m) => { senast?.classList.remove("provv-ordna-over"); senast = m && rot.contains(m) ? m : null; senast?.classList.add("provv-ordna-over"); };
      dragbar(knapp, {
        onRor: ({ mal }) => markera(over(mal)),
        onSlut: () => markera(null),
        onSlapp: ({ mal }) => {
          const m = over(mal);
          if (!m || !rot.contains(m)) return;
          if (m.hasAttribute("data-kvar")) {
            if (placerade.includes(sak)) valj(ordnaTaBort(placerade, placerade.indexOf(sak)), ["kvar", 0]);
          } else valj(ordnaSlapp(placerade, sak, Number(m.dataset.plats)), ["svar", Number(m.dataset.plats)]);
        },
      });
    };

    const rita = (fokus) => {
      const kvar = ordnaKvar(alla, placerade);
      svarLista.replaceChildren(...alla.map((_, i) => {
        const sak = placerade[i];
        const plats = h("li", { class: `provv-ordna-plats${sak ? "" : " provv-ordna-ledig"}`, "data-plats": String(i) },
          h("span", { class: "provv-ordna-nr", "aria-hidden": "true", text: `${i + 1}.` }));
        if (!sak) {
          plats.append(h("span", { class: "provv-ordna-tom", text: k.las ? "" : "___" }));
          return plats;
        }
        const knapp = h("button", {
          type: "button", class: "provv-ordna-sak", "data-svar": String(i), text: sak, disabled: !!k.las,
          "aria-label": `Plats ${i + 1}: ${sak}. Tryck för att ta bort.`,
          on: { click: () => valj(ordnaTaBort(placerade, i), ["svar", i]) },
        });
        if (!k.las) gorDragbar(knapp, sak);
        plats.append(knapp);
        return plats;
      }));
      kvarRuta.replaceChildren(...(kvar.length ? kvar.map((sak, j) => {
        const knapp = h("button", {
          type: "button", class: "provv-ordna-sak", "data-kvar-sak": String(j), text: sak, disabled: !!k.las,
          "aria-label": `${sak}. Tryck för att lägga på plats ${placerade.length + 1}.`,
          on: { click: () => valj(ordnaLagg(placerade, sak, n), ["kvar", j]) },
        });
        if (!k.las) gorDragbar(knapp, sak);
        return knapp;
      }) : [h("span", { class: "provv-ordna-klart", text: "Alla är placerade." })]));
      status.textContent = ordnaStatus(placerade.length, n);
      borjaOm.disabled = !placerade.length;
      if (fokus) satFokus(fokus);
    };
    // Fokus stannar nära trycket (tangentbordet): nästa sak i "Kvar", annars svaret.
    const satFokus = ([var_, i]) => {
      const kvarKn = [...kvarRuta.querySelectorAll("button")];
      const svarKn = [...svarLista.querySelectorAll("button")];
      const forsta = var_ === "kvar" ? kvarKn[Math.min(i, kvarKn.length - 1)] || svarKn[svarKn.length - 1]
        : svarKn[Math.min(i, svarKn.length - 1)] || kvarKn[0];
      (forsta || borjaOm).focus();
    };
    borjaOm.addEventListener("click", () => valj([], ["kvar", 0]));
    rita();
    return rot;
  },
};
