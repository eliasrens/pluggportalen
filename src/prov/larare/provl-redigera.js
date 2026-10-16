// ============================================================================
// Prov (#739, spec §8.1): skapa / redigera / kopiera ett prov
// (src/prov/larare/provl-redigera.js)
// ----------------------------------------------------------------------------
//   #/larare/prov?vy=ny              nytt prov
//   #/larare/prov?vy=ny&id=<id>      redigera (bara ägaren/admin – andra kopierar)
//   #/larare/prov?vy=ny&kopia=<id>   kopia → osparat utkast med "(kopia)"
// Provets uppgifter + inställningar, frågekorten (flytta, duplicera, ta bort,
// redigera i kortet), "Lägg till fråga" (typväljaren → typens formulär),
// "Skapa med AI" (provl-ai.js), "Förhandsvisa som elev" (provl-forhandsvisa.js),
// "Skriv ut" (prov-utskrift.js, #747)
// och "Kör i klass" (provtillfället, #740).
// Arbetskopian ändras bara via prov-redigera-ops.js. Spara = validateProv +
// ägarfälten (tillDokument) → setDoc. Osparade ändringar → lämna-vakten frågar.
// ============================================================================

import { el, esc, icon } from "../../teacher-shared.js";
import { myRole } from "../../teacher-role.js";
import { GRADES } from "../../grades.js";
import { armeraLamnaVakt } from "../../hitta-ratt/hr-lamna-vakt.js";
import { fragetyp } from "../prov-fragetyper.js";
import { fragaNummer, maxPoang } from "../prov-modell.js";
import { TIDSGRANS_MAX, TIDSGRANS_MIN, tolkaTidsgrans, typValjare } from "../prov-validera.js";
import { kanAndra } from "../prov-lista-ops.js";
import {
  bild, dupliceraFraga, flyttaFraga, fragaRubrik, fragaText, kopieraProv, nyttProv, provFranDok,
  sparaFraga, taBortFraga, tillDokument, tomFraga,
} from "../prov-redigera-ops.js";
import { byggFragaForm } from "./provl-fragaform.js";
import { myntFalt } from "./provl-mynt.js";
import { felText, hamtaProv, raderaProv, sparaProv } from "./provl-data.js";
import { HASH } from "./page-larare-prov.js";
import { korIKlass, raderaRuta } from "./provl-lista.js";

const LAMNA_TEXT = "Du har ändringar i provet som inte är sparade. Vill du lämna utan att spara?";
let flash = null; // { id, html } – meddelande efter sparning, visas en gång

export async function renderRedigera(ctx, host, { id, kopia } = {}) {
  host.replaceChildren(el(`<div class="spinner">Laddar provet…</div>`));
  let role, dok = null;
  try {
    [role, dok] = await Promise.all([myRole(), id || kopia ? hamtaProv(id || kopia) : null]);
  } catch (err) {
    return fel(ctx, host, `Provet gick inte att läsa: ${err?.message || err}`);
  }
  if ((id || kopia) && !dok) return fel(ctx, host, "Provet finns inte längre.");
  if (id && !kanAndra(dok, role)) return fel(ctx, host, "Bara läraren som skapade provet kan ändra det. Kopiera det i stället.", id);
  const st = {
    id: id || null,
    original: id ? dok : null,
    prov: id ? provFranDok(dok) : kopia ? kopieraProv(dok) : nyttProv(),
    kopiaAv: kopia ? dok.namn : "",
    role,
    oppen: null, // index för frågan vars formulär är öppet, "ny" eller null
  };
  ritaRedigerare(ctx, host, st);
}

function fel(ctx, host, text, kopiaId) {
  const vy = el(`<div class="panel provl-fel" role="alert"><p>${esc(text)}</p>
    <div class="provl-knappar">${kopiaId ? `<button class="btn gron" data-act="kopia">${icon("copy", 16)}<span>Kopiera provet</span></button>` : ""}
    <button class="btn" data-act="tillbaka">← Mina prov</button></div></div>`);
  vy.querySelector('[data-act="tillbaka"]').addEventListener("click", () => ctx.go(HASH));
  vy.querySelector('[data-act="kopia"]')?.addEventListener("click", () => ctx.go(`${HASH}?vy=ny&kopia=${encodeURIComponent(kopiaId)}`));
  host.replaceChildren(vy);
}

const checked = (on) => (on ? "checked" : "");

function ritaRedigerare(ctx, host, st) {
  const p = st.prov;
  const ins = p.installningar;
  const titel = st.id ? `Redigera ”${esc(p.namn)}”` : st.kopiaAv ? `Kopia av ”${esc(st.kopiaAv)}”` : "Nytt prov";
  const vy = el(`<form class="provl-redigera" novalidate>
    <div class="provl-redigera-topp">
      <h2 class="subhead">${titel}</h2>
      <span class="provl-knappar">
        <button type="button" class="btn small ghost" data-act="omrade">${icon("book", 16)}<span>Hämta från område</span></button>
        <button type="button" class="btn small ghost" data-act="ai">${icon("sparkle", 16)}<span>Skapa med AI</span></button>
        <button type="button" class="btn small" data-act="forhand">${icon("eye", 16)}<span>Förhandsvisa som elev</span></button>
        <button type="button" class="btn small ghost" data-act="skrivut">${icon("printer", 16)}<span>Skriv ut</span></button>
      </span>
    </div>
    ${st.kopiaAv ? `<p class="hint">Kopian är inte sparad än. Ändra det du vill och spara – originalet påverkas inte.</p>` : ""}
    <div class="provl-msg" aria-live="polite">${flash && flash.id === st.id ? flash.html : ""}</div>
    <section class="panel provl-uppgifter" aria-label="Provets uppgifter">
      <div class="provl-grid">
        <label class="provl-falt provl-falt-namn">Namn<input type="text" data-k="namn" maxlength="80" value="${esc(p.namn)}" placeholder="t.ex. Vikingatiden – prov" /></label>
        <label class="provl-falt">Ämne <input type="text" data-k="amne" maxlength="60" value="${esc(p.amne)}" placeholder="t.ex. Historia" /></label>
        <label class="provl-falt">Årskurs<select data-k="arskurs"><option value="">Ingen vald</option>
          ${GRADES.map((g) => `<option value="${g.id}" ${g.id === p.arskurs ? "selected" : ""}>${g.label}</option>`).join("")}</select></label>
        <label class="provl-falt provl-falt-bred">Beskrivning <span class="hint">(valfri – bara lärare ser den)</span>
          <textarea data-k="beskrivning" rows="2" maxlength="1000">${esc(p.beskrivning)}</textarea></label>
      </div>
      <fieldset class="provl-grupp provl-installningar"><legend>Inställningar</legend>
        <label class="provl-check"><input type="checkbox" data-ins="poang" ${checked(ins.poang)} /><span><b>Poängsätt frågorna</b> <span class="hint">– av: bara rätt, fel eller delvis + kommentar</span></span></label>
        <label class="provl-check"><input type="checkbox" data-ins="nivaer" ${checked(ins.nivaer)} /><span><b>Använd nivåerna</b> <span class="hint">EG / G / MG i rättningen</span></span></label>
        <label class="provl-check"><input type="checkbox" data-ins="visaFacit" ${checked(ins.visaFacit)} /><span><b>Visa facit</b> <span class="hint">när provet lämnas tillbaka</span></span></label>
        <label class="provl-check"><input type="checkbox" data-ins="stavningskontroll" ${checked(ins.stavningskontroll)} /><span><b>Stavningskontroll</b> <span class="hint">– webbläsarens röda understrykning i elevens svarsrutor</span></span></label>
        <label class="provl-falt provl-tid">Tidsgräns <span class="hint">(minuter, tomt = ingen – standard när provet körs)</span>
          <input type="number" data-ins="tidsgransMin" min="${TIDSGRANS_MIN}" max="${TIDSGRANS_MAX}" step="1" value="${ins.tidsgransMin ?? ""}" placeholder="Ingen" /></label>
      </fieldset>
    </section>
    <section class="provl-fragor" aria-label="Frågor">
      <h3 class="provl-fragor-rubrik"></h3>
      <ol class="provl-fragelista"></ol>
      <div class="provl-lagg-till-host"></div>
    </section>
    <div class="provl-fel-rad" role="alert" hidden></div>
    <div class="provl-knappar provl-spara-rad">
      <button type="submit" class="btn gron" data-act="spara">${icon("save", 16)}<span>Spara provet</span></button>
      <button type="button" class="btn ghost" data-act="tillbaka">Tillbaka</button>
      ${st.id ? `<span class="provl-spacer"></span>
        <button type="button" class="btn small" data-act="kor">${icon("users", 16)}<span>Kör i klass</span></button>
        <button type="button" class="btn small ghost" data-act="kopia">${icon("copy", 16)}<span>Kopiera</span></button>
        <button type="button" class="btn small ghost danger" data-act="radera">${icon("trash", 16)}<span>Radera</span></button>` : ""}
    </div>
  </form>`);
  if (flash?.id === st.id) flash = null;
  const $ = (s) => vy.querySelector(s);

  // --- Osparat-läge -------------------------------------------------------------
  let sparadBild = st.kopiaAv ? "" : bild(st.prov);
  let avarmera = null;
  const slappVakt = () => {
    avarmera?.();
    avarmera = null;
  };
  const andrad = () => {
    const smutsig = bild(st.prov) !== sparadBild;
    if (smutsig && !avarmera) avarmera = armeraLamnaVakt({ text: LAMNA_TEXT });
    if (!smutsig && avarmera) slappVakt();
    $(".provl-fel-rad").hidden = true;
  };
  const andra = (ny) => {
    st.prov = ny;
    andrad();
  };

  vy.querySelectorAll("[data-k]").forEach((inp) => inp.addEventListener("input", () => {
    andra({ ...st.prov, [inp.dataset.k]: inp.dataset.k === "arskurs" ? inp.value || null : inp.value });
  }));
  vy.querySelectorAll("[data-ins]").forEach((inp) => inp.addEventListener(inp.type === "checkbox" ? "change" : "input", () => {
    const k = inp.dataset.ins;
    const v = inp.type === "checkbox" ? inp.checked : tolkaTidsgrans(inp.value);
    andra({ ...st.prov, installningar: { ...st.prov.installningar, [k]: v === undefined ? inp.value : v } });
    if (k === "poang") {
      mynt.sattPoang(inp.checked);
      ritaFragor();
    }
  }));
  // Pluggmynt (#746) – eget fält under inställningarna.
  const mynt = myntFalt({
    mynt: ins.mynt, poang: ins.poang,
    onAndra: (m) => andra({ ...st.prov, installningar: { ...st.prov.installningar, mynt: m } }),
  });
  $(".provl-installningar").after(mynt.el);

  // --- Frågekorten --------------------------------------------------------------
  const lista = $(".provl-fragelista");
  function ritaFragor() {
    const fragor = st.prov.fragor;
    const nr = fragaNummer(fragor);
    const antal = Object.keys(nr).length;
    const poangPa = st.prov.installningar.poang !== false;
    $(".provl-fragor-rubrik").textContent = `Frågor (${antal})${poangPa && antal ? ` · ${maxPoang(fragor)} poäng totalt` : ""}`;
    lista.replaceChildren(...fragor.map((f, i) => kort(f, i, nr[f.id], fragor.length, poangPa)));
    if (!fragor.length) lista.appendChild(el(`<li class="provl-tom hint">Inga frågor än. Lägg till en fråga nedan eller skapa frågor med AI.</li>`));
    ritaLaggTill();
  }

  function kort(f, i, nummer, antal, poangPa) {
    const typ = fragetyp(f.typ);
    const li = el(`<li class="provl-kort${typ?.arFraga === false ? " provl-kort-text" : ""}" data-i="${i}"></li>`);
    if (st.oppen === i) {
      li.appendChild(byggFragaForm(f, {
        poangPa,
        onSubmit: (falt) => {
          const r = sparaFraga(st.prov, i, f.typ, falt);
          if (r.ok) {
            st.oppen = null;
            andra(r.prov);
            ritaFragor();
          }
          return r;
        },
        onCancel: () => { st.oppen = null; ritaFragor(); },
      }));
      return li;
    }
    const rubrik = fragaRubrik(f);
    li.innerHTML = `<div class="provl-kort-huvud">
        <span class="provl-kort-nr">${nummer ? `Fråga ${nummer}` : "Text"}</span>
        <span class="provl-kort-typ"><span aria-hidden="true">${typ?.ikon || "❔"}</span> ${esc(typ?.namn || f.typ)}</span>
        <span class="provl-kort-knappar">
          <button type="button" class="btn small ghost" data-k="upp" title="Flytta upp" aria-label="Flytta upp" ${i === 0 ? "disabled" : ""}>↑</button>
          <button type="button" class="btn small ghost" data-k="ned" title="Flytta ned" aria-label="Flytta ned" ${i === antal - 1 ? "disabled" : ""}>↓</button>
          <button type="button" class="btn small" data-k="redigera">${icon("pencil", 15)}<span>Redigera</span></button>
          <button type="button" class="btn small ghost" data-k="dup" title="Duplicera" aria-label="Duplicera">${icon("copy", 15)}</button>
          <button type="button" class="btn small ghost danger" data-k="bort" title="Ta bort" aria-label="Ta bort">${icon("trash", 15)}</button>
        </span>
      </div>
      <div class="provl-kort-text-rad">${esc(fragaText(f))}</div>
      <div class="hint provl-kort-rubrik">${esc(poangPa ? rubrik : rubrik.replace(/ · \d+ p$/, ""))}</div>
      ${f.hjalptext ? `<div class="hint provl-kort-hjalp">Hjälptext: ${esc(f.hjalptext)}</div>` : ""}`;
    const knapp = (k) => li.querySelector(`[data-k="${k}"]`);
    knapp("upp").addEventListener("click", () => { andra(flyttaFraga(st.prov, i, -1)); ritaFragor(); fokus(i - 1, "upp"); });
    knapp("ned").addEventListener("click", () => { andra(flyttaFraga(st.prov, i, 1)); ritaFragor(); fokus(i + 1, "ned"); });
    knapp("dup").addEventListener("click", () => { andra(dupliceraFraga(st.prov, i)); ritaFragor(); });
    knapp("redigera").addEventListener("click", () => { st.oppen = i; ritaFragor(); });
    knapp("bort").addEventListener("click", () => {
      const fore = st.prov;
      andra(taBortFraga(st.prov, i));
      ritaFragor();
      visaMsg(`<div class="msg ok provl-angra">${nummer ? `Fråga ${nummer}` : "Textblocket"} togs bort.
        <button type="button" class="btn small ghost" data-angra>Ångra</button></div>`);
      $("[data-angra]").addEventListener("click", () => { andra(fore); ritaFragor(); visaMsg(""); });
    });
    return li;
  }
  const fokus = (i, k) => lista.querySelector(`[data-i="${i}"] [data-k="${k}"]:not(:disabled)`)?.focus();
  const visaMsg = (html) => { $(".provl-msg").innerHTML = html; };

  // --- Lägg till fråga: typväljaren → typens formulär ------------------------------
  function ritaLaggTill() {
    const h = $(".provl-lagg-till-host");
    if (st.oppen === "ny-val") {
      const valjare = el(`<div class="panel provl-typvaljare"><div class="provl-typvaljare-topp"><b>Välj frågetyp</b>
        <button type="button" class="btn small ghost" data-avbryt>Avbryt</button></div>
        <div class="provl-typ-grid">${typValjare().map((t) => `<button type="button" class="provl-typ" data-typ="${t.id}">
          <span class="provl-typ-ikon" aria-hidden="true">${t.ikon}</span><b>${esc(t.namn)}</b><span class="hint">${esc(t.beskrivning)}</span></button>`).join("")}</div></div>`);
      valjare.querySelector("[data-avbryt]").addEventListener("click", () => { st.oppen = null; ritaLaggTill(); });
      valjare.querySelectorAll("[data-typ]").forEach((b) => b.addEventListener("click", () => { st.oppen = `ny:${b.dataset.typ}`; ritaLaggTill(); }));
      h.replaceChildren(valjare);
      valjare.querySelector("[data-typ]").focus();
      return;
    }
    if (typeof st.oppen === "string" && st.oppen.startsWith("ny:")) {
      const typ = st.oppen.slice(3);
      h.replaceChildren(el(`<div class="provl-kort provl-kort-ny"></div>`));
      h.firstElementChild.appendChild(byggFragaForm(tomFraga(typ, st.prov.fragor), {
        ny: true,
        poangPa: st.prov.installningar.poang !== false,
        onSubmit: (falt) => {
          const r = sparaFraga(st.prov, null, typ, falt);
          if (r.ok) {
            st.oppen = null;
            andra(r.prov);
            ritaFragor();
            lista.lastElementChild?.scrollIntoView({ block: "nearest" });
          }
          return r;
        },
        onCancel: () => { st.oppen = null; ritaLaggTill(); },
      }));
      return;
    }
    const knapp = el(`<button type="button" class="btn provl-lagg-till">${icon("plus", 16)}<span>Lägg till fråga</span></button>`);
    knapp.addEventListener("click", () => { st.oppen = "ny-val"; ritaFragor(); });
    h.replaceChildren(knapp);
  }

  // --- Knapparna ----------------------------------------------------------------
  const visaFel = (fel) => {
    const rad = $(".provl-fel-rad");
    rad.innerHTML = `<div class="msg error"><div>Provet kunde inte sparas. Rätta det här:</div>
      <ul class="error-list">${fel.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
    rad.hidden = false;
    rad.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  $('[data-act="forhand"]').addEventListener("click", async () => {
    const { visaForhandsvisning } = await import("./provl-forhandsvisa.js");
    visaForhandsvisning(st.prov);
  });
  $('[data-act="skrivut"]').addEventListener("click", async () => {
    const { skrivUtProvDok } = await import("../prov-utskrift.js");
    skrivUtProvDok(st.prov);
  });
  const lagtTill = (ny, text) => {
    andra(ny);
    st.oppen = null;
    ritaFragor();
    visaMsg(`<div class="msg ok">${esc(text)} Granska frågorna och spara provet.</div>`);
  };
  $('[data-act="omrade"]').addEventListener("click", async () => {
    const { oppnaFranOmrade } = await import("./provl-fran-omrade.js");
    oppnaFranOmrade(st.prov, st.role, lagtTill);
  });
  $('[data-act="ai"]').addEventListener("click", async () => {
    const { oppnaAiRuta } = await import("./provl-ai.js");
    oppnaAiRuta(st.prov, (ny, text) => {
      andra(ny);
      // Uppgifterna AI:n fyllde i (bara tomma fält) och poängvalet syns direkt.
      vy.querySelectorAll("[data-k]").forEach((inp) => { inp.value = st.prov[inp.dataset.k] ?? ""; });
      $('[data-ins="poang"]').checked = st.prov.installningar.poang !== false;
      lagtTill(st.prov, text);
    });
  });

  vy.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (st.oppen !== null || vy.querySelector(".provl-form")) return visaFel(["Du har en fråga öppen – klicka på Klar/Lägg till eller Avbryt först."]);
    const r = tillDokument(st.prov, st.original, st.role);
    if (!r.ok) return visaFel(r.errors);
    const knapp = $('[data-act="spara"]');
    knapp.disabled = true;
    knapp.lastElementChild.textContent = "Sparar…";
    try {
      const nyttId = await sparaProv(st.id, r.value, st.original);
      slappVakt();
      sparadBild = bild(st.prov);
      const varn = r.warnings.length ? `<ul class="error-list">${r.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : "";
      flash = { id: nyttId, html: `<div class="msg ok">Provet är sparat.${varn}</div>` };
      history.replaceState(null, "", `${HASH}?vy=ny&id=${encodeURIComponent(nyttId)}`);
      renderRedigera(ctx, host, { id: nyttId });
    } catch (err) {
      knapp.disabled = false;
      knapp.lastElementChild.textContent = "Spara provet";
      visaFel([felText(err)]);
    }
  });

  $('[data-act="tillbaka"]').addEventListener("click", () => ctx.go(HASH)); // vakten frågar om osparat
  $('[data-act="kor"]')?.addEventListener("click", () => {
    // Provtillfället kopierar det SPARADE provet – osparade ändringar följer inte med.
    if (bild(st.prov) !== sparadBild) return visaFel(["Spara provet först – annars körs den sparade versionen utan dina senaste ändringar."]);
    korIKlass(ctx, st.id, $(".provl-msg"));
  });
  $('[data-act="kopia"]')?.addEventListener("click", () => ctx.go(`${HASH}?vy=ny&kopia=${encodeURIComponent(st.id)}`));
  $('[data-act="radera"]')?.addEventListener("click", () => {
    vy.querySelector(".provl-bekrafta-ruta")?.remove();
    const ruta = raderaRuta(st.original?.namn || st.prov.namn, async () => {
      try {
        await raderaProv(st.id);
        slappVakt();
        ctx.go(HASH);
      } catch (err) {
        ruta.remove();
        visaFel([felText(err, "Provet kunde inte raderas")]);
      }
    });
    $(".provl-spara-rad").after(ruta);
    ruta.querySelector('[data-act="ja"]').focus();
  });

  host.replaceChildren(vy);
  ritaFragor();
  if (!st.id && !st.kopiaAv && !st.prov.fragor.length) $('[data-k="namn"]').focus();
}
