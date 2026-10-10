// ============================================================================
// Snilleblixten – TV-studion (#559): FINALEN (designspec §5.7). Pallplatsen
// spelas EXAKT en gång per fönster (regins final, live-events.js sparar det i
// sessionStorage – en omladdning visar bara resultatet), ~8–9 s:
//   ljuset dämpas + strålkastarna mot pallen → trumvirvel → 3:an kliver upp →
//   trumvirvel → 2:an → längre trumvirvel → 1:an med stor blixt, konfetti och
//   fanfar → vinnaren jublar, de andra (pallen + publiken) klappar/vinkar →
//   resultatskärmen. Totalt ~8–9 s med tre pallsteg.
// Pallen (topp 3) är projektorns ENDA namnlista (Elias 2026-10-10): resultat-
// skärmen är pallen kvar + en anonym klassrad ("Hela klassen: 62 % rätt
// svar") – aldrig hela klassens topplista (den finns i lärarens historik).
// Delad placering = samma pallsteg (podiumGroups). Pluggmyntpriset för
// placeringen visas under varje steg (sessionens rewards, #557). Figurerna
// är avatarpoolens egna element (plats "pall") – kläderna följer med.
// Reducerad rörelse: samma ordning, men toningar i stället för hopp och
// ingen konfetti.
//
// API
//   createFinal(host, { pool, sound, flashHost }) → {
//     play(data, signal) → Promise     hela sekvensen, sedan resultatet
//     showResult(data)                 direkt till resultatskärmen
//     el, destroy()
//   }
//   data = { groups: podiumGroups(ranking) (bara topp 3), prize(rank) → mynt|0,
//            title, sub (anonym klassrad), cheer(uids) }
// ============================================================================

import { esc } from "../../../teacher-shared.js";
import { react, prefersReducedMotion } from "../../design/live-reactions.js";
import { flash } from "./sb-miljo.js";

const tal = (n) => (Number(n) || 0).toLocaleString("sv-SE");
const MEDALJ = { 1: "🥇", 2: "🥈", 3: "🥉" };
const KONFETTI = 42;
const FARGER = ["#ff5a5f", "#3d8bff", "#ffd23f", "#34c26b", "#ffffff", "#c58cff"];

function wait(ms, signal) {
  return new Promise((r) => {
    if (signal?.aborted) return r();
    const t = setTimeout(r, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); r(); }, { once: true });
  });
}

export function createFinal(host, { pool, sound, flashHost }) {
  const root = document.createElement("div");
  root.className = "sbf";
  root.hidden = true;
  root.innerHTML = `<div class="sbf-dim" aria-hidden="true"></div><span class="sbf-kagla" aria-hidden="true"></span>
    <h2 class="sbf-rubrik"></h2><div class="sbf-pall"></div><p class="sbf-sub" hidden></p><div class="sbf-konfetti" aria-hidden="true"></div>`;
  host.appendChild(root);
  const pall = root.querySelector(".sbf-pall");
  const sub = root.querySelector(".sbf-sub");

  // Pallen: mitten = bästa gruppen, vänster = näst bästa, höger = tredje.
  function build(data) {
    const g = data.groups || [];
    const slots = [g[1], g[0], g[2]];
    pall.innerHTML = "";
    slots.forEach((grp, col) => {
      const steg = document.createElement("div");
      steg.className = `sbf-steg sbf-steg-${["vanster", "mitten", "hoger"][col]}`;
      if (!grp) { steg.classList.add("sbf-tom"); pall.appendChild(steg); return; }
      steg.dataset.rank = grp.rank;
      steg.style.setProperty("--n", grp.players.length);
      const prize = data.prize?.(grp.rank) || 0;
      steg.innerHTML = `<div class="sbf-figurer"></div>
        <div class="sbf-namn">${grp.players.map((p) => esc(p.name || "?")).join(" & ")}</div>
        <div class="sbf-poang">${tal(grp.players[0].points)} poäng</div>
        ${prize ? `<div class="sbf-pris">🪙 +${tal(prize)} pluggmynt</div>` : ""}
        <div class="sbf-block"><span>${MEDALJ[grp.rank] || grp.rank}</span><b>${grp.rank}</b></div>`;
      const fig = steg.querySelector(".sbf-figurer");
      for (const p of grp.players) {
        const av = pool.el(p.uid, "pall");
        av.classList.add("lav-stor");
        fig.appendChild(av);
      }
      pall.appendChild(steg);
    });
    root.querySelector(".sbf-rubrik").textContent = data.title || "";
  }

  function stegFor(rank) {
    return pall.querySelector(`.sbf-steg[data-rank="${rank}"]`);
  }

  async function stepUp(steg, signal, { winner = false } = {}) {
    if (!steg || signal?.aborted) return;
    steg.classList.add("sbf-uppe");
    const figs = [...steg.querySelectorAll(".lav")];
    await Promise.all(figs.map((el) => react(el, winner ? "jubel" : "ankomst", { signal, big: winner })));
  }

  function confetti() {
    if (prefersReducedMotion()) return;
    const box = root.querySelector(".sbf-konfetti");
    box.innerHTML = "";
    for (let i = 0; i < KONFETTI; i++) {
      const p = document.createElement("i");
      const x = (i / KONFETTI) * 100 + ((i * 37) % 7) - 3;
      p.style.left = `${x}%`;
      p.style.background = FARGER[i % FARGER.length];
      box.appendChild(p);
      const drift = ((i * 53) % 21) - 10;
      p.animate([
        { transform: "translate(0, -10vh) rotate(0)", opacity: 1 },
        { transform: `translate(${drift}vw, 105vh) rotate(${(i % 2 ? 1 : -1) * (360 + i * 25)}deg)`, opacity: 0.9 },
      ], { duration: 2600 + (i % 9) * 260, delay: (i % 12) * 70, easing: "cubic-bezier(.3,.1,.6,1)", fill: "backwards" })
        .finished.catch(() => {}).finally(() => p.remove());
    }
  }

  function showResult(data) {
    root.hidden = false;
    if (!pall.childElementCount) build(data);
    pall.querySelectorAll(".sbf-steg").forEach((s) => s.classList.add("sbf-uppe"));
    root.classList.add("sbf-pa", "sbf-resultat");
    sub.textContent = data.sub || "";
    sub.hidden = !data.sub;
  }

  async function play(data, signal) {
    build(data);
    root.hidden = false;
    // Ljuset dämpas, strålkastarna vänds mot pallen.
    root.getBoundingClientRect();
    root.classList.add("sbf-pa");
    await wait(600, signal);
    const g = data.groups || [];
    const order = [g[2], g[1], g[0]].filter(Boolean);
    for (let i = 0; i < order.length; i++) {
      if (signal?.aborted) break;
      const winner = i === order.length - 1 && order[i] === g[0];
      sound?.cue?.("trumvirvel");
      await wait(winner ? 1400 : 1000, signal);
      if (winner) {
        if (flashHost) flash(flashHost, { strong: true });
        sound?.cue?.("fanfar");
        confetti();
        root.classList.add("sbf-vinnare");
      }
      await stepUp(stegFor(order[i].rank), signal, { winner });
      if (winner) {
        // De andra på pallen och publiken klappar/vinkar.
        for (const grp of g.slice(1)) for (const p of grp.players) react(pool.el(p.uid, "pall"), "glad", { signal });
        data.cheer?.(g[0].players.map((p) => p.uid));
      }
      await wait(winner ? 1000 : 350, signal);
    }
    if (!order.length) await wait(600, signal);
    showResult(data);
  }

  return {
    el: root,
    play,
    showResult,
    destroy() { root.remove(); },
  };
}
