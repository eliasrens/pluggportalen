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
// Avsnitt (#765): poäng per avsnitt för klassen (snitt) och eleven
// ("Del 1: 8 av 10 · Del 2: 9,5 av 14"), avsnittsrubriker över rutnätets
// kolumner med en Σ-kolumn per avsnitt. Ett prov utan avsnitt ser ut som förut.
// Den fördjupade statistiken och utskriften (#747) laddas lat från
// prov-fordjupad-vy.js: verktygsraden ovanför rutnätet, sektionerna under.
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
  CELL_INFO, FARG_INFO, andelFor, avsnittFor, avsnittText, avsnittVarde, cellLage, fargFor, fordelningText, granserText, klassOversikt, procent,
  sorteraRader, totalText,
} from "./prov-statistik.js";
import { poangAvsnitt } from "./prov-modell.js";
import { poangTal } from "./prov-poang.js";
import { h, stycken } from "./prov-vy.js";

/** Avsnitten som brickor: färg + symbol + "Del 1: 8 av 10" (#765). null utan avsnitt. */
export function avsnittBrickor(lista, poangsatt, etikett = "Per avsnitt") {
  if (!lista?.length) return null;
  return h("p", { class: "provl-st-avsnitt" }, h("b", { text: `${etikett}: ` }),
    ...lista.map((a) => {
      const f = a.farg ? FARG_INFO[a.farg] : null;
      return h("span", { class: `provl-st-bricka provl-st-${a.farg || "ej"}`, title: f ? `${f.namn} (${procent(a.andel)})` : "Inte rättat än" },
        h("span", { class: "provl-st-ikon", "aria-hidden": "true", text: f ? f.ikon : "?" }), h("span", { text: avsnittText(a, poangsatt) }));
    }));
}

/** Rutnätets kolumner: frågorna, med en Σ-kolumn efter varje avsnitt (#765). */
function kolumner(rf, avsnitt) {
  if (!avsnitt.length) return rf.map((_, i) => ({ f: i }));
  const ut = [];
  let i = 0;
  avsnitt.forEach((a, ai) => {
    for (let k = 0; k < a.fragor.length; k++) ut.push({ f: i++, forst: k === 0 });
    ut.push({ a: ai });
  });
  return ut;
}

/** Elevens Σ-cell för ett avsnitt: "8/10" i avsnittets färg. */
function avsnittCell(e, poangsatt) {
  const text = e.andel == null ? "–" : poangsatt && e.max ? `${poangTal(e.poang)}/${poangTal(e.max)}` : procent(e.andel);
  return h("span", { class: `provl-st-asum provl-st-${e.farg || "ej"}`, title: avsnittText(e, poangsatt) },
    e.farg ? h("span", { class: "provl-st-ikon", "aria-hidden": "true", text: FARG_INFO[e.farg].ikon }) : null, h("span", { text }));
}

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

const granssText = (g) => `Färggränser: ${granserText(g)}`;

/**
 * Två reglage för färggränserna (§7.5) – gul från, grön från. Startar på
 * tillfällets gränser (provets från Mina prov, #759); hela procent som där.
 */
function granssReglage(v, onAndrat) {
  const g = v.granser();
  const falt = (id, namn, varde, min, max) => {
    const ut = h("output", { class: "provl-st-gv", text: `${varde} %` });
    const inp = h("input", { type: "range", min: String(min), max: String(max), step: "1", value: String(varde), "data-g": id, "aria-label": namn });
    return { inp, ut, el: h("label", { class: "provl-st-grans" }, h("span", { text: namn }), inp, ut) };
  };
  const sammanfattning = h("summary", { text: granssText(g) });
  const gul = falt("gul", "Gul från", g.gul, 1, 99);
  const gron = falt("gron", "Grön från", g.gron, 2, 100);
  const andra = (vem) => {
    let a = Number(gul.inp.value);
    let b = Number(gron.inp.value);
    if (a >= b) {
      if (vem === "gul") b = Math.min(100, a + 5);
      else a = Math.max(1, b - 5);
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
    h("p", { class: "hint", text: "Gäller det här provet i klassen – provets egna gränser ställer du in i Mina prov. Nivån (EG/G/MG) är din bedömning och ändrar inte färgen." }));
}

// --- Hela klassen ---------------------------------------------------------------

export function oversiktVy(v) {
  const wrap = h("div", { class: "provl-st" });
  const topp = h("div", { class: "panel provl-st-topp" });
  const tabellHost = h("div", { class: "panel provl-st-rutnat-panel" });
  // Den fördjupade statistiken (#747): CSV, utskrift, staplar, fördelning, jämförelse – lat.
  const verktygHost = h("div", { class: "provl-st-utverktyg-host" });
  const fordjupadHost = h("div", { class: "provl-st-fordjupad" });
  let fordjupad = null;
  let senast = null;
  let tid = null;
  const reglage = granssReglage(v, (g) => {
    clearTimeout(tid);
    tid = setTimeout(() => v.sattGranser(g), 400);
    rita(g);
  });
  wrap.append(topp, verktygHost, tabellHost, fordjupadHost);
  import("./prov-fordjupad-vy.js").then((mod) => {
    fordjupad = mod;
    verktygHost.replaceChildren(mod.verktyg(v));
    if (senast) fordjupadHost.replaceChildren(...mod.sektioner(v, senast));
  }).catch(() => fordjupadHost.replaceChildren(h("p", { class: "msg error", text: "Den fördjupade statistiken kunde inte laddas – ladda om sidan." })));

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
      ...(m.avsnitt.length ? [avsnittBrickor(m.avsnitt, m.poangsatt, "Per avsnitt (klassens snitt)")] : []),
      ...(svarast ? [svarast] : []),
      h("div", { class: "provl-st-verktyg" }, sortVal, reglage),
      h("p", { class: "hint", text: "Bara bedömda frågor räknas – obesvarade och orättade blir inte fel förrän du har rättat dem. Förslag räknas när du har godkänt dem." }));

    const rf = v.rf;
    const rader = sorteraRader(m.rader, v.stat.sort);
    const kol = kolumner(rf, m.avsnitt);
    const medAvsnitt = m.avsnitt.length > 0;
    const kolKlass = (k) => `provl-st-cellkol${k.forst ? " provl-st-avsnitt-start" : ""}${k.a != null ? " provl-st-asumkol" : ""}`;
    const fnrRad = kol.map((k) => (k.a != null
      ? h("th", { scope: "col", class: "provl-st-fkol provl-st-asumkol", title: `${m.avsnitt[k.a].titel}: poäng i avsnittet`, text: "Σ" })
      : h("th", { scope: "col", class: `provl-st-fkol${k.forst ? " provl-st-avsnitt-start" : ""}` },
        h("button", { type: "button", class: "provl-st-fnr", title: `Rätta fråga ${v.nr[rf[k.f].id]}`, text: String(v.nr[rf[k.f].id]), on: { click: () => v.oppnaFraga(rf[k.f].id) } }))));
    const namnTh = h("th", { scope: "col", class: "provl-st-namnkol", text: "Elev", rowspan: medAvsnitt ? "2" : null });
    const totTh = h("th", { scope: "col", class: "provl-st-totkol", text: m.poangsatt ? "Totalt" : "Andel rätt", rowspan: medAvsnitt ? "2" : null });
    const thead = medAvsnitt
      ? h("thead", {},
        h("tr", { class: "provl-st-avsnittsrad" }, namnTh, totTh, m.avsnitt.map((a) => h("th", {
          scope: "colgroup", colspan: String(a.fragor.length + 1), class: "provl-st-avsnittkol provl-st-avsnitt-start", title: a.titel,
        }, h("span", { class: "provl-st-avsnittnamn", text: a.titel })))),
        h("tr", {}, fnrRad))
      : h("thead", {}, h("tr", {}, namnTh, totTh, fnrRad));
    const tbody = h("tbody", {}, rader.map((r) => h("tr", { class: `provl-st-rad provl-st-rad-${r.farg || "ej"}` },
      h("th", { scope: "row", class: "provl-st-namnkol" },
        h("button", { type: "button", class: "provl-st-namn", text: r.namn, title: "Öppna elevvyn", on: { click: () => v.oppnaElev(r.id) } })),
      h("td", { class: "provl-st-totkol" }, totalBricka(r, m.poangsatt)),
      kol.map((k) => h("td", { class: kolKlass(k) }, k.a != null ? avsnittCell(r.avsnitt[k.a], m.poangsatt)
        : cell(r.celler[k.f].lage, `${r.namn}, fråga ${v.nr[r.celler[k.f].fid]}`, () => v.oppnaSvar(r.id, r.celler[k.f].fid)))))));
    const tfoot = h("tfoot", {}, h("tr", {},
      h("th", { scope: "row", class: "provl-st-namnkol", text: "Per fråga" }),
      h("td", { class: "provl-st-totkol hint", text: m.poangsatt ? "andel av poängen" : "andel rätt" }),
      kol.map((k) => {
        const s = k.a != null ? { ...m.avsnitt[k.a], nr: null } : m.fragaSumma[k.f];
        const vad = k.a != null ? m.avsnitt[k.a].titel : `Fråga ${s.nr}`;
        return h("td", { class: kolKlass(k) },
          s.andel == null ? h("span", { class: "provl-st-fsum provl-st-ej", title: "Inget bedömt än", text: "?" })
            : h("span", { class: `provl-st-fsum provl-st-${s.farg}`, title: `${vad}: ${procent(s.andel)} rätt (${s.bedomda} bedömda)` },
              h("span", { class: "provl-st-ikon", "aria-hidden": "true", text: FARG_INFO[s.farg].ikon }), h("span", { text: procent(s.andel).replace(" ", " ") })));
      })));
    tabellHost.replaceChildren(
      h("div", { class: "provl-st-scroll", tabindex: "0", "aria-label": "Klassens resultat per fråga – scrolla i sidled" },
        h("table", { class: "provl-st-tabell" }, thead, tbody, tfoot)),
      teckenforklaring());
    senast = m;
    if (fordjupad) fordjupadHost.replaceChildren(...fordjupad.sektioner(v, m));
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
  const lagen = v.rf.map((f) => ({ f, lage: cellLage(r?.fragor?.[f.id], v.svarAv(uid, f.id), f, poangsatt) }));
  const avsnitt = poangAvsnitt(v.fragor);
  const perAvsnitt = avsnittFor(r, avsnitt, poangsatt, granser);
  // Avsnittsrubriken före avsnittets första fråga (#765): "Del 1 – 8 av 10 p".
  const forstaI = new Map(avsnitt.map((a, i) => [a.fragor[0].id, i]));
  const i = v.med.indexOf(uid);

  const huvud = h("div", { class: "panel provl-st-elev-topp" },
    h("div", { class: "provl-st-elev-nav" },
      h("button", { type: "button", class: "btn ghost small", text: "← Hela klassen", on: { click: () => v.tillKlassen() } }),
      h("button", { type: "button", class: "btn ghost small", text: "‹ Föregående", disabled: i <= 0, on: { click: () => v.oppnaElev(v.med[i - 1]) } }),
      h("button", { type: "button", class: "btn ghost small", text: "Nästa ›", disabled: i >= v.med.length - 1, on: { click: () => v.oppnaElev(v.med[i + 1]) } }),
      h("button", { type: "button", class: "btn small", text: "Rätta eleven", on: { click: () => v.oppnaSvar(uid, null) } }),
      h("button", { type: "button", class: "btn ghost small", text: "🖨 Skriv ut", title: "Skriv ut elevens rättade prov (#747)",
        on: { click: () => import("./prov-fordjupad-vy.js").then((mod) => mod.skrivUtElever(v, [uid])) } })),
    h("h3", { class: "provl-st-elev-namn", text: v.visNamn(uid) }),
    h("p", { class: "provl-st-elev-summa" }, totalBricka(rad, poangsatt),
      nivaText ? h("span", { class: "provl-st-niva-text", text: ` Nivå: ${nivaText}` }) : null,
      status ? h("span", { class: "hint", text: ` · ${status}` }) : null,
      res.bedomda < res.antal ? h("span", { class: "hint", text: ` · ${res.bedomda} av ${res.antal} frågor rättade` }) : null),
    avsnittBrickor(perAvsnitt, poangsatt),
    h("div", { class: "provl-st-elev-rad", "aria-label": "Fråga för fråga" },
      lagen.map(({ f, lage }) => h("span", { class: "provl-st-elev-cell" },
        h("span", { class: "provl-st-elev-nr", text: String(v.nr[f.id]) }),
        cell(lage, `Fråga ${v.nr[f.id]}`, () => document.getElementById(`provl-st-f-${f.id}`)?.scrollIntoView({ block: "start", behavior: "smooth" }))))),
    r?.helhetskommentar ? h("div", { class: "provl-st-helhet" }, h("b", { text: "Helhetskommentar" }), stycken(r.helhetskommentar)) : null);

  const fragor = lagen.flatMap(({ f, lage }) => {
    const typ = fragetyp(f.typ);
    const post = r?.fragor?.[f.id];
    const info = CELL_INFO[lage];
    const ai = forstaI.get(f.id);
    const e = ai == null ? null : perAvsnitt[ai];
    const rubrik = e && h("h3", { class: "provl-st-elev-avsnitt" }, h("span", { text: e.titel }),
      h("span", { class: "provl-st-elev-avsnitt-p", text: avsnittVarde(e, poangsatt) }));
    return [rubrik, h("section", { class: `panel provl-st-fraga provl-st-fraga-${lage}`, id: `provl-st-f-${f.id}` },
      h("div", { class: "provl-st-fraga-topp" },
        h("span", { class: "provl-r-fraga-nr", text: `Fråga ${v.nr[f.id]}` }),
        (lage === "ratt" || lage === "delvis" || lage === "fel")
          ? bedomningsEtikett(post.ratt, { poang: post.poang, max: f.poang, poangsatt })
          : h("span", { class: `provl-st-ejbedomd provl-st-c-${lage}` }, h("span", { "aria-hidden": "true", text: `${info.ikon} ` }), info.namn)),
      h("div", { class: "provl-r-fragetext" }, stycken(f.fraga)),
      typ ? h("div", { class: "provv-rot provl-r-papper" }, typ.renderRattning(f, v.svarAv(uid, f.id), { facit: v.facit[f.id], facitRad: true })) : null,
      post?.kommentar ? h("p", { class: "provl-st-kommentar" }, h("b", { text: "Kommentar: " }), post.kommentar) : null)];
  });
  return { el: h("div", { class: "provl-st provl-st-elev" }, huvud, h("div", { class: "provl-st-fragor" }, fragor)), uppdatera: () => {} };
}
