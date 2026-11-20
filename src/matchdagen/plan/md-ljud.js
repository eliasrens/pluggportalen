// ============================================================================
// Matchdagen (#869): LJUDET (spec §4) – korta, mjuka ljud som syntetiseras med
// Web Audio (inga ljudfiler): vissla, spark, jubel, "oj" och publikens sorl i
// bakgrunden. Knappen av/på kommer ihåg valet (localStorage). Lugnt läge: inget
// jubel och inget sorl, och allt lite dämpat.
//
//   skapaLjud({ lugnt, lagring?, final? }) → { pa, satt(pa), spela(namn), sorl(pa), stang() }
//   namn: vissla | slutvissla | spark | jubel | raddning | oj | sorl | fanfar
//   final (#873, Mästarcupens final §10.2): ett större jubel och en fullsatt läktares sorl.
//   fanfar: firandet efter en titel (lugnt läge: bara tonerna, dämpade).
//   ljudPa(lagring) → bool   (sparat val, standard på)
// ============================================================================

export const LJUD_NYCKEL = "matchdagen-ljud";

export function ljudPa(lagring = globalThis.localStorage) {
  try { return lagring?.getItem(LJUD_NYCKEL) !== "av"; } catch { return true; }
}

export function skapaLjud({ lugnt = false, lagring = globalThis.localStorage, final = false } = {}) {
  let pa = ljudPa(lagring);
  let ctx = null, huvud = null, brus = null, sorlKalla = null, sorlVill = false;
  const volym = lugnt ? 0.45 : 0.8;

  function sammanhang() {
    if (ctx) return ctx;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      huvud = ctx.createGain();
      huvud.gain.value = volym;
      huvud.connect(ctx.destination);
      // Ett vitt brus att filtrera fram spark, jubel och sorl ur.
      brus = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = brus.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch { ctx = null; }
    return ctx;
  }

  function ton(frekvens, start, langd, { typ = "sine", gain = 0.2, vibrato = 0 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = typ;
    o.frequency.value = frekvens;
    if (vibrato) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 28;
      lg.gain.value = vibrato;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(start);
      lfo.stop(start + langd);
    }
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + langd);
    o.connect(g).connect(huvud);
    o.start(start);
    o.stop(start + langd + 0.05);
  }

  function brusStot(start, langd, { frekvens = 800, q = 0.8, gain = 0.3, typ = "bandpass", loop = false } = {}) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = brus;
    s.loop = loop;
    f.type = typ;
    f.frequency.value = frekvens;
    f.Q.value = q;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + Math.min(0.25, langd / 3));
    if (!loop) g.gain.exponentialRampToValueAtTime(0.0001, start + langd);
    s.connect(f).connect(g).connect(huvud);
    s.start(start);
    if (!loop) s.stop(start + langd + 0.05);
    return { s, g };
  }

  const LJUD = {
    vissla: (t) => ton(2600, t, 0.35, { gain: 0.12, vibrato: 60 }),
    slutvissla: (t) => { ton(2600, t, 0.3, { gain: 0.12, vibrato: 60 }); ton(2600, t + 0.4, 0.3, { gain: 0.12, vibrato: 60 }); ton(2600, t + 0.8, 0.7, { gain: 0.12, vibrato: 60 }); },
    spark: (t) => { brusStot(t, 0.09, { frekvens: 180, q: 1.2, gain: 0.5, typ: "lowpass" }); ton(90, t, 0.1, { gain: 0.25 }); },
    jubel: (t) => { if (!lugnt) {
      brusStot(t, final ? 4 : 2.6, { frekvens: 1100, q: 0.5, gain: final ? 0.5 : 0.35 });
      if (final) brusStot(t + 0.3, 3.4, { frekvens: 600, q: 0.5, gain: 0.25 }); // det större jublet i finalen
    } },
    fanfar: (t) => [523, 659, 784, 1047].forEach((f, i) => ton(f, t + i * 0.22, i === 3 ? 0.9 : 0.24, { typ: "triangle", gain: lugnt ? 0.06 : 0.12 })),
    raddning: (t) => { if (!lugnt) brusStot(t, 1.1, { frekvens: 900, q: 0.6, gain: 0.18 }); },
    oj: (t) => { if (!lugnt) brusStot(t, 0.8, { frekvens: 500, q: 0.7, gain: 0.12 }); },
    sorl: () => {},
  };

  function startaSorl() {
    if (!pa || lugnt || !sorlVill || sorlKalla || !sammanhang()) return;
    sorlKalla = brusStot(ctx.currentTime, 1, { frekvens: 420, q: 0.4, gain: final ? 0.08 : 0.05, loop: true });
  }
  function stoppaSorl() {
    if (!sorlKalla) return;
    try { sorlKalla.s.stop(); } catch { /* redan stoppad */ }
    sorlKalla = null;
  }

  return {
    get pa() { return pa; },
    satt(v) {
      pa = !!v;
      try { lagring?.setItem(LJUD_NYCKEL, pa ? "pa" : "av"); } catch { /* bara bekvämlighet */ }
      if (pa) startaSorl(); else stoppaSorl();
    },
    spela(namn) {
      if (!pa || !sammanhang()) return;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      try { LJUD[namn]?.(ctx.currentTime + 0.01); } catch { /* ljud är bara en bonus */ }
    },
    /** Publikens sorl i bakgrunden under matchen (aldrig i lugnt läge). */
    sorl(v) {
      sorlVill = !!v;
      if (sorlVill) startaSorl(); else stoppaSorl();
    },
    stang() {
      stoppaSorl();
      ctx?.close?.().catch(() => {});
      ctx = null;
    },
  };
}
