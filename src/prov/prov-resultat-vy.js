// ============================================================================
// Prov (#741, spec §7 "Elevens resultatvy"): det rättade provet som eleven
// ser det efter tillbakalämningen – utan Firebase (prov-elev-sida.js hämtar,
// previewn stubbar). Namn och datum överst, totalen, nivån och pluggmynten
// ("+36 mynt", #746), lärarens helhetskommentar, sedan varje fråga med
// elevens svar, ✓/½/✗ med text, poängen, lärarens kommentar och facit om
// läraren valt att visa det.
// Lugn och uppmuntrande: inga fyrverkerier, ingen skam. CSS: prov-resultat.css.
// ============================================================================

import { coinIcon } from "../icons.js";
import { fragetyp } from "./prov-fragetyper.js";
import { myntText } from "./prov-mynt.js";
import { bedomning } from "./prov-rattning-logik.js";
import { h, laddaCss, stycken } from "./prov-vy.js";

const poangText = (p) => String(p).replace(".", ",");

/** "✓ Rätt" / "½ Delvis rätt" / "✗ Fel" – ikon + text, aldrig bara färg. */
export function bedomningsEtikett(ratt, { poang, max, poangsatt } = {}) {
  const b = bedomning(ratt);
  if (!b) return null;
  return h("span", { class: `provv-res-etikett provv-res-${b.id}` },
    h("span", { class: "provv-res-ikon", "aria-hidden": "true", text: b.ikon }),
    h("span", { text: b.namn }),
    poangsatt && max ? h("span", { class: "provv-res-p", text: ` · ${poangText(poang ?? 0)} av ${poangText(max)} p` }) : null);
}

/** "+36 mynt" med myntikonen (#746) – det eleven faktiskt fick, null om inga. */
function myntEtikett(n) {
  const text = myntText(n);
  if (!text) return null;
  const ikon = h("span", { class: "provv-res-mynt-ikon", "aria-hidden": "true" });
  ikon.innerHTML = coinIcon("1.1em");
  return h("span", { class: "provv-res-mynt" }, ikon, h("b", { text }));
}

/** Antal rätt/delvis/fel – summan när provet inte poängsätts. */
function rakna(poster) {
  const n = { ratt: 0, delvis: 0, fel: 0 };
  for (const p of poster) {
    const b = bedomning(p.post?.ratt);
    if (b) n[b.id]++;
  }
  return n;
}

/**
 * @param {ReturnType<import("./prov-rattning-logik.js").resultatModell>} m
 * @param {{ datum?: string, tillbakaHref?: string }} [o]
 * @returns {HTMLElement} .provv-rot med resultatet
 */
export function renderaResultat(m, o = {}) {
  laddaCss("prov-elev.css");
  laddaCss("prov-resultat.css");
  const n = rakna(m.poster);
  const summa = m.poangsatt
    ? h("p", { class: "provv-res-total" }, h("b", { text: `${poangText(m.totalPoang)} av ${poangText(m.maxPoang)}` }), " poäng")
    : h("p", { class: "provv-res-total" },
      h("b", { text: `${n.ratt} rätt` }), n.delvis ? ` · ${n.delvis} delvis rätt` : "", n.fel ? ` · ${n.fel} fel` : "");
  const topp = h("header", { class: "provv-res-topp" },
    h("h1", { class: "provv-sidrubrik", text: m.namn }),
    o.datum ? h("p", { class: "provv-res-datum", text: o.datum }) : null,
    h("div", { class: "provv-res-summa" }, summa,
      m.nivaNamn ? h("span", { class: "provv-res-niva", text: m.nivaNamn }) : null,
      myntEtikett(m.mynt)),
    h("p", { class: "provv-res-ton", text: "Här är ditt rättade prov. Läs lärarens kommentarer – de hjälper dig att lära dig ännu mer." }),
    m.helhetskommentar ? h("div", { class: "provv-res-helhet" },
      h("h2", { class: "provv-res-helhet-rubrik", text: "Från din lärare" }), stycken(m.helhetskommentar)) : null,
    m.visaFacit ? null : h("p", { class: "provv-res-hint", text: "Din lärare visar inte facit för det här provet." }));

  const fragor = m.poster.map(({ fraga: f, nr, svar, post, facit }) => {
    const typ = fragetyp(f.typ);
    if (!typ) return null;
    if (nr == null) {
      return h("details", { class: "provv-res-textblock" },
        h("summary", { text: f.titel || "Text" }), typ.renderResultat(f, null, {}));
    }
    const b = bedomning(post?.ratt);
    return h("section", { class: `provv-res-fraga${b ? ` provv-res-fraga-${b.id}` : ""}`, "aria-labelledby": `provv-res-${f.id}` },
      h("div", { class: "provv-fraga-huvud" },
        h("span", { class: "provv-nr", text: String(nr) }),
        h("div", { class: "provv-fragetext", id: `provv-res-${f.id}` }, stycken(f.fraga)),
        bedomningsEtikett(post?.ratt, { poang: post?.poang, max: f.poang, poangsatt: m.poangsatt })),
      h("div", { class: "provv-res-svar" }, typ.renderResultat(f, svar, { facit })),
      post?.kommentar ? h("p", { class: "provv-res-kommentar" }, h("b", { text: "Lärarens kommentar: " }), post.kommentar) : null);
  });

  return h("div", { class: "provv-rot" },
    h("div", { class: "provv-panel provv-res" },
      topp,
      h("div", { class: "provv-res-fragor" }, fragor.filter(Boolean)),
      h("p", {}, h("a", { href: o.tillbakaHref || "#/elev/prov", class: "provv-lank", text: "Till dina prov" }))));
}
