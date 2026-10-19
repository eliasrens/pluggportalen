// ============================================================================
// Prov (#747, spec §13): utskrift – samma mönster som inloggningskorten
// (teacher-login-print.js): en helskärmsvy med verktygsrad, sidorna som vita
// A4-blad på skärmen, och @media print (A4 stående) som döljer allt annat
// och skriver ut bladen. Ren klient: window.print(), inga läsningar.
//
//   skrivUtProv(o)      provet på papper: namnrad, frågor, skrivlinjer;
//                       kryssrutan "Facit på ett eget blad" (prov-utskrift-papper.js)
//   skrivUtProvDok(p)   samma för ett prov-dokument (Mina prov, redigeraren)
//   skrivUtResultat(o)  elevernas rättade prov, EN elev per sida: totalen,
//                       nivån, helhetskommentaren, varje fråga med svaret,
//                       bedömningen (✓ ½ ✗ + text), kommentaren och ev. facit;
//                       #765: poäng per avsnitt överst och vid avsnittsrubriken,
//                       poängkriterierna när provet visar dem för eleven
// Laddas med import() när läraren trycker på en utskriftsknapp (#271).
// CSS: prov-utskrift.css (.provl-ut-) + prov-elev.css/prov-resultat.css (svaren).
// ============================================================================

import { fragetyp } from "./prov-fragetyper.js";
import { ELEV_STATUS_NAMN, arBedomd, elevStatus, nivaNamn } from "./prov-rattning-logik.js";
import { bedomningsEtikett } from "./prov-resultat-vy.js";
import { FARG_INFO, andelFor, avsnittFor, avsnittText, avsnittVarde, fargFor, granserFor, procent } from "./prov-statistik.js";
import { facitSida, provSidor } from "./prov-utskrift-papper.js";
import { delaUppProv, fragaNummer, poangAvsnitt } from "./prov-modell.js";
import { h, laddaCss, stycken } from "./prov-vy.js";
import { poangTal } from "./prov-poang.js";

const dec = poangTal;

/**
 * Helskärmsvyn: rubrik, val, Skriv ut / Stäng och bladen.
 * @param {{ titel: string, hint: string, val?: HTMLElement[], rita: () => HTMLElement[] }} o
 * @returns {{ el: HTMLElement, rita: () => void, stang: () => void }}
 */
function utskriftsvy({ titel, hint, val = [], rita }) {
  const blad = h("div", { class: "provl-ut-blad" });
  const stang = () => {
    vy.remove();
    document.removeEventListener("keydown", tangent);
    window.removeEventListener("hashchange", stang);
    window.removeEventListener("popstate", stang);
    tillbaka?.focus?.();
  };
  const tangent = (e) => { if (e.key === "Escape") stang(); };
  const tillbaka = document.activeElement;
  const skrivUt = h("button", { type: "button", class: "btn gron small provl-ut-skriv", text: "🖨 Skriv ut", on: { click: () => window.print() } });
  const vy = h("div", { class: "provl-utskrift teacher-dark", role: "dialog", "aria-modal": "true", "aria-label": titel },
    h("div", { class: "provl-ut-verktyg" },
      h("h2", { class: "provl-ut-rubrik", text: titel }),
      h("div", { class: "provl-ut-val" }, val),
      h("div", { class: "provl-ut-knappar" }, skrivUt,
        h("button", { type: "button", class: "btn ghost small provl-ut-stang", text: "Stäng", on: { click: stang } }))),
    h("p", { class: "provl-ut-hint", text: hint }),
    blad);
  const ritaOm = () => blad.replaceChildren(...rita());
  ritaOm();
  document.addEventListener("keydown", tangent);
  // Byts sidan (Bakåt, menyn) stängs vyn – annars ligger den kvar över nästa sida (#749 F4).
  window.addEventListener("hashchange", stang);
  window.addEventListener("popstate", stang);
  document.body.append(vy);
  vy.scrollTop = 0;
  skrivUt.focus();
  return { el: vy, rita: ritaOm, stang };
}

function kryssruta(text, checked, onChange) {
  const inp = h("input", { type: "checkbox", checked });
  inp.addEventListener("change", () => onChange(inp.checked));
  return h("label", { class: "provl-kryss provl-ut-kryssval" }, inp, ` ${text}`);
}

async function laddaStilar() {
  await Promise.all(["prov-elev.css", "prov-resultat.css", "prov-utskrift.css"].map(laddaCss));
}

/**
 * Skriv ut provet (§13): pappersprovet, och facit på ett eget blad om läraren
 * kryssar i det (förvalt av).
 * @param {{ namn: string, klassNamn?: string, fragor: object[], facit?: object, bedomningsstod?: object, poangsatt?: boolean }} o
 *   fragor = elevens frågor (delaUppProv / tillfällets), facit + bedömningsstöd separat
 */
export async function skrivUtProv(o) {
  await laddaStilar();
  let medFacit = false;
  const harFacit = !!o.facit && Object.keys(o.facit).length > 0;
  const vy = utskriftsvy({
    titel: `Skriv ut provet – ${o.namn || "Prov"}`,
    hint: "A4 stående. Eleverna skriver namn, kryssar och skriver på linjerna. Facit hamnar alltid på ett eget blad – dela inte ut det.",
    val: harFacit ? [kryssruta("Skriv ut facit på ett eget blad", false, (v) => { medFacit = v; vy.rita(); })] : [],
    rita: () => [...provSidor(o), ...(medFacit && harFacit ? [facitSida(o)] : [])],
  });
  return vy;
}

/** "Skriv ut" i Mina prov och redigeraren: provet (med facit) delas som när det öppnas. */
export function skrivUtProvDok(prov) {
  const { fragor, facit, bedomningsstod, kriterier } = delaUppProv(prov);
  return skrivUtProv({ namn: prov.namn || "Namnlöst prov", fragor, facit, bedomningsstod, kriterier, poangsatt: prov.installningar?.poang !== false });
}

/** En elevs rättade prov på ett blad. */
function resultatSida(e, o) {
  const { fragor, poangsatt, granser, medFacit, facit = {}, kriterier = null } = o;
  const nr = fragaNummer(fragor);
  const r = e.r || null;
  const res = andelFor(r, fragor, poangsatt);
  const avsnitt = avsnittFor(r, poangAvsnitt(fragor), poangsatt, granser);
  const perAvsnitt = new Map(avsnitt.filter((a) => a.id).map((a) => [a.id, a]));
  const farg = fargFor(res.andel, granser);
  const nivaText = nivaNamn(r?.niva);
  const status = elevStatus(r, fragor);
  const total = res.andel == null
    ? h("span", { class: "provl-ut-total provl-ut-total-ej", text: "? Inte rättat än" })
    : h("span", { class: `provl-ut-total provl-ut-total-${farg}` },
      h("span", { "aria-hidden": "true", text: `${FARG_INFO[farg].ikon} ` }),
      `${poangsatt && res.max ? `${dec(res.poang)} av ${dec(res.max)} p · ` : ""}${procent(res.andel)} · ${FARG_INFO[farg].namn}`);
  return h("article", { class: "provv-rot provl-ut-sida provl-ut-resultat" },
    h("header", { class: "provl-ut-huvud" },
      h("p", { class: "provl-ut-overrad", text: [o.namn, o.klassNamn, o.datum].filter(Boolean).join(" · ") }),
      h("h1", { class: "provl-ut-titel", text: e.namn }),
      h("p", { class: "provl-ut-summa" }, total,
        nivaText ? h("span", { class: "provl-ut-niva", text: `Nivå: ${nivaText}` }) : null,
        status !== "tillbaka" && status !== "rattad" ? h("span", { class: "provl-ut-status", text: `${ELEV_STATUS_NAMN[status]} – ${res.bedomda} av ${res.antal} frågor rättade` }) : null),
      avsnitt.length ? h("p", { class: "provl-ut-avsnittsrad", text: avsnitt.map((a) => avsnittText(a, poangsatt)).join(" · ") }) : null,
      r?.helhetskommentar ? h("div", { class: "provl-ut-helhet" }, h("b", { text: "Lärarens kommentar" }), stycken(r.helhetskommentar)) : null),
    h("div", { class: "provl-ut-fragor" }, fragor.map((f) => {
      const typ = fragetyp(f.typ);
      if (f.typ === "avsnitt") {
        const a = perAvsnitt.get(f.id);
        return h("h2", { class: "provl-ut-avsnitt provl-ut-avsnitt-titel" }, f.titel || "",
          a ? h("span", { class: "provl-ut-p", text: ` – ${avsnittVarde(a, poangsatt)}${poangsatt && a.max && a.andel != null ? " p" : ""}` }) : null);
      }
      if (nr[f.id] == null) return f.titel ? h("p", { class: "provl-ut-textblock-ref", text: `Text: ${f.titel}` }) : null;
      const post = r?.fragor?.[f.id];
      const bedomd = arBedomd(post); // #764: autorättade räknas, förslag inte
      return h("section", { class: "provl-ut-fraga" },
        h("div", { class: "provl-ut-fraga-huvud" },
          h("span", { class: "provl-ut-nr", text: String(nr[f.id]) }),
          h("div", { class: "provl-ut-fragetext" }, stycken(f.fraga)),
          (bedomd && bedomningsEtikett(post.ratt, { poang: post.poang, max: f.poang, poangsatt }))
            || h("span", { class: "provl-ut-ejbedomd", text: "? Inte rättad" })),
        typ ? h("div", { class: "provl-ut-svar" }, typ.renderRattning(f, e.svar?.[f.id], { facit: medFacit ? facit[f.id] ?? null : null, facitRad: medFacit })) : null,
        kriterier?.[f.id]?.length ? h("p", { class: "provl-ut-kriterier" }, h("b", { text: "Poängkriterier: " }), kriterier[f.id].join(" · ")) : null,
        bedomd && post.kommentar ? h("p", { class: "provl-ut-kommentar" }, h("b", { text: "Kommentar: " }), post.kommentar) : null);
    })));
}

/**
 * Skriv ut resultat (§13): en elev per sida.
 * @param {object} o
 * @param {string} o.namn  provets namn
 * @param {string} [o.klassNamn]
 * @param {string} [o.datum]
 * @param {object[]} o.fragor  tillfällets frågor
 * @param {object} [o.facit]  privat/facit.facit
 * @param {object} [o.kriterier]  privat/facit.kriterier – skrivs ut bara om provet visar dem för eleven (visaKriterier, #765)
 * @param {object} [o.installningar]  tillfällets (poang, granser, visaFacit, visaKriterier)
 * @param {{ namn: string, r: object|null, svar: object|null }[]} o.elever
 */
export async function skrivUtResultat(o) {
  await laddaStilar();
  const ins = o.installningar || {};
  const bas = {
    ...o, poangsatt: ins.poang !== false, granser: granserFor(ins), medFacit: ins.visaFacit !== false,
    kriterier: ins.visaKriterier === true ? o.kriterier || null : null,
  };
  const harFacit = !!o.facit && Object.keys(o.facit).length > 0;
  const en = o.elever.length === 1;
  const vy = utskriftsvy({
    titel: en ? `Skriv ut resultat – ${o.elever[0].namn}` : `Skriv ut resultat – ${o.elever.length} elever`,
    hint: `A4 stående, en elev per sida. Bedömningen står alltid med symbol och text (✓ Rätt, ½ Delvis rätt, ✗ Fel), så den går att läsa i svartvitt.`,
    val: harFacit ? [kryssruta("Med facit", bas.medFacit, (v) => { bas.medFacit = v; vy.rita(); })] : [],
    rita: () => o.elever.map((e) => resultatSida(e, { ...bas, medFacit: harFacit && bas.medFacit })),
  });
  return vy;
}
