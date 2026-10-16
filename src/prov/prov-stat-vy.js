// ============================================================================
// Prov (#742, spec §7.5): fliken Översikt i rättningsvyn – hela klassen i
// grönt/gult/rött – och elevvyn (en elevs rad uppförstorad, bara att läsa).
// Allt räknas ur det rättningsvyn redan läst (prov-ratta-sida.js): inga
// extra läsningar. Färgerna har alltid symbol och text (✓ ½ ✗ – ?).
//
//   oversiktVy(v)       räknaren, snittet, de tre svåraste frågorna, gränsreglagen,
//                       rutnätet elev × fråga med totalbricka och summering per fråga
//   elevStatVy(v, uid)  en elev: fråga för fråga i färg, svaren, kommentarerna,
//                       totalen och nivån
// Båda returnerar { el, uppdatera() } som lägena i prov-ratta-lagen.js.
//
// v utöver lägenas kontext (prov-ratta-sida.js):
//   stat           { sort: "namn"|"resultat" }
//   oppnaElev(uid) / tillKlassen() / oppnaSvar(uid, fid) / oppnaFraga(fid)
//   granser()      tillfällets gränser, sattGranser({ gul, gron })
// CSS: prov-statistik.css (.provl-st-).
// ============================================================================

import { fragetyp } from "./prov-fragetyper.js";
import { ELEV_STATUS_NAMN, elevStatus, nivaNamn } from "./prov-rattning-logik.js";
import { bedomningsEtikett } from "./prov-resultat-vy.js";
import {
  CELL_INFO, FARG_INFO, andelFor, cellLage, fargFor, fordelningText, klassOversikt, procent, sorteraRader, totalText,
} from "./prov-statistik.js";
import { h, stycken } from "./prov-vy.js";

/** Totalbrickan: färg + symbol + "18/24 · 75 %" (+ nivån bredvid, ändrar inte färgen). */
export function totalBricka(rad, poangsatt) {
  const f = rad.farg ? FARG_INFO[rad.farg] : null;
  const text = totalText(rad, poangsatt);
  return h("span", { class: "provl-st-total" },
    h("span", { class: `provl-st-bricka provl-st-${rad.farg || "ej"}`, title: f ? `${f.namn} (${procent(rad.andel)})` : "Inte rättad än" },
      h("span", { class: "provl-st-ikon", "aria-hidden": "true", text: f ? f.ikon : "?" }),
      h("span", { text: text || "Ej rättad" })),
    rad.nivaNamn ? h("span", { class: "provl-st-niva", title: `Lärarens nivå: ${rad.nivaNamn}`, text: rad.niva }) : null,
    rad.andel != null && rad.bedomda < rad.antal ? h("span", { class: "provl-st-delvis-rattad", title: "Bara de rättade frågorna räknas", text: `${rad.bedomda}/${rad.antal} rättade` }) : null);
}

/** Räknaren som brickor: "✓ 12 gröna · ½ 7 gula · ✗ 4 röda · ? 1 ej rättade" (symbol + text, inte bara färg). */
export function fordelningEl(n) {
  const b = (farg, ikon, text) => h("span", { class: `provl-st-bricka provl-st-${farg}` },
    h("span", { class: "provl-st-ikon", "aria-hidden": "true", text: ikon }), h("span", { text }));
  return h("span", { class: "provl-st-fordelning", "aria-label": fordelningText(n) },
    b("gron", "✓", `${n.gron} ${n.gron === 1 ? "grön" : "gröna"}`), b("gul", "½", `${n.gul} ${n.gul === 1 ? "gul" : "gula"}`),
    b("rod", "✗", `${n.rod} ${n.rod === 1 ? "röd" : "röda"}`),
    n.ej ? b("ej", "?", `${n.ej} ej rättade`) : null);
}

/** En cell: liten färgad ruta med symbol, skärmläsartext "Fråga 4: Rätt". */
function cell(lage, etikett, onClick) {
  const info = CELL_INFO[lage];
  return h("button", {
    type: "button", class: `provl-st-c provl-st-c-${lage}`, title: `${etikett}: ${info.namn}`, "aria-label": `${etikett}: ${info.namn}`,
    on: onClick ? { click: onClick } : null,
  }, h("span", { "aria-hidden": "true", text: info.ikon }));
}

function teckenforklaring() {
  return h("p", { class: "provl-st-forklaring hint" },
    ...["ratt", "delvis", "fel", "obesvarad", "ej"].map((l) => h("span", { class: "provl-st-forkl" },
      h("span", { class: `provl-st-c provl-st-c-${l} provl-st-c-liten`, "aria-hidden": "true", text: CELL_INFO[l].ikon }), ` ${CELL_INFO[l].namn}`)));
}

const granssText = (g) => `Färggränser: röd under ${g.gul} %, gul ${g.gul}–${g.gron - 1} %, grön ${g.gron} % eller mer`;

/** Två reglage för färggränserna (§7.5) – gul från, grön från. */
function granssReglage(v, onAndrat) {
  const g = v.granser();
  const falt = (id, namn, varde) => {
    const ut = h("output", { class: "provl-st-gv", text: `${varde} %` });
    const inp = h("input", { type: "range", min: "5", max: "95", step: "5", value: String(varde), "data-g": id, "aria-label": namn });
    return { inp, ut, el: h("label", { class: "provl-st-grans" }, h("span", { text: namn }), inp, ut) };
  };
  const sammanfattning = h("summary", { text: granssText(g) });
  const gul = falt("gul", "Gul från", g.gul);
  const gron = falt("gron", "Grön från", g.gron);
  const andra = (vem) => {
    let a = Number(gul.inp.value);
    let b = Number(gron.inp.value);
    if (a >= b) {
      if (vem === "gul") b = Math.min(100, a + 5);
      else a = Math.max(0, b - 5);
      gul.inp.value = String(a);
      gron.inp.value = String(b);
    }
    gul.ut.textContent = `${a} %`;
    gron.ut.textContent = `${b} %`;
    sammanfattning.textContent = granssText({ gul: a, gron: b });
    onAndrat({ gul: a, gron: b });
  };
  gul.inp.addEventListener("input", () => andra("gul"));
  gron.inp.addEventListener("input", () => andra("gron"));
  return h("details", { class: "provl-st-granser" }, sammanfattning,
    h("div", { class: "provl-st-grans-rad" }, gul.el, gron.el),
    h("p", { class: "hint", text: "Gäller det här provet i klassen. Nivån (EG/G/MG) är din bedömning och ändrar inte färgen." }));
}

// --- Hela klassen ---------------------------------------------------------------

export function oversiktVy(v) {
  const wrap = h("div", { class: "provl-st" });
  const topp = h("div", { class: "panel provl-st-topp" });
  const tabellHost = h("div", { class: "panel provl-st-rutnat-panel" });
  let tid = null;
  const reglage = granssReglage(v, (g) => {
    clearTimeout(tid);
    tid = setTimeout(() => v.sattGranser(g), 400);
    rita(g);
  });
  wrap.append(topp, tabellHost);

  function rita(granser) {
    const m = klassOversikt({
      fragor: v.fragor, med: v.med, namn: Object.fromEntries(v.med.map((uid) => [uid, v.visNamn(uid)])),
      svarAv: v.svarAv, rattningar: v.lager.rattningar,
      installningar: { ...v.tf.installningar, granser: granser || v.granser() },
    });
    const snittFarg = fargFor(m.snitt, m.granser);
    const sortVal = h("select", { class: "select provl-st-sort", "aria-label": "Sortera eleverna" },
      h("option", { value: "namn", text: "Sortera: namn", selected: v.stat.sort === "namn" }),
      h("option", { value: "resultat", text: "Sortera: resultat", selected: v.stat.sort === "resultat" }));
    sortVal.addEventListener("change", () => { v.stat.sort = sortVal.value; rita(granser); });
    const svarast = m.svarast.length
      ? h("p", { class: "provl-st-svarast" }, h("b", { text: "Svåraste frågorna: " }),
        ...m.svarast.flatMap((s, i) => [i ? ", " : "", h("a", {
          class: "provl-lank", href: "#", text: `Fråga ${s.nr} (${procent(s.andel)})`,
          on: { click: (e) => { e.preventDefault(); v.oppnaFraga(s.fid); } },
        })]))
      : null;
    topp.replaceChildren(
      h("p", { class: "provl-st-raknare", role: "status" }, fordelningEl(m.raknare)),
      h("p", { class: "provl-st-snitt" }, "Klassens snitt: ",
        m.snitt == null ? h("span", { class: "hint", text: "inget rättat än" })
          : h("span", { class: `provl-st-bricka provl-st-${snittFarg}` },
            h("span", { class: "provl-st-ikon", "aria-hidden": "true", text: FARG_INFO[snittFarg].ikon }), h("span", { text: procent(m.snitt) }))),
      ...(svarast ? [svarast] : []),
      h("div", { class: "provl-st-verktyg" }, sortVal, reglage),
      h("p", { class: "hint", text: "Bara bedömda frågor räknas – obesvarade och orättade blir inte fel förrän du har rättat dem. Förslag räknas när du har godkänt dem." }));

    const rf = v.rf;
    const rader = sorteraRader(m.rader, v.stat.sort);
    const thead = h("thead", {}, h("tr", {},
      h("th", { scope: "col", class: "provl-st-namnkol", text: "Elev" }),
      h("th", { scope: "col", class: "provl-st-totkol", text: m.poangsatt ? "Totalt" : "Andel rätt" }),
      rf.map((f) => h("th", { scope: "col", class: "provl-st-fkol" },
        h("button", { type: "button", class: "provl-st-fnr", title: `Rätta fråga ${v.nr[f.id]}`, text: String(v.nr[f.id]), on: { click: () => v.oppnaFraga(f.id) } })))));
    const tbody = h("tbody", {}, rader.map((r) => h("tr", { class: `provl-st-rad provl-st-rad-${r.farg || "ej"}` },
      h("th", { scope: "row", class: "provl-st-namnkol" },
        h("button", { type: "button", class: "provl-st-namn", text: r.namn, title: "Öppna elevvyn", on: { click: () => v.oppnaElev(r.id) } })),
      h("td", { class: "provl-st-totkol" }, totalBricka(r, m.poangsatt)),
      r.celler.map((c) => h("td", { class: "provl-st-cellkol" },
        cell(c.lage, `${r.namn}, fråga ${v.nr[c.fid]}`, () => v.oppnaSvar(r.id, c.fid)))))));
    const tfoot = h("tfoot", {}, h("tr", {},
      h("th", { scope: "row", class: "provl-st-namnkol", text: "Per fråga" }),
      h("td", { class: "provl-st-totkol hint", text: m.poangsatt ? "andel av poängen" : "andel rätt" }),
      m.fragaSumma.map((s) => h("td", { class: "provl-st-cellkol" },
        s.andel == null ? h("span", { class: "provl-st-fsum provl-st-ej", title: "Inget bedömt än", text: "?" })
          : h("span", { class: `provl-st-fsum provl-st-${s.farg}`, title: `Fråga ${s.nr}: ${procent(s.andel)} rätt (${s.bedomda} bedömda)` },
            h("span", { class: "provl-st-ikon", "aria-hidden": "true", text: FARG_INFO[s.farg].ikon }), h("span", { text: procent(s.andel).replace(" ", " ") }))))));
    tabellHost.replaceChildren(
      h("div", { class: "provl-st-scroll", tabindex: "0", "aria-label": "Klassens resultat per fråga – scrolla i sidled" },
        h("table", { class: "provl-st-tabell" }, thead, tbody, tfoot)),
      teckenforklaring());
  }
  rita();
  return { el: wrap, uppdatera: () => {} };
}

// --- En elev (bara att läsa) ------------------------------------------------------

export function elevStatVy(v, uid) {
  const r = v.lager.rattningar[uid] || null;
  const poangsatt = v.poangsatt;
  const granser = v.granser();
  const res = andelFor(r, v.fragor, poangsatt);
  const nivaText = nivaNamn(r?.niva);
  const rad = { ...res, farg: fargFor(res.andel, granser), niva: r?.niva || null, nivaNamn: nivaText };
  const status = ELEV_STATUS_NAMN[elevStatus(r, v.fragor)] || "";
  const lagen = v.rf.map((f) => ({ f, lage: cellLage(r?.fragor?.[f.id], v.svarAv(uid, f.id), f) }));
  const i = v.med.indexOf(uid);

  const huvud = h("div", { class: "panel provl-st-elev-topp" },
    h("div", { class: "provl-st-elev-nav" },
      h("button", { type: "button", class: "btn ghost small", text: "← Hela klassen", on: { click: () => v.tillKlassen() } }),
      h("button", { type: "button", class: "btn ghost small", text: "‹ Föregående", disabled: i <= 0, on: { click: () => v.oppnaElev(v.med[i - 1]) } }),
      h("button", { type: "button", class: "btn ghost small", text: "Nästa ›", disabled: i >= v.med.length - 1, on: { click: () => v.oppnaElev(v.med[i + 1]) } }),
      h("button", { type: "button", class: "btn small", text: "Rätta eleven", on: { click: () => v.oppnaSvar(uid, null) } })),
    h("h3", { class: "provl-st-elev-namn", text: v.visNamn(uid) }),
    h("p", { class: "provl-st-elev-summa" }, totalBricka(rad, poangsatt),
      nivaText ? h("span", { class: "provl-st-niva-text", text: ` Nivå: ${nivaText}` }) : null,
      status ? h("span", { class: "hint", text: ` · ${status}` }) : null,
      res.bedomda < res.antal ? h("span", { class: "hint", text: ` · ${res.bedomda} av ${res.antal} frågor rättade` }) : null),
    h("div", { class: "provl-st-elev-rad", "aria-label": "Fråga för fråga" },
      lagen.map(({ f, lage }) => h("span", { class: "provl-st-elev-cell" },
        h("span", { class: "provl-st-elev-nr", text: String(v.nr[f.id]) }),
        cell(lage, `Fråga ${v.nr[f.id]}`, () => document.getElementById(`provl-st-f-${f.id}`)?.scrollIntoView({ block: "start", behavior: "smooth" }))))),
    r?.helhetskommentar ? h("div", { class: "provl-st-helhet" }, h("b", { text: "Helhetskommentar" }), stycken(r.helhetskommentar)) : null);

  const fragor = lagen.map(({ f, lage }) => {
    const typ = fragetyp(f.typ);
    const post = r?.fragor?.[f.id];
    const info = CELL_INFO[lage];
    return h("section", { class: `panel provl-st-fraga provl-st-fraga-${lage}`, id: `provl-st-f-${f.id}` },
      h("div", { class: "provl-st-fraga-topp" },
        h("span", { class: "provl-r-fraga-nr", text: `Fråga ${v.nr[f.id]}` }),
        (lage === "ratt" || lage === "delvis" || lage === "fel")
          ? bedomningsEtikett(post.ratt, { poang: post.poang, max: f.poang, poangsatt })
          : h("span", { class: `provl-st-ejbedomd provl-st-c-${lage}` }, h("span", { "aria-hidden": "true", text: `${info.ikon} ` }), info.namn)),
      h("div", { class: "provl-r-fragetext" }, stycken(f.fraga)),
      typ ? h("div", { class: "provv-rot provl-r-papper" }, typ.renderRattning(f, v.svarAv(uid, f.id), { facit: v.facit[f.id], facitRad: true })) : null,
      post?.kommentar ? h("p", { class: "provl-st-kommentar" }, h("b", { text: "Kommentar: " }), post.kommentar) : null);
  });
  return { el: h("div", { class: "provl-st provl-st-elev" }, huvud, h("div", { class: "provl-st-fragor" }, fragor)), uppdatera: () => {} };
}
