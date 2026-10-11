// ============================================================================
// Snilleblixten – TV-studion (#559): FRÅGAN (designspec §5.3–5.5).
//   createKlocka(host)  överst: "Fråga 4 av 10" + stor cirkulär nedräkning
//                       (frågans serverstämpel, aldrig en lokal nedräknare).
//                       Sista 5 s: röd + pulserande (.sbk-spanning).
//   createSchakt(host)  mitten: frågeschaktet – frågan stort, under den
//                       Flerval 2×2 (färg OCH form: röd ▲, blå ◆, gul ●,
//                       grön ■ – CHOICE_STYLES, samma som elevens knappar)
//                       eller Skriv själv ("Skriv ditt svar!"). Avslöjandet:
//                       rätt alternativ tänds, fel tonas, staplar växer
//                       (transform: scaleX) / rätt svar stort, andel rätt
//                       och de vanligaste felsvaren UTAN namn.
//                       Tidslinjefråga (#600, kind "timeline"): händelsen +
//                       frågan, under dem tidslinjen över frågans spann UTAN
//                       markör (src/timeline/timeline-spread.js, latt) –
//                       inget som avslöjar svaret. Avslöjandet: rätt år på
//                       linjen, andel exakt rätt och klassens gissningar som
//                       anonym spridning. Ingen rangordning.
// Ritas om bara när frågan byts (key); avslöjandet läggs på samma element.
//
// API
//   createKlocka(host) → { set({ index, count, clock }), destroy() }
//     clock = questionClock(...) | null (dold ring, t.ex. efter avslöjandet)
//   createSchakt(host) → {
//     show(q, { answerKind, land? })   ny fråga (land = blixtlandning);
//                                      answerKind = sessionens – frågans kind vinner
//     reveal(info)                     revealInfo(...) ur sb-scen.js
//     clear()                          töm (intro)
//     destroy()
//   }
// ============================================================================

import { esc } from "../../../teacher-shared.js";
import { CHOICE_STYLES, choiceShapeSvg, textLength, keepNumbers } from "../../choice-answer.js";
import { prefersReducedMotion } from "../../design/live-reactions.js";

const R = 44;
const CIRC = 2 * Math.PI * R;

export function createKlocka(host) {
  const root = document.createElement("div");
  root.className = "sbk";
  root.innerHTML = `
    <div class="sbk-nr" aria-live="polite"></div>
    <div class="sbk-ring" role="timer" aria-label="Tid kvar">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle class="sbk-spar" cx="50" cy="50" r="${R}"/>
        <circle class="sbk-bage" cx="50" cy="50" r="${R}" stroke-dasharray="${CIRC.toFixed(2)}" transform="rotate(-90 50 50)"/>
      </svg>
      <b class="sbk-sek"></b>
    </div>`;
  host.appendChild(root);
  const nr = root.querySelector(".sbk-nr");
  const ring = root.querySelector(".sbk-ring");
  const arc = root.querySelector(".sbk-bage");
  const sek = root.querySelector(".sbk-sek");
  let last = "";
  return {
    set({ index = -1, count = 0, clock = null } = {}) {
      const nrText = index >= 0 ? `Fråga ${index + 1} av ${count}` : "";
      const key = `${nrText}|${clock ? `${clock.secs}|${clock.frac.toFixed(3)}|${clock.tension}` : "-"}`;
      if (key === last) return;
      last = key;
      if (nr.textContent !== nrText) nr.textContent = nrText;
      ring.hidden = !clock;
      if (!clock) return;
      sek.textContent = String(clock.secs);
      arc.style.strokeDashoffset = (CIRC * (1 - clock.frac)).toFixed(2);
      ring.classList.toggle("sbk-spanning", clock.tension);
    },
    destroy() { root.remove(); },
  };
}

/** Frågetextens storleksklass efter längd (stor och lättläst, aldrig < 28 px).
 *  Med lästext ett steg mindre, så att kortet ryms över alternativen (#621). */
function textSize(text, passage = false) {
  const n = String(text || "").length;
  const i = (n <= 24 ? 0 : n <= 70 ? 1 : n <= 140 ? 2 : 3) + (passage ? 1 : 0);
  return ["xl", "l", "m", "s"][Math.min(3, i)];
}

/** Alternativens storlek – samma längdklass som elevens knappar (choice-answer.js). */
const OPT_SIZE = { kort: "xl", mellan: "l", lang: "m" };

export function createSchakt(host) {
  const root = document.createElement("section");
  root.className = "sbs";
  root.setAttribute("aria-live", "polite");
  host.appendChild(root);
  let key = null;
  let kind = "free";
  let revealed = false;
  let facitShown = false;
  let spread = null; // tidslinjens visning (tidslinjefråga)
  let spreadKey = null;
  let pendingReveal = null;

  function dropSpread() {
    spread?.destroy();
    spread = null;
    spreadKey = null;
    pendingReveal = null;
  }

  function mountSpread(span) {
    const k = key;
    spreadKey = k;
    import("../../../timeline/timeline-spread.js").then(({ mountTimelineSpread }) => {
      const box = root.querySelector(".sbs-tidslinje");
      if (spreadKey !== k || !box) return;
      spread = mountTimelineSpread(box, { span });
      if (pendingReveal) spread.reveal(pendingReveal);
    }, (err) => console.warn("Snilleblixten: tidslinjen kunde inte laddas", err));
  }

  function show(q, { answerKind = "free", land = false } = {}) {
    const k = q?.question?.key ?? `${q?.index}`;
    if (k === key) return;
    key = k;
    const tl = q?.question?.kind === "timeline";
    kind = tl ? "timeline" : answerKind;
    revealed = false;
    facitShown = false;
    dropSpread();
    root.classList.remove("sbs-avslojad");
    const text = q?.question?.text || "";
    const passage = tl ? [q.question.event, q.question.description].filter(Boolean).join(": ") : q?.question?.passage || "";
    const opts = (q?.question?.options || []).slice(0, 4);
    const optLen = textLength(opts, "alt");
    root.dataset.kind = kind;
    root.innerHTML = `
      <div class="sbs-kort">${passage ? `<p class="sbs-kontext">${esc(keepNumbers(passage))}</p>` : ""}<p class="sbs-fraga sbs-t-${textSize(text, !!passage)}">${esc(keepNumbers(text))}</p></div>
      ${tl ? `<div class="sbs-tidslinje"></div><div class="sbs-skriv sbs-dra"><span class="sbs-penna" aria-hidden="true">📅</span> Dra till rätt år!</div>`
    : kind === "choice" ? `<ol class="sbs-alt" data-n="${opts.length}" data-len="${optLen}">${opts.map((o, i) => `
        <li class="sbs-opt sbs-${CHOICE_STYLES[i].key}" data-i="${i}" aria-label="${esc(CHOICE_STYLES[i].label)}: ${esc(o)}">
          <span class="sbs-stapel" aria-hidden="true"><i></i></span>
          <span class="sbs-form">${choiceShapeSvg(i)}</span>
          <span class="sbs-otext sbs-t-${OPT_SIZE[optLen]}">${esc(keepNumbers(o))}</span>
          <b class="sbs-antal" aria-hidden="true"></b>
        </li>`).join("")}</ol>`
    : `<div class="sbs-skriv"><span class="sbs-penna" aria-hidden="true">✍️</span> Skriv ditt svar!</div>`}
      <div class="sbs-facit" hidden></div>`;
    if (tl && q.question.span) mountSpread(q.question.span);
    if (land) {
      const reduced = prefersReducedMotion();
      const card = root.querySelector(".sbs-kort");
      card.animate(reduced ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ opacity: 0, transform: "translateY(-30%) scale(1.25)" }, { opacity: 1, transform: "scale(.97)", offset: 0.6 }, { opacity: 1, transform: "none" }],
      { duration: reduced ? 300 : 520, easing: "cubic-bezier(.2,.9,.3,1.2)" });
      root.querySelectorAll(".sbs-opt, .sbs-skriv").forEach((el, i) => {
        el.animate(reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: "scale(.6)" }, { opacity: 1, transform: "none" }],
          { duration: 360, delay: 260 + i * 70, easing: "cubic-bezier(.3,1.4,.5,1)", fill: "backwards" });
      });
    }
  }

  function reveal(info, { animate = true } = {}) {
    if (!info || (revealed && info.ready)) return;
    const reduced = prefersReducedMotion() || !animate;
    root.classList.add("sbs-avslojad");
    if (info.kind === "timeline") return revealTimeline(info, reduced);
    if (info.kind === "choice") {
      root.querySelectorAll(".sbs-opt").forEach((li) => {
        const i = Number(li.dataset.i);
        const ok = i === info.correctIndex;
        li.classList.toggle("sbs-ratt", ok);
        li.classList.toggle("sbs-fel", !ok);
        const n = info.counts[i] || 0;
        li.querySelector(".sbs-antal").textContent = info.ready ? String(n) : "";
        const bar = li.querySelector(".sbs-stapel i");
        const to = `scaleX(${info.ready ? (n / info.max).toFixed(3) : 0})`;
        bar.style.transform = to;
        if (!reduced && info.ready) bar.animate([{ transform: "scaleX(0)" }, { transform: to }], { duration: 900, delay: 250 + i * 90, easing: "cubic-bezier(.2,.8,.3,1)", fill: "backwards" });
      });
    } else {
      const f = root.querySelector(".sbs-facit");
      const wrong = info.topWrong.map((w) => `<span>${esc(w.answer)} <small>(${w.n} st)</small></span>`).join(`<i aria-hidden="true">·</i>`);
      f.innerHTML = `
        <div class="sbs-rattsvar"><small>Rätt svar</small><b>${esc(info.correctText)}</b></div>
        <div class="sbs-facit-info">
          <div class="sbs-andel">${info.ready ? `<b>${info.share} %</b> rätt <small>(${info.correct} av ${info.answered} svar)</small>` : ""}</div>
          ${info.ready && info.topWrong.length ? `<div class="sbs-vanliga"><small>Vanliga felsvar:</small> ${wrong}</div>` : ""}
        </div>`;
      f.hidden = false;
      root.querySelector(".sbs-skriv")?.setAttribute("hidden", "");
      if (!reduced && !facitShown) {
        f.querySelector(".sbs-rattsvar").animate([{ opacity: 0, transform: "scale(1.6)" }, { opacity: 1, transform: "none" }], { duration: 480, easing: "cubic-bezier(.2,.9,.3,1.2)" });
      }
    }
    facitShown = true;
    revealed = !!info.ready;
  }

  function revealTimeline(info, reduced) {
    const pr = { correct: info.correctYear, guesses: info.ready ? info.guesses : [], animate: !reduced };
    if (Number.isInteger(info.correctYear)) {
      pendingReveal = pr;
      spread?.reveal(pr);
    }
    const f = root.querySelector(".sbs-facit");
    const html = `
        <div class="sbs-rattsvar"><small>Rätt år</small><b>${esc(info.correctText)}</b></div>
        <div class="sbs-facit-info">
          <div class="sbs-andel">${info.ready ? `<b>${info.share} %</b> exakt rätt <small>(${info.correct} av ${info.answered} svar)</small>` : ""}</div>
          ${info.ready && info.spreadText ? `<div class="sbs-vanliga">${esc(info.spreadText)}</div>` : ""}
        </div>`;
    if (f.dataset.html !== html) {
      f.dataset.html = html;
      f.innerHTML = html;
    }
    f.hidden = false;
    root.querySelector(".sbs-dra")?.setAttribute("hidden", "");
    if (!reduced && !facitShown) {
      f.querySelector(".sbs-rattsvar").animate([{ opacity: 0, transform: "scale(1.6)" }, { opacity: 1, transform: "none" }], { duration: 480, easing: "cubic-bezier(.2,.9,.3,1.2)" });
    }
    facitShown = true;
    revealed = !!info.ready;
  }

  return {
    show,
    reveal,
    get kind() { return kind; },
    clear() { key = null; revealed = false; facitShown = false; dropSpread(); root.innerHTML = ""; root.classList.remove("sbs-avslojad"); },
    destroy() { dropSpread(); root.remove(); },
  };
}
