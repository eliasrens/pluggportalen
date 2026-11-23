// ============================================================================
// Lärarsidan – panelen för EN elev i "Anpassningar per elev" (md-anpassningar-panel.js) · #867
// ----------------------------------------------------------------------------
// Spec §1.2: Matchdagen på/av, frågekällor (Plugga-områden, multiplikationstabeller
// 0–10, Räkna-områden), svarssätt, klocka, lugnt läge, påminnelse om paus och
// Återställ lagnamn. Spara = EN batch (md-inst-data.js sparaAnpassning).
// Plugga-områden = områden med quiz eller par; Räkna = områden med generator
// (areaContentFlags, samma grind som elevens lägen). Klassens tilldelade områden
// och redan valda står överst i sitt ämne, och de ämnena är utfällda.
// Återställ lagnamn (#869): bara klubb.namn i matchdagen/{uid} (md-lagnamn.js) –
// har eleven inte startat något lag än står det i svaret.
// Hela klassen (#876, elev = null): samma formulär för classes/{id}.matchdagenInst och
// Matchdagen för klassen (enabledModules) – md-inst-data.js sparaKlass. En elev utan egna
// inställningar visar klassens (annars tabellerna 0–10); Spara skriver egna bara om
// läraren ändrat något. "Följ klassens inställningar" raderar elevens egna.
// #899 (Veckoschema A.2–A.3): överst bland frågekällorna "Samma som Plugga" (foljPlugga, standard)
// eller "Välj områden själv". I det senare står ett valt område som är dolt för klassen kvar, gråat
// ("Dolt för klassen – används inte just nu"). Ger valen inga frågor alls efter filtret står det
// överst med knappen "Byt till Samma som Plugga". Synligheten = klassens assignedAreas (tom = allt),
// samma regel som eleven och servern (delat/md-synlighet.js) – räknas ur biblioteket, ingen läsning.
// #905: under källorna kryssrutan "Visa lästext till frågorna" (lastext, samma text som Live) – ikryssad
// som standard; gråad ("Inga valda områden har lästexter") när inget av områdena som används
// (effektivaKallor – dolda räknas inte) har frågor med lästext. Ett gråat val sparas som det var.
// ============================================================================

import { el, esc, errText, icon } from "../../teacher-shared.js";
import { areaContentFlags } from "../../gamemode-visibility.js";
import {
  KLOCKA_VAL, MAX_OMRADEN, PAUS_VAL, STANDARD_FRAGOR, TABELLER, elevPa, harKallor, klassInst, klassPa, normalizeInst, omradeNyckel,
  sammaInst, sammanfattning,
} from "../md-inst.js";
import { arSynligt, effektivaKallor, pluggaKallor } from "../delat/md-synlighet.js";
import { raderUrBibliotek } from "../md-synlig.js";
import { hasPassage } from "../../live/modes/quiz-passage.js";

export const DOLT_TEXT = "Dolt för klassen – används inte just nu";
export const LASTEXT_TEXT = "Visa lästext till frågorna";
export const LASTEXT_INFO = "Frågor med en kort text att läsa först – från Pluggas Läsförståelse.";
export const LASTEXT_INGA = "Inga valda områden har lästexter";

/** Bibliotekets områden med minst en quizfråga med lästext (#905) – nycklarna "ämne/område". */
function lastextOmraden(library) {
  const ut = new Set();
  for (const subj of library) for (const a of subj.areas || []) {
    if (Array.isArray(a.quiz) && a.quiz.some(hasPassage)) ut.add(omradeNyckel(subj.id, a.id));
  }
  return ut;
}

const antalText = (n) => (n ? `${n} ${n === 1 ? "vald" : "valda"}` : "");

const radio = (namn, varde, text, valt) =>
  `<label class="mda-val"><input type="radio" name="${namn}" value="${varde}"${valt ? " checked" : ""} /><span>${text}</span></label>`;

/** Klassens synliga områden (assignedAreas, tom = hela biblioteket → null) – som synligaOmraden. */
function klassensSynliga(cls) {
  const ut = [];
  for (const a of Array.isArray(cls.assignedAreas) ? cls.assignedAreas : []) {
    const k = omradeNyckel(a?.subjectId, a?.areaId);
    if (a?.subjectId && a?.areaId && !ut.includes(k)) ut.push(k);
  }
  return ut.length ? ut : null;
}

/** Ämnesgrupper med de områden som klarar källan (quiz/par eller generator). */
function grupper(library, cls, valda, passar) {
  const tilldelade = new Set((cls.assignedAreas || []).map((a) => omradeNyckel(a.subjectId, a.areaId)));
  const synliga = klassensSynliga(cls);
  return library.map((subj) => {
    const areas = (subj.areas || []).filter((a) => passar(areaContentFlags(a))).map((a) => {
      const nyckel = omradeNyckel(subj.id, a.id);
      return { nyckel, namn: a.name || a.id, klassens: tilldelade.has(nyckel), vald: valda.includes(nyckel), dolt: !arSynligt(nyckel, synliga) };
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
      <div class="mda-kryss">${areas.map((a) => `<label class="mda-val${a.dolt ? " mda-dolt" : ""}${a.dolt && a.vald ? " mda-dolt-vald" : ""}"><input type="checkbox" data-${typ}="${esc(a.nyckel)}"${a.vald ? " checked" : ""} />
        <span>${esc(a.namn)}${a.klassens ? ' <small class="mda-tagg">klassens</small>' : ""}${a.dolt ? ` <small class="mda-dolt-text">${DOLT_TEXT}</small>` : ""}</span></label>`).join("")}</div>
    </details>`;
  }).join("");
}

/**
 * Rita panelen för `elev` (null = hela klassen, #876) i `host`.
 * @param {object} ctx
 * @param {{cls:object, elev:object|null, host:HTMLElement, avbryt:{aborted:boolean},
 *   loadLibrary:Function, onSaved:Function}} o
 */
export async function renderPanel(ctx, o) {
  const { cls, elev, host, avbryt, loadLibrary, onSaved } = o;
  host.replaceChildren(el(`<div class="spinner">Laddar inställningar…</div>`));
  let inst, library;
  try {
    const data = await import("../md-inst-data.js");
    // Klassens inställningar ligger på klassdokumentet – ingen läsning.
    [inst, library] = await Promise.all([elev ? data.lasInst(elev.id) : klassInst(cls), loadLibrary()]);
  } catch (err) {
    if (!avbryt.aborted) host.replaceChildren(el(`<p class="err-inline">Kunde inte ladda inställningarna: ${esc(errText(err))}</p>`));
    return;
  }
  if (avbryt.aborted) return;
  const egna = !!inst;
  const arvd = elev && !egna ? klassInst(cls) : null; // vad en elev utan egna spelar med
  const i = inst || arvd || normalizeInst(STANDARD_FRAGOR);
  const namn = elev ? esc(elev.namn || elev.username || elev.id) : "";
  const kalla = !elev ? "" : egna
    ? `<p class="hint mda-kalla">${namn} har egna inställningar, som gäller före klassens.
        <button type="button" class="btn ghost small" data-folj>Följ klassens inställningar</button></p>`
    : `<p class="hint mda-kalla">${namn} följer ${arvd ? "klassens inställningar" : "standard (Samma som Plugga) – klassen har inga inställningar än"}.
        Ändrar du något här får ${namn} egna.</p>`;
  const paRad = elev
    ? `<label class="mda-pa"><input type="checkbox" name="pa"${elevPa(cls, elev.id) ? " checked" : ""} />
      <span><b>Matchdagen</b> för ${namn}<small>${klassPa(cls) ? "Matchdagen är redan på för hela klassen." : "Syns under Öva i elevens meny. Klasskamraterna ser den inte."}</small></span></label>`
    : `<label class="mda-pa"><input type="checkbox" name="pa"${klassPa(cls) ? " checked" : ""} />
      <span><b>Matchdagen</b> för hela ${esc(cls.name || cls.id)}<small>Alla elever i klassen ser den under Öva (samma som i Vad eleverna ser).
        Inställningarna gäller elever utan egna.</small></span></label>`;
  // "Samma som Plugga" för klassen (#899): de synliga områdena med underlag, ur biblioteket.
  const synliga = klassensSynliga(cls);
  const plugga = pluggaKallor(raderUrBibliotek(library, synliga));
  // Utan några inställningar alls blir det tabellerna 0–10 om klassen inte ser något med underlag.
  const standard = elev ? !egna && !arvd : !inst;
  const box = el(`<form class="mda-form" novalidate>
    <div class="mda-tom" data-tom role="status" hidden>
      <span data-tom-valj><b>Inga frågor just nu.</b> Inget av det som är valt syns för klassen, så eleven kan inte spela.</span>
      <span data-tom-folj hidden><b>Inga frågor just nu.</b> Klassen ser inga områden med frågor. Välj multiplikationstabeller
        eller områden under Vad eleverna ser.</span>
      <button type="button" class="btn gron small" data-byt-plugga>Byt till Samma som Plugga</button>
    </div>
    ${paRad}
    ${kalla}

    <fieldset class="mda-del"><legend>Frågekällor</legend>
      <p class="hint">Frågorna blir aldrig svårare högre upp i divisionerna. Det kommer aldrig frågor från ett område som är dolt för klassen.</p>
      <div class="mda-rad-val mda-folj">
        ${radio("folj", "1", "Samma som Plugga – frågor från de områden eleven ser just nu <small>(rekommenderat)</small>", i.foljPlugga)}
        ${radio("folj", "0", "Välj områden själv", !i.foljPlugga)}
      </div>
      <p class="hint mda-folj-info" data-folj-info>${esc(pluggaInfo(plugga))}</p>
      <div data-valj-sjalv>
        <h4>Plugga-områden</h4>${omradesHtml("omrade", grupper(library, cls, i.omraden, (h) => h.quiz || h.pairs))}
        <h4>Räkna</h4>${omradesHtml("rakna", grupper(library, cls, i.rakna, (h) => h.generator))}
      </div>
      <label class="mda-val mda-lastext"><input type="checkbox" name="lastext"${i.lastext ? " checked" : ""} />
        <span>${LASTEXT_TEXT} <small data-lastext-info>${LASTEXT_INFO}</small></span></label>
      <h4>Multiplikationstabeller</h4>
      <div class="mda-kryss mda-tabeller">${TABELLER.map((t) => `<label class="mda-val mda-tal"><input type="checkbox" data-tabell="${t}"${i.tabeller.includes(t) ? " checked" : ""} /><span>${t}</span></label>`).join("")}</div>
      <p class="hint">Tabellerna går att ha med i båda lägena.</p>
    </fieldset>

    <fieldset class="mda-del"><legend>Svarssätt</legend>
      <div class="mda-rad-val">${radio("svarssatt", "flerval", "Flerval <small>(standard)</small>", i.svarssatt === "flerval")}${radio("svarssatt", "skriv", "Skriv själv", i.svarssatt === "skriv")}</div>
      <p class="hint">Skriv själv gäller där källan stödjer det, annars blir det flerval.</p>
    </fieldset>
    <fieldset class="mda-del"><legend>Klocka på frågorna</legend>
      <div class="mda-rad-val">${KLOCKA_VAL.map((k) => radio("klocka", k, k ? `${k} sekunder` : "Av <small>(standard)</small>", i.klocka === k)).join("")}</div>
    </fieldset>
    <fieldset class="mda-del"><legend>Lugnt läge</legend>
      <label class="mda-val"><input type="checkbox" name="lugnt"${i.lugnt ? " checked" : ""} /><span>På – färre effekter, ingen publik som jublar och inga skakningar</span></label>
    </fieldset>
    <fieldset class="mda-del"><legend>Påminnelse om paus</legend>
      <div class="mda-rad-val">${PAUS_VAL.map((p) => radio("paus", p, p ? `${p} minuter${p === 60 ? " <small>(standard)</small>" : ""}` : "Av", i.paus === p)).join("")}</div>
      <p class="hint">Efter den tiden visas "Bra jobbat! Dags för en paus." efter nästa slutsignal. Den spärrar ingenting.</p>
    </fieldset>
    ${elev ? `<fieldset class="mda-del"><legend>Lagnamn</legend>
      <button type="button" class="btn ghost small" data-lagnamn disabled>${icon("pencil", 16)}<span>Återställ lagnamn</span></button>
      <span class="mda-lagnamn-status" role="status"></span>
      <p class="hint">Om eleven skriver något olämpligt. Lagnamnet blir då Pluggporten FC.</p>
    </fieldset>` : ""}

    <div class="mda-spara">
      <button type="submit" class="btn gron small">${icon("save", 16)}<span>Spara</span></button>
      <span class="mda-resultat" role="status"></span>
    </div>
  </form>`);

  const resultat = box.querySelector(".mda-resultat");
  if (elev) import("./md-lagnamn.js").then(({ kopplaAterstall }) => kopplaAterstall(box.querySelector("[data-lagnamn]"),
    { uid: elev.id, elevNamn: elev.namn || "Eleven", status: box.querySelector(".mda-lagnamn-status") }));
  box.querySelector("[data-folj]")?.addEventListener("click", async (e) => {
    const knapp = e.currentTarget;
    knapp.disabled = true;
    try {
      await (await import("../md-inst-data.js")).foljKlassen(elev.id);
      if (!avbryt.aborted) renderPanel(ctx, o);
    } catch (err) {
      knapp.disabled = false;
      resultat.innerHTML = `<span class="err-inline">Kunde inte ändra: ${esc(errText(err))}</span>`;
    }
  });
  const las = () => {
    const kryss = (attr) => [...box.querySelectorAll(`input[data-${attr}]:checked`)].map((c) => c.dataset[attr]);
    // Ett sparat område som inte visas (borttaget eller utan innehåll just nu) behålls –
    // läraren kan inte ha bockat ur det. md-fragor.js (1b) hoppar över det som saknas.
    const dolda = (attr, sparade) => {
      const visade = new Set([...box.querySelectorAll(`input[data-${attr}]`)].map((c) => c.dataset[attr]));
      return sparade.filter((k) => !visade.has(k));
    };
    const val = (n) => box.querySelector(`input[name="${n}"]:checked`)?.value;
    return {
      pa: box.querySelector('input[name="pa"]').checked,
      inst: {
        omraden: [...kryss("omrade"), ...dolda("omrade", i.omraden)], rakna: [...kryss("rakna"), ...dolda("rakna", i.rakna)],
        tabeller: kryss("tabell").map(Number),
        svarssatt: val("svarssatt"), klocka: Number(val("klocka")), paus: Number(val("paus")),
        lugnt: box.querySelector('input[name="lugnt"]').checked,
        foljPlugga: val("folj") === "1",
        lastext,
      },
    };
  };
  // Lästexten (#905): lärarens val, oavsett om rutan just nu är gråad.
  let lastext = i.lastext;
  const medLastext = lastextOmraden(library);
  const lastextCb = box.querySelector('input[name="lastext"]');
  // Läget (Samma som Plugga / Välj själv), de gråade dolda och "Inga frågor just nu" följer formuläret.
  const tom = box.querySelector("[data-tom]");
  const synka = () => {
    const v = las().inst;
    box.querySelector("[data-valj-sjalv]").hidden = v.foljPlugga;
    box.querySelector("[data-folj-info]").hidden = !v.foljPlugga;
    box.querySelectorAll(".mda-dolt").forEach((l) => l.classList.toggle("mda-dolt-vald", l.querySelector("input").checked));
    const anvands = effektivaKallor(normalizeInst(v), { synliga, plugga, standard: standard && sammaInst(v, i) });
    // Lästexten: bara områdena som faktiskt används (inte de dolda) räknas.
    const har = anvands.omraden.some((k) => medLastext.has(k));
    lastextCb.disabled = !har;
    lastextCb.checked = har && lastext;
    lastextCb.closest(".mda-lastext").classList.toggle("mda-gra", !har);
    box.querySelector("[data-lastext-info]").textContent = har ? LASTEXT_INFO : LASTEXT_INGA;
    tom.hidden = harKallor(anvands);
    tom.querySelector("[data-tom-valj]").hidden = v.foljPlugga;
    tom.querySelector("[data-tom-folj]").hidden = !v.foljPlugga;
    tom.querySelector("[data-byt-plugga]").hidden = v.foljPlugga;
  };
  // Antalet valda per ämne följer kryssen; ändrat = "Sparat" bort.
  box.addEventListener("change", (e) => {
    resultat.innerHTML = "";
    if (e.target === lastextCb) lastext = lastextCb.checked;
    const amne = e.target.closest(".mda-amne");
    if (amne) {
      const n = amne.querySelectorAll("input:checked").length;
      amne.querySelector("[data-antal]").textContent = antalText(n);
    }
    synka();
  });
  box.querySelector("[data-byt-plugga]").addEventListener("click", () => {
    box.querySelector('input[name="folj"][value="1"]').checked = true;
    synka();
    box.requestSubmit();
  });
  box.addEventListener("submit", async (e) => {
    e.preventDefault();
    const knapp = box.querySelector('button[type="submit"]');
    const val = las();
    knapp.disabled = true;
    resultat.innerHTML = "Sparar…";
    try {
      const data = await import("../md-inst-data.js");
      // En elev utan egna som läraren inte ändrat: bara på/av – eleven följer klassen vidare.
      const foljer = elev && !egna && sammaInst(val.inst, i);
      const sparad = elev
        ? await data.sparaAnpassning(cls, elev.id, { pa: val.pa, inst: foljer ? null : val.inst })
        : await data.sparaKlass(cls, val);
      const galler = sparad || i;
      const vem = elev ? "eleven" : "eleverna";
      const anvands = effektivaKallor(galler, { synliga, plugga, standard: standard && foljer });
      const varning = val.pa && !harKallor(anvands) ? ` – välj frågor, annars kan ${vem} inte spela` : "";
      resultat.innerHTML = `<span class="ok-inline">Sparat ✓ ${esc(sammanfattning(galler))}${foljer ? (arvd ? " (klassens)" : " (standard)") : ""}${varning}</span>`;
      onSaved();
      // Fick eleven nyss egna: rita om så att "Följ klassens inställningar" syns.
      if (elev && !egna && sparad && !avbryt.aborted) renderPanel(ctx, o).then(() => {
        const r = host.querySelector(".mda-resultat");
        if (r) r.innerHTML = `<span class="ok-inline">Sparat ✓ ${esc(sammanfattning(sparad))}</span>`;
      });
    } catch (err) {
      resultat.innerHTML = `<span class="err-inline">Kunde inte spara: ${esc(errText(err))}</span>`;
    } finally {
      knapp.disabled = false;
    }
  });
  synka();
  host.replaceChildren(box);
}

/** Raden under "Samma som Plugga": vad den ger just nu, och taket. */
function pluggaInfo(p) {
  const delar = [];
  if (p.omraden.length) delar.push(`${p.omraden.length} ${p.omraden.length === 1 ? "Plugga-område" : "Plugga-områden"}`);
  if (p.rakna.length) delar.push(`${p.rakna.length} ${p.rakna.length === 1 ? "Räkna-område" : "Räkna-områden"}`);
  const just = delar.length ? `Just nu: ${delar.join(" och ")} som klassen ser.` : "Klassen ser inga områden med frågor just nu.";
  return p.fler ? `${just} Klassen ser fler än ${MAX_OMRADEN} områden – de ${MAX_OMRADEN} första används.` : just;
}
