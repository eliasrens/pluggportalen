// ============================================================================
// Guldrushen (#564): VÄLJ EN KLASSKAMRAT efter en Stöld- eller Byte-kista
// (funktionsspec §6.4, designspec §6.5).
//   • klasskamraterna som stora avatarknappar med namn + guld, sorterade på
//     guld (gr-elev.js victimRows); byte visar bara de med MER guld
//   • sköld / stöldskydd → gråad med 🛡️, går inte att välja (servern nekar
//     ändå ett manipulerat val – det här är bara visningen)
//   • synlig nedräkning (~10 s, serverns expiresAt) → servern slumpar
//     (choose(null)); valet ligger kvar vid omladdning (grPlayers.pending)
//   • vid val springer tvättbjörnen över skärmen med guldpåsen (byte: guld-
//     pilarna snurrar), guldet räknas upp av vyn (onResult)
//   • 30 elever ryms utan scroll på 1366×768 (rutnätet krymper avatarerna)
// Tangentbord: Tab/pilar mellan knapparna, ENTER väljer.
// Stilar: guldrush-elev.css (gro-*).
//
// API
//   pickVictim(host, { kind, me, players, pending, now, pool, roster, choose,
//                      onResult?, stage?, reduced? }) → { done, update(me, players), destroy() }
//     choose(uid | null) → Promise<chooseVictim-svar>  (null = "slumpa åt mig")
//     onResult(view)  när servern svarat (vyn räknar upp guldet, reagerar)
//     stage           elementet tvättbjörnen springer över (default host)
//     done → Promise<view> (victimView) när animationen är klar
// ============================================================================

import { victimRows, victimView, pendingLeftMs, formatGold } from "./gr-elev.js";
import { svgOf } from "./gr-kistfx.js";
import { GR_RULES } from "./delat/chests-config.js";

const TEXT = {
  steal: { rubrik: "🦝 Vem ska tvättbjörnen knycka guld från?", tom: "Ingen har tillräckligt med guld att knycka just nu." },
  swap: { rubrik: "🔄 Vem vill du byta guld med?", tom: "Ingen har mer guld än du just nu." },
};

export function pickVictim(host, opts) {
  const { kind, now, pool, roster, choose, onResult = () => {}, reduced = false } = opts;
  const stage = opts.stage || host;
  const t = TEXT[kind] || TEXT.steal;
  host.innerHTML = `<div class="gro" data-kind="${kind}">
      <div class="gro-topp"><h2 class="gro-rubrik">${t.rubrik}</h2>
        <div class="gro-klocka" aria-live="off"><span class="gro-sek">10</span><small>s</small></div></div>
      <div class="gro-tid" aria-hidden="true"><i></i></div>
      <p class="gro-hint">Väljer du inte slumpas en klasskamrat.</p>
      <div class="gro-rutnat" role="group" aria-label="Klasskamrater"></div>
      <p class="gro-tom hint" hidden>${t.tom} Vänta – det slumpas strax.</p>
      <p class="gro-fel" role="alert" hidden></p>
    </div>`;
  const root = host.firstElementChild;
  const grid = root.querySelector(".gro-rutnat");
  const sek = root.querySelector(".gro-sek");
  const bar = root.querySelector(".gro-tid i");
  const fel = root.querySelector(".gro-fel");
  const btns = new Map(); // uid → knapp (återanvänds, avataren ritas en gång)
  let me = opts.me;
  let players = opts.players || [];
  let pending = opts.pending;
  let busy = false;
  let destroyed = false;
  let autoSent = false;
  let names = {};
  let resolveDone;
  const done = new Promise((r) => { resolveDone = r; });

  function button(row) {
    let b = btns.get(row.uid);
    if (!b) {
      b = document.createElement("button");
      b.type = "button";
      b.className = "gro-kamrat";
      b.dataset.uid = row.uid;
      b.innerHTML = `<span class="gro-av"></span><span class="gro-namn"></span><span class="gro-guld"></span><span class="gro-why"></span>`;
      b.querySelector(".gro-av").appendChild(pool.el(row.uid, "offer"));
      b.addEventListener("click", () => pick(row.uid));
      btns.set(row.uid, b);
    }
    b.querySelector(".gro-namn").textContent = row.first || row.name || "?";
    b.querySelector(".gro-guld").textContent = `💰 ${formatGold(row.gold)}`;
    b.querySelector(".gro-why").textContent = row.why;
    b.classList.toggle("gro-av-gra", !row.ok);
    b.classList.toggle("gro-skyddad", row.shield);
    b.disabled = busy || !row.ok;
    b.setAttribute("aria-label", `${row.name || row.first}, ${formatGold(row.gold)} guld${row.ok ? "" : ` – ${row.why}`}`);
    return b;
  }

  function draw() {
    const rows = victimRows(kind, me, players, now());
    names = Object.fromEntries(rows.map((r) => [r.uid, r.first || r.name]));
    roster?.ensure(rows.map((r) => ({ uid: r.uid, classId: r.classId }))).catch(() => {});
    root.dataset.many = rows.length > 24 ? "3" : rows.length > 15 ? "2" : rows.length > 8 ? "1" : "0";
    const keep = new Set(rows.map((r) => r.uid));
    for (const [uid, b] of btns) if (!keep.has(uid)) { b.remove(); btns.delete(uid); }
    rows.forEach((r, i) => {
      const b = button(r);
      if (grid.children[i] !== b) grid.insertBefore(b, grid.children[i] || null);
    });
    root.querySelector(".gro-tom").hidden = rows.some((r) => r.ok);
  }

  function focusFirst() {
    const b = [...btns.values()].find((x) => !x.disabled);
    try { b?.focus({ preventScroll: true }); } catch { b?.focus(); }
  }

  async function pick(uid) {
    if (busy || destroyed) return;
    busy = true;
    fel.hidden = true;
    for (const [u, b] of btns) { b.disabled = true; b.classList.toggle("vald", u === uid); }
    let res;
    try {
      res = await choose(uid);
    } catch (err) {
      if (destroyed) return;
      busy = false;
      fel.textContent = `😕 ${err?.message || "Det gick inte – välj någon annan."}`;
      fel.hidden = false;
      for (const b of btns.values()) b.classList.remove("vald");
      draw();
      focusFirst();
      // Nekad efter nedräkningen → låt servern slumpa.
      if (uid && pendingLeftMs(pending, now()) <= 0) setTimeout(() => { autoSent = false; tick(); }, 300);
      return;
    }
    if (destroyed) return;
    const view = victimView(res, names);
    root.classList.add("gro-klar");
    root.querySelector(".gro-hint").textContent = view.caption;
    try { onResult(view); } catch (e) { console.warn("Guldrushen: onResult", e); }
    await runAcross(view);
    if (!destroyed) resolveDone(view);
  }

  function runAcross(view) {
    if (!view.run || typeof stage.animate !== "function") return new Promise((r) => setTimeout(r, 700));
    const el = document.createElement("span");
    el.className = `gro-spring ${kind === "swap" ? "gro-spring-byte" : ""}`;
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = kind === "swap" ? svgOf("pilar") : `${svgOf("tvattbjorn")}<span class="gro-pase">💰</span>`;
    stage.appendChild(el);
    const w = stage.getBoundingClientRect?.().width || 800;
    const frames = reduced
      ? [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }]
      : kind === "swap"
        ? [{ transform: "translateX(-50%) scale(.3) rotate(0)", opacity: 0 }, { offset: 0.25, transform: "translateX(-50%) scale(1.1) rotate(180deg)", opacity: 1 },
          { offset: 0.8, transform: "translateX(-50%) scale(1) rotate(600deg)", opacity: 1 }, { transform: "translateX(-50%) scale(.5) rotate(720deg)", opacity: 0 }]
        : Array.from({ length: 9 }, (_, i) => ({
          transform: `translate(${-160 + (w + 320) * (i / 8)}px, ${i % 2 ? -14 : 0}px) rotate(${i % 2 ? 4 : -4}deg)`,
          opacity: i === 0 || i === 8 ? 0.6 : 1,
        }));
    const a = el.animate(frames, { duration: reduced ? 700 : 850, easing: "linear" });
    return a.finished.catch(() => {}).then(() => el.remove());
  }

  // Nedräkningen: serverns expiresAt (serverkorrigerad klocka).
  const total = GR_RULES.victimPickMs;
  let iv = 0;
  function tick() {
    if (destroyed) return;
    const left = pendingLeftMs(pending, now());
    sek.textContent = String(Math.ceil(left / 1000));
    bar.style.transform = `scaleX(${Math.min(1, left / total).toFixed(3)})`;
    root.classList.toggle("gro-brattom", left <= 3000);
    if (left <= 0 && !busy && !autoSent) {
      autoSent = true;
      pick(null);
    }
  }
  draw();
  tick();
  iv = setInterval(tick, 200);
  setTimeout(() => { if (!destroyed && !busy) focusFirst(); }, 0);

  function onKey(e) {
    if (busy || destroyed || !["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) return;
    const list = [...grid.children].filter((b) => !b.disabled);
    if (!list.length) return;
    e.preventDefault();
    const cur = list.indexOf(document.activeElement);
    const cols = Math.max(1, Math.round(grid.clientWidth / (list[0].offsetWidth || 1)));
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
    const next = list[Math.min(list.length - 1, Math.max(0, (cur < 0 ? 0 : cur + step)))];
    try { next.focus({ preventScroll: true }); } catch { next.focus(); }
  }
  document.addEventListener("keydown", onKey);

  return {
    done,
    update(nextMe, nextPlayers) {
      if (nextMe) {
        me = nextMe;
        if (nextMe.pending) pending = nextMe.pending;
      }
      if (nextPlayers) players = nextPlayers;
      if (!busy && !destroyed) draw();
    },
    destroy() {
      destroyed = true;
      clearInterval(iv);
      document.removeEventListener("keydown", onKey);
      for (const uid of btns.keys()) pool.drop(uid, "offer");
      host.innerHTML = "";
    },
  };
}
