// ============================================================================
// Mattematchen – elevsidan #/elev/mattematchen (#458)
// ----------------------------------------------------------------------------
// En skärm utan scroll: tävlingens namn + tid kvar, elevens poäng, knapparna
// 🏆 (Topp 25 / Klasskamp) och 📊 (egen statistik), och den snabba
// svarskomponenten (#457) i mitten. 1 rätt = 1 poäng, fel = 0, inga coins.
//
// Synlighet: sidan nås bara under en AKTIV period där elevens klass deltar
// (ui.getMattematch → mm-watch.js). Ingen aktiv period → snällt meddelande
// och hem. Tar perioden slut (eller pausar läraren) medan eleven spelar
// stängs svarsfältet direkt – eleven kan fortfarande se 🏆 och 📊.
//
// Laddas DYNAMISKT från app.js (#271). Stilar: mattematchen.css (laddas här).
// ============================================================================

import * as data from "../data.js";
import { app, el, renderTopbar, flash, escHtml, getMattematch } from "../ui.js";
import { mountFastAnswer } from "../mult/fast-answer.js";
import MULT from "../live/modes/multiplication-0-10.js";
import { onMattematchChange, mmNow } from "./mm-watch.js";
import { submitAnswer, loadMyStats } from "./mm-data.js";
import { openTopplista, openStatistik } from "./mm-panels.js";
import { formatLeft, toMs } from "./mm-core.js";

const ROUTE = "#/elev/mattematchen";
let aktiv = null; // { stang() } för vyn som visas just nu

/** Ladda CSS:erna en gång (ostylad blink undviks med kort väntan). */
function ensureStyles() {
  const filer = [["fa", "../mult/fast-answer.css"], ["mm", "./mattematchen.css"]];
  return Promise.all(filer.map(([id, rel]) => {
    if (document.querySelector(`link[data-mm-css="${id}"]`)) return null;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL(rel, import.meta.url).href;
    link.dataset.mmCss = id;
    const ready = new Promise((resolve) => {
      link.addEventListener("load", resolve, { once: true });
      link.addEventListener("error", resolve, { once: true });
      setTimeout(resolve, 1500);
    });
    document.head.appendChild(link);
    return ready;
  }));
}

function tidKvar(comp) {
  return `slutar om ${formatLeft(toMs(comp.endAt) - mmNow())}`;
}

/** Sidans ingång (anropas av app.js-routern). */
export async function pageMattematchen() {
  aktiv?.stang();
  aktiv = null;
  const stilP = ensureStyles();
  const mm = await getMattematch();
  renderTopbar();
  if (!mm) {
    flash("Mattematchen är inte igång för din klass just nu.");
    window.location.replace("#/elev/hus");
    return;
  }
  const { competition, classId } = mm;
  const uid = data.currentStudentId();
  const name = data.getSession()?.namn || uid;
  // Poängen läses FÖRE första frågan, så lokala +1 aldrig dubbelräknas.
  const [start] = await Promise.all([loadMyStats(competition.id, uid).catch(() => null), stilP]);
  if (!window.location.hash.startsWith(ROUTE)) return; // eleven hann gå vidare

  const vy = el(`<div class="mm-sida">
    <header class="mm-topp">
      <div class="mm-titel">
        <span class="mm-logga" aria-hidden="true">🧮</span>
        <div>
          <h1>Mattematchen</h1>
          <small><span class="mm-namn">${escHtml(competition.name || "")}</span> · <span class="mm-kvar">${tidKvar(competition)}</span></small>
        </div>
      </div>
      <div class="mm-poang" title="1 rätt = 1 poäng">
        <b class="mm-poang-tal">0</b><span>poäng</span>
      </div>
      <div class="mm-knappar">
        <button type="button" class="mm-knapp mm-knapp-topp" aria-label="Topplistor" title="Topplistor">🏆</button>
        <button type="button" class="mm-knapp mm-knapp-stat" aria-label="Min statistik" title="Min statistik">📊</button>
      </div>
    </header>
    <section class="mm-spel"><div class="mm-kort"><div class="mm-fa"></div></div></section>
    <footer class="mm-fot">
      <span>Skriv svaret · tryck <kbd>ENTER</kbd> · 1 rätt = 1 poäng</span>
      <span class="mm-session">Nu: <b class="mm-s-ratt">0</b> rätt · <b class="mm-s-fel">0</b> fel</span>
      <span class="mm-varning" hidden></span>
    </footer>
  </div>`);
  app.replaceChildren(vy);
  const $ = (s) => vy.querySelector(s);

  let poang = start ? start.correct : 0;
  // Server-bekräftade rätt (Klass-EXP #479: var 20:e = 1). Okänd start → ingen
  // klass-EXP den här gången (hellre det än fel 20-gränser).
  let bekraftade = start ? start.correct : null;
  let osparade = 0;
  let oppenPanel = null;
  const visaPoang = () => { $(".mm-poang-tal").textContent = String(poang); };
  visaPoang();

  const fa = mountFastAnswer($(".mm-fa"), {
    source: MULT.createSource(),
    check: MULT.checkAnswer,
    inputMode: MULT.inputMode,
    idleText: "Mattematchen är slut – bra kämpat! 🎉",
    onAnswer(attempt) {
      if (attempt.result.correct) {
        poang++;
        visaPoang();
        $(".mm-poang").classList.remove("mm-plopp");
        void $(".mm-poang").offsetWidth;
        $(".mm-poang").classList.add("mm-plopp");
      }
      $(".mm-s-ratt").textContent = fa.counts.correct;
      $(".mm-s-fel").textContent = fa.counts.wrong;
      return submitAnswer({ competition, classId, uid, name, attempt }).then(() => {
        if (!attempt.result.correct || bekraftade == null) return;
        const rattFore = bekraftade++;
        import("../klasscenter/kc-koppling.js")
          .then((m) => m.klassExpEfterOvning({ modul: "mattematchen", resultat: { rattFore, rattEfter: bekraftade } }))
          .catch(() => {});
      }, (err) => {
        osparade++;
        if (attempt.result.correct && poang) { poang--; visaPoang(); }
        const v = $(".mm-varning");
        v.hidden = false;
        v.textContent = `⚠️ ${osparade} svar kunde inte sparas`;
        console.warn("Mattematchen: svaret sparades inte", err?.code || err);
      });
    },
  });

  // Panelerna pausar autofokus medan de är öppna.
  function oppna(fn) {
    if (oppenPanel) return;
    fa.pauseFocus();
    oppenPanel = fn({ competition, uid, myPoints: poang, onClose: () => { oppenPanel = null; fa.resumeFocus(); } });
  }
  $(".mm-knapp-topp").addEventListener("click", () => oppna(openTopplista));
  $(".mm-knapp-stat").addEventListener("click", () => oppna(openStatistik));

  const kvarIv = setInterval(() => { $(".mm-kvar").textContent = tidKvar(competition); }, 30_000);

  // Perioden slutar/pausas/byts medan eleven är här.
  const avreg = onMattematchChange((next) => {
    if (next && next.competition.id === competition.id) {
      $(".mm-namn").textContent = next.competition.name || "";
      Object.assign(competition, next.competition);
      $(".mm-kvar").textContent = tidKvar(competition);
      return;
    }
    if (next) return void pageMattematchen(); // ny period → rita om
    fa.setEnabled(false, "Mattematchen är slut – bra kämpat! 🎉");
    $(".mm-kvar").textContent = "slut";
    vy.classList.add("mm-slut");
  });

  function stang() {
    clearInterval(kvarIv);
    avreg();
    oppenPanel?.close();
    fa.destroy();
    window.removeEventListener("hashchange", onHash);
    if (aktiv?.stang === stang) aktiv = null;
  }
  function onHash() {
    if (!window.location.hash.startsWith(ROUTE)) stang();
  }
  window.addEventListener("hashchange", onHash);
  aktiv = { stang };
}
