// ============================================================================
// Hitta rätt! – kartval i lärarens editor (src/hitta-ratt/larare/lhr-kartval.js) · #636
// ----------------------------------------------------------------------------
// Arkitektur §11.6 (punkt) och §11.7 (område). Kartan ligger ovanför
// frågelistan (lhr-fragor.js) och överlever att listan ritas om.
//
//   const kv = skapaKartval(host, st, { omraden, andrad, omritaLista })
//   kv.synka()        listan ändrades (ta bort, namn) → markeringar/mål följer med
//   kv.valjFraga(it)  punkt: "📍 Flytta på kartan" i en frågerad → den blir målet
//   kv.destroy()
//
// PUNKT: sök (knapp eller Enter, lhr-platssok.js) → förslag (utanför packets
//   scope = grått, "utanför kartan") → markören sätts och kartan zoomar dit
//   (k.satGissning). Läraren drar markören eller klickar om. "Använd denna
//   plats" skriver lat/lon (5 decimaler) och källan till målfrågan – eller
//   lägger till en ny fråga med träffens namn. Källan (wikidata:Q… / osm:…)
//   följer med när markören bara justeras – den säger VILKEN plats det är.
// OMRÅDE: klick på ett område växlar en fråga (namn ur <geo>.namn.json via
//   omraden.lista). Valda områden är blå (k.markera), senast tillagda får sitt
//   namn som etikett – bara här i lärarvyn, aldrig i elevens spel.
// Reserv: kartan fungerar utan sökningen, och listan (namnlistan /
// "Avancerat") fungerar utan kartan.
// ============================================================================

import { el, esc, icon } from "../../teacher-shared.js";
import { GRANS } from "../delat/egna.js";
import { GEO_SCOPE, STANDARD, inomScope } from "../delat/scope.js";
import { laggTillOmrade, tal } from "./lhr-modell.js";
import { hamtaGeo } from "./lhr-data.js";
import { OSM_ATTRIBUTION, avrunda, skapaPlatssok } from "./lhr-platssok.js";

const KALLOR = { ne: "Natural Earth", "lm-landskap": "Lantmäteriet (CC0)" };
let platssok = null; // en per sida – cachen och strypningen gäller hela sessionen
const sokaren = () => (platssok ||= skapaPlatssok());

const koord = ({ lat, lon }) => `${avrunda(lat).toFixed(5)}, ${avrunda(lon).toFixed(5)}`;

export function skapaKartval(host, st, { omraden = null, andrad = () => {}, omritaLista = () => {} } = {}) {
  const area = st.f.type === "area";
  const scope = GEO_SCOPE[st.f.geo];
  const vy = el(`<section class="lhr-kartval" aria-label="Välj på kartan">
    ${area ? `<p class="hint lhr-kartval-hjalp">Klicka på ett område för att lägga till det som fråga – klicka igen för att ta bort det. Valda områden är blå.</p>`
      : `<div class="lhr-platssok" role="search">
        <label class="lhr-mini">Sök plats<input type="search" data-v="q" maxlength="80" placeholder="t.ex. Gävle, Kebnekaise, Eiffeltornet" autocomplete="off" /></label>
        <button type="button" class="btn small" data-act="sok">🔍 <span>Sök</span></button>
        <button type="button" class="btn small ghost" data-act="osm" title="Om Wikidata inte hittar platsen">Sök i OpenStreetMap</button>
      </div>
      <div class="lhr-platssok-svar" aria-live="polite"></div>`}
    <div class="lhr-kartval-karta"><div class="spinner">Laddar kartan…</div></div>
    <div class="lhr-kartval-fot">
      <span class="lhr-kartval-status" aria-live="polite"></span>
      ${area ? "" : `<span class="lhr-spacer"></span>
        <button type="button" class="btn small ghost" data-act="avbryt" hidden>Avbryt</button>
        <button type="button" class="btn small gron" data-act="anvand" disabled>${icon("check", 16)}<span>Använd denna plats</span></button>`}
    </div>
  </section>`);
  const $ = (s) => vy.querySelector(s);
  const status = (html) => { $(".lhr-kartval-status").innerHTML = html; };
  host.replaceChildren(vy);

  let k = null;
  let dod = false;
  let kandidat = null; // punkt: { lon, lat, namn, kalla }
  let mal = null; // punkt: frågan som flyttas (annars blir det en ny fråga)
  let senaste = null; // område: senast tillagda id (etiketten)

  // --- Kartan (laddas dynamiskt, som i spelet) --------------------------------
  Promise.all([hamtaGeo(st.f.geo), import("../karta/kartmotor.js")]).then(([geo, motor]) => {
    if (dod) return;
    const yta = $(".lhr-kartval-karta");
    yta.replaceChildren();
    k = motor.skapaKarta(yta, geo, {
      lage: area ? "omrade" : "punkt",
      maxZoom: STANDARD[scope]?.maxZoom,
      visaGranser: area ? true : "svag",
      attribution: `Kartdata: ${(geo.kalla || ["ne"]).map((x) => KALLOR[x] || x).join(" · ")}`,
    });
    if (area) {
      k.on("val", ({ id }) => vaxla(id));
      synka();
    } else {
      k.on("gissning", ({ lon, lat }) => satKandidat({ ...kandidat, lon, lat }, false));
      if (kandidat) k.satGissning(kandidat, { zooma: true });
      ritaPunkt();
    }
  }).catch(() => {
    if (dod) return;
    $(".lhr-kartval-karta").replaceChildren(el(`<p class="err-inline">Kartan gick inte att ladda. ${area ? "Lägg till områden med namnlistan nedan." : "Skriv lat/lon under ”Avancerat” i frågan."}</p>`));
  });

  // --- Område: klick växlar en fråga -----------------------------------------
  function vaxla(id) {
    const o = omraden?.lista.find((x) => x.id === id);
    if (!o) return;
    const fanns = st.f.items.find((it) => it.omrade === id);
    if (fanns) {
      st.f.items = st.f.items.filter((it) => it !== fanns);
      senaste = null;
      status(`Tog bort <b>${esc(o.namn)}</b>.`);
    } else if (st.f.items.length >= GRANS.items) {
      status(`Max ${GRANS.items} frågor – ta bort en först.`);
      return synka();
    } else {
      st.f = laggTillOmrade(st.f, o);
      senaste = id;
      status(`La till <b>${esc(o.namn)}</b> som fråga ${st.f.items.length}.`);
    }
    omritaLista(); // anropar andrad() → synka()
  }

  function synka() {
    if (area) {
      const ids = st.f.items.map((it) => it.omrade);
      if (!ids.includes(senaste)) senaste = null;
      const namn = senaste && omraden?.lista.find((x) => x.id === senaste)?.namn;
      k?.markera(ids, { etikett: namn ? { id: senaste, text: namn } : null });
      return;
    }
    if (mal && !st.f.items.includes(mal)) avbryt();
    else ritaPunkt();
  }

  if (area) return { synka, valjFraga() {}, destroy };

  // --- Punkt: sök → markör → Använd -------------------------------------------
  const q = $('[data-v="q"]');
  const svar = $(".lhr-platssok-svar");

  async function sok(kalla) {
    const text = q.value.trim();
    svar.replaceChildren(el(`<p class="hint">Söker …</p>`));
    try {
      const r = await sokaren().sok(text, { scope, kalla });
      svar.replaceChildren(el(`<div><ul class="lhr-platssok-lista">${r.traffar.map((t, i) => `<li>
          <button type="button" class="lhr-plats-traff ${t.inom ? "" : "utanfor"}" data-i="${i}" ${t.inom ? "" : "disabled"}>
            <b>${esc(t.namn)}</b>${t.besk ? ` – <span>${esc(t.besk)}</span>` : ""}${t.inom ? "" : ` <em>utanför kartan</em>`}
          </button></li>`).join("")}</ul>
        ${r.kalla === "osm" ? `<p class="hint lhr-osm">${esc(OSM_ATTRIBUTION)}</p>` : ""}</div>`));
      svar.querySelectorAll("[data-i]").forEach((b) => b.addEventListener("click", () => {
        const t = r.traffar[Number(b.dataset.i)];
        svar.querySelectorAll(".vald").forEach((x) => x.classList.remove("vald"));
        b.classList.add("vald");
        satKandidat({ lon: t.lon, lat: t.lat, namn: t.namn, kalla: t.kalla }, true);
      }));
    } catch (err) {
      svar.replaceChildren(el(`<p class="msg warn lhr-platssok-fel" role="alert">${esc(err?.message || "Sökningen misslyckades.")}</p>`));
    }
  }
  $('[data-act="sok"]').addEventListener("click", () => sok("auto"));
  $('[data-act="osm"]').addEventListener("click", () => sok("osm"));
  // Ingen autocomplete. Enter får inte skicka formuläret runt omkring (= Spara).
  q.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    sok("auto");
  });

  function satKandidat(ny, flytta) {
    kandidat = ny;
    if (flytta) k?.satGissning(ny, { zooma: true });
    ritaPunkt();
  }

  function ritaPunkt() {
    const anvand = $('[data-act="anvand"]');
    $('[data-act="avbryt"]').hidden = !mal && !kandidat;
    const nr = mal ? st.f.items.indexOf(mal) + 1 : 0;
    const vem = mal ? `fråga ${nr}${mal.name ? ` ”${esc(mal.name)}”` : ""}` : "";
    if (!kandidat) {
      anvand.disabled = true;
      status(mal ? `Flyttar ${vem}: sök eller klicka på kartan.` : "Sök efter en plats eller klicka på kartan för att sätta en markör.");
      return;
    }
    const inom = inomScope(scope, kandidat.lon, kandidat.lat);
    const fullt = !mal && st.f.items.length >= GRANS.items;
    anvand.disabled = !inom || fullt;
    anvand.lastElementChild.textContent = mal ? `Använd för fråga ${nr}` : "Använd denna plats";
    status(`📍 ${kandidat.namn ? `<b>${esc(kandidat.namn)}</b> · ` : ""}${koord(kandidat)}${
      !inom ? ` – <span class="lhr-utanfor">utanför kartan</span>`
      : fullt ? ` – max ${GRANS.items} frågor`
      : " – dra markören eller klicka för att justera."}`);
  }

  $('[data-act="anvand"]').addEventListener("click", () => {
    if (!kandidat || !inomScope(scope, kandidat.lon, kandidat.lat)) return;
    const plats = { lat: avrunda(kandidat.lat), lon: avrunda(kandidat.lon) };
    let it = mal;
    if (it) {
      Object.assign(it, plats);
      if (kandidat.kalla) it.kalla = kandidat.kalla;
      if (!String(it.name || "").trim() && kandidat.namn) it.name = kandidat.namn.slice(0, GRANS.namn);
    } else {
      it = { name: (kandidat.namn || "").slice(0, GRANS.namn), prompt: "", ...plats, ...(kandidat.kalla ? { kalla: kandidat.kalla } : {}) };
      st.f.items = [...st.f.items, it];
    }
    const nr = st.f.items.indexOf(it) + 1;
    mal = null;
    kandidat = null;
    k?.satGissning(null);
    svar.querySelectorAll(".vald").forEach((x) => x.classList.remove("vald"));
    omritaLista();
    status(`✓ Sparade platsen i fråga ${nr}${it.name ? ` ”${esc(it.name)}”` : " – skriv ett namn i frågan"}. Glöm inte Spara.`);
    if (!it.name) host.parentElement?.querySelector(`.lhr-fraga[data-i="${nr - 1}"] [data-f="name"]`)?.focus();
  });

  function avbryt() {
    mal = null;
    kandidat = null;
    k?.satGissning(null);
    ritaPunkt();
  }
  $('[data-act="avbryt"]').addEventListener("click", avbryt);

  function valjFraga(it) {
    mal = it;
    const lat = tal(it.lat), lon = tal(it.lon);
    kandidat = lat !== undefined && lon !== undefined ? { lat, lon, namn: it.name, kalla: it.kalla } : null;
    if (kandidat) k?.satGissning(kandidat, { zooma: true });
    else {
      k?.satGissning(null);
      if (it.name && !q.value.trim()) q.value = it.name;
    }
    ritaPunkt();
    vy.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function destroy() {
    dod = true;
    k?.destroy();
    k = null;
  }

  ritaPunkt();
  return { synka, valjFraga, destroy };
}
