// ============================================================================
// Mattematchen – totalt rätt/fel/felprocent per klass och hela skolan (#863)
// ----------------------------------------------------------------------------
// Tabell på en tävlings detaljvy (teacher-mm-detail.js), för pågående OCH
// avslutade matcher:  Klass | Rätt | Fel | Felprocent
// + delsumma per årskurs (#845 arskursAvKlass, bara om fler än en årskurs)
// + totalraden "Hela skolan".
//
// Siffrorna (ren logik: mm-teacher-core.classTotals, HTML: mm-totalt-html.js):
//   • avslutad med sparat result → ur result.students, INGA extra läsningar
//     (ögonblicksbilden tas vid avslutet; kapad vid RESULT_STUDENTS_MAX → not
//     och "?" i stället för "–"). Hela skolan = matchens deltagande klasser
//     (inte result.totals, som även räknar elever i klasser som lämnat matchen).
//   • pågående (eller avslutad utan result) → studentStats via
//     mm-teacher-data.loadStatsForClasses: en läsning per elev som svarat.
//     Fel per klass finns inte aggregerat (classCounters har bara rätt).
// Behörighet (#678): admin ser alla klasser + Hela skolan. Ett årskurskonto
// ser bara sina klasser (reglerna släpper bara dem) + "Mina klasser"; Hela
// skolan visas för årskurskontot bara i en avslutad match (ur det sparade
// result.students, samma summa som admin ser) – i en pågående match kan det
// inte läsa andras fel.
// Laddas DYNAMISKT (#271).
// ============================================================================

import { el, esc, icon } from "../teacher-shared.js";
import { RESULT_STUDENTS_MAX, classTotals } from "./mm-teacher-core.js";
import { totalsHtml } from "./mm-totalt-html.js";

/**
 * Rita sektionen. role = teacher-role.myRole() ({ admin, classIds }).
 * @param {{ api:object, classes:object[], role:{admin:boolean, classIds:Set|null} }} deps
 */
export function renderClassTotals(host, comp, { api, classes, role }) {
  const box = el(`<section class="mmt-kort mmt-totalt">
    <div class="row-inline mmt-follow-topp"><span class="hint mmt-uppdaterad"></span>
      <button type="button" class="btn ghost small" data-uppdatera="1">Uppdatera</button></div>
    <div class="mmt-totalt-body"><div class="spinner">Räknar…</div></div>
    <p class="hint mmt-not mmt-totalt-not"></p>
  </section>`);
  const body = box.querySelector(".mmt-totalt-body");
  const not = box.querySelector(".mmt-totalt-not");
  const stamp = box.querySelector(".mmt-uppdaterad");
  const btn = box.querySelector("[data-uppdatera]");
  const classIds = role?.admin ? null : role?.classIds || new Set();
  const sparat = comp.result && Array.isArray(comp.result.students) ? comp.result : null;
  let busy = false;

  const rita = (stats) => {
    // Sparat result täcker alla klasser (kontot läser hela tävlingsdokumentet);
    // pågående: bara admin läser alla klassers studentStats.
    const kapad = !!sparat && (stats.length >= RESULT_STUDENTS_MAX || (Number(sparat.totals?.participants) || 0) > stats.length);
    const t = classTotals({ stats, classes, participatingIds: comp.participatingClassIds, classIds, fullstandig: !!sparat || !classIds, kapad });
    body.innerHTML = totalsHtml(t);
    const delar = [sparat ? "Ur det sparade resultatet vid avslutet." : "Live-svar i multiplikation räknas in (#847)."];
    if (kapad) delar.push(`Resultatet sparade bara de ${RESULT_STUDENTS_MAX} elever som hade flest rätt – siffrorna kan vara lägre än de verkliga (? = kan saknas).`);
    if (t.filtrerad && !t.skola) delar.push("Hela skolan visas när matchen är avslutad.");
    not.textContent = delar.join(" ");
  };

  const load = async () => {
    if (busy) return;
    busy = true;
    btn.disabled = true;
    try {
      if (sparat) {
        rita(sparat.students);
      } else {
        const stats = await api.loadStatsForClasses(comp.id, classIds ? [...classIds] : null);
        rita(stats);
        stamp.textContent = `Uppdaterad ${new Date().toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
      }
    } catch (err) {
      body.replaceChildren(el(`<div class="msg error">Kunde inte räkna klasserna: ${esc(err.message)}</div>`));
    } finally {
      busy = false;
      btn.disabled = false;
    }
  };
  btn.hidden = !!sparat;
  btn.addEventListener("click", load);
  host.replaceChildren(box);
  load();
}
