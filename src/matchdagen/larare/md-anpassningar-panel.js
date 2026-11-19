// ============================================================================
// Lärarsidan – panelen för EN elev i "Anpassningar per elev" (md-anpassningar-panel.js) · #867
// ----------------------------------------------------------------------------
// Spec §1.2: Matchdagen på/av, frågekällor (Plugga-områden, multiplikationstabeller
// 0–10, Räkna-områden), svarssätt, klocka, lugnt läge, påminnelse om paus och
// Återställ lagnamn. Spara = EN batch (md-inst-data.js sparaAnpassning).
// Plugga-områden = områden med quiz eller par; Räkna = områden med generator
// (areaContentFlags, samma grind som elevens lägen). Klassens tilldelade områden
// och redan valda står överst i sitt ämne, och de ämnena är utfällda.
// Återställ lagnamn: lagnamnet finns först när eleven spelat (matchdagen/{uid},
// Etapp 1c) – knappen är avstängd tills dess.
// ============================================================================

import { el, esc, errText, icon } from "../../teacher-shared.js";
import { areaContentFlags } from "../../gamemode-visibility.js";
import { KLOCKA_VAL, PAUS_VAL, STANDARD_INST, TABELLER, harKallor, harMatchdagen, omradeNyckel, sammanfattning } from "../md-inst.js";

const antalText = (n) => (n ? `${n} ${n === 1 ? "vald" : "valda"}` : "");

const radio = (namn, varde, text, valt) =>
  `<label class="mda-val"><input type="radio" name="${namn}" value="${varde}"${valt ? " checked" : ""} /><span>${text}</span></label>`;

/** Ämnesgrupper med de områden som klarar källan (quiz/par eller generator). */
function grupper(library, cls, valda, passar) {
  const tilldelade = new Set((cls.assignedAreas || []).map((a) => omradeNyckel(a.subjectId, a.areaId)));
  return library.map((subj) => {
    const areas = (subj.areas || []).filter((a) => passar(areaContentFlags(a))).map((a) => {
      const nyckel = omradeNyckel(subj.id, a.id);
      return { nyckel, namn: a.name || a.id, klassens: tilldelade.has(nyckel), vald: valda.includes(nyckel) };
    }).sort((x, y) => (y.vald - x.vald) || (y.klassens - x.klassens) || x.namn.localeCompare(y.namn, "sv"));
    return { subj, areas };
  }).filter((g) => g.areas.length);
}

function omradesHtml(typ, gs) {
  if (!gs.length) return `<p class="hint">Det finns inga sådana områden än.</p>`;
  return gs.map(({ subj, areas }) => {
    const n = areas.filter((a) => a.vald).length;
    const oppen = areas.some((a) => a.vald || a.klassens);
    return `<details class="mda-amne"${oppen ? " open" : ""}>
      <summary>${esc(subj.icon || "📚")} ${esc(subj.name || subj.id)} <span class="mda-antal" data-antal>${antalText(n)}</span></summary>
      <div class="mda-kryss">${areas.map((a) => `<label class="mda-val"><input type="checkbox" data-${typ}="${esc(a.nyckel)}"${a.vald ? " checked" : ""} />
        <span>${esc(a.namn)}${a.klassens ? ' <small class="mda-tagg">klassens</small>' : ""}</span></label>`).join("")}</div>
    </details>`;
  }).join("");
}

/**
 * Rita panelen för `elev` i `host`.
 * @param {object} ctx
 * @param {{cls:object, elev:object, host:HTMLElement, avbryt:{aborted:boolean},
 *   loadLibrary:Function, onSaved:Function}} o
 */
export async function renderPanel(ctx, { cls, elev, host, avbryt, loadLibrary, onSaved }) {
  host.replaceChildren(el(`<div class="spinner">Laddar inställningar…</div>`));
  let inst, library;
  try {
    const data = await import("../md-inst-data.js");
    [inst, library] = await Promise.all([data.lasInst(elev.id), loadLibrary()]);
  } catch (err) {
    if (!avbryt.aborted) host.replaceChildren(el(`<p class="err-inline">Kunde inte ladda inställningarna: ${esc(errText(err))}</p>`));
    return;
  }
  if (avbryt.aborted) return;
  const i = inst || { ...STANDARD_INST };
  const namn = esc(elev.namn || elev.username || elev.id);
  const box = el(`<form class="mda-form" novalidate>
    <label class="mda-pa"><input type="checkbox" name="pa"${harMatchdagen(cls, elev.id) ? " checked" : ""} />
      <span><b>Matchdagen</b> för ${namn}<small>Syns under Öva i elevens meny. Klasskamraterna ser den inte.</small></span></label>

    <fieldset class="mda-del"><legend>Frågekällor</legend>
      <p class="hint">Välj en eller flera. Frågorna blir aldrig svårare högre upp i divisionerna. Utan källor kan eleven inte starta någon match.</p>
      <h4>Plugga-områden</h4>${omradesHtml("omrade", grupper(library, cls, i.omraden, (h) => h.quiz || h.pairs))}
      <h4>Multiplikationstabeller</h4>
      <div class="mda-kryss mda-tabeller">${TABELLER.map((t) => `<label class="mda-val mda-tal"><input type="checkbox" data-tabell="${t}"${i.tabeller.includes(t) ? " checked" : ""} /><span>${t}</span></label>`).join("")}</div>
      <h4>Räkna</h4>${omradesHtml("rakna", grupper(library, cls, i.rakna, (h) => h.generator))}
    </fieldset>

    <fieldset class="mda-del"><legend>Svarssätt</legend>
      <div class="mda-rad-val">${radio("svarssatt", "flerval", "Flerval <small>(standard)</small>", i.svarssatt === "flerval")}${radio("svarssatt", "skriv", "Skriv själv", i.svarssatt === "skriv")}</div>
      <p class="hint">Skriv själv gäller där källan stödjer det, annars blir det flerval.</p>
    </fieldset>
    <fieldset class="mda-del"><legend>Klocka på frågorna</legend>
      <div class="mda-rad-val">${KLOCKA_VAL.map((k) => radio("klocka", k, k ? `${k} sekunder` : "Av <small>(standard)</small>", i.klocka === k)).join("")}</div>
    </fieldset>
    <fieldset class="mda-del"><legend>Lugnt läge</legend>
      <label class="mda-val"><input type="checkbox" name="lugnt"${i.lugnt ? " checked" : ""} /><span>På – färre effekter, ingen publik som jublar, inga skakningar och dämpade ljud</span></label>
    </fieldset>
    <fieldset class="mda-del"><legend>Påminnelse om paus</legend>
      <div class="mda-rad-val">${PAUS_VAL.map((p) => radio("paus", p, p ? `${p} minuter${p === 60 ? " <small>(standard)</small>" : ""}` : "Av", i.paus === p)).join("")}</div>
      <p class="hint">Efter den tiden visas "Bra jobbat! Dags för en paus." efter nästa slutsignal. Den spärrar ingenting.</p>
    </fieldset>
    <fieldset class="mda-del"><legend>Lagnamn</legend>
      <button type="button" class="btn ghost small" disabled>${icon("pencil", 16)}<span>Återställ lagnamn</span></button>
      <p class="hint">Om eleven skriver något olämpligt. Går att använda när ${namn} har startat sitt lag.</p>
    </fieldset>

    <div class="mda-spara">
      <button type="submit" class="btn gron small">${icon("save", 16)}<span>Spara</span></button>
      <span class="mda-resultat" role="status"></span>
    </div>
  </form>`);

  const resultat = box.querySelector(".mda-resultat");
  const las = () => {
    const kryss = (attr) => [...box.querySelectorAll(`input[data-${attr}]:checked`)].map((c) => c.dataset[attr]);
    const val = (n) => box.querySelector(`input[name="${n}"]:checked`)?.value;
    return {
      pa: box.querySelector('input[name="pa"]').checked,
      inst: {
        omraden: kryss("omrade"), rakna: kryss("rakna"), tabeller: kryss("tabell").map(Number),
        svarssatt: val("svarssatt"), klocka: Number(val("klocka")), paus: Number(val("paus")),
        lugnt: box.querySelector('input[name="lugnt"]').checked,
      },
    };
  };
  // Antalet valda per ämne följer kryssen; ändrat = "Sparat" bort.
  box.addEventListener("change", (e) => {
    resultat.innerHTML = "";
    const amne = e.target.closest(".mda-amne");
    if (amne) {
      const n = amne.querySelectorAll("input:checked").length;
      amne.querySelector("[data-antal]").textContent = antalText(n);
    }
  });
  box.addEventListener("submit", async (e) => {
    e.preventDefault();
    const knapp = box.querySelector('button[type="submit"]');
    const val = las();
    knapp.disabled = true;
    resultat.innerHTML = "Sparar…";
    try {
      const sparad = await (await import("../md-inst-data.js")).sparaAnpassning(cls, elev.id, val);
      const varning = val.pa && !harKallor(sparad) ? " – välj frågor, annars kan eleven inte spela" : "";
      resultat.innerHTML = `<span class="ok-inline">Sparat ✓ ${esc(sammanfattning(sparad))}${varning}</span>`;
      onSaved();
    } catch (err) {
      resultat.innerHTML = `<span class="err-inline">Kunde inte spara: ${esc(errText(err))}</span>`;
    } finally {
      knapp.disabled = false;
    }
  });
  host.replaceChildren(box);
}
