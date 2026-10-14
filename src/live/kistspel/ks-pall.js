// ============================================================================
// Kistspel 🎁 – projektorns PALLPLATS (#651, utbruten ur Guldrushens gr-pall.js
// #565/#578/#592). Spelas EXAKT en gång per fönster (regins final), ~10 s:
// temats öppningsljud → scenen mörknar, ljuset mot en pall av temats
// byggstenar → trumvirvel → 3:an → trumvirvel → 2:an → längre trumvirvel →
// 1:an med regn, konfetti och fanfar → den lugna totalraden med alla
// elevernas avatarer som jublar → resultatskärmen (står kvar). Inga
// klassnamn någonstans (#592).
// Pallen visar topp 3 med namn och avatarer. Delad placering = samma
// pallsteg (podiumGroups). Färre än tre steg → bara de som finns byggs, så
// pallen står centrerad utan tomma platser. Pluggmyntpriset för placeringen
// under varje steg. Reducerad rörelse: samma ordning, toningar, inget regn.
//
// API
//   createFinal(host, {
//     pool, sound,
//     cls,            CSS-prefix ("grp" → .grp, .grp-steg, --grp-folk-n …)
//     piece,          pallens byggsten (SVG, upprepas 2–3 per rad)
//     amountHtml(n),  stegets saldorad (betrodd HTML: "💰 120 guld")
//     colors,         konfettins färger
//     cues,           { open, drum, win, rain } – ljudköns namn
//   }) → {
//     play(data, signal) → Promise     hela sekvensen, sedan resultatet
//     showResult(data)                 direkt till resultatskärmen
//     el, destroy()
//   }
//   data = { groups, prize(rank) → mynt|0, title, together (betrodd HTML),
//            everyone: [uid] }
// ============================================================================

import { esc } from "../../teacher-shared.js";
import { coinIcon } from "../../icons.js";
import { react, prefersReducedMotion } from "../design/live-reactions.js";
import { tal } from "./ks-proj-scen.js";

const MEDALJ = { 1: "🥇", 2: "🥈", 3: "🥉" };
const MYNT = 26;
const KONFETTI = 30;

function wait(ms, signal) {
  return new Promise((r) => {
    if (signal?.aborted) return r();
    const t = setTimeout(r, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); r(); }, { once: true });
  });
}

export function createFinal(host, { pool, sound, cls, piece, amountHtml, colors, cues }) {
  const c = cls;
  const root = document.createElement("div");
  root.className = c;
  root.hidden = true;
  root.innerHTML = `<div class="${c}-mork" aria-hidden="true"></div><span class="${c}-ljus" aria-hidden="true"></span>
    <h2 class="${c}-rubrik"></h2><div class="${c}-pall"></div>
    <p class="${c}-tillsammans" hidden></p><div class="${c}-folk" aria-hidden="true"></div>
    <div class="${c}-regn" aria-hidden="true"></div>`;
  host.appendChild(root);
  const pall = root.querySelector(`.${c}-pall`);
  const tills = root.querySelector(`.${c}-tillsammans`);
  const folk = root.querySelector(`.${c}-folk`);

  // Pallen efter PLACERING: 2:an vänster, 1:an mitten, 3:an höger (delad 1:a
  // + en 3:a → 3:an står till höger). Saknade steg byggs inte alls –
  // flexraden centrerar det som finns (#592).
  function build(data) {
    const g = data.groups || [];
    pall.innerHTML = "";
    [2, 1, 3].map((rank) => g.find((x) => x.rank === rank)).forEach((grp, col) => {
      if (!grp) return;
      const steg = document.createElement("div");
      steg.className = `${c}-steg ${c}-steg-${["vanster", "mitten", "hoger"][col]}`;
      steg.dataset.rank = grp.rank;
      steg.style.setProperty("--n", grp.players.length);
      const prize = data.prize?.(grp.rank) || 0;
      const rader = grp.rank === 1 ? 4 : grp.rank === 2 ? 3 : 2;
      steg.innerHTML = `<div class="${c}-figurer"></div>
        <div class="${c}-namn">${grp.players.map((p) => esc(p.name || "?")).join(" & ")}</div>
        <div class="${c}-guld">${amountHtml(grp.players[0].gold)}</div>
        ${prize ? `<div class="${c}-pris">${coinIcon("1em")} +${tal(prize)} pluggmynt</div>` : ""}
        <div class="${c}-block"><span class="${c}-medalj">${MEDALJ[grp.rank] || grp.rank}</span>
          <div class="${c}-tackor">${Array.from({ length: rader }, (_, r) => `<div class="${c}-tackrad">${piece.repeat(r % 2 ? 2 : 3)}</div>`).join("")}</div></div>`;
      const fig = steg.querySelector(`.${c}-figurer`);
      for (const p of grp.players) fig.appendChild(pool.el(p.uid, "pall"));
      pall.appendChild(steg);
    });
    root.querySelector(`.${c}-rubrik`).textContent = data.title || "";
    tills.innerHTML = data.together || "";
    // Alla elever jublar längst ned: en rad upp till 14, sedan två
    // (högst tre) rader med större figurer i stället för en lång smal rad.
    const all = data.everyone || [];
    const n = Math.max(1, all.length);
    folk.style.setProperty(`--${c}-folk-n`, n);
    const rader = Math.min(3, Math.ceil(n / 14));
    folk.style.setProperty(`--${c}-folk-rader`, rader);
    folk.style.setProperty(`--${c}-folk-per-rad`, Math.ceil(n / rader));
    if (folk.dataset.k !== all.join(",")) {
      folk.dataset.k = all.join(",");
      folk.replaceChildren(...all.map((u) => pool.el(u, "jubel")));
    }
  }

  const stegFor = (rank) => pall.querySelector(`.${c}-steg[data-rank="${rank}"]`);

  async function stepUp(steg, signal, { winner = false } = {}) {
    if (!steg || signal?.aborted) return;
    steg.classList.add(`${c}-uppe`);
    const figs = [...steg.querySelectorAll(".lav")];
    await Promise.all(figs.map((el) => react(el, winner ? "jubel" : "ankomst", { signal, big: winner })));
  }

  // Regn (mynt-klassen) + konfetti över vinnaren (begränsat antal, §11).
  function regn() {
    if (prefersReducedMotion()) return;
    const box = root.querySelector(`.${c}-regn`);
    box.innerHTML = "";
    const n = MYNT + KONFETTI;
    for (let i = 0; i < n; i++) {
      const coin = i < MYNT;
      const p = document.createElement("i");
      p.className = coin ? `${c}-mynt` : `${c}-konf`;
      const spread = coin ? 34 : 90;
      p.style.left = `${50 - spread / 2 + ((i * 37) % 100) / 100 * spread}%`;
      if (!coin) p.style.background = colors[i % colors.length];
      box.appendChild(p);
      const drift = ((i * 53) % 21) - 10;
      p.animate([
        { transform: "translate(0, -12vh) rotate(0)", opacity: 1 },
        { transform: `translate(${coin ? drift / 3 : drift}vw, 108vh) rotate(${(i % 2 ? 1 : -1) * (coin ? 540 : 360 + i * 20)}deg)`, opacity: 0.95 },
      ], { duration: (coin ? 1700 : 2600) + (i % 9) * 220, delay: (i % 13) * 80, easing: "cubic-bezier(.4,.05,.7,1)", fill: "backwards" })
        .finished.catch(() => {}).finally(() => p.remove());
    }
  }

  function cheerAll(signal) {
    [...folk.children].forEach((el, i) => setTimeout(() => !signal?.aborted && react(el, "jubel", { signal }), (i % 10) * 60));
  }

  function showResult(data) {
    root.hidden = false;
    build(data);
    pall.querySelectorAll(`.${c}-steg`).forEach((s) => s.classList.add(`${c}-uppe`));
    root.classList.add(`${c}-pa`, `${c}-resultat`, `${c}-slut`);
    tills.hidden = !data.together;
  }

  async function play(data, signal) {
    build(data);
    root.hidden = false;
    sound?.cue?.(cues.open);
    root.getBoundingClientRect();
    root.classList.add(`${c}-pa`); // scenen mörknar, ljuset mot pallen
    await wait(1100, signal);
    const g = data.groups || [];
    const order = [g[2], g[1], g[0]].filter(Boolean);
    for (let i = 0; i < order.length; i++) {
      if (signal?.aborted) break;
      const winner = i === order.length - 1 && order[i] === g[0];
      sound?.cue?.(cues.drum);
      await wait(winner ? 1400 : 1000, signal);
      if (winner) {
        sound?.cue?.(cues.win);
        setTimeout(() => !signal?.aborted && sound?.cue?.(cues.rain), 250);
        regn();
        root.classList.add(`${c}-vinnare`);
      }
      await stepUp(stegFor(order[i].rank), signal, { winner });
      if (winner) for (const grp of g.slice(1)) for (const p of grp.players) react(pool.el(p.uid, "pall"), "glad", { signal });
      await wait(winner ? 900 : 350, signal);
    }
    if (!order.length) await wait(600, signal);
    if (signal?.aborted) return showResult(data);
    // Klassens gemensamma saldo + alla jublar.
    tills.hidden = !data.together;
    root.classList.add(`${c}-slut`);
    cheerAll(signal);
    await wait(1600, signal);
    showResult(data);
  }

  return {
    el: root,
    play,
    showResult,
    destroy() { root.remove(); },
  };
}
