// ============================================================================
// Prov (#741, spec §6–§7): rättningsvyn #/larare/prov/ratta?t=<tillfälle>
// med två lägen (flikar):
//   Per fråga (standard, §6.1)  en fråga i taget: facit + bedömningsstöd
//                               överst, alla elevers svar under – identiska
//                               kortsvar/luckor som EN grupp ("Birka – 12 elever")
//   Per elev (§6.2)             en elev med hela provet, totalen, nivån,
//                               helhetskommentaren, Lämna tillbaka / Ångra
// Läser EN gång när vyn öppnas (tillfället, facit, alla svar, alla
// rättningar – inga lyssnare, §6.3) och sparar automatiskt (prov-sparning.js
// med lärarens tak). Förslagen sparas med auto: true direkt.
// Tangenter: 1 rätt · 2 delvis · 3 fel · Tab nästa svar · N nästa fråga.
// Läget och fråga/elev står i hashen (&lage=elev&e=<uid>, &f=<fråga>) men byts
// med replaceState – vyn laddas inte om. Laddas DYNAMISKT (#271). CSS:
// prov-ratta.css (.provl-r-) + prov-resultat.css (svaren).
// ============================================================================

import { el, emptyState, errText, esc, isTeacher, renderGate, teacherHead, teacherNav, wireHashLinks } from "../teacher-shared.js";
import { getClasses } from "../data-classes.js";
import { getStudentsByIds } from "../data-content.js";
import { formatKlockslag } from "../class-lock.js";
import { STATUS, STATUS_NAMN, fragaNummer } from "./prov-modell.js";
import { TANGENT_RATT, aterlamnaPlan, ejKlaraText, rattFragor, rattStatusText } from "./prov-rattning-logik.js";
import { laddaRattning } from "./prov-rattning-data.js";
import { skapaRattningsLager } from "./prov-ratta-lager.js";
import { perElev, perFraga } from "./prov-ratta-lagen.js";
import { elevStatVy, oversiktVy } from "./prov-stat-vy.js";
import { granserFor } from "./prov-statistik.js";
import { sparaGranser } from "./prov-rattning-data.js";
import { ruta } from "./prov-tillfalle-rutor.js";
import { harMynt, myntRegelText } from "./prov-mynt.js";
import { blanda } from "./typer/delat.js";
import { h, laddaCss } from "./prov-vy.js";

const LISTA = "#/larare/prov/tillfallen";
const oversiktHash = (t) => `#/larare/prov/tillfalle?t=${encodeURIComponent(t)}`;
export const rattaHash = (t, extra = "") => `#/larare/prov/ratta?t=${encodeURIComponent(t)}${extra}`;
const DOLJ_NYCKEL = "pp:prov:doljNamn";
const SPARTEXT = {
  fel: "Kunde inte spara – kontrollera internet. Rättningen finns kvar här och sparas igen.",
  nekad: "Rättningen kunde inte sparas (behörighet). Ladda om sidan.",
  sparar: "Sparar…",
};

/** Route-handler: #/larare/prov/ratta?t=… */
export async function pageProvRatta(ctx) {
  const route = window.location.hash;
  const q = new URLSearchParams(route.split("?")[1] || "");
  const t = q.get("t") || "";
  ctx.renderTopbar();
  if (!isTeacher()) return renderGate(ctx);
  laddaCss("prov-tillfalle.css");
  laddaCss("prov-elev.css");
  laddaCss("prov-resultat.css");
  laddaCss("prov-ratta.css");
  laddaCss("prov-statistik.css");
  const page = el(`<div class="teacher-page teacher-dark provl-sida provl-r-sida"></div>`);
  page.append(teacherNav(ctx, "provtillfallen"), teacherHead(ctx, "provtillfallen"));
  const body = el(`<div class="provl-kropp"><div class="spinner">Laddar rättningen…</div></div>`);
  page.append(body);
  ctx.app.replaceChildren(page);

  let data;
  let elever;
  try {
    data = await laddaRattning(t);
    if (!data) throw new Error("Provtillfället finns inte (det kan ha raderats).");
    if (data.tf.status === STATUS.FORBERETT) throw new Error("Provet har inte öppnats än – det finns inget att rätta.");
    const klass = (await getClasses()).find((c) => c.id === data.tf.classId);
    const ids = [...new Set([...(klass?.studentIds || []), ...Object.keys(data.svar)])];
    // Elevernas namn – en gång (§9.2: en klass i taget).
    const namn = Object.fromEntries((await getStudentsByIds(ids)).map((e) => [e.id, e.namn || e.username || e.id]));
    elever = ids.map((id) => ({ id, namn: namn[id] || "Okänd elev" })).sort((a, b) => a.namn.localeCompare(b.namn, "sv"));
    data.tf.klassNamn = klass?.name || data.tf.classId;
  } catch (err) {
    body.replaceChildren(el(`<div class="panel"><div class="msg error">${esc(errText(err))}</div>
      <p><a data-hash="${LISTA}" class="provl-lank">← Provtillfällen</a></p></div>`));
    wireHashLinks(ctx, body);
    return;
  }
  if (window.location.hash !== route) return;
  rattningsVy(ctx, body, data, elever, q);
}

function rattningsVy(ctx, body, data, elever, q) {
  const { tf, svar } = data;
  const t = tf.id;
  const fragor = tf.fragor || [];
  const rf = rattFragor(fragor);
  const poangsatt = tf.installningar?.poang !== false;
  // Bara inlämnade prov rättas; de som skriver kommer med när vyn laddas om.
  const med = elever.filter((e) => svar[e.id]?.inlamnad === true).map((e) => e.id);
  const skriver = elever.filter((e) => svar[e.id] && !svar[e.id].inlamnad).length;
  const ejBorjat = elever.filter((e) => !svar[e.id]).length;
  const namn = Object.fromEntries(elever.map((e) => [e.id, e.namn]));
  // "Dölj namn" (§6.1): Elev 1, Elev 2 … i en ordning som inte följer alfabetet.
  const anonym = Object.fromEntries(blanda(med, `dolj:${t}`).map((uid, i) => [uid, `Elev ${i + 1}`]));
  let doljNamn = localStorage.getItem(DOLJ_NYCKEL) === "1";

  const sparStatus = h("span", { class: "provl-r-spar", role: "status", "aria-live": "polite" });
  const lager = skapaRattningsLager({
    data, med,
    onStatus: (s) => {
      sparStatus.textContent = SPARTEXT[s.lage] || (s.tid ? `Sparat ${formatKlockslag(s.tid)}` : "");
      sparStatus.dataset.lage = s.lage;
    },
  });

  let lage = ["elev", "oversikt"].includes(q.get("lage")) ? q.get("lage") : "fraga";
  // Översikten (#742): en elev i elevvyn (&e=) eller hela klassen; svaret att visa efter klick på en cell.
  let statElev = lage === "oversikt" && med.includes(q.get("e")) ? q.get("e") : null;
  let fokusFraga = lage === "elev" ? q.get("f") : null;
  const index = { fraga: Math.max(0, rf.findIndex((f) => f.id === q.get("f"))), elev: Math.max(0, med.indexOf(q.get("e"))) };
  let aktiv = null; // { el, uppdatera } för läget som visas

  // --- skalet -------------------------------------------------------------------
  const statusRad = h("span", { class: "provl-r-raknare" });
  const allaKnapp = h("button", { type: "button", class: "btn gron small", text: "Lämna tillbaka till alla rättade", on: { click: () => lamnaAlla() } });
  const doljRuta = h("input", { type: "checkbox", checked: doljNamn });
  doljRuta.addEventListener("change", () => {
    doljNamn = doljRuta.checked;
    try { localStorage.setItem(DOLJ_NYCKEL, doljNamn ? "1" : "0"); } catch {}
    ritaInnehall();
  });
  const FLIKAR = { fraga: "Per fråga", elev: "Per elev", oversikt: "Översikt" };
  const flikar = Object.keys(FLIKAR).map((id) => h("button", {
    type: "button", role: "tab", class: "provl-r-flik", "data-lage": id, text: FLIKAR[id],
    on: { click: () => { lage = id; statElev = null; ritaInnehall(); } },
  }));
  const innehall = h("div", { class: "provl-r-innehall" });
  const vy = h("div", { class: "provl-r" },
    h("div", { class: "panel provl-huvud" },
      h("div", { class: "provl-r-lankar" },
        h("a", { "data-hash": LISTA, class: "provl-lank", text: "← Provtillfällen" }),
        h("a", { "data-hash": oversiktHash(t), class: "provl-lank", text: "Översikten" })),
      h("div", { class: "provl-huvud-rad" },
        h("h2", { class: "provl-huvud-namn" }, tf.provNamn || "Prov", h("span", { class: "provl-klassnamn", text: ` · ${tf.klassNamn}` })),
        h("span", { class: `provl-status provl-status-${tf.status}`, text: STATUS_NAMN[tf.status] || tf.status })),
      h("p", { class: "hint provl-fakta", text: [
        `${rf.length} frågor`, `${med.length} inlämnade prov`,
        skriver ? `${skriver} skriver fortfarande` : "", ejBorjat ? `${ejBorjat} har inte skrivit` : "",
        poangsatt ? "" : "utan poäng",
      ].filter(Boolean).join(" · ") }),
      tf.status === STATUS.OPPET ? h("p", { class: "msg provl-r-oppet", text: "Provet är fortfarande öppet. Du rättar de inlämnade proven – ladda om sidan när fler har lämnat in." }) : null,
      h("div", { class: "provl-r-verktyg" }, statusRad, sparStatus, allaKnapp)),
    h("div", { class: "provl-r-flikrad" },
      h("div", { class: "provl-r-flikar", role: "tablist", "aria-label": "Rättningsläge" }, flikar),
      h("label", { class: "provl-kryss provl-r-dolj" }, doljRuta, " Dölj namn")),
    innehall);
  body.replaceChildren(vy);
  wireHashLinks(ctx, vy);

  function ritaStatus() {
    statusRad.textContent = rattStatusText(lager.status());
    const klara = aterlamnaPlan(med, lager.rattningar, fragor).klara.length;
    allaKnapp.disabled = !klara;
    allaKnapp.title = klara ? "" : "Ingen elev är färdigrättad än";
    aktiv?.uppdatera();
  }

  if (!med.length) {
    innehall.replaceChildren(emptyState(ctx, {
      title: "Inga inlämnade prov än",
      text: skriver ? `${skriver} elever skriver fortfarande. Ladda om sidan när de har lämnat in, eller stäng provet.` : "Ingen elev har skrivit provet.",
      icon: "inbox",
    }));
    [...flikar, allaKnapp, doljRuta].forEach((x) => (x.disabled = true));
    statusRad.textContent = "";
    return;
  }

  // Vyernas kontext (prov-ratta-lagen.js).
  const v = {
    lager, tf, fragor, rf, nr: fragaNummer(fragor), facit: data.facit, bedomningsstod: data.bedomningsstod, med,
    poangsatt, nivaer: tf.installningar?.nivaer === true, index,
    svarAv: (uid, fid) => svar[uid]?.svar?.[fid],
    visNamn: (uid) => (doljNamn ? anonym[uid] : namn[uid]),
    // CSV och utskrift (#747) har alltid det riktiga namnet – de är lärarens egna papper.
    riktigtNamn: (uid) => namn[uid] || "Okänd elev",
    ga({ fraga, elev, fokus = false }) {
      if (fraga != null) index.fraga = Math.min(rf.length - 1, Math.max(0, fraga));
      if (elev != null) index.elev = Math.min(med.length - 1, Math.max(0, elev));
      ritaInnehall({ fokus });
    },
    andrat(uids) {
      lager.andrat(uids);
      ritaStatus();
    },
    lamnaTillbaka: (uids) => lamnaRuta(uids, 0),
    // Översikten och elevvyn (#742, prov-stat-vy.js).
    stat: { sort: "namn" },
    granser: () => granserFor(tf.installningar),
    async sattGranser(g) {
      tf.installningar = { ...tf.installningar, granser: g };
      // Rättningarnas provInfo (statistikfliken "Prov") får de nya gränserna vid nästa sparning.
      v.andrat(med.filter((uid) => !lager.rattningar[uid]?.aterlamnad));
      try {
        await sparaGranser(t, g);
      } catch (err) {
        sparStatus.textContent = `Kunde inte spara färggränserna: ${errText(err)}`;
        sparStatus.dataset.lage = "fel";
      }
    },
    oppnaElev: (uid) => { lage = "oversikt"; statElev = uid; ritaInnehall({ topp: true }); },
    tillKlassen: () => { lage = "oversikt"; statElev = null; ritaInnehall({ topp: true }); },
    oppnaSvar(uid, fid) {
      lage = "elev";
      index.elev = Math.max(0, med.indexOf(uid));
      fokusFraga = fid;
      ritaInnehall({ topp: !fid });
    },
    oppnaFraga(fid) {
      lage = "fraga";
      index.fraga = Math.max(0, rf.findIndex((f) => f.id === fid));
      ritaInnehall({ topp: true });
    },
    angra: async (uid) => {
      try {
        await lager.angra(uid);
        ritaInnehall();
      } catch (err) {
        sparStatus.textContent = `Kunde inte ångra: ${errText(err)}`;
        sparStatus.dataset.lage = "fel";
      }
    },
  };

  let route = window.location.hash;
  function ritaInnehall({ fokus = false, topp = false } = {}) {
    flikar.forEach((f) => {
      const valt = f.dataset.lage === lage;
      f.setAttribute("aria-selected", valt ? "true" : "false");
      f.classList.toggle("provl-r-flik-vald", valt);
    });
    const scroll = window.scrollY;
    aktiv = lage === "fraga" ? perFraga(v) : lage === "elev" ? perElev(v) : statElev ? elevStatVy(v, statElev) : oversiktVy(v);
    innehall.replaceChildren(aktiv.el);
    const extra = lage === "elev" ? `&lage=elev&e=${encodeURIComponent(med[index.elev])}`
      : lage === "oversikt" ? `&lage=oversikt${statElev ? `&e=${encodeURIComponent(statElev)}` : ""}`
        : `&f=${encodeURIComponent(rf[index.fraga]?.id || "")}`;
    route = rattaHash(t, extra);
    if (window.location.hash !== route) history.replaceState(null, "", route);
    ritaStatus();
    // Klick på en cell i översikten (#742): just det svaret i Per elev.
    const malKort = fokusFraga && lage === "elev" ? innehall.querySelector(`.provl-r-kort[data-f="${CSS.escape(fokusFraga)}"]`) : null;
    fokusFraga = null;
    if (malKort) {
      malKort.focus({ preventScroll: true });
      malKort.scrollIntoView({ block: "center" });
    } else if (fokus) {
      innehall.querySelector(".provl-r-kort")?.focus({ preventScroll: true });
      innehall.scrollIntoView({ block: "start", behavior: "smooth" });
    } else if (topp) innehall.scrollIntoView({ block: "start" });
    else window.scrollTo?.(0, scroll);
  }

  // --- Lämna tillbaka (§7) -------------------------------------------------------
  function lamnaAlla() {
    const plan = aterlamnaPlan(med, lager.rattningar, fragor);
    lamnaRuta(plan.klara, plan.ejKlara.length);
  }

  function lamnaRuta(uids, ejKlara) {
    if (!uids.length) return;
    const en = uids.length === 1;
    const { box, stang } = ruta(`
      <h2 class="provl-ruta-rubrik">Lämna tillbaka till ${en ? esc(v.visNamn(uids[0])) : `${uids.length} elever`}?</h2>
      <p>${en ? "Eleven" : "Eleverna"} ser rättningen och dina kommentarer${poangsatt ? " och poängen" : ""} direkt under Prov.</p>
      ${ejKlara ? `<p class="msg provl-r-ejklara">${esc(ejKlaraText(ejKlara))}</p>` : ""}
      ${harMynt(tf.installningar) ? `<p>Pluggmynt: ${esc(myntRegelText(tf.installningar.mynt))}. Har ${en ? "eleven" : "en elev"} redan fått mynt för provet betalas bara skillnaden ut.</p>` : ""}
      <label class="provl-kryss"><input type="checkbox" data-f="facit" ${tf.installningar?.visaFacit !== false ? "checked" : ""} /> Visa facit för ${en ? "eleven" : "eleverna"}</label>
      <p class="hint">Förvalt enligt provets inställning. Du kan ångra tillbakalämningen för en elev i taget under Per elev.</p>
      <div class="provl-tf-knappar">
        <button class="btn gron" data-act="ok">Lämna tillbaka</button>
        <button class="btn ghost" data-avbryt>Avbryt</button>
      </div>
      <p class="msg error provl-tf-fel" hidden></p>`, { etikett: "Lämna tillbaka" });
    const ok = box.querySelector('[data-act="ok"]');
    ok.addEventListener("click", async () => {
      ok.disabled = true;
      ok.textContent = "Lämnar tillbaka…";
      try {
        visaMynt(await lager.lamnaTillbaka(uids, box.querySelector('[data-f="facit"]').checked));
        stang();
        ritaInnehall();
      } catch (err) {
        ok.disabled = false;
        ok.textContent = "Lämna tillbaka";
        const fel = box.querySelector(".provl-tf-fel");
        fel.hidden = false;
        fel.textContent = `Kunde inte lämna tillbaka: ${errText(err)}`;
      }
    });
  }

  // Pluggmyntens utfall (#746) i sparraden – nekade betalas nästa gång vyn öppnas.
  function visaMynt(ut) {
    const nekade = ut.filter((b) => b.status === "nekad").length;
    const betalda = ut.filter((b) => b.status === "betald").length;
    if (!nekade && !betalda) return;
    sparStatus.textContent = nekade
      ? `Pluggmynten kunde inte betalas ut till ${nekade} ${nekade === 1 ? "elev" : "elever"} – det görs nästa gång du öppnar rättningen.`
      : `Pluggmynt utbetalda till ${betalda} ${betalda === 1 ? "elev" : "elever"}.`;
    sparStatus.dataset.lage = nekade ? "fel" : "sparat";
  }

  // --- tangentbordet (§6.1) -----------------------------------------------------------
  function tangent(e) {
    if (!vy.isConnected || e.ctrlKey || e.metaKey || e.altKey || document.querySelector(".provl-bakgrund")) return;
    const kort = e.target.closest?.(".provl-r-kort");
    const paKortet = kort && e.target === kort;
    if (e.key === "Tab" && paKortet) {
      const alla = [...innehall.querySelectorAll(".provl-r-kort")];
      const nasta = alla[alla.indexOf(kort) + (e.shiftKey ? -1 : 1)];
      if (nasta) {
        e.preventDefault();
        nasta.focus();
        nasta.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
      return;
    }
    if (e.target.closest?.("input, textarea, select, [contenteditable]")) return;
    if (kort && e.key in TANGENT_RATT) {
      e.preventDefault();
      kort.__kort?.bedom(TANGENT_RATT[e.key]);
    } else if (paKortet && e.key === "Enter") {
      e.preventDefault();
      kort.querySelector(".provl-r-poang-falt:not(:disabled), .provl-r-kommentar-falt:not(:disabled)")?.focus();
    } else if ((e.key === "n" || e.key === "N") && lage === "fraga" && index.fraga < rf.length - 1) {
      e.preventDefault();
      v.ga({ fraga: index.fraga + 1, fokus: true });
    }
  }
  document.addEventListener("keydown", tangent);

  // Lämnar läraren vyn eller fliken sparas det direkt.
  const spola = () => lager.spola();
  const synlighet = () => { if (document.hidden) spola(); };
  const bort = () => {
    if (window.location.hash === route) return;
    spola();
    document.removeEventListener("keydown", tangent);
    window.removeEventListener("hashchange", bort);
    window.removeEventListener("pagehide", spola);
    document.removeEventListener("visibilitychange", synlighet);
  };
  window.addEventListener("hashchange", bort);
  window.addEventListener("pagehide", spola);
  document.addEventListener("visibilitychange", synlighet);

  ritaInnehall();
  // Mynt som inte hann betalas ut förra gången (avbrott, nekad) – som Live-historiken.
  lager.betalaKvar().then((ut) => { if (ut.length && vy.isConnected) { visaMynt(ut); aktiv?.uppdatera(); } });
}
