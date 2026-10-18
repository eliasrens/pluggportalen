// ============================================================================
// Prov (#747, spec §12–§13): den fördjupade statistiken under fliken Översikt
// i rättningsvyn – laddas med import() när fliken ritas (#271).
//
//   verktyg(v)              Exportera CSV · Skriv ut provet · Skriv ut resultat
//   sektioner(v, m)         poäng per avsnitt (#765, bara med avsnitt), staplar
//                           per fråga (svårast först), fördelningen av totalen
//                           och nivåerna, jämförelsen med lärarens andra klasser
//                           (läses först på knapptryck, grupperad per avsnitt)
//   skrivUtElever(v, uids)  "Skriv ut resultat" för en eller flera elever
// Allt utom jämförelsen räknas ur det rättningsvyn redan läst (v.lager,
// v.svarAv, v.fragor): inga extra läsningar. Färg har alltid symbol + text.
// v = rättningsvyns kontext (prov-ratta-sida.js), m = klassOversikt(...).
// CSS: prov-statistik.css (.provl-st-).
// ============================================================================

import { CELL_INFO, FARG_INFO, avsnittVarde, fargFor, procent } from "./prov-statistik.js";
import { csvFilnamn, jamforKlasser, nivaFordelning, perFragaStaplar, poangFordelning, resultatCsv } from "./prov-statistik-fordjupad.js";
import { fordelningEl } from "./prov-stat-vy.js";
import { tillMs } from "./prov-tillfalle-logik.js";
import { h } from "./prov-vy.js";

const SEGMENT = ["ratt", "delvis", "fel", "obesvarad", "ej"];
const SEG_TEXT = { ratt: "rätt", delvis: "delvis rätt", fel: "fel", obesvarad: "obesvarade", ej: "ej rättade" };
const datumText = (ms) => (ms ? new Date(ms).toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" }) : "");
const riktigtNamn = (v, uid) => (v.riktigtNamn ? v.riktigtNamn(uid) : v.visNamn(uid));

function andelBricka(andel, farg) {
  if (andel == null) return h("span", { class: "provl-st-fsum provl-st-ej", title: "Inget bedömt än" }, h("span", { class: "provl-st-ikon", "aria-hidden": "true", text: "?" }), h("span", { text: "–" }));
  return h("span", { class: `provl-st-fsum provl-st-${farg}`, title: FARG_INFO[farg].namn },
    h("span", { class: "provl-st-ikon", "aria-hidden": "true", text: FARG_INFO[farg].ikon }), h("span", { text: procent(andel) }));
}

// --- verktygen: CSV och utskrift ---------------------------------------------------

/** Ladda ner en textfil (CSV) utan server. */
function laddaNer(text, filnamn) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = h("a", { href: url, download: filnamn, hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exporteraCsv(v) {
  const csv = resultatCsv({
    fragor: v.fragor, med: v.med, namn: Object.fromEntries(v.med.map((uid) => [uid, riktigtNamn(v, uid)])),
    rattningar: v.lager.rattningar, installningar: { ...v.tf.installningar, granser: v.granser() },
  });
  laddaNer(csv, csvFilnamn(v.tf.provNamn, v.tf.klassNamn));
  return csv;
}

export async function skrivUtProvet(v) {
  const { skrivUtProv } = await import("./prov-utskrift.js");
  return skrivUtProv({
    namn: v.tf.provNamn, klassNamn: v.tf.klassNamn, fragor: v.fragor, facit: v.facit, bedomningsstod: v.bedomningsstod,
    kriterier: v.kriterier, poangsatt: v.poangsatt,
  });
}

export async function skrivUtElever(v, uids) {
  const { skrivUtResultat } = await import("./prov-utskrift.js");
  const elever = uids.map((uid) => ({ namn: riktigtNamn(v, uid), r: v.lager.rattningar[uid] || null, svar: Object.fromEntries(v.rf.map((f) => [f.id, v.svarAv(uid, f.id)])) }))
    .sort((a, b) => a.namn.localeCompare(b.namn, "sv"));
  return skrivUtResultat({
    namn: v.tf.provNamn, klassNamn: v.tf.klassNamn, datum: datumText(tillMs(v.tf.oppnad)), fragor: v.fragor, facit: v.facit, kriterier: v.kriterier,
    installningar: { ...v.tf.installningar, granser: v.granser() }, elever,
  });
}

export function verktyg(v) {
  const knapp = (text, titel, fn) => h("button", { type: "button", class: "btn ghost small", text, title: titel, on: { click: fn } });
  return h("div", { class: "provl-st-utverktyg", role: "group", "aria-label": "Exportera och skriv ut" },
    knapp("⬇ Exportera CSV", "Klassens resultat som CSV: elev, poäng per fråga, total och nivå", () => exporteraCsv(v)),
    knapp("🖨 Skriv ut provet", "Provet på papper med namnrad och skrivlinjer – facit på ett eget blad om du vill", () => skrivUtProvet(v)),
    knapp("🖨 Skriv ut resultat", `Alla ${v.med.length} elevers rättade prov, en elev per sida`, () => skrivUtElever(v, v.med)));
}

// --- per fråga ---------------------------------------------------------------------

function stapel(s) {
  const delar = SEGMENT.filter((k) => s.n[k]).map((k) => `${s.n[k]} ${SEG_TEXT[k]}`);
  const etikett = `Fråga ${s.nr}: ${delar.join(", ")}`;
  return h("div", { class: "provl-st-stapel", role: "img", "aria-label": etikett, title: etikett },
    SEGMENT.filter((k) => s.n[k]).map((k) => h("span", {
      class: `provl-st-seg provl-st-seg-${k}`, style: `flex-grow: ${s.n[k]}`, title: `${s.n[k]} ${SEG_TEXT[k]}`,
    }, h("span", { class: "provl-st-seg-text", "aria-hidden": "true", text: `${CELL_INFO[k].ikon} ${s.n[k]}` }))));
}

function perFragaSektion(v, m) {
  const staplar = perFragaStaplar(m, v.fragor);
  return h("section", { class: "panel provl-st-sektion", "aria-labelledby": "provl-st-pf" },
    h("h3", { class: "provl-st-rubrik", id: "provl-st-pf", text: "Per fråga – svårast först" }),
    h("p", { class: "hint", text: "Hur många elever som fick rätt, delvis rätt och fel på varje fråga. Procenten är andelen av poängen bland de bedömda svaren. Klicka på en fråga för att rätta den." }),
    h("ol", { class: "provl-st-staplar" }, staplar.map((s) => h("li", { class: "provl-st-stapelrad" },
      h("button", { type: "button", class: "provl-st-stapel-namn", title: `Rätta fråga ${s.nr}`, on: { click: () => v.oppnaFraga(s.fid) } },
        h("b", { text: `Fråga ${s.nr}` }), s.avsnitt ? h("span", { class: "provl-st-stapel-avsnitt", text: s.avsnitt }) : null,
        h("span", { class: "provl-st-stapel-text", text: s.text })),
      stapel(s),
      andelBricka(s.andel, s.farg)))),
    h("p", { class: "provl-st-forklaring hint" }, SEGMENT.map((k) => h("span", { class: "provl-st-forkl" },
      h("span", { class: `provl-st-seg-prov provl-st-seg-${k}`, "aria-hidden": "true", text: CELL_INFO[k].ikon }), ` ${CELL_INFO[k].namn}`))));
}

// --- per avsnitt (#765) ----------------------------------------------------------------

function avsnittSektion(v, m) {
  if (!m.avsnitt.length) return null;
  return h("section", { class: "panel provl-st-sektion", "aria-labelledby": "provl-st-pa" },
    h("h3", { class: "provl-st-rubrik", id: "provl-st-pa", text: "Per avsnitt" }),
    h("p", { class: "hint", text: m.poangsatt
      ? "Klassens snittpoäng i varje avsnitt – var det faktakunskaperna eller skrivandet som var svårt? Procenten är andelen av poängen bland de bedömda svaren."
      : "Andelen rätt i varje avsnitt bland de bedömda svaren." }),
    h("ul", { class: "provl-st-avsnittlista" }, m.avsnitt.map((a) => h("li", { class: "provl-st-avsnittrad" },
      h("span", { class: "provl-st-avsnittrad-namn" }, h("b", { text: a.titel }),
        h("span", { class: "hint", text: ` ${a.antal} ${a.antal === 1 ? "fråga" : "frågor"}` })),
      h("span", { class: "provl-st-avsnittrad-snitt", text: avsnittVarde(a, m.poangsatt) }),
      h("span", { class: "provl-st-nivastapel" }, h("span", { class: `provl-st-avsnittfyll provl-st-${a.farg || "ej"}`, style: `width: ${Math.round((a.andel || 0) * 100)}%` })),
      andelBricka(a.andel, a.farg)))));
}

// --- fördelningen ------------------------------------------------------------------

function fordelningSektion(v, m) {
  const f = poangFordelning(m.rader, m.granser);
  const hojd = (n) => (f.flest ? Math.round((n / f.flest) * 100) : 0);
  const sammanfattning = f.staplar.filter((s) => s.antal).map((s) => `${s.text}: ${s.antal}`).join(", ") || "inga rättade prov";
  const nivaer = nivaFordelning(m.rader);
  const visaNivaer = v.nivaer || nivaer.some((n) => n.id && n.antal);
  const flestNiva = Math.max(1, ...nivaer.map((n) => n.antal));
  return h("section", { class: "panel provl-st-sektion", "aria-labelledby": "provl-st-ford" },
    h("h3", { class: "provl-st-rubrik", id: "provl-st-ford", text: m.poangsatt ? "Fördelning av totalpoängen" : "Fördelning av andelen rätt" }),
    h("div", { class: "provl-st-histogram", role: "img", "aria-label": `Antal elever per resultat: ${sammanfattning}` },
      f.staplar.map((s) => h("div", { class: "provl-st-hkol", title: `${s.text}: ${s.antal} ${s.antal === 1 ? "elev" : "elever"} (${FARG_INFO[s.farg].namn})` },
        h("span", { class: "provl-st-hantal", text: s.antal ? String(s.antal) : "" }),
        h("span", { class: "provl-st-hyta" }, h("span", { class: `provl-st-hstapel provl-st-${s.farg}`, style: `height: ${hojd(s.antal)}%` })),
        h("span", { class: "provl-st-hetikett" }, h("span", { "aria-hidden": "true", text: `${FARG_INFO[s.farg].ikon} ` }), `${s.fran}`)))),
    h("p", { class: "hint", text: `Procent av ${m.poangsatt ? "poängen" : "frågorna"} på de bedömda frågorna, i steg om 10 % (0 = 0–9 %, 90 = 90–100 %). Symbolen visar färgen: ✗ röd, ½ gul, ✓ grön.${f.ej ? ` ${f.ej} ${f.ej === 1 ? "elev är" : "elever är"} inte rättade än och syns inte här.` : ""}` }),
    visaNivaer ? h("div", { class: "provl-st-nivaer" },
      h("h4", { class: "provl-st-underrubrik", text: "Nivåerna du satt" }),
      h("ul", { class: "provl-st-nivalista" }, nivaer.map((n) => h("li", {},
        h("span", { class: "provl-st-nivanamn", text: n.id ? `${n.id} – ${n.namn}` : n.namn }),
        h("span", { class: "provl-st-nivastapel" }, h("span", { class: `provl-st-nivafyll${n.id ? "" : " provl-st-nivafyll-ingen"}`, style: `width: ${Math.round((n.antal / flestNiva) * 100)}%` })),
        h("span", { class: "provl-st-nivaantal", text: String(n.antal) }))))) : null);
}

// --- jämförelsen -------------------------------------------------------------------

function jamforTabell(v, m, andra) {
  const j = jamforKlasser({ tf: v.tf, klassNamn: v.tf.klassNamn, rattningar: v.lager.rattningar, med: v.med, granser: m.granser }, andra);
  if (j.kolumner.length < 2) return h("p", { class: "hint", text: "Provet har inte körts i någon av dina andra klasser än." });
  const th = (text, extra = {}) => h("th", { scope: "row", ...extra, text });
  return h("div", { class: "provl-st-scroll", tabindex: "0", "aria-label": "Jämförelse mellan klasserna – scrolla i sidled" },
    h("table", { class: "provl-st-lista provl-st-jamfor" },
      h("thead", {}, h("tr", {}, h("th", { scope: "col", text: "" }),
        j.kolumner.map((k, i) => h("th", { scope: "col", text: i === 0 ? `${k.klassNamn} (den här)` : k.klassNamn })))),
      h("tbody", {},
        h("tr", {}, th("Elever (rättade)"), j.kolumner.map((k) => h("td", { text: `${k.antal} (${k.rattade})` }))),
        h("tr", {}, th("Snitt"), j.kolumner.map((k) => h("td", {}, andelBricka(k.snitt, k.farg)))),
        h("tr", {}, th("Fördelning"), j.kolumner.map((k) => h("td", { class: "provl-st-ford" }, fordelningEl(k.fordelning)))),
        jamforRader(j).map((f) => h("tr", { class: f.avsnitt ? "provl-st-jamfor-avsnitt" : null },
          th(f.avsnitt ? f.titel : `Fråga ${f.nr}`, { title: f.avsnitt ? `${f.titel}: snittet i avsnittet` : f.text }),
          f.andelar.map((a) => h("td", {}, andelBricka(a, fargFor(a, j.granser)))))))));
}

/** Frågeraderna – med avsnitt (#765) först avsnittets rad (snittet), sedan dess frågor. */
function jamforRader(j) {
  if (!j.avsnitt.length) return j.perFraga;
  const perId = new Map(j.perFraga.map((f) => [f.fid, f]));
  return j.avsnitt.flatMap((a) => [{ avsnitt: true, titel: a.titel, andelar: a.andelar }, ...a.fids.map((id) => perId.get(id)).filter(Boolean)]);
}

function jamforSektion(v, m) {
  const host = h("div", { class: "provl-st-jamfor-host" });
  const st = v.stat;
  const knapp = h("button", { type: "button", class: "btn small", text: "Jämför med mina andra klasser", on: { click: () => ladda() } });
  async function ladda() {
    knapp.disabled = true;
    knapp.textContent = "Hämtar…";
    try {
      const hamta = v.hamtaJamforelse || (await import("./prov-jamfor-data.js")).hamtaJamforelse;
      st.jamfor = await hamta(v.tf);
      ritaJ();
    } catch (err) {
      knapp.disabled = false;
      knapp.textContent = "Försök igen";
      host.replaceChildren(h("p", { class: "msg error", text: `Kunde inte hämta de andra klasserna: ${err?.message || err}` }));
    }
  }
  function ritaJ() {
    knapp.remove();
    host.replaceChildren(jamforTabell(v, m, st.jamfor));
  }
  if (st.jamfor) queueMicrotask(ritaJ);
  return h("section", { class: "panel provl-st-sektion", "aria-labelledby": "provl-st-jf" },
    h("h3", { class: "provl-st-rubrik", id: "provl-st-jf", text: "Jämför klasser" }),
    h("p", { class: "hint", text: "Samma prov i dina andra klasser, sida vid sida. Bara dina egna klasser visas, med det här provets färggränser. Hämtas först när du trycker." }),
    knapp, host);
}

export function sektioner(v, m) {
  return [avsnittSektion(v, m), perFragaSektion(v, m), fordelningSektion(v, m), jamforSektion(v, m)].filter(Boolean);
}
