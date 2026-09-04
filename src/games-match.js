// ============================================================================
// Pluggportalen – games-match.js
// De kort-/matchningsbaserade gamemoderna, båda byggda på fakta-paren:
//   • Para ihop – matcha begrepp ↔ förklaring (rätt par låser, fel skakar)
//   • Memory    – vänd två kort och hitta paren (bonus-gamemode)
// ============================================================================

import { app, el } from "./ui.js";
import { sound } from "./fx.js";
import { gameFrame, showResult, shuffle } from "./game-shared.js";
import { resolvePairImage } from "./pair-images.js";
import { pickOnePerGroup } from "./pick-group.js";

/** Enkel HTML-escape för lärar-inmatad text (samma som i game-shared). */
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Bygg innehållet för en kort-sida. Om paret har en bildnyckel på sidan
 * (termImage/defImage) och nyckeln finns i bildpaketet renderas den betrodda
 * inline-SVG:n, annars textfältet (esc:at). Bild↔text och bild↔bild funkar.
 *   side = "term"  -> använder p.term / p.termImage
 *   side = "def"   -> använder p.definition / p.defImage
 */
function sideContent(p, side) {
  const imageKey = side === "term" ? p.termImage : p.defImage;
  const text = side === "term" ? p.term : p.definition;
  if (imageKey) {
    const img = resolvePairImage(imageKey);
    if (img) {
      return `<span class="pair-img" role="img" aria-label="${esc(img.alt)}">${img.markup}</span>`;
    }
  }
  return esc(text);
}

// --- Para ihop --------------------------------------------------------------

export function startPara(ctx) {
  const { subj, area, areaData } = ctx;
  // Max 6 par åt gången så det blir lagom för åk 4. Först ett par per "group"
  // (ömsesidigt uteslutande dubbletter), sedan slumpa fram max 6.
  const pairs = pickOnePerGroup(areaData.pairs || []).slice(0, 6);

  const view = gameFrame({ subj, area, title: "Para ihop", emoji: "🧩" });
  const body = view.querySelector("#game-body");
  app.replaceChildren(view);

  const terms = shuffle(pairs);
  const defs = shuffle(pairs);

  const wrap = el(`<div>
    <p class="hint center">Klicka på ett begrepp och sedan på förklaringen som hör ihop. Rätt par låser sig! 🧩</p>
    <div class="para-grid">
      <div class="para-col" id="col-term">
        ${terms.map((p) => `<button class="para-card" data-pair="${p.id}" data-col="term">${sideContent(p, "term")}</button>`).join("")}
      </div>
      <div class="para-col" id="col-def">
        ${defs.map((p) => `<button class="para-card" data-pair="${p.id}" data-col="def">${sideContent(p, "def")}</button>`).join("")}
      </div>
    </div>
  </div>`);
  body.replaceChildren(wrap);

  let selected = null; // valt kort (element)
  let matched = 0;
  let mistakes = 0;
  const total = pairs.length;

  wrap.querySelectorAll(".para-card").forEach((card) => {
    card.addEventListener("click", () => onPick(card));
  });

  function clearSelection() {
    if (selected) selected.classList.remove("selected");
    selected = null;
  }

  function onPick(card) {
    if (card.classList.contains("matched")) return;
    if (card === selected) {
      clearSelection();
      return;
    }
    if (!selected) {
      selected = card;
      card.classList.add("selected");
      sound.click();
      return;
    }
    // Samma kolumn – flytta bara markeringen.
    if (card.dataset.col === selected.dataset.col) {
      clearSelection();
      selected = card;
      card.classList.add("selected");
      return;
    }
    const a = selected;
    const b = card;
    if (a.dataset.pair === b.dataset.pair) {
      // Rätt par – lås.
      a.classList.remove("selected");
      a.classList.add("matched");
      b.classList.add("matched");
      selected = null;
      matched++;
      sound.correct();
      if (matched === total) finish();
    } else {
      // Fel par – skaka och nollställ.
      mistakes++;
      sound.wrong();
      a.classList.remove("selected");
      a.classList.add("shake", "wrong-flash");
      b.classList.add("shake", "wrong-flash");
      selected = null;
      setTimeout(() => {
        a.classList.remove("shake", "wrong-flash");
        b.classList.remove("shake", "wrong-flash");
      }, 500);
    }
  }

  function finish() {
    // Stjärnor efter hur få fel: 0 fel = 3, ≤2 = 2, annars 1.
    const stars = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
    const baseCoins = 2 * (8 + (mistakes === 0 ? 8 : Math.max(0, 6 - mistakes)));
    setTimeout(() => {
      showResult({
        container: body,
        subj, area, mode: "para",
        stars,
        scoreLine: mistakes === 0 ? "Helt felfritt! 🎯" : `Klart med ${mistakes} felförsök.`,
        baseCoins,
        bestScore: total * 2 - mistakes,
        replay: () => startPara(ctx),
      });
    }, 500);
  }
}

// --- Memory (bonus) ---------------------------------------------------------

export function startMemory(ctx) {
  const { subj, area, areaData } = ctx;
  // Håll brädet lagom: max 6 par = 12 kort. Först ett par per "group"
  // (ömsesidigt uteslutande dubbletter), sedan slumpa fram max 6.
  const pairs = pickOnePerGroup(areaData.pairs || []).slice(0, 6);

  const view = gameFrame({ subj, area, title: "Memory", emoji: "🃏" });
  const body = view.querySelector("#game-body");
  app.replaceChildren(view);

  // Två kort per par: begreppet och förklaringen. Varje kort bär med paret och
  // vilken sida det är, så bilder kan renderas på mem-front (annars texten).
  const cards = shuffle(
    pairs.flatMap((p) => [
      { pair: p.id, p, side: "term" },
      { pair: p.id, p, side: "def" },
    ])
  );

  const wrap = el(`<div>
    <p class="hint center">Vänd två kort. Hittar du ett begrepp och rätt förklaring försvinner de! 🃏</p>
    <div class="memory-grid">
      ${cards
        .map(
          (c, idx) => `<button class="memory-card" data-idx="${idx}" data-pair="${c.pair}">
            <span class="mem-face mem-back">?</span>
            <span class="mem-face mem-front">${sideContent(c.p, c.side)}</span>
          </button>`
        )
        .join("")}
    </div>
  </div>`);
  body.replaceChildren(wrap);

  let flipped = []; // element[] max 2
  let matched = 0;
  let tries = 0;
  let busy = false;
  const total = pairs.length;

  wrap.querySelectorAll(".memory-card").forEach((card) => {
    card.addEventListener("click", () => onFlip(card));
  });

  function onFlip(card) {
    if (busy) return;
    if (card.classList.contains("matched") || card.classList.contains("open")) return;
    card.classList.add("open");
    sound.click();
    flipped.push(card);
    if (flipped.length < 2) return;

    tries++;
    busy = true;
    const [a, b] = flipped;
    if (a.dataset.pair === b.dataset.pair) {
      setTimeout(() => {
        a.classList.add("matched");
        b.classList.add("matched");
        flipped = [];
        matched++;
        busy = false;
        sound.correct();
        if (matched === total) finish();
      }, 350);
    } else {
      sound.wrong();
      setTimeout(() => {
        a.classList.remove("open");
        b.classList.remove("open");
        flipped = [];
        busy = false;
      }, 800);
    }
  }

  function finish() {
    // Färre försök = fler stjärnor. Perfekt = total försök.
    const stars = tries <= total ? 3 : tries <= total + 3 ? 2 : 1;
    const baseCoins = 2 * Math.max(5, 6 + Math.max(0, 10 - (tries - total)));
    setTimeout(() => {
      showResult({
        container: body,
        subj, area, mode: "memory",
        stars,
        scoreLine: `Klart på ${tries} försök.`,
        baseCoins,
        bestScore: Math.max(0, total * 3 - tries),
        replay: () => startMemory(ctx),
      });
    }, 400);
  }
}
