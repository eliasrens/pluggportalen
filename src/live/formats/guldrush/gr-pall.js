// ============================================================================
// Guldrushen – Skattkammaren (#565): PALLPLATSEN (designspec §6.7). Spelas
// EXAKT en gång per fönster (regins final, live-events.js sparar det i
// sessionStorage – en omladdning visar bara resultatet), ~10 s:
//   tungt grottljud → grottan mörknar, facklorna lyser upp en pall av
//   guldtackor → trumvirvel → 3:an → trumvirvel → 2:an → längre trumvirvel →
//   1:an med guldmyntsregn, konfetti och fanfar → vinnaren jublar → "Tillsammans
//   samlade 4B 4 380 guld!" med alla elevernas avatarer som jublar →
//   resultatskärmen (står kvar).
// Pallen (topp 3) är projektorns enda namnlista (Elias 2026-10-10). Delad
// placering = samma pallsteg (podiumGroups). Pluggmyntpriset för placeringen
// under varje steg (sessionens rewards, #557). Figurerna är avatarpoolens
// egna element (plats "pall"/"jubel") – kläderna följer med. Reducerad rörelse:
// samma ordning, toningar i stället för hopp, inget regn/konfetti.
//
// API
//   createFinal(host, { pool, sound }) → {
//     play(data, signal) → Promise     hela sekvensen, sedan resultatet
//     showResult(data)                 direkt till resultatskärmen
//     el, destroy()
//   }
//   data = { groups, prize(rank) → mynt|0, title, together, everyone: [uid] }
// ============================================================================

import { esc } from "../../../teacher-shared.js";
import { react, prefersReducedMotion } from "../../design/live-reactions.js";
import { tal } from "./gr-proj-scen.js";

const MEDALJ = { 1: "🥇", 2: "🥈", 3: "🥉" };
const MYNT = 26;
const KONFETTI = 30;
const FARGER = ["#ffcf3a", "#ff8a1f", "#86d8e8", "#e88fa8", "#fff1c6", "#c58cff"];

function wait(ms, signal) {
  return new Promise((r) => {
    if (signal?.aborted) return r();
    const t = setTimeout(r, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); r(); }, { once: true });
  });
}

// En guldtacka (pallens byggsten).
const TACKA = `<svg viewBox="0 0 60 26" aria-hidden="true" focusable="false"><path d="M8 2 H52 L59 24 H1Z" fill="#ffc928" stroke="#a86f00" stroke-width="2.5" stroke-linejoin="round"/><path d="M10 6 H50" stroke="#fff3b0" stroke-width="3" stroke-linecap="round" opacity=".8"/></svg>`;

export function createFinal(host, { pool, sound }) {
  const root = document.createElement("div");
  root.className = "grp";
  root.hidden = true;
  root.innerHTML = `<div class="grp-mork" aria-hidden="true"></div><span class="grp-ljus" aria-hidden="true"></span>
    <h2 class="grp-rubrik"></h2><div class="grp-pall"></div>
    <p class="grp-tillsammans" hidden></p><div class="grp-folk" aria-hidden="true"></div>
    <div class="grp-regn" aria-hidden="true"></div>`;
  host.appendChild(root);
  const pall = root.querySelector(".grp-pall");
  const tills = root.querySelector(".grp-tillsammans");
  const folk = root.querySelector(".grp-folk");

  // Pallen: mitten = bästa gruppen, vänster = näst bästa, höger = tredje.
  function build(data) {
    const g = data.groups || [];
    pall.innerHTML = "";
    [g[1], g[0], g[2]].forEach((grp, col) => {
      const steg = document.createElement("div");
      steg.className = `grp-steg grp-steg-${["vanster", "mitten", "hoger"][col]}`;
      if (!grp) { steg.classList.add("grp-tom"); pall.appendChild(steg); return; }
      steg.dataset.rank = grp.rank;
      steg.style.setProperty("--n", grp.players.length);
      const prize = data.prize?.(grp.rank) || 0;
      const rader = grp.rank === 1 ? 4 : grp.rank === 2 ? 3 : 2;
      steg.innerHTML = `<div class="grp-figurer"></div>
        <div class="grp-namn">${grp.players.map((p) => esc(p.name || "?")).join(" & ")}</div>
        <div class="grp-guld">💰 ${tal(grp.players[0].gold)} guld</div>
        ${prize ? `<div class="grp-pris">🪙 +${tal(prize)} pluggmynt</div>` : ""}
        <div class="grp-block"><span class="grp-medalj">${MEDALJ[grp.rank] || grp.rank}</span>
          <div class="grp-tackor">${Array.from({ length: rader }, (_, r) => `<div class="grp-tackrad">${TACKA.repeat(r % 2 ? 2 : 3)}</div>`).join("")}</div></div>`;
      const fig = steg.querySelector(".grp-figurer");
      for (const p of grp.players) fig.appendChild(pool.el(p.uid, "pall"));
      pall.appendChild(steg);
    });
    root.querySelector(".grp-rubrik").textContent = data.title || "";
    tills.textContent = data.together || "";
    // Alla skattjägare jublar längst ned (en rad, krymper med antalet).
    const all = data.everyone || [];
    folk.style.setProperty("--grp-folk-n", Math.max(1, all.length));
    if (folk.dataset.k !== all.join(",")) {
      folk.dataset.k = all.join(",");
      folk.replaceChildren(...all.map((u) => pool.el(u, "jubel")));
    }
  }

  const stegFor = (rank) => pall.querySelector(`.grp-steg[data-rank="${rank}"]`);

  async function stepUp(steg, signal, { winner = false } = {}) {
    if (!steg || signal?.aborted) return;
    steg.classList.add("grp-uppe");
    const figs = [...steg.querySelectorAll(".lav")];
    await Promise.all(figs.map((el) => react(el, winner ? "jubel" : "ankomst", { signal, big: winner })));
  }

  // Guldmyntsregn + konfetti över vinnaren (begränsat antal, §11).
  function regn() {
    if (prefersReducedMotion()) return;
    const box = root.querySelector(".grp-regn");
    box.innerHTML = "";
    const n = MYNT + KONFETTI;
    for (let i = 0; i < n; i++) {
      const coin = i < MYNT;
      const p = document.createElement("i");
      p.className = coin ? "grp-mynt" : "grp-konf";
      const spread = coin ? 34 : 90;
      p.style.left = `${50 - spread / 2 + ((i * 37) % 100) / 100 * spread}%`;
      if (!coin) p.style.background = FARGER[i % FARGER.length];
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
    pall.querySelectorAll(".grp-steg").forEach((s) => s.classList.add("grp-uppe"));
    root.classList.add("grp-pa", "grp-resultat", "grp-slut");
    tills.hidden = !data.together;
  }

  async function play(data, signal) {
    build(data);
    root.hidden = false;
    sound?.cue?.("grotta");
    root.getBoundingClientRect();
    root.classList.add("grp-pa"); // grottan mörknar, facklorna mot pallen
    await wait(1100, signal);
    const g = data.groups || [];
    const order = [g[2], g[1], g[0]].filter(Boolean);
    for (let i = 0; i < order.length; i++) {
      if (signal?.aborted) break;
      const winner = i === order.length - 1 && order[i] === g[0];
      sound?.cue?.("trumvirvel");
      await wait(winner ? 1400 : 1000, signal);
      if (winner) {
        sound?.cue?.("fanfar");
        setTimeout(() => !signal?.aborted && sound?.cue?.("guldregn"), 250);
        regn();
        root.classList.add("grp-vinnare");
      }
      await stepUp(stegFor(order[i].rank), signal, { winner });
      if (winner) for (const grp of g.slice(1)) for (const p of grp.players) react(pool.el(p.uid, "pall"), "glad", { signal });
      await wait(winner ? 900 : 350, signal);
    }
    if (!order.length) await wait(600, signal);
    if (signal?.aborted) return showResult(data);
    // Klassens gemensamma guld + alla jublar.
    tills.hidden = !data.together;
    root.classList.add("grp-slut");
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
