// ============================================================================
// Kurragömma 🙈 (#839, spec §11.4): demots ROBOTAR – de påhittade eleverna som
// spelar mot låtsasservern (kg-demo-server.js) med samma anrop som en riktig
// elev: gömmare går till ett gömställe nära ett föremål och låser (kgLas),
// svarar rätt/fel i letfasen (kgSvara – fel svar visslar), sökare vandrar
// (positionerna via den lokala rörelsekanalen, högst 5/s som riktiga sökare),
// går mot den senaste visslingen och letar (kgLeta) när ficklampan är laddad.
// Ingen DOM, inga timers – demot (kg-demo.js) stegar dem: steg(nu).
//
//   skapaDemoRobotar({ server, buss, uids, rng, karta, now, ratt = 0.65 }) → robotar
//     robotar.steg(nu)        ett steg (dt högst 0,25 s – ett klockhopp teleporterar ingen)
//     robotar.pa(bool)        av = robotarna gör ingenting (svarar inte, går inte)
//     robotar.borta(bool)     sökarna slutar pulsa (regeln "det finns alltid en sökare")
//     robotar.svara(uid, ratt) · robotar.leta(uid)   ett svar / en sökning nu (demoknappar)
//     robotar.lista()         [{ uid, roll, x, z, harLast }]
// ============================================================================

import { kollidera, gomstalleNaraForemal } from "./delat/kg-geometri.js";
import { MAX_FART, VISSLING_FONSTER_MS } from "./delat/kg-config.js";

const DT_MAX_S = 0.25;
const FART = 0.55; // andel av MAX_FART
const SVAR_MS = [7000, 14000];
const LETA_MS = [3000, 6500];

export function skapaDemoRobotar({ server, buss, uids, rng, karta, now, ratt = 0.65 }) {
  const robotar = new Map();
  let pa = true;
  let borta = false;
  let sist = null;
  let vissling = null; // senaste visslingen { x, z, t }
  let nr = 0;
  const mellan = (lo, hi) => lo + (hi - lo) * rng();
  const nyRobot = (uid) => ({ uid, roll: null, x: 0, z: 0, yaw: 0, mal: null, stilla: 0, harLast: false, laddningar: 0, kanal: null, nastaSvar: 0, nastaLeta: 0, lastar: false, malVissling: 0 });
  for (const uid of uids) robotar.set(uid, nyRobot(uid));

  // Visslingarna hörs av alla sökare – en lyssnare räcker (ingen egen pos).
  buss.kanalFor("robotar").paHandelse((h) => { if (h.typ === "vissling") vissling = { x: h.x, z: h.z, t: h.t }; });

  const gomdaUids = () => [...robotar.values()].filter((r) => r.roll === "gomd").map((r) => r.uid);

  /** Rollerna och platserna ur serverns tillstånd (sökare som nyss var gömda börjar vid gömstället). */
  function synka() {
    const st = server.state();
    for (const p of st.spelare) {
      const r = robotar.get(p.uid);
      if (!r) continue;
      if (r.roll !== p.roll) {
        r.roll = p.roll;
        r.mal = null;
        if (p.roll === "sokare") {
          const sp = st.secrets[p.uid]?.startpunkt || karta.sokarStart;
          r.x = sp.x; r.z = sp.z;
          r.kanal = r.kanal || buss.kanalFor(p.uid);
          r.nastaLeta = now() + mellan(...LETA_MS);
        }
      }
      r.harLast = !!p.harLast;
      r.laddningar = p.laddningar | 0;
    }
    return st;
  }

  function ga(r, dt, fart = FART) {
    if (!r.mal) return;
    r.yaw = Math.atan2(r.mal.x - r.x, r.mal.z - r.z);
    const s = MAX_FART * fart * dt;
    const p = kollidera(r.x + Math.sin(r.yaw) * s, r.z + Math.cos(r.yaw) * s, karta);
    r.stilla = Math.hypot(p.x - r.x, p.z - r.z) < s * 0.2 ? r.stilla + dt : 0;
    r.x = p.x; r.z = p.z;
  }
  const framme = (r) => !r.mal || Math.hypot(r.mal.x - r.x, r.mal.z - r.z) < 0.4 || r.stilla > 0.8;

  function svar(uid, korrekt) {
    const a = Math.floor(rng() * 11);
    const b = Math.floor(rng() * 11);
    nr++;
    return server.svara(uid, { attemptId: `${uid}_${nr}`, factorA: a, factorB: b, answer: String(korrekt ? a * b : a * b + 1 + Math.floor(rng() * 3)) }).catch(() => null);
  }

  /** Gömmaren: till ett gömställe nära ett föremål, lås; i letfasen svara ibland (fel → vissling). */
  function gommare(r, st, nu, dt) {
    if (st.fas === "gom" && !r.harLast) {
      if (!r.mal) {
        const g = gomstalleNaraForemal(karta, rng);
        r.mal = g;
        const start = karta.gomStart[Math.floor(rng() * karta.gomStart.length)];
        r.x = start.x; r.z = start.z;
      }
      ga(r, dt);
      if (framme(r) && !r.lastar) {
        r.lastar = true;
        server.las(r.uid, { x: r.x, z: r.z }).then((ut) => { if (ut?.gomstalle) { r.x = ut.gomstalle.x; r.z = ut.gomstalle.z; } }).catch(() => null).finally(() => { r.lastar = false; });
      }
      return;
    }
    if (st.fas !== "leta") return;
    if (!r.nastaSvar) r.nastaSvar = nu + mellan(...SVAR_MS);
    if (nu >= r.nastaSvar) { r.nastaSvar = nu + mellan(...SVAR_MS); svar(r.uid, rng() < ratt); }
  }

  /** Sökaren: vandra (mot visslingen när det nyss visslat), pulsa positionen, svara och leta. */
  function sokare(r, st, nu, dt) {
    if (borta) return;
    const nyVissling = vissling && nu - vissling.t < VISSLING_FONSTER_MS && r.malVissling !== vissling.t;
    if (nyVissling && rng() < 0.6) { r.mal = { x: vissling.x, z: vissling.z }; r.malVissling = vissling.t; r.stilla = 0; }
    else if (framme(r)) { const a = rng() * 6.28; const d = 3 + rng() * (karta.radie - 5); r.mal = { x: Math.cos(a) * d, z: Math.sin(a) * d }; r.stilla = 0; }
    ga(r, dt);
    r.kanal?.skickaPos({ x: r.x, z: r.z, yaw: r.yaw });
    if (!r.nastaSvar) r.nastaSvar = nu + mellan(...SVAR_MS) * 0.7;
    if (nu >= r.nastaSvar) { r.nastaSvar = nu + mellan(...SVAR_MS) * 0.7; svar(r.uid, rng() < ratt + 0.1); }
    if (st.fas === "leta" && r.laddningar > 0 && nu >= r.nastaLeta) {
      r.nastaLeta = nu + mellan(...LETA_MS);
      server.leta(r.uid, { x: r.x, z: r.z }).catch(() => null);
    }
  }

  return {
    steg(nu) {
      const dt = sist == null ? 0 : Math.min(DT_MAX_S, Math.max(0, (nu - sist) / 1000));
      sist = nu;
      if (!pa) return;
      const st = synka();
      if (!st.fas) return;
      for (const r of robotar.values()) {
        if (r.roll === "gomd") gommare(r, st, nu, dt);
        else if (r.roll === "sokare") sokare(r, st, nu, dt);
      }
    },
    pa(v) { pa = !!v; },
    get arPa() { return pa; },
    borta(v) { borta = !!v; server.sokareBorta(!!v); },
    svara: (uid, korrekt = false) => svar(uid, korrekt),
    leta: (uid) => { const r = robotar.get(uid); return r ? server.leta(uid, { x: r.x, z: r.z }) : Promise.resolve(null); },
    gomda: gomdaUids,
    lista: () => [...robotar.values()].map((r) => ({ uid: r.uid, roll: r.roll, x: r.x, z: r.z, harLast: r.harLast, laddningar: r.laddningar })),
  };
}
