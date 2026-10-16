// ============================================================================
// Prov (#740, spec §5.5 + §9): elevens automatiska sparning – ren logik med
// utbytbara timers (testas i test/prov-tillfalle.test.js). Provsidan skriver
// dessutom localStorage vid VARJE ändring, så en omladdning tappar aldrig något.
//
// Avvägningen (§9.1, docs/PROV.md "Budget"):
//   • första sparningen 4 s efter en ändring (spec: "högst var 4:e sekund")
//   • men aldrig tätare än MELLANRUM_MS (24 s) mellan två skrivningar – annars
//     skulle en elev som skriver hela tiden ge 600 skrivningar på 40 minuter.
//     Med taket: högst 101 bakgrundsskrivningar per elev och prov.
//   • lämnar eleven en svarsruta sparas det direkt – om taket tillåter, annars
//     när det tillåter. Inlämningen och "eleven lämnar sidan" sparar alltid (spolaNu).
//   • ett misslyckat försök (eller ett som hänger > 8 s, offline) visar felraden
//     och försöker igen efter 5, 10, 20, 30 s. Misslyckade skrivningar kostar
//     inget; ett nekat försök (permission-denied: stängt, tiden ute) är slutgiltigt.
// ============================================================================

export const SPARNING = Object.freeze({
  forstaMs: 4_000,
  mellanrumMs: 24_000,
  hangerMs: 8_000,
  omforsokMs: [5_000, 10_000, 20_000, 30_000],
});

// Lärarens rättning (#741, prov-ratta-lager.js): samma avvägning, tätare tak –
// läraren rättar i korta stötar och väntar inte gärna (§6.3). En batch med de
// ändrade eleverna högst var 10:e sekund.
export const LARARENS_SPARNING = Object.freeze({ ...SPARNING, forstaMs: 3_000, mellanrumMs: 10_000 });

/** Ett fel som aldrig blir bättre av att försöka igen (reglerna nekar). */
export function arSlutgiltigtFel(err) {
  return err?.code === "permission-denied" || err?.code === "firestore/permission-denied" || err?.code === "not-found";
}

/**
 * @param {object} o
 * @param {() => Promise<void>} o.spara        skriver elevens nuvarande svar
 * @param {(s: { lage: "sparat"|"sparar"|"fel", tid?: number }) => void} [o.onStatus]
 * @param {(err: any) => void} [o.onSlutgiltigt]  reglerna nekade – sluta spara
 * @param {() => number} [o.nu]
 * @param {{ set: Function, clear: Function }} [o.timer]
 * @param {typeof SPARNING} [o.instl]
 */
export function skapaSparare({
  spara,
  onStatus = () => {},
  onSlutgiltigt = () => {},
  nu = () => Date.now(),
  timer = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id) },
  instl = SPARNING,
}) {
  let version = 0;        // ökar vid varje ändring
  let sparadVersion = 0;  // senast bekräftat sparad
  let senastForsok = -Infinity; // när senaste skrivningen startade (taket räknas härifrån)
  let pagaende = null;    // Promise för skrivningen som pågår
  let planerad = null;    // { id, vid }
  let forsok = 0;         // misslyckade försök i rad
  let stoppad = false;
  let skrivningar = 0;
  let status = { lage: "sparat", tid: null };

  const smutsig = () => version !== sparadVersion;
  const satt = (s) => {
    status = s;
    onStatus(s);
  };

  function planera(vid) {
    if (stoppad || !smutsig()) return;
    if (planerad && planerad.vid <= vid) return;
    if (planerad) timer.clear(planerad.id);
    planerad = { vid, id: timer.set(() => { planerad = null; kor(); }, Math.max(0, vid - nu())) };
  }

  function kor({ tvinga = false } = {}) {
    if (stoppad || pagaende || !smutsig()) return pagaende || Promise.resolve();
    if (!tvinga && forsok === 0 && nu() < senastForsok + instl.mellanrumMs) {
      planera(senastForsok + instl.mellanrumMs);
      return Promise.resolve();
    }
    if (planerad) { timer.clear(planerad.id); planerad = null; }
    const v = version;
    senastForsok = nu();
    skrivningar++;
    satt({ lage: "sparar" });
    const hanger = timer.set(() => { if (pagaende) satt({ lage: "fel" }); }, instl.hangerMs);
    const p = Promise.resolve().then(spara).then(
      () => {
        timer.clear(hanger);
        pagaende = null;
        forsok = 0;
        sparadVersion = Math.max(sparadVersion, v);
        if (stoppad) return;
        if (smutsig()) {
          satt({ lage: "sparar" });
          planera(Math.max(nu() + instl.forstaMs, senastForsok + instl.mellanrumMs));
        } else satt({ lage: "sparat", tid: nu() });
      },
      (err) => {
        timer.clear(hanger);
        pagaende = null;
        if (stoppad) return;
        if (arSlutgiltigtFel(err)) {
          stoppad = true;
          onSlutgiltigt(err);
          return;
        }
        forsok++;
        satt({ lage: "fel" });
        const vanta = instl.omforsokMs[Math.min(forsok, instl.omforsokMs.length) - 1];
        planera(nu() + vanta);
      }
    );
    pagaende = p;
    return p;
  }

  return {
    /** Eleven ändrade ett svar. */
    andrat() {
      if (stoppad) return;
      version++;
      if (status.lage !== "fel") satt({ lage: "sparar" });
      planera(Math.max(nu() + instl.forstaMs, senastForsok + instl.mellanrumMs));
    },
    /** Eleven lämnade en svarsruta / bytte fråga: spara nu om taket tillåter. */
    lamnatRuta() {
      if (!stoppad && smutsig()) planera(Math.max(nu(), senastForsok + instl.mellanrumMs));
    },
    /** Spara direkt, utan tak (eleven lämnar sidan). */
    async spolaNu() {
      if (pagaende) await pagaende.catch(() => {});
      return kor({ tvinga: true });
    },
    /** Sluta spara (inlämnat, stängt). */
    stoppa() {
      stoppad = true;
      if (planerad) timer.clear(planerad.id);
      planerad = null;
    },
    get status() { return status; },
    get osparat() { return smutsig(); },
    get skrivningar() { return skrivningar; },
  };
}
