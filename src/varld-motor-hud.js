// ============================================================================
// Pluggporten – liten debug-HUD för Pixi-rörelsen (#396, F4 #418)
// ----------------------------------------------------------------------------
// Visas bara med localStorage "pp:pixi:debug" (varld-motor.js, som själv bara
// nås via import()). Plus motorns små debug-hjälpare (URL-flaggor, frame-statistik). Visar senaste övergången: väg (pixi/css:<orsak>), hur länge
// handoffen tog, workerns frame-dt (snitt/max/tappade > 25 ms), en mini-graf
// över frame-dt och texturbudgeten. Pekar-genomskinlig, rör ingen annan DOM.
// (G1 kan ersätta den med en rikare varld-render-hud.js.)
// ============================================================================

let hud = null;

/** ?pixi=debug|frys|av|tvinga sätter flaggan, ?pixi=normal tar bort alla (preview utan konsol). */
export function urlFlaggor() {
  const q = new URLSearchParams(location.search).get("pixi");
  if (!q) return;
  try {
    if (q === "normal") ["av", "tvinga", "debug", "frys"].forEach((f) => localStorage.removeItem(`pp:pixi:${f}`));
    else if (/^(av|tvinga|debug|frys)$/.test(q)) localStorage.setItem(`pp:pixi:${q}`, "1");
  } catch { /* localStorage blockerad */ }
}

/** Workerns frame-dt → snitt/max/tappade (> 25 ms). */
export function statistik(frames = []) {
  const sum = frames.reduce((a, b) => a + b, 0);
  return frames.length ? { n: frames.length + 1, medelDt: +(sum / frames.length).toFixed(1), maxDt: Math.max(...frames), tappade: frames.filter((dt) => dt > 25).length, frames } : { n: 0 };
}

const rad = (k, v) => `<div><b style="opacity:.7">${k}</b> ${v}</div>`;

/** Rita/uppdatera HUD:en med senaste övergången (`post` från motorns logg). */
export async function visaHud(post, yta) {
  if (!hud) {
    hud = document.createElement("div");
    hud.id = "pp-pixi-hud";
    hud.setAttribute("aria-hidden", "true");
    hud.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:2147483000;pointer-events:none;" +
      "font:12px/1.35 ui-monospace,Menlo,Consolas,monospace;color:#fff;background:rgba(20,24,40,.82);" +
      "padding:8px 10px;border-radius:8px;max-width:340px;white-space:nowrap";
    document.body.appendChild(hud);
  }
  let worker = "";
  try {
    const s = await yta?.stats();
    if (s) worker = `${s.texturer} texturer · ${s.bitmaps} bitmaps`;
  } catch { /* renderaren död */ }
  const vag = post.vag === "pixi" ? "🟢 pixi" : post.vag ? `🟠 css:${post.orsak}` : "–";
  const m = post.malForvarm;
  const frames = post.frames || [];
  const max = Math.max(50, ...frames);
  const graf = frames.length
    ? `<svg width="320" height="40" style="display:block;margin-top:4px;background:rgba(255,255,255,.08)">` +
      `<line x1="0" x2="320" y1="${40 - (16.7 / max) * 40}" y2="${40 - (16.7 / max) * 40}" stroke="#7fd" stroke-dasharray="3 3"/>` +
      frames.map((dt, i) => {
        const x = (i / Math.max(1, frames.length - 1)) * 316 + 2;
        const h = (dt / max) * 40;
        return `<rect x="${x.toFixed(1)}" y="${(40 - h).toFixed(1)}" width="2" height="${h.toFixed(1)}" fill="${dt > 25 ? "#f77" : "#9e9"}"/>`;
      }).join("") + "</svg>"
    : "";
  hud.innerHTML =
    (post.vag ? rad("övergång", `${post.yttre}${post.riktning === "in" ? " → " : " ← "}${post.inre}  ${vag}`) : "") +
    (post.ateranvanda?.length ? rad("återanvänt", `${post.ateranvanda.join(", ")} (${(post.kallor || []).join("/")})`) : "") +
    (post.skulleMissat ? rad("⚠ prod", `skulle missat: ${Object.entries(post.missatMs || {}).map(([k, v]) => `${k} ${v} ms`).join(", ")}`) : "") +
    (m ? rad("mål", `#${m.id} ${m.lager}${m.inre ? `→${m.inre}` : ""} ${m.status} · ${m.ms} ms · ${m.poster.map((p) => `${p.roll}${p.minKlar ? "✓" : "…"}`).join(" ")}`) : "") +
    rad("handoff", `${post.forberedMs ?? "–"} ms${post.omspeglade?.length ? ` (omspeglat: ${post.omspeglade.join(", ")})` : ""}`) +
    (post.inaktuella?.length ? rad("reserv", `förvärmd pyramid för ${post.inaktuella.join(", ")} (omspeglingen hann inte)`) : "") +
    (frames.length
      ? rad("frame-dt", `snitt ${post.medelDt} · max ${post.maxDt} · tappade ${post.tappade}/${post.n}${post.avbruten ? " · AVBRUTEN" : ""}`)
      : "") +
    rad("texturer", `${post.cacheMB} MB${worker ? ` · ${worker}` : ""}`) +
    graf;
}
