// ============================================================================
// Kistspel 🎁 – elevens OFFERVÄLJARE efter en offer-kista (stöld/byte) (#651,
// utbruten ur Guldrushens gr-offer.js #564/#588).
//   • klasskamraterna som stora avatarknappar med namn + saldo, sorterade på
//     saldo (temats victimRows); byte visar bara de med MER
//   • skyddad → gråad med "🛡️ 0:04"; listan är LEVANDE (ritas om varje tick)
//     och kompisen blir valbar när nedräkningen når noll. Väljartimern pausas
//     aldrig. Servern prövar skyddet i valets ögonblick – ett nekat val visar
//     serverns text och eleven väljer om på tiden som är kvar
//   • synlig nedräkning (rules.victimPickMs, serverns expiresAt) → servern
//     slumpar (choose(null)); valet ligger kvar vid omladdning (pending)
//   • vid val springer temats figur (runnerHtml) över skärmen, saldot räknas
//     upp av vyn (onResult)
//   • 30 elever ryms utan scroll på 1366×768 (rutnätet krymper avatarerna)
// Tangentbord: Tab/pilar mellan knapparna, ENTER väljer.
//
// API
//   pickVictim(host, { kind, me, players, pending, now, pool, roster, choose,
//                      onResult?, stage?, reduced?, theme }) → { done, update(me, players), destroy() }
//     choose(uid | null) → Promise<chooseVictim-svar>  (null = "slumpa åt mig")
//     onResult(view)  när servern svarat (vyn räknar upp saldot, reagerar)
//     stage           elementet figuren springer över (default host)
//     done → Promise<view> (victimView) när animationen är klar
//     theme = {
//       cls,           CSS-prefix ("gro" → .gro, .gro-kamrat, .gro-spring …)
//       elev,          { victimRows, victimView, pendingLeftMs } (createKistElev)
//       rules,         { victimPickMs }
//       texts,         { steal: { rubrik, tom }, swap: { rubrik, tom },
//                        amount(belopp), ariaAmount(belopp) }
//       runnerHtml(kind)  figuren som springer över skärmen (byte: snurrar)
//       warn?          konsolens prefix ("Guldrushen")
//     }
// ============================================================================

import { formatGold } from "./ks-elev.js";

export function pickVictim(host, opts) {
  const { kind, now, pool, roster, choose, onResult = () => {}, reduced = false } = opts;
  const { cls: c, elev, rules, texts: T, runnerHtml, warn = "Kistspel" } = opts.theme;
  const { victimRows, victimView, pendingLeftMs } = elev;
  const stage = opts.stage || host;
  const t = T[kind] || T.steal;
  host.innerHTML = `<div class="${c}" data-kind="${kind}">
      <div class="${c}-topp"><h2 class="${c}-rubrik">${t.rubrik}</h2>
        <div class="${c}-klocka" aria-live="off"><span class="${c}-sek">10</span><small>s</small></div></div>
      <div class="${c}-tid" aria-hidden="true"><i></i></div>
      <p class="${c}-hint">Väljer du inte slumpas en klasskamrat.</p>
      <div class="${c}-rutnat" role="group" aria-label="Klasskamrater"></div>
      <p class="${c}-tom hint" hidden>${t.tom} Vänta – det slumpas strax.</p>
      <p class="${c}-fel" role="alert" hidden></p>
    </div>`;
  const root = host.firstElementChild;
  const grid = root.querySelector(`.${c}-rutnat`);
  const sek = root.querySelector(`.${c}-sek`);
  const bar = root.querySelector(`.${c}-tid i`);
  const fel = root.querySelector(`.${c}-fel`);
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
      b.className = `${c}-kamrat`;
      b.dataset.uid = row.uid;
      b.innerHTML = `<span class="${c}-av"></span><span class="${c}-namn"></span><span class="${c}-guld"></span><span class="${c}-why"></span>`;
      b.querySelector(`.${c}-av`).appendChild(pool.el(row.uid, "offer"));
      b.addEventListener("click", () => pick(row.uid));
      btns.set(row.uid, b);
    }
    // Ritas om varje tick (skyddens nedräkning) – skriv bara det som ändrats.
    const set = (q, text) => { const el = b.querySelector(q); if (el.textContent !== text) el.textContent = text; };
    set(`.${c}-namn`, row.first || row.name || "?");
    set(`.${c}-guld`, T.amount(formatGold(row.gold)));
    set(`.${c}-why`, row.why);
    b.classList.toggle(`${c}-av-gra`, !row.ok);
    b.classList.toggle(`${c}-skyddad`, row.shield);
    b.disabled = busy || !row.ok;
    b.setAttribute("aria-label", `${row.name || row.first}, ${T.ariaAmount(formatGold(row.gold))}${row.ok ? "" : ` – ${row.why}`}`);
    return b;
  }

  let rosterKey = "";
  function draw() {
    const rows = victimRows(kind, me, players, now());
    names = Object.fromEntries(rows.map((r) => [r.uid, r.first || r.name]));
    const key = rows.map((r) => r.uid).join();
    if (key !== rosterKey) {
      rosterKey = key;
      roster?.ensure(rows.map((r) => ({ uid: r.uid, classId: r.classId }))).catch(() => {});
    }
    root.dataset.many = rows.length > 24 ? "3" : rows.length > 15 ? "2" : rows.length > 8 ? "1" : "0";
    const keep = new Set(rows.map((r) => r.uid));
    for (const [uid, b] of btns) if (!keep.has(uid)) { b.remove(); btns.delete(uid); }
    rows.forEach((r, i) => {
      const b = button(r);
      if (grid.children[i] !== b) grid.insertBefore(b, grid.children[i] || null);
    });
    root.querySelector(`.${c}-tom`).hidden = rows.some((r) => r.ok);
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
      const msg = err?.message || "Det gick inte – välj någon annan.";
      fel.textContent = msg.startsWith("🛡️") ? msg : `😕 ${msg}`;
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
    root.classList.add(`${c}-klar`);
    root.querySelector(`.${c}-hint`).textContent = view.caption;
    try { onResult(view); } catch (e) { console.warn(`${warn}: onResult`, e); }
    await runAcross(view);
    if (!destroyed) resolveDone(view);
  }

  function runAcross(view) {
    if (!view.run || typeof stage.animate !== "function") return new Promise((r) => setTimeout(r, 700));
    const el = document.createElement("span");
    el.className = `${c}-spring ${kind === "swap" ? `${c}-spring-byte` : ""}`;
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = runnerHtml(kind);
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
  const total = rules.victimPickMs;
  let iv = 0;
  function tick() {
    if (destroyed) return;
    const left = pendingLeftMs(pending, now());
    sek.textContent = String(Math.ceil(left / 1000));
    bar.style.transform = `scaleX(${Math.min(1, left / total).toFixed(3)})`;
    root.classList.toggle(`${c}-brattom`, left <= 3000);
    // Levande lista: skyddens nedräkning, och den som når 0:00 blir valbar.
    if (!busy) draw();
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
