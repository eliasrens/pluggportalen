// ============================================================================
// Prov (#739, spec §8.1): "Förhandsvisa som elev". Provet delas precis som när
// det öppnas (delaUppProv → elevens frågor UTAN facit), numreras som eleven ser
// det (fragaNummer) och kan besvaras på prov – men INGET sparas och inget skickas.
//
// Frågorna ritas av ELEVSIDANS egen kod (provsidan, #740 äger den):
//   renderaFragor(container, fragor, { svar, installningar, onAndrad, lasLage })
// ur src/prov/prov-elev-fragor.js, laddad med import(). Saknas modulen (innan
// #740 landat, eller mitt i en utrullning) används RESERV nedan: en enkel,
// fungerande elevvy per typ. Den kan tas bort när prov-elev-fragor.js finns.
// ============================================================================

import { el, esc, icon } from "../../teacher-shared.js";
import { fragetyp } from "../prov-fragetyper.js";
import { besvarat, delaUppProv, fragaLista, fragaNummer, tomtSvar } from "../prov-modell.js";

let uid = 0;
const nytt = () => `provl-fh${++uid}`;
const stav = (ins) => `spellcheck="${ins?.stavningskontroll ? "true" : "false"}"`;

// Reservvyerna: (f, svar, satt, ins) → html; `satt(nytt)` uppdaterar svaret.
// Händelserna kopplas av koppla() nedan via data-attribut.
const RESERV = {
  flerval: (f, svar) => {
    const g = nytt();
    return `<div class="provl-fh-val">${f.alternativ.map((a, i) => `<label class="provl-fh-alt"><input type="radio" name="${g}" data-ix="${i}" ${svar === i ? "checked" : ""} /><span>${esc(a)}</span></label>`).join("")}</div>`;
  },
  "flerval-flera": (f, svar) => `<div class="provl-fh-val"><span class="provl-fh-hint">Välj alla som stämmer.</span>${f.alternativ.map((a, i) =>
    `<label class="provl-fh-alt"><input type="checkbox" data-ix="${i}" ${svar.includes(i) ? "checked" : ""} /><span>${esc(a)}</span></label>`).join("")}</div>`,
  santfalskt: (f, svar) => {
    const g = nytt();
    return `<div class="provl-fh-val provl-fh-rad">${[[true, "Sant"], [false, "Falskt"]].map(([v, t]) =>
      `<label class="provl-fh-alt"><input type="radio" name="${g}" data-bool="${v}" ${svar === v ? "checked" : ""} /><span>${t}</span></label>`).join("")}</div>`;
  },
  kortsvar: (f, svar, ins) => `<input type="text" class="provl-fh-input" data-text maxlength="100" value="${esc(svar)}" ${stav(ins)} aria-label="Ditt svar" autocomplete="off" />`,
  lucktext: (f, svar, ins) => `<p class="provl-fh-lucktext">${f.delar.map((d) => (d.t !== undefined ? esc(d.t)
    : `<input type="text" class="provl-fh-lucka" data-lucka="${d.lucka}" maxlength="100" value="${esc(svar[d.lucka] || "")}" ${stav(ins)} aria-label="Lucka ${d.lucka + 1}" autocomplete="off" />`)).join("")}</p>`,
  para: (f, svar) => `<div class="provl-fh-par">${f.vanster.map((v, i) => `<label class="provl-fh-par-rad"><span>${esc(v)}</span>
    <select data-par="${i}"><option value="">Välj …</option>${f.hoger.map((h) => `<option ${svar[i] === h ? "selected" : ""}>${esc(h)}</option>`).join("")}</select></label>`).join("")}</div>`,
  ordna: (f, svar) => {
    const ordning = svar.length ? svar : f.saker;
    return `<ol class="provl-fh-ordna">${ordning.map((s, i) => `<li><span>${esc(s)}</span>
      <button type="button" class="provl-fh-flytt" data-flytt="${i}:-1" ${i === 0 ? "disabled" : ""} aria-label="Flytta upp">↑</button>
      <button type="button" class="provl-fh-flytt" data-flytt="${i}:1" ${i === ordning.length - 1 ? "disabled" : ""} aria-label="Flytta ned">↓</button></li>`).join("")}</ol>`;
  },
  fritext: (f, svar, ins) => `<textarea class="provl-fh-fritext" data-text rows="6" maxlength="${f.maxTecken}" ${stav(ins)} aria-label="Ditt svar">${esc(svar)}</textarea>
    <span class="provl-fh-raknare" data-raknare>${Array.from(svar).length} / ${f.maxTecken} tecken</span>`,
};

/** Koppla reservvyns händelser: varje ändring → satt(nyttSvar). */
function koppla(box, f, hamta, satt, rita) {
  box.addEventListener("input", (e) => {
    const t = e.target;
    if (t.matches("[data-text]")) {
      satt(t.value);
      const r = box.querySelector("[data-raknare]");
      if (r) r.textContent = `${Array.from(t.value).length} / ${f.maxTecken} tecken`;
    } else if (t.matches("[data-lucka]")) {
      const s = [...hamta()];
      s[Number(t.dataset.lucka)] = t.value;
      satt(s);
    }
  });
  box.addEventListener("change", (e) => {
    const t = e.target;
    if (t.matches("input[type=radio][data-ix]")) satt(Number(t.dataset.ix));
    else if (t.matches("input[type=checkbox][data-ix]")) satt([...box.querySelectorAll("input[data-ix]:checked")].map((x) => Number(x.dataset.ix)));
    else if (t.matches("[data-bool]")) satt(t.dataset.bool === "true");
    else if (t.matches("[data-par]")) {
      const s = [...hamta()];
      s[Number(t.dataset.par)] = t.value;
      satt(s);
    }
  });
  box.addEventListener("click", (e) => {
    const b = e.target.closest("[data-flytt]");
    if (!b) return;
    const [i, steg] = b.dataset.flytt.split(":").map(Number);
    const s = [...(hamta().length ? hamta() : f.saker)];
    [s[i], s[i + steg]] = [s[i + steg], s[i]];
    satt(s);
    rita();
  });
}

/** En fråga som eleven ser den. */
function fragaVy(f, nummer, st, ins, poangPa, uppdatera) {
  const typ = fragetyp(f.typ);
  if (f.typ === "text") {
    return el(`<section class="provl-fh-text">${f.titel ? `<h3>${esc(f.titel)}</h3>` : ""}${f.brodtext.split(/\n{2,}/).map((s) => `<p>${esc(s)}</p>`).join("")}</section>`);
  }
  const kort = el(`<section class="provl-fh-fraga" aria-label="Fråga ${nummer}">
    <div class="provl-fh-huvud"><span class="provl-fh-nr">Fråga ${nummer}</span>${poangPa ? `<span class="provl-fh-poang">${f.poang} poäng</span>` : ""}</div>
    <p class="provl-fh-fragetext">${esc(f.fraga)}</p>
    ${f.hjalptext ? `<p class="provl-fh-hjalp">${esc(f.hjalptext)}</p>` : ""}
    <div class="provl-fh-svar"></div>
  </section>`);
  const box = kort.querySelector(".provl-fh-svar");
  const hamta = () => st.svar[f.id];
  const satt = (v) => {
    st.svar[f.id] = typ.rensaSvar(v, f);
    uppdatera();
  };
  const rita = () => { box.innerHTML = RESERV[f.typ]?.(f, hamta(), ins) ?? `<p class="hint">(${esc(typ.namn)} kan inte förhandsvisas än)</p>`; };
  rita();
  koppla(box, f, hamta, satt, rita);
  return kort;
}

/**
 * Elevsidans renderaFragor (#740) om den finns, annars reservvyerna.
 * onAndrad får antingen hela svar-mapen eller (fragaId, svar).
 */
async function ritaFragor(lista, fragor, st, ins, reserv, uppdatera) {
  let m = null;
  try {
    m = await import("../prov-elev-fragor.js");
  } catch {
    m = null;
  }
  if (typeof m?.renderaFragor !== "function") {
    for (const f of fragor) lista.appendChild(reserv(f));
    return;
  }
  m.renderaFragor(lista, fragor, {
    svar: st.svar,
    installningar: ins,
    lasLage: false,
    onAndrad: (a, b) => {
      if (typeof a === "string" && b !== undefined) st.svar = { ...st.svar, [a]: b };
      else if (a && typeof a === "object") st.svar = { ...st.svar, ...a };
      uppdatera();
    },
  });
}

/**
 * Visa förhandsvisningen i en dialog.
 * @param {{ namn?: string, beskrivning?: string, fragor: object[], installningar?: object }} prov
 *   arbetskopian eller ett sparat prov (med facit – delas här precis som vid öppning)
 */
export function visaForhandsvisning(prov) {
  const { fragor } = delaUppProv(prov);
  const ins = prov.installningar || {};
  const poangPa = ins.poang !== false;
  const nr = fragaNummer(fragor);
  const st = { svar: tomtSvar(fragor) };
  const dlg = el(`<dialog class="provl-dialog provl-fh-dialog teacher-dark" aria-label="Förhandsvisning som elev">
    <div class="provl-dialog-inre">
      <div class="provl-dialog-topp">
        <div><h2 class="subhead">${icon("eye", 20)} Förhandsvisning som elev</h2>
          <p class="hint">Så här ser eleven provet. Du kan svara för att prova – inget sparas.</p></div>
        <button type="button" class="btn small ghost" data-stang aria-label="Stäng">${icon("x", 16)}</button>
      </div>
      <div class="provl-fh-papper">
        <header class="provl-fh-rubrik"><h1>${esc(prov.namn || "Namnlöst prov")}</h1>
          ${ins.tidsgransMin ? `<span class="provl-fh-tid">Tidsgräns: ${ins.tidsgransMin} min</span>` : ""}</header>
        <div class="provl-fh-fragor"></div>
        <footer class="provl-fh-fot"><span class="provl-fh-status" aria-live="polite"></span>
          <button type="button" class="btn" disabled title="Förhandsvisning – inget lämnas in">Lämna in</button></footer>
      </div>
    </div>
  </dialog>`);
  const status = dlg.querySelector(".provl-fh-status");
  const uppdatera = () => {
    const b = besvarat(fragor, st.svar);
    const ob = b.obesvarade.length ? ` ${fragaLista(b.obesvarade)} ${b.obesvarade.length === 1 ? "är obesvarad" : "är obesvarade"}.` : "";
    status.textContent = `Du har svarat på ${b.besvarade} av ${b.antal} frågor.${ob}`;
  };
  const lista = dlg.querySelector(".provl-fh-fragor");
  if (!fragor.length) lista.appendChild(el(`<p class="hint">Provet har inga frågor än.</p>`));
  else ritaFragor(lista, fragor, st, ins, (f) => fragaVy(f, nr[f.id], st, ins, poangPa, uppdatera), uppdatera);
  uppdatera();
  const stang = () => {
    dlg.close();
    dlg.remove();
  };
  dlg.querySelector("[data-stang]").addEventListener("click", stang);
  dlg.addEventListener("close", () => dlg.remove());
  document.body.appendChild(dlg);
  dlg.showModal();
  return dlg;
}
