// ============================================================================
// Mattematchen – elevens paneler (#458): 🏆 Topplistor och 📊 Min statistik
// ----------------------------------------------------------------------------
// Öppnas bara när eleven trycker på knappen (aldrig mitt i spelflödet).
// Datat kommer ur aggregerade dokument (mm-data.js) – inga svar scannas.
//
// API (båda returnerar { close() }):
//   openTopplista({ competition, uid, myPoints, onClose })
//     flikar: Individuellt (exakt Topp 25) · Klasskamp (alla deltagande
//     klasser, rätt / elevantal med 1 decimal och svensk komma)
//   openStatistik({ competition, uid, onClose })
//     rätt, fel, totalt, % rätt, % fel + per tabell 0–10. Bara egen data.
// Stäng: ✕, Esc eller klick utanför kortet.
// ============================================================================

import { el, escHtml } from "../ui.js";
import { getClasses } from "../data-classes.js";
import { loadTop25, loadClassFight, loadMyStats } from "./mm-data.js";
import { formatScore, formatPct, TOP_N } from "./mm-core.js";

const MEDALJ = { 1: "🥇", 2: "🥈", 3: "🥉" };
const plats = (rank) => MEDALJ[rank] || `${rank}.`;

/** Gemensamt panelskal: scrim + kort + rubrik + stäng. */
function panelSkal(titel, innehall, onClose) {
  const lager = el(`<div class="mm-lager" role="dialog" aria-modal="true" aria-label="${escHtml(titel)}">
    <div class="mm-panel">
      <header class="mm-panel-topp">
        <h2>${titel}</h2>
        <button type="button" class="mm-stang" aria-label="Stäng">✕</button>
      </header>
      <div class="mm-panel-kropp">${innehall}</div>
    </div>
  </div>`);
  let stangd = false;
  function close() {
    if (stangd) return;
    stangd = true;
    document.removeEventListener("keydown", onKey, true);
    lager.remove();
    onClose?.();
  }
  function onKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }
  lager.addEventListener("click", (e) => { if (e.target === lager) close(); });
  lager.querySelector(".mm-stang").addEventListener("click", close);
  document.addEventListener("keydown", onKey, true);
  document.body.appendChild(lager);
  lager.querySelector(".mm-stang").focus({ preventScroll: true });
  return { lager, close };
}

const laddar = `<p class="mm-laddar">Laddar…</p>`;
const felRad = `<p class="mm-laddar">Kunde inte hämta listan just nu. Prova igen om en stund.</p>`;

async function ritaIndividuellt(box, { competition, uid, myPoints }) {
  box.innerHTML = laddar;
  try {
    const [rader, klasser] = await Promise.all([loadTop25(competition.id), getClasses().catch(() => [])]);
    const klassNamn = new Map(klasser.map((k) => [k.id, k.name || k.id]));
    if (!rader.length) {
      box.innerHTML = `<p class="mm-tom">Ingen har fått poäng än – bli först! 🚀</p>`;
      return;
    }
    const jagMed = rader.some((r) => r.uid === uid);
    box.innerHTML = `<ol class="mm-topp25">${rader.map((r) => `
        <li class="mm-rad${r.uid === uid ? " mm-jag" : ""}${r.rank <= 3 ? ` mm-pall mm-pall-${r.rank}` : ""}">
          <span class="mm-plats">${plats(r.rank)}</span>
          <span class="mm-elev">${escHtml(r.name)}<small>${escHtml(klassNamn.get(r.classId) || r.classId)}</small></span>
          <b class="mm-tal">${r.correct}</b>
        </li>`).join("")}</ol>
      <p class="mm-not">Topp ${TOP_N} · 1 rätt = 1 poäng${
        jagMed ? "" : ` · <b>Du: ${Number(myPoints) || 0} poäng</b> – fortsätt så!`}</p>`;
  } catch (err) {
    console.warn("Mattematchen: Topp 25", err);
    box.innerHTML = felRad;
  }
}

async function ritaKlasskamp(box, { competition, myClassIds }) {
  box.innerHTML = laddar;
  try {
    const rader = await loadClassFight(competition);
    const max = Math.max(...rader.map((r) => r.score), 0);
    box.innerHTML = `<ol class="mm-klasser">${rader.map((r) => `
        <li class="mm-klassrad${myClassIds.includes(r.classId) ? " mm-jag" : ""}">
          <span class="mm-plats">${plats(r.rank)}</span>
          <span class="mm-klassnamn">${escHtml(r.name)}</span>
          <span class="mm-stapel" aria-hidden="true"><i style="width:${max > 0 ? Math.max(2, (r.score / max) * 100) : 0}%"></i></span>
          <b class="mm-tal">${formatScore(r.score)}</b>
        </li>`).join("")}</ol>
      <p class="mm-not">Poäng = klassens rätt ÷ antal elever i klassen</p>`;
  } catch (err) {
    console.warn("Mattematchen: Klasskamp", err);
    box.innerHTML = felRad;
  }
}

/** 🏆 Topplistor med två flikar. */
export function openTopplista(ctx) {
  const { lager, close } = panelSkal("🏆 Topplistor", `
    <div class="mm-flikar" role="tablist">
      <button type="button" role="tab" class="mm-flik" data-flik="ind" aria-selected="true">Individuellt</button>
      <button type="button" role="tab" class="mm-flik" data-flik="klass" aria-selected="false">Klasskamp</button>
    </div>
    <div class="mm-flik-yta" role="tabpanel"></div>`, ctx.onClose);
  const yta = lager.querySelector(".mm-flik-yta");
  const myClassIdsP = getClasses()
    .then((ks) => ks.filter((k) => (k.studentIds || []).includes(ctx.uid)).map((k) => k.id))
    .catch(() => []);
  let flik = null;
  async function visa(namn) {
    if (namn === flik) return;
    flik = namn;
    lager.querySelectorAll(".mm-flik").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.flik === namn)));
    if (namn === "ind") await ritaIndividuellt(yta, ctx);
    else await ritaKlasskamp(yta, { ...ctx, myClassIds: await myClassIdsP });
  }
  lager.querySelectorAll(".mm-flik").forEach((b) => b.addEventListener("click", () => visa(b.dataset.flik)));
  visa("ind");
  return { close };
}

/** Färgklass för en procentsats (grön = säker, gul = nästan, orange = öva mer). */
function niva(p, total) {
  if (!total) return "mm-niva-ingen";
  return p >= 85 ? "mm-niva-bra" : p >= 60 ? "mm-niva-mellan" : "mm-niva-ova";
}

/** 📊 Elevens egen statistik. */
export function openStatistik(ctx) {
  const { lager, close } = panelSkal("📊 Min statistik", laddar, ctx.onClose);
  const kropp = lager.querySelector(".mm-panel-kropp");
  loadMyStats(ctx.competition.id, ctx.uid)
    .then((s) => {
      const ruta = (klass, tal, text) => `<div class="mm-ruta ${klass}"><b>${tal}</b><span>${text}</span></div>`;
      kropp.innerHTML = `
        <div class="mm-rutor">
          ${ruta("mm-ruta-ratt", s.correct, "rätt")}
          ${ruta("mm-ruta-fel", s.incorrect, "fel")}
          ${ruta("mm-ruta-tot", s.total, "totalt")}
          ${ruta("mm-ruta-pr", formatPct(s.pctCorrect), "rätt")}
          ${ruta("mm-ruta-pf", formatPct(s.pctWrong), "fel")}
        </div>
        <h3 class="mm-tabell-rubrik">Per tabell</h3>
        <ul class="mm-tabeller">${s.tables.map((t) => `
          <li class="mm-tabell ${niva(t.pct, t.total)}" title="${t.correct} rätt · ${t.wrong} fel">
            <span class="mm-tabell-namn">${t.table}:ans tabell</span>
            <span class="mm-stapel" aria-hidden="true"><i style="width:${t.total ? Math.max(2, t.pct) : 0}%"></i></span>
            <b class="mm-tal">${t.total ? formatPct(t.pct) : "–"}</b>
          </li>`).join("")}</ul>
        <p class="mm-not">Bara du ser din statistik. 7 × 8 räknas i både 7:ans och 8:ans tabell.</p>`;
    })
    .catch((err) => {
      console.warn("Mattematchen: statistik", err);
      kropp.innerHTML = felRad;
    });
  return { close };
}
