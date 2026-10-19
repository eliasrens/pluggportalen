// ============================================================================
// Prov (#739, spec §8.2): "Skapa med AI" – samma flöde som för Plugga-områdena.
// 1) Läraren väljer ämne, årskurs, antal frågor, frågetyper, poängsättning,
//    önskemål och ev. material → kopierar prompten (buildProvPrompt).
// 2) Klistrar in AI:ns JSON → "Granska" (tolkaAiJson = validateProv) visar fel
//    och varningar på svenska INNAN något läggs till.
// 3) "Lägg till i provet": frågorna läggs sist (fyllFranAi – ett befintligt
//    prov får frågorna sist, ett tomt får även namn/ämne/årskurs).
// Inget sparas här – redigeraren sparar som vanligt.
// ============================================================================

import { copyText, el, esc, icon } from "../../teacher-shared.js";
import { GRADES } from "../../grades.js";
import { FRAGETYPER, fragetyp } from "../prov-fragetyper.js";
import { ANTAL_MAX, ANTAL_MIN, ANTAL_STANDARD, buildProvPrompt } from "../prov-prompt.js";
import { fyllFranAi, tolkaAiJson } from "../prov-redigera-ops.js";

// Förvalda typer: allt utom textblocket (det väljer läraren till läsförståelse)
// och avsnitten (#762 – läraren väljer om provet ska delas in).
const FORVALDA = FRAGETYPER.map((t) => t.id).filter((id) => id !== "text" && id !== "avsnitt");

/** "12 frågor: 4 Flerval, 3 Kort svar …" – sammanfattningen efter granskningen. */
export function aiSammanfattning(fragor) {
  const per = new Map();
  for (const f of fragor) per.set(f.typ, (per.get(f.typ) || 0) + 1);
  const delar = [...per].map(([typ, n]) => `${n} ${fragetyp(typ)?.namn || typ}`);
  const n = fragor.filter((f) => fragetyp(f.typ)?.arFraga !== false).length;
  const avsnitt = fragor.filter((f) => f.typ === "avsnitt").length;
  const text = fragor.length - n - avsnitt;
  const extra = [text ? `${text} textblock` : "", avsnitt ? `${avsnitt} ${avsnitt === 1 ? "avsnitt" : "avsnitt"}` : ""].filter(Boolean);
  return `${n} ${n === 1 ? "fråga" : "frågor"}${extra.length ? ` och ${extra.join(" och ")}` : ""} (${delar.join(", ")})`;
}

/**
 * Öppna rutan.
 * @param {object} prov arbetskopian (läses, ändras inte)
 * @param {(nyttProv: object, text: string) => void} onKlar
 */
export function oppnaAiRuta(prov, onKlar) {
  const harFragor = prov.fragor.length > 0;
  const dlg = el(`<dialog class="provl-dialog teacher-dark" aria-label="Skapa med AI">
    <form method="dialog" class="provl-dialog-inre provl-ai" novalidate>
      <div class="provl-dialog-topp"><h2 class="subhead">${icon("sparkle", 20)} Skapa med AI</h2>
        <button type="button" class="btn small ghost" data-stang aria-label="Stäng">${icon("x", 16)}</button></div>
      <ol class="provl-ai-steg">
        <li><span><b>1. Beskriv provet</b></span>
          <div class="provl-grid">
            <label class="provl-falt">Ämne<input type="text" name="amne" value="${esc(prov.amne)}" placeholder="t.ex. Historia – vikingatiden" /></label>
            <label class="provl-falt">Årskurs<select name="arskurs"><option value="">Ingen vald (åk 4)</option>
              ${GRADES.map((g) => `<option value="${g.id}" ${g.id === prov.arskurs ? "selected" : ""}>${g.label}</option>`).join("")}</select></label>
            <label class="provl-falt">Antal frågor<input type="number" name="antal" min="${ANTAL_MIN}" max="${ANTAL_MAX}" value="${ANTAL_STANDARD}" /></label>
            <label class="provl-check provl-ai-poang"><input type="checkbox" name="poang" ${prov.installningar.poang !== false ? "checked" : ""} /><span>Poängsätt frågorna</span></label>
          </div>
          <fieldset class="provl-grupp"><legend>Frågetyper</legend><div class="provl-ai-typer">
            ${FRAGETYPER.map((t) => `<label class="provl-check"><input type="checkbox" name="typ" value="${t.id}" ${FORVALDA.includes(t.id) ? "checked" : ""} /><span>${t.ikon} ${esc(t.namn)}</span></label>`).join("")}
          </div></fieldset>
          <label class="provl-falt">Önskemål <span class="hint">(valfritt)</span><textarea name="onskemal" rows="2" placeholder="t.ex. Fokus på handel och resor. Några svårare frågor på slutet."></textarea></label>
          <label class="provl-falt">Material att utgå från <span class="hint">(valfritt – klistra in text, eller bifoga en PDF i AI:n)</span><textarea name="material" rows="3"></textarea></label>
        </li>
        <li><span><b>2. Kopiera prompten</b> och klistra in den i Claude eller en annan AI.</span>
          <div class="provl-knappar"><button type="button" class="btn small" data-kopiera>${icon("copy", 15)}<span>Kopiera prompten</span></button>
            <button type="button" class="btn small ghost" data-visa aria-expanded="false">Visa prompten</button></div>
          <textarea class="provl-ai-prompt" readonly rows="8" hidden aria-label="Prompten"></textarea>
        </li>
        <li><span><b>3. Klistra in AI:ns svar</b> (JSON)${harFragor ? ` <span class="hint">– frågorna läggs till sist i provet (${prov.fragor.length} finns redan)</span>` : ""}.</span>
          <textarea name="json" rows="7" placeholder='{ "namn": "…", "fragor": [ … ] }' spellcheck="false"></textarea>
          <div class="provl-knappar"><button type="button" class="btn small" data-granska>${icon("check", 15)}<span>Granska</span></button></div>
          <div class="provl-ai-resultat" aria-live="polite"></div>
        </li>
      </ol>
      <div class="provl-knappar provl-dialog-fot">
        <button type="button" class="btn gron" data-lagg-till disabled>${icon("plus", 16)}<span>Lägg till i provet</span></button>
        <button type="button" class="btn ghost" data-stang>Avbryt</button>
      </div>
    </form>
  </dialog>`);
  const f = dlg.querySelector("form");
  const $ = (s) => dlg.querySelector(s);
  let granskat = null;

  const prompt = () => buildProvPrompt({
    amne: f.elements.amne.value,
    arskurs: f.elements.arskurs.value || null,
    antal: f.elements.antal.value,
    typer: [...f.querySelectorAll('[name="typ"]:checked')].map((x) => x.value),
    poang: f.elements.poang.checked,
    onskemal: f.elements.onskemal.value,
    material: f.elements.material.value,
  });
  const promptRuta = $(".provl-ai-prompt");
  f.addEventListener("input", (e) => {
    if (e.target.name === "json") {
      granskat = null;
      $("[data-lagg-till]").disabled = true;
    } else if (!promptRuta.hidden) promptRuta.value = prompt();
  });
  $("[data-kopiera]").addEventListener("click", (e) => copyText(prompt(), e.currentTarget));
  $("[data-visa]").addEventListener("click", (e) => {
    promptRuta.hidden = !promptRuta.hidden;
    promptRuta.value = prompt();
    e.currentTarget.setAttribute("aria-expanded", String(!promptRuta.hidden));
    e.currentTarget.textContent = promptRuta.hidden ? "Visa prompten" : "Dölj prompten";
  });

  $("[data-granska]").addEventListener("click", () => {
    const r = tolkaAiJson(f.elements.json.value);
    const res = $(".provl-ai-resultat");
    const lista = (xs) => `<ul class="error-list">${xs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
    granskat = r.ok ? r.value : null;
    $("[data-lagg-till]").disabled = !r.ok;
    res.innerHTML = r.ok
      ? `<div class="msg ok">Allt ser bra ut: ${esc(aiSammanfattning(r.value.fragor))}.</div>${r.warnings.length ? `<div class="msg warn"><div>Bra att veta:</div>${lista(r.warnings)}</div>` : ""}`
      : `<div class="msg error"><div>Det här behöver rättas (be AI:n rätta det, eller ändra i texten):</div>${lista(r.errors)}</div>${r.warnings.length ? `<div class="msg warn">${lista(r.warnings)}</div>` : ""}`;
  });

  $("[data-lagg-till]").addEventListener("click", () => {
    if (!granskat) return;
    const r = fyllFranAi(prov, granskat);
    if (!r.ok) {
      $(".provl-ai-resultat").innerHTML = `<div class="msg error">${esc(r.errors.join(" "))}</div>`;
      return;
    }
    // Poängvalet i rutan gäller provet bara när det var tomt (annars lärarens inställning).
    const ny = harFragor ? r.prov : { ...r.prov, installningar: { ...r.prov.installningar, poang: f.elements.poang.checked } };
    stang();
    onKlar(ny, `${r.antal} ${r.antal === 1 ? "fråga lades" : "frågor lades"} till från AI:n.`);
  });

  const stang = () => {
    dlg.close();
    dlg.remove();
  };
  dlg.querySelectorAll("[data-stang]").forEach((b) => b.addEventListener("click", stang));
  dlg.addEventListener("close", () => dlg.remove());
  document.body.appendChild(dlg);
  dlg.showModal();
  f.elements.amne.focus();
}
