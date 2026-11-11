// ============================================================================
// Kurragömma (#837): SCENEN – det API som projektorn och elevskärmen (D)
// monterar. Äger tillståndet (egen figur, sökare, läge, nivå) och bildrutans
// loop; ritandet görs av en RITARE med samma gränssnitt i 3D (kg-ritare-3d.js,
// three.js lat via import()) eller 2D (kg-2d.js, canvas) – D behöver inte veta
// vilken som kör. Dokumenterat i docs/KURRAGOMMA.md §9.
//
//   skapaKgScen({ yta, lage, roster, jagUid, namnPa, tvinga2d, niva, karta }) → Promise<scen>
//
//   scen.typ                      "3d" | "2d"
//   scen.lage(l?)                 elev-gom | elev-gomd | elev-sokare | projektor
//   scen.jag(p?)                  { x, z, yaw } – sätt startplatsen / läs var figuren är
//   scen.skydd() → 0–3            mätarens värde (händelsen "skydd" när det ändras)
//   scen.sokare([{ uid, x, z, yaw, t, namn }])   positioner ur rörelsekanalen (interpoleras ~150 ms)
//   scen.sokareBort(uid)
//   scen.vissling({ x, z })       ringar/noter; markör + pil i kanten hos sökaren; glidning på projektorn
//   scen.hopp()                   den egna figuren hoppar till (egen vissling)
//   scen.hittad({ x, z })         konfetti; glidning på projektorn
//   scen.gomstallen([{ uid, x, z }])   finalen: figurer på sina gömställen
//   scen.hjartslag(bool)          kanten pulserar (sökare inom HJARTSLAG_M – D räknar)
//   scen.namnPa(bool)
//   scen.niva(n?) / scen.nivaInfo() → { niva, namn, fps, ritanrop, typ }
//   scen.on("skydd" | "flytt" | "niva" | "reserv", fn) → av
//   scen.paus(bool) · scen.destroy()
// ============================================================================

import { ON } from "../delat/kg-karta.js";
import { skydd as skyddNiva, kollidera } from "../delat/kg-geometri.js";
import { VISSLING_MARKOR_MS } from "../delat/kg-config.js";
import { skapaAvatarBilder } from "./kg-avatar-bild.js";
import { skapaStyrning } from "./kg-styrning.js";
import { stegaJag, skapaInterpolering, normVinkel } from "./kg-rorelse.js";
import { skapaGlid } from "./kg-kamera.js";
import { NIVAER, NIVA_STANDARD, normNiva, valjRitare, lasSparadNiva, sparaNiva, skapaNivavakt } from "./kg-niva.js";
import { skapaOverlagg } from "./kg-overlagg.js";

export const LAGEN = Object.freeze(["elev-gom", "elev-gomd", "elev-sokare", "projektor"]);
const ELEV = (l) => l !== "projektor";

/** Vilket lov-föremål punkten ligger inne i (för genomskinligheten), eller null. */
function inneILov(x, z, karta) {
  let basta = null, bd = Infinity;
  for (const f of karta.foremal) {
    if (!f.lov) continue;
    const d = Math.hypot(x - f.x, z - f.z);
    if (d <= f.r && d < bd) { bd = d; basta = f.id; }
  }
  return basta;
}

export async function skapaKgScen({
  yta, lage = "elev-gom", roster = null, jagUid = "jag", namnPa = true, tvinga2d = false,
  niva = null, karta = ON, storage = null, auto = true,
} = {}) {
  if (!yta) throw new Error("Kurragömma: yta saknas");
  yta.classList.add("kg-scen");
  let lagret = storage;
  if (lagret === null) { try { lagret = window.localStorage; } catch { lagret = null; } }
  const { harWebGL } = await import("./kg-tre.js");
  let typ = valjRitare({ harWebGL: harWebGL(), tvinga2d });
  const bilder = skapaAvatarBilder({ roster });
  let aktuellNiva = normNiva(niva ?? lasSparadNiva(lagret) ?? NIVA_STANDARD);

  async function skapaRitare(t) {
    if (t === "3d") {
      try {
        const [{ laddaThree }, { skapa3dRitare }] = await Promise.all([import("./kg-tre.js"), import("./kg-ritare-3d.js")]);
        const T = await laddaThree();
        return skapa3dRitare({ T, yta, karta, niva: aktuellNiva, bilder });
      } catch (e) {
        console.warn("Kurragömma: 3D kunde inte startas – 2D-reserven tar över", e);
        typ = "2d";
      }
    }
    const { skapa2dRitare } = await import("./kg-2d.js");
    return skapa2dRitare({ yta, karta, bilder, jagUid });
  }
  let ritare = await skapaRitare(typ);
  ritare.nivaSatt(aktuellNiva);
  const overlagg = skapaOverlagg(yta);

  // ---- tillståndet ----
  const st = {
    lage: LAGEN.includes(lage) ? lage : "elev-gom",
    jag: { x: karta.gomStart[0].x, z: karta.gomStart[0].z, yaw: karta.gomStart[0].yaw, gar: false, mal: null, stillaS: 0 },
    skydd: -1, hopp: 0, hoppStart: 0, namnPa: !!namnPa, hjartslag: false, paus: false,
    markor: null, // { x, z, start } – sökarens visslingsmarkör
    gomstallen: [],
  };
  const sokare = new Map(); // uid → namn
  const interp = skapaInterpolering();
  const glid = skapaGlid();
  let stilla = false;
  let rorelseMq = null;
  const stillaByt = () => { stilla = !!(rorelseMq && rorelseMq.matches); };
  try {
    rorelseMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    stillaByt();
    if (rorelseMq.addEventListener) rorelseMq.addEventListener("change", stillaByt);
  } catch { /* ingen matchMedia */ }
  const lyssnare = new Map();
  const emit = (h, v) => { for (const fn of lyssnare.get(h) || []) { try { fn(v); } catch (e) { console.warn("Kurragömma scen:", e); } } };

  const styrning = skapaStyrning({
    yta,
    onDra: (d) => { if (ELEV(st.lage)) st.jag.yaw = normVinkel(st.jag.yaw + d); },
    onTryck: (sx, sy) => {
      if (st.lage !== "elev-gom" && st.lage !== "elev-sokare") return;
      const p = ritare.markPunkt(sx, sy);
      if (p) st.jag.mal = kollidera(p.x, p.z, karta);
    },
  });

  function lageSatt(l) {
    if (!LAGEN.includes(l)) return;
    st.lage = l;
    st.jag.mal = null;
    styrning.aktiv(ELEV(l));
    ritare.lageSatt(l);
    overlagg.pil(null);
    if (l !== "projektor") { st.gomstallen = []; ritare.gomstallenRensa(); }
  }
  lageSatt(st.lage);

  // ---- nivån ----
  const vakt = skapaNivavakt({ niva: aktuellNiva, nu: performance.now(), auto });
  function nivaSatt(n, { sparad = true, automatisk = false } = {}) {
    aktuellNiva = normNiva(n);
    vakt.satt(aktuellNiva, performance.now());
    ritare.nivaSatt(aktuellNiva);
    if (sparad && typ === "3d") sparaNiva(lagret, aktuellNiva); // 2D-reservens nivå är inget 3D-val
    emit("niva", { niva: aktuellNiva, namn: NIVAER[aktuellNiva].namn, automatisk });
  }

  let byter = false;
  async function bytTill2d(fps) {
    if (typ === "2d" || byter) return;
    byter = true;
    typ = "2d";
    try {
      ritare.dispose();
      ritare = await skapaRitare("2d");
      ritare.nivaSatt(aktuellNiva);
      ritare.lageSatt(st.lage);
      ritare.namnPa(st.namnPa);
      overlagg.notis("Datorn hinner inte med 3D – nu visas kartan i 2D i stället.");
      emit("reserv", { typ, fps });
    } finally { byter = false; }
  }

  // ---- bildrutan ----
  let sist = performance.now();
  let ritanrop = 0;
  let raf = 0;
  let dold = typeof document !== "undefined" && document.hidden;

  function bildruta(nu) {
    raf = 0;
    if (st.paus || dold) return;
    raf = requestAnimationFrame(bildruta);
    if (byter) return;
    const dt = Math.min(0.05, Math.max(0.001, (nu - sist) / 1000));
    sist = nu;
    const elev = ELEV(st.lage);

    if (elev) {
      const styr = styrning.las();
      st.jag = stegaJag(st.jag, { ...styr, mal: st.jag.mal }, dt, karta, { fast: st.lage === "elev-gomd" });
      const s = skyddNiva(st.jag.x, st.jag.z, karta);
      if (s !== st.skydd) { st.skydd = s; emit("skydd", s); }
      if (st.jag.gar) emit("flytt", { x: st.jag.x, z: st.jag.z, yaw: st.jag.yaw });
      const hopp = st.hopp > 0 ? Math.min(1, (nu - st.hoppStart) / 600) : 0;
      if (hopp >= 1) st.hopp = 0;
      ritare.figur(jagUid, { x: st.jag.x, z: st.jag.z, gar: st.jag.gar, hopp: st.hopp ? hopp : 0 });
    }
    for (const uid of interp.alla()) {
      if (uid === jagUid) continue;
      const p = interp.lage(uid, nu);
      if (p) ritare.figur(uid, { x: p.x, z: p.z, gar: p.gar, namn: sokare.get(uid) || null, skylt: true });
    }
    for (const g of st.gomstallen) ritare.figur(g.uid, { x: g.x, z: g.z });

    ritare.kamera({
      jag: st.jag,
      inneI: elev ? inneILov(st.jag.x, st.jag.z, karta) : null,
      projektor: { t: nu, glid: glid.lage(nu), stilla },
    }, dt);
    if (elev) ritare.genomskinlig(inneILov(st.jag.x, st.jag.z, karta));

    // Visslingsmarkören: pil i skärmkanten när platsen är utanför bilden (§1.5).
    if (st.markor && nu - st.markor.start < VISSLING_MARKOR_MS && st.lage === "elev-sokare") {
      overlagg.pil(ritare.skarmPunkt(st.markor.x, st.markor.z), ritare.storlek());
    } else overlagg.pil(null);

    ritanrop = ritare.rita(nu, dt);
    // Nivåvakten mäter fps alltid (nivaInfo), men sänker bara i 3D – 2D-reserven är redan sista steget.
    const h = vakt.bildruta(nu);
    if (typ !== "3d") return;
    if (h && h.typ === "sankt") {
      nivaSatt(h.niva, { automatisk: true });
      overlagg.notis(`Grafiken sänktes till ${h.namn} så att det går mjukare.`);
    } else if (h && h.typ === "2d") bytTill2d(h.fps);
  }

  function starta() {
    if (raf || st.paus || dold) return;
    sist = performance.now();
    raf = requestAnimationFrame(bildruta);
  }
  function synlighet() {
    dold = document.hidden;
    if (dold && raf) { cancelAnimationFrame(raf); raf = 0; } else starta();
  }
  document.addEventListener("visibilitychange", synlighet);
  starta();

  const scen = {
    get typ() { return typ; },
    lage(l) { if (l === undefined) return st.lage; lageSatt(l); return st.lage; },
    jag(p) {
      if (p) {
        const k = kollidera(Number(p.x) || 0, Number(p.z) || 0, karta);
        st.jag = { ...st.jag, x: k.x, z: k.z, yaw: Number.isFinite(p.yaw) ? p.yaw : st.jag.yaw, mal: null };
        ritare.kameraHopp(); // kameran hoppar till den nya platsen
      }
      return { x: st.jag.x, z: st.jag.z, yaw: st.jag.yaw };
    },
    skydd: () => Math.max(0, st.skydd),
    sokare(lista) {
      const nu = performance.now();
      for (const s of lista || []) {
        if (!s || !s.uid) continue;
        sokare.set(s.uid, s.namn || null);
        // t är avsändarens Date.now() (epok-ms) ur rörelsekanalen – räknas om till bildrutans klocka.
        // Ett t under 1e12 tas som redan lokalt (performance.now(), förhandsvisningen).
        const t = !Number.isFinite(s.t) ? nu : s.t > 1e12 ? nu - (Date.now() - s.t) : s.t;
        interp.satt(s.uid, { x: s.x, z: s.z, yaw: s.yaw, t });
      }
    },
    sokareBort(uid) { sokare.delete(uid); interp.bort(uid); ritare.figurerBehall([jagUid, ...interp.alla(), ...st.gomstallen.map((g) => g.uid)]); },
    vissling(p) {
      const nu = performance.now();
      if (st.lage === "projektor") { ritare.vissling(p, { markor: false, text: true }, nu); glid.starta(p, nu); }
      else if (st.lage === "elev-sokare") { ritare.vissling(p, { markor: true, text: false }, nu); st.markor = { x: p.x, z: p.z, start: nu }; }
    },
    hopp() { st.hopp = 1; st.hoppStart = performance.now(); },
    hittad(p) {
      const nu = performance.now();
      ritare.hittad(p, { text: st.lage === "projektor" }, nu);
      if (st.lage === "projektor") glid.starta(p, nu);
    },
    gomstallen(lista) {
      st.gomstallen = (lista || []).filter((g) => g && g.uid);
      ritare.gomstallenRensa();
      for (const g of st.gomstallen) ritare.gomstalle(g.uid, g);
      ritare.figurerBehall([jagUid, ...interp.alla(), ...st.gomstallen.map((g) => g.uid)]);
    },
    hjartslag(v) { st.hjartslag = !!v; overlagg.hjartslag(st.hjartslag); },
    namnPa(v) { st.namnPa = !!v; ritare.namnPa(st.namnPa); },
    niva(n) { if (n !== undefined) nivaSatt(n); return aktuellNiva; },
    nivaInfo: () => ({ niva: aktuellNiva, namn: NIVAER[aktuellNiva].namn, fps: Math.round(vakt.fps()), ritanrop, typ }),
    on(h, fn) {
      if (!lyssnare.has(h)) lyssnare.set(h, new Set());
      lyssnare.get(h).add(fn);
      return () => lyssnare.get(h).delete(fn);
    },
    /** Ritaren som kör just nu (för förhandsvisningar och tester – inte för D). */
    ritare: () => ritare,
    paus(v) { st.paus = !!v; if (st.paus && raf) { cancelAnimationFrame(raf); raf = 0; } else starta(); },
    destroy() {
      st.paus = true;
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", synlighet);
      if (rorelseMq && rorelseMq.removeEventListener) rorelseMq.removeEventListener("change", stillaByt);
      styrning.destroy();
      overlagg.destroy();
      ritare.dispose();
      bilder.destroy();
      lyssnare.clear();
      yta.classList.remove("kg-scen");
    },
  };
  scen.namnPa(st.namnPa);
  return scen;
}
