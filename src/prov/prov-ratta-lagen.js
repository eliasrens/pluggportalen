// ============================================================================
// Prov (#741, spec §6.1–§6.2): rättningsvyns två lägen.
//   perFraga(v)  en fråga: facit + bedömningsstöd överst, "Godkänn alla
//                förslag", ett kort per elev – eller per GRUPP av identiska
//                kortsvar/luckor (bedömningen gäller alla i gruppen)
//   perElev(v)   en elev: hela provet, totalen, nivån, helhetskommentaren,
//                Lämna tillbaka / Ångra
// Båda returnerar { el, uppdatera() } – uppdatera() ritar om det som beror
// på andra kort (frågeknapparnas "klar", elevlistans status).
//
// v (från prov-ratta-sida.js):
//   lager                 prov-ratta-lager.js (rattningar)
//   tf, fragor, rf, nr    tillfället, frågorna, de rättade frågorna, numren
//   facit, bedomningsstod, kriterier  privat/facit (kriterier: fritextens poängkriterier, #762)
//   med                   eleverna som rättas
//   svarAv(uid, fid), visNamn(uid), poangsatt, nivaer
//   flikbyteText(uid)     #748: "Lämnade provet 2 gånger" eller ""
//   index                 { fraga, elev } – nuvarande
//   ga({ fraga?, elev?, fokus? })  byt fråga/elev och rita om
//   andrat(uids)          spara + uppdatera räknaren
//   lamnaTillbaka(uids), angra(uid)
//   godkannAven(fraga, { text, lucka }) → Promise<boolean>  facit i efterhand (#764)
// Avsnitten (#762) syns som grupper: rubriker i Per elev, grupperade
// frågeknappar och avsnittets namn överst i Per fråga.
// ============================================================================

import { formatKlockslag } from "../class-lock.js";
import { arAvsnitt, arFraga, fragetyp } from "./prov-fragetyper.js";
import { NIVAER, avsnittsGrupper } from "./prov-modell.js";
import {
  ELEV_STATUS, ELEV_STATUS_NAMN, HELHET_MAX, arBedomd, arForslag, bedom, bedomGrupp, elevStatus, forslagPaFraga, fragaKlar,
  godkannAlla, godkannFraga, gruppPost, summera, svarsGrupper,
} from "./prov-rattning-logik.js";
import { rattaKort } from "./prov-ratta-kort.js";
import { godkannbara } from "./prov-ratta-alla.js";
import { STAVFEL, stavfelFor } from "./prov-validera.js";
import { tillMs } from "./prov-tillfalle-logik.js";
import { h, stycken } from "./prov-vy.js";
import { poangTal } from "./prov-poang.js";

const poangText = poangTal;
const TANGENTER = "Tangenter: 1 rätt · 2 delvis · 3 fel · + och − ändrar poängen 0,5 · Tab nästa svar · Enter poäng/kommentar · N nästa fråga";

// Kortets extra delar (#764): kriterierna bredvid fritext, "Godkänn även" för kortsvar/luckor.
const kortExtra = (v, f, svar) => ({
  kriterier: v.kriterier?.[f.id] || [],
  godkannbara: godkannbara(f, svar, v.facit[f.id]),
  onGodkannAven: (g) => v.godkannAven(f, g),
});

/** Kortets rubrik för en grupp: ”Birka” – 12 elever. */
function gruppTitel(f, g) {
  const n = g.elever.length;
  const vad = g.nyckel === "" ? "Inget svar"
    : f.typ === "kortsvar" ? `”${String(g.svar ?? "").trim()}”` : "Samma svar";
  return `${vad} – ${n} ${n === 1 ? "elev" : "elever"}`;
}

// --- Per fråga (§6.1) -------------------------------------------------------------

export function perFraga(v) {
  const { lager, rf, nr, med, poangsatt, fragor } = v;
  const rattningar = lager.rattningar;
  const f = rf[v.index.fraga];
  const typ = fragetyp(f.typ);
  const fa = v.facit[f.id];

  const knappar = rf.map((x, i) => h("button", {
    type: "button", class: `provl-r-nr${i === v.index.fraga ? " provl-r-nr-aktiv" : ""}`, text: String(nr[x.id]),
    "aria-current": i === v.index.fraga ? "true" : null, on: { click: () => v.ga({ fraga: i }) },
  }));
  // Avsnitten som grupper (#762): frågeknapparna under avsnittets namn.
  const grupper = avsnittsGrupper(fragor).filter((g) => g.fragor.length);
  const avsnittAv = (fid) => grupper.find((g) => g.fragor.some((x) => x.id === fid))?.avsnitt || null;
  const nrRad = grupper.map((g) => h("span", { class: "provl-r-nrgrupp" },
    g.avsnitt ? h("span", { class: "provl-r-nrgrupp-namn", text: g.avsnitt.titel || "Avsnitt" }) : null,
    g.fragor.map((x) => knappar[rf.findIndex((y) => y.id === x.id)])));
  const avsnitt = avsnittAv(f.id);
  const godkannKnapp = h("button", {
    type: "button", class: "btn small",
    on: { click: () => { v.andrat(godkannFraga(rattningar, med, f.id)); v.ga({}); } },
  });
  const facitText = fa ? typ.facitText?.(f, fa) : "";
  const stod = v.bedomningsstod[f.id];
  const huvud = h("div", { class: "panel provl-r-fraga" },
    avsnitt ? h("p", { class: "provl-r-fraga-avsnitt", text: avsnitt.titel || "Avsnitt" }) : null,
    h("div", { class: "provl-r-fraga-topp" },
      h("span", { class: "provl-r-fraga-nr", text: `Fråga ${nr[f.id]} av ${rf.length}` }),
      h("span", { class: "hint", text: `${typ.ikon} ${typ.namn}${poangsatt ? ` · ${poangText(f.poang)} p` : ""}` }),
      h("span", { class: "provl-r-pilar" },
        h("button", { type: "button", class: "btn ghost small", text: "‹ Föregående", disabled: v.index.fraga === 0, on: { click: () => v.ga({ fraga: v.index.fraga - 1, fokus: true }) } }),
        h("button", { type: "button", class: "btn ghost small", text: "Nästa fråga ›", disabled: v.index.fraga >= rf.length - 1, on: { click: () => v.ga({ fraga: v.index.fraga + 1, fokus: true }) } }))),
    h("div", { class: "provl-r-fragetext" }, stycken(f.fraga)),
    facitText ? h("p", { class: "provl-r-facit" }, h("b", { text: "Facit: " }), facitText,
      fa?.exaktStavning === false ? h("span", { class: "hint", text: stavfelFor(v.tf.installningar) === STAVFEL.SJALV ? " · stavfel rättar du själv" : " · ett stavfel ger delvis" }) : null) : null,
    stod ? h("div", { class: "provl-r-stod" }, h("b", { text: "Bedömningsstöd" }), stycken(stod)) : null,
    typ.autoratt ? null : h("p", { class: "hint", text: "Den här frågan rättar du själv – bara obesvarade svar får ett förslag." }),
    h("div", { class: "provl-r-godkann" }, godkannKnapp, h("span", { class: "hint provl-r-tangenter", text: TANGENTER })));

  const kort = svarsGrupper(f, med, (uid) => v.svarAv(uid, f.id), fa).map((g) => rattaKort({
    titel: g.grupp ? gruppTitel(f, g) : v.visNamn(g.elever[0]),
    under: g.grupp ? g.elever.map(v.visNamn).join(", ") : "",
    fraga: f, svar: g.svar, facit: fa, facitRad: false, poangsatt,
    ...kortExtra(v, f, g.svar),
    lage: () => {
      const aktiva = g.elever.filter((uid) => !rattningar[uid].aterlamnad);
      const post = gruppPost(rattningar, aktiva.length ? aktiva : g.elever, f.id);
      return { post, blandat: !post && g.elever.length > 1, last: !aktiva.length };
    },
    onAndring: (a) => v.andrat(bedomGrupp(rattningar, g.elever, f, a, fragor)),
  }).el);

  function uppdatera() {
    knappar.forEach((b, i) => {
      const klar = fragaKlar(rattningar, med, rf[i].id);
      b.classList.toggle("provl-r-nr-klar", klar);
      b.setAttribute("aria-label", `Fråga ${nr[rf[i].id]}${klar ? ", färdigrättad" : ""}`);
    });
    const n = forslagPaFraga(rattningar, med, f.id);
    godkannKnapp.disabled = !n;
    godkannKnapp.textContent = n ? `Godkänn alla förslag på den här frågan (${n})` : "Inga förslag kvar att godkänna";
  }
  uppdatera();
  return {
    el: h("div", {}, h("nav", { class: "provl-r-nrrad", "aria-label": "Frågor" }, nrRad), huvud, h("div", { class: "provl-r-kortlista" }, kort)),
    uppdatera,
  };
}

// --- Per elev (§6.2) ---------------------------------------------------------------

export function perElev(v) {
  const { lager, fragor, rf, nr, med, poangsatt } = v;
  const uid = med[v.index.elev];
  const r = () => lager.rattningar[uid];
  const last = () => r().aterlamnad === true;

  const val = h("select", { class: "select provl-r-elevval", "aria-label": "Elev" },
    med.map((id, i) => h("option", { value: id, selected: i === v.index.elev, text: v.visNamn(id) })));
  val.addEventListener("change", () => v.ga({ elev: med.indexOf(val.value), fokus: true }));
  const nav = h("div", { class: "panel provl-r-elevnav" },
    h("button", { type: "button", class: "btn ghost small", text: "‹ Föregående elev", disabled: v.index.elev === 0, on: { click: () => v.ga({ elev: v.index.elev - 1, fokus: true }) } }),
    val,
    h("button", { type: "button", class: "btn ghost small", text: "Nästa elev ›", disabled: v.index.elev >= med.length - 1, on: { click: () => v.ga({ elev: v.index.elev + 1, fokus: true }) } }));

  const godkannKnapp = h("button", {
    type: "button", class: "btn small",
    on: { click: () => { lager.rattningar[uid] = godkannAlla(r(), fragor); v.andrat([uid]); v.ga({}); } },
  });
  const totalEl = h("p", { class: "provl-r-total" });
  const knapp = h("div", { class: "provl-r-tillbaka" });
  const andrat = () => v.andrat([uid]); // ritar om totalen/knappen via uppdatera()

  const kort = fragor.map((f) => {
    const typ = fragetyp(f.typ);
    if (!typ) return null;
    if (arAvsnitt(f)) return h("div", { class: "provl-r-avsnitt" }, typ.renderRattning(f, null, {}));
    if (!arFraga(f)) {
      return h("details", { class: "panel provl-r-textblock" }, h("summary", { text: f.titel || "Textblock" }),
        h("div", { class: "provv-rot provl-r-papper" }, typ.renderRattning(f, null, {})));
    }
    const stod = v.bedomningsstod[f.id];
    const k = rattaKort({
      titel: `Fråga ${nr[f.id]}`, fraga: f, svar: v.svarAv(uid, f.id), facit: v.facit[f.id], facitRad: true, poangsatt,
      ...kortExtra(v, f, v.svarAv(uid, f.id)),
      huvud: h("div", { class: "provl-r-kortfraga" }, stycken(f.fraga),
        stod ? h("details", { class: "provl-r-stod" }, h("summary", { text: "Bedömningsstöd" }), stycken(stod)) : null),
      lage: () => ({ post: r().fragor?.[f.id] || null, blandat: false, last: last() }),
      onAndring: (a) => { lager.rattningar[uid] = bedom(r(), f, a, fragor); andrat(); },
    }).el;
    k.dataset.f = f.id; // översiktens cell hoppar hit (#742)
    return k;
  }).filter(Boolean);

  // Nivå (frivillig, bara om provet använder nivåer) och helhetskommentar.
  const nivaRad = v.nivaer ? h("fieldset", { class: "provl-r-niva" },
    h("legend", { text: "Nivå (frivillig)" }),
    [...NIVAER, { id: null, namn: "Ingen nivå" }].map((n) => {
      const input = h("input", { type: "radio", name: `niva-${uid}`, value: n.id ?? "", checked: (r().niva ?? null) === n.id, disabled: last() });
      input.addEventListener("change", () => { lager.rattningar[uid] = { ...r(), niva: n.id }; andrat(); });
      return h("label", { class: "provl-kryss" }, input, ` ${n.namn}`);
    })) : null;
  const helhet = h("textarea", { class: "provl-r-helhet", rows: "3", maxlength: String(HELHET_MAX), disabled: last(), placeholder: "Till eleven: vad gick bra, vad kan hen öva mer på?" });
  helhet.value = r().helhetskommentar || "";
  let tid = null;
  const sparaHelhet = () => {
    clearTimeout(tid);
    if ((r().helhetskommentar || "") === helhet.value) return;
    lager.rattningar[uid] = { ...r(), helhetskommentar: helhet.value };
    andrat();
  };
  helhet.addEventListener("input", () => { clearTimeout(tid); tid = setTimeout(sparaHelhet, 600); });
  helhet.addEventListener("change", sparaHelhet);

  function uppdatera() {
    const s = elevStatus(r(), fragor);
    const sum = summera(r(), fragor);
    totalEl.replaceChildren(
      h("b", { text: poangsatt ? `Totalt: ${poangText(sum.totalPoang)} av ${poangText(sum.maxPoang)} poäng` : "Totalt" }),
      h("span", { class: `provl-r-elevstatus provl-r-elevstatus-${s}`, text: ELEV_STATUS_NAMN[s] }));
    const forslag = rf.filter((f) => arForslag(r().fragor?.[f.id])).length;
    godkannKnapp.disabled = last() || !forslag;
    godkannKnapp.textContent = forslag ? `Godkänn elevens förslag (${forslag})` : "Inga förslag kvar";
    [...val.options].forEach((op) => { op.textContent = `${v.visNamn(op.value)} – ${ELEV_STATUS_NAMN[elevStatus(lager.rattningar[op.value], fragor)]}`; });
    if (s === ELEV_STATUS.TILLBAKA) {
      const nar = tillMs(r().aterlamnadAt);
      const dag = nar ? ` ${new Date(nar).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })} ${formatKlockslag(nar)}` : "";
      knapp.replaceChildren(
        h("p", { class: "provl-r-tillbaka-info", text: `✓ Tillbakalämnat${dag} · ${r().facit ? "med facit" : "utan facit"}${r().myntUtbetalt ? ` · ${r().myntUtbetalt} pluggmynt utbetalda` : ""}.` }),
        h("button", { type: "button", class: "btn ghost small", text: "Ångra tillbakalämning", on: { click: () => v.angra(uid) } }));
    } else {
      const kvar = rf.filter((f) => !arBedomd(r().fragor?.[f.id])).length;
      knapp.replaceChildren(
        h("button", { type: "button", class: "btn gron", text: "Lämna tillbaka", disabled: s !== ELEV_STATUS.RATTAD, on: { click: () => v.lamnaTillbaka([uid]) } }),
        ...(kvar ? [h("span", { class: "hint", text: ` Rätta ${kvar === 1 ? "1 fråga till" : `${kvar} frågor till`} först – ett förslag räknas när du har godkänt det.` })] : []));
    }
  }
  uppdatera();
  return {
    el: h("div", {}, nav,
      h("div", { class: "provl-r-elevtopp" }, h("h3", { class: "provl-r-elevnamn", text: v.visNamn(uid) }),
        v.flikbyteText?.(uid) ? h("span", { class: "hint provl-r-flikbyte", title: "Hur många gånger eleven lämnade provet (bytte flik, gick ur helskärm). Bara information – det påverkar inget.", text: v.flikbyteText(uid) }) : null,
        godkannKnapp),
      h("div", { class: "provl-r-kortlista" }, kort),
      h("div", { class: "panel provl-r-summa" }, totalEl, nivaRad,
        h("label", { class: "provl-r-helhet-etikett" }, h("b", { text: "Helhetskommentar" }), helhet), knapp)),
    uppdatera,
  };
}
