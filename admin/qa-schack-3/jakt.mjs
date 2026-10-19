// Slut-QA Etapp 3 (#792): EGEN lösare för stjärnjakterna (lektion 2–8) – oberoende av
// src/schack/schack-stjarnjakt.js (minstaDrag/jaktDrag). BFS över (ruta, kvarvarande mål).
const F = "abcdefgh";
const xy = (r) => [F.indexOf(r[0]), +r[1] - 1];
const rt = (x, y) => (x >= 0 && x < 8 && y >= 0 && y < 8 ? F[x] + (y + 1) : null);
const RAK = [[1, 0], [-1, 0], [0, 1], [0, -1]], SNETT = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const HOPP = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];

/** Dragen för den vita pjäsen: egna (bönder) stoppar, fiender kan tas. */
export function drag(typ, fran, egna, fiender) {
  const [x, y] = xy(fran);
  const ut = [];
  const lagg = (t) => { if (!t || egna.has(t)) return false; ut.push(t); return !fiender.has(t); };
  if (typ === "r" || typ === "b" || typ === "q") {
    const rikt = typ === "r" ? RAK : typ === "b" ? SNETT : [...RAK, ...SNETT];
    for (const [dx, dy] of rikt) for (let i = 1; i < 8; i++) if (!lagg(rt(x + dx * i, y + dy * i))) break;
  } else if (typ === "k") for (const [dx, dy] of [...RAK, ...SNETT]) lagg(rt(x + dx, y + dy));
  else if (typ === "n") for (const [dx, dy] of HOPP) lagg(rt(x + dx, y + dy));
  else if (typ === "p") {
    const ett = rt(x, y + 1);
    if (ett && !egna.has(ett) && !fiender.has(ett)) {
      ut.push(ett);
      const tva = rt(x, y + 2);
      if (y === 1 && tva && !egna.has(tva) && !fiender.has(tva)) ut.push(tva);
    }
    for (const dx of [-1, 1]) { const t = rt(x + dx, y + 1); if (t && fiender.has(t)) ut.push(t); }
  }
  return ut;
}

/**
 * Minsta antal drag + en väg. `slack`: gör först ett dragna vilket icke-målsdrag som helst
 * (för att prova en längre lösning) – returnerar då en väg med exakt `slack` extra drag om det går.
 */
export function lös(u, start = u.fran, kvar0 = null) {
  const mal = [...u.stjarnor, ...(u.fiender || []).map((f) => f.ruta)];
  const fi = new Set((u.fiender || []).map((f) => f.ruta));
  const egna = new Set(u.egna || []);
  const idx = (k) => mal.indexOf(k);
  let m0 = 0;
  mal.forEach((m, i) => { if (!kvar0 || kvar0.has(m)) m0 |= 1 << i; });
  if (!m0) return { min: 0, vag: [] };
  const fore = new Map([[`${start}:${m0}`, null]]);
  let ko = [[start, m0]];
  for (let d = 1; ko.length; d++) {
    const nasta = [];
    for (const [r, m] of ko) {
      const kvarF = new Set(mal.filter((x, i) => m & (1 << i) && fi.has(x)));
      for (const t of drag(u.pjas, r, egna, kvarF)) {
        const i = idx(t);
        const nm = i >= 0 ? m & ~(1 << i) : m;
        const k = `${t}:${nm}`;
        if (fore.has(k)) continue;
        fore.set(k, `${r}:${m}`);
        if (!nm) { const vag = []; for (let p = k; p; p = fore.get(p)) vag.unshift(p.split(":")[0]); return { min: d, vag: vag.slice(1) }; }
        nasta.push([t, nm]);
      }
    }
    ko = nasta;
  }
  return { min: Infinity, vag: null };
}

/** En väg som börjar med ett "bortkastat" drag (inte ett mål): minsta totala längd, eller null. */
export function lösMedOmväg(u) {
  const mal = new Set([...u.stjarnor, ...(u.fiender || []).map((f) => f.ruta)]);
  const egna = new Set(u.egna || []);
  const fiender = new Set((u.fiender || []).map((f) => f.ruta));
  let basta = null;
  for (const t of drag(u.pjas, u.fran, egna, fiender)) {
    if (mal.has(t)) continue;
    const r = lös(u, t, null);
    if (r.vag && (!basta || 1 + r.min < basta.min)) basta = { min: 1 + r.min, vag: [t, ...r.vag] };
  }
  return basta;
}
