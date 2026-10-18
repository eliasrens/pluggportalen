// ============================================================================
// Prov (#747, spec §13 "Skriv ut provet"): provet på papper – en svarsyta per
// frågetyp att skriva/kryssa i med penna, och facit på ett eget blad.
// Elevens frågor (utanFacit, som på tillfället) – alternativen i samma
// blandade ordning som på skärmen. En typ som saknas här får skrivlinjer, så
// en ny frågetyp fungerar utan att den här filen ändras (registret, §2).
//
//   provSidor(o)       → [HTMLElement] provets sidor (rubrik + namnrad + frågor)
//   facitSida(o)       → HTMLElement facit (nummer → rätt svar / bedömningsstöd)
//   skrivlinjer(n)     → n tomma linjer
// Avsnitt (#765): rubriken med avsnittets poäng ("Del 1 – Begrepp (8 p)"),
// facit grupperat per avsnitt; frågorna numreras löpande, decimalkomma.
// CSS: prov-utskrift.css (.provl-ut-).
// ============================================================================

import { fragetyp } from "./prov-fragetyper.js";
import { avsnittsGrupper, fragaNummer, maxPoang } from "./prov-modell.js";
import { h, stycken } from "./prov-vy.js";
import { poangP } from "./prov-poang.js";

const BOKSTAV = "ABCDEFGHIJ";
const kort = (s) => { const t = Array.from(String(s ?? "").replace(/\s+/g, " ").trim()); return t.length > 120 ? `${t.slice(0, 119).join("")}…` : t.join(""); };
const poangText = poangP;

export function skrivlinjer(n) {
  return h("div", { class: "provl-ut-linjer", "aria-hidden": "true" }, Array.from({ length: n }, () => h("span", { class: "provl-ut-linje" })));
}

/** Rader att kryssa i: ○ (ett svar) eller ☐ (flera). */
function kryssLista(texter, symbol) {
  return h("ul", { class: "provl-ut-kryss" }, texter.map((t) => h("li", {}, h("span", { class: "provl-ut-ruta", text: symbol }), h("span", { text: t }))));
}

const instruktion = (text) => h("p", { class: "provl-ut-instr", text });

// Svarsytan per frågetyp. Fritext: fler linjer ju fler poäng.
const PAPPER = {
  flerval: (f) => [instruktion("Kryssa i ett svar."), kryssLista(f.alternativ || [], "○")],
  "flerval-flera": (f) => [instruktion("Kryssa i alla som stämmer."), kryssLista(f.alternativ || [], "☐")],
  santfalskt: () => [instruktion("Kryssa i Sant eller Falskt."), h("p", { class: "provl-ut-santfalskt" },
    h("span", {}, h("span", { class: "provl-ut-ruta", text: "☐" }), " Sant"), h("span", {}, h("span", { class: "provl-ut-ruta", text: "☐" }), " Falskt"))],
  kortsvar: () => [skrivlinjer(1)],
  lucktext: (f) => [instruktion("Skriv det som saknas på linjerna."),
    h("p", { class: "provl-ut-lucktext" }, (f.delar || []).map((d) => (typeof d.t === "string" ? d.t
      : h("span", { class: "provl-ut-lucka" }, h("span", { class: "provl-ut-luckanr", text: `(${d.lucka + 1})` })))))],
  para: (f) => [instruktion("Skriv bokstaven för det som hör ihop på linjen."),
    h("div", { class: "provl-ut-para" },
      h("ol", { class: "provl-ut-para-v" }, (f.vanster || []).map((t) => h("li", {}, h("span", { text: t }), h("span", { class: "provl-ut-bokstavslinje" })))),
      h("ul", { class: "provl-ut-para-h" }, (f.hoger || []).map((t, i) => h("li", {}, h("b", { text: `${BOKSTAV[i]}. ` }), t))))],
  ordna: (f) => [instruktion(`Skriv 1 vid det som kommer först, 2 vid nästa … till ${(f.saker || []).length}.`),
    h("ul", { class: "provl-ut-kryss" }, (f.saker || []).map((t) => h("li", {}, h("span", { class: "provl-ut-nrruta", "aria-hidden": "true" }), h("span", { text: t }))))],
  fritext: (f) => [skrivlinjer(Math.min(16, Math.max(6, 4 + 2 * (Number(f.poang) || 1))))],
};

/** Avsnittens maxpoäng per avsnitts-id (#765) – bara avsnitt med frågor. */
export function avsnittMax(fragor) {
  return new Map(avsnittsGrupper(fragor).filter((g) => g.avsnitt && g.fragor.length).map((g) => [g.avsnitt.id, g.maxPoang]));
}

/** En fråga, ett textblock eller ett avsnitt (#762) på papper. avMax = avsnittets maxpoäng (#765). */
function pappersFraga(f, nr, poangsatt, avMax) {
  const typ = fragetyp(f.typ);
  if (f.typ === "avsnitt") {
    return h("section", { class: "provl-ut-avsnitt" },
      h("h2", { class: "provl-ut-avsnitt-titel" }, f.titel || "",
        poangsatt && avMax ? h("span", { class: "provl-ut-p", text: ` (${poangText(avMax)})` }) : null),
      f.instruktion ? stycken(f.instruktion, "provl-ut-instr") : null);
  }
  if (typ?.arFraga === false) {
    return h("section", { class: "provl-ut-textblock" },
      f.titel ? h("h3", { class: "provl-ut-textblock-titel", text: f.titel }) : null, stycken(f.brodtext));
  }
  const yta = PAPPER[f.typ] ? PAPPER[f.typ](f) : [skrivlinjer(3)];
  return h("section", { class: "provl-ut-fraga" },
    h("div", { class: "provl-ut-fraga-huvud" },
      h("span", { class: "provl-ut-nr", text: String(nr) }),
      h("div", { class: "provl-ut-fragetext" }, stycken(f.fraga)),
      poangsatt ? h("span", { class: "provl-ut-p", text: `(${poangText(f.poang ?? 0)})` }) : null),
    f.hjalptext ? h("p", { class: "provl-ut-hjalp", text: f.hjalptext }) : null,
    h("div", { class: "provl-ut-yta" }, yta));
}

/** Rubriken med namnrad: "Namn ____  Klass 4B  Datum ____". */
export function namnrad(klassNamn) {
  const falt = (etikett, varde, cls) => h("span", { class: `provl-ut-falt ${cls}` }, h("span", { class: "provl-ut-falt-namn", text: etikett }),
    varde ? h("span", { class: "provl-ut-falt-varde", text: varde }) : h("span", { class: "provl-ut-falt-linje" }));
  return h("div", { class: "provl-ut-namnrad" }, falt("Namn", "", "provl-ut-falt-namn-lang"), falt("Klass", klassNamn || "", ""), falt("Datum", "", ""));
}

/**
 * Provets sidor (§13): rubrik, namnrad och frågorna. Sidbrytningarna gör
 * webbläsaren (en fråga delas inte om den får plats på nästa sida).
 * @param {{ namn: string, klassNamn?: string, fragor: object[], poangsatt?: boolean }} o
 */
export function provSidor({ namn, klassNamn, fragor, poangsatt = true }) {
  const nr = fragaNummer(fragor);
  const max = maxPoang(fragor);
  const avMax = avsnittMax(fragor);
  return [h("article", { class: "provv-rot provl-ut-sida" },
    h("header", { class: "provl-ut-huvud" },
      h("h1", { class: "provl-ut-titel", text: namn || "Prov" }),
      namnrad(klassNamn),
      poangsatt && max ? h("p", { class: "provl-ut-max", text: `Provet ger högst ${poangText(max)}.` }) : null),
    h("div", { class: "provl-ut-fragor" }, fragor.map((f) => pappersFraga(f, nr[f.id], poangsatt, avMax.get(f.id)))))];
}

/** Facit för en fråga som text; para får bokstäverna från pappret. */
function facitFor(f, facit, stod, krit) {
  if (f.typ === "para" && facit?.par) {
    return facit.par.map((p) => `${p.vanster} → ${BOKSTAV[(f.hoger || []).indexOf(p.hoger)] || "?"} (${p.hoger})`).join(" · ");
  }
  const text = fragetyp(f.typ)?.facitText?.(f, facit) || "";
  if (text) return text;
  const delar = [stod ? `Bedömningsstöd: ${stod}` : "", krit?.length ? `Poängkriterier: ${krit.join(" · ")}` : ""].filter(Boolean);
  return delar.length ? delar.join(" ") : "Bedöms av läraren.";
}

/**
 * Facit på ett eget blad (§13 "Ett val avgör om facit skrivs ut separat").
 * @param {{ namn, fragor, facit, bedomningsstod?, kriterier?, poangsatt? }} o  kriterier = poängkriterierna (#762)
 */
export function facitSida({ namn, fragor, facit = {}, bedomningsstod = {}, kriterier = {}, poangsatt = true }) {
  const nr = fragaNummer(fragor);
  // Grupperat per avsnitt (#765) – ett prov utan avsnitt är en grupp utan rubrik, som förut.
  const grupper = avsnittsGrupper(fragor).filter((g) => g.fragor.length);
  return h("article", { class: "provv-rot provl-ut-sida provl-ut-facitsida" },
    h("header", { class: "provl-ut-huvud" }, h("h1", { class: "provl-ut-titel", text: `Facit – ${namn || "Prov"}` }),
      h("p", { class: "provl-ut-max", text: "Till läraren. Dela inte ut det här bladet." })),
    grupper.flatMap((g) => [
      g.avsnitt ? h("h2", { class: "provl-ut-avsnitt provl-ut-avsnitt-titel" }, g.avsnitt.titel || "",
        poangsatt ? h("span", { class: "provl-ut-p", text: ` (${poangText(g.maxPoang)})` }) : null) : null,
      h("ol", { class: "provl-ut-facit" }, g.fragor.map((f) => h("li", { value: String(nr[f.id]) },
        h("span", { class: "provl-ut-facit-fraga", text: kort(f.fraga) }),
        poangsatt ? h("span", { class: "provl-ut-p", text: ` (${poangText(f.poang ?? 0)})` }) : null,
        h("span", { class: "provl-ut-facit-svar", text: facitFor(f, facit[f.id], bedomningsstod[f.id], kriterier[f.id]) }))))]));
}
