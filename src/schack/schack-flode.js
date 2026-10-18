// ============================================================================
// Elevens schackflöde (#776, §4): startsidan → nivåval → partiet mot datorn →
// slutrutan. Fristående från ui.js/data.js så att samma kod kör i appen
// (page-schack.js) och i förhandsvisningen utan Firebase. Vyn väljs av
// hash-parametrarna:
//
//   #/elev/schack                  startsidan (pågående parti överst)
//   #/elev/schack?vy=dator         fortsätt det sparade partiet (annars nivåval)
//   #/elev/schack?vy=dator&ny=1    nivåval → nytt parti
//
//   const flode = visaSchack(host, ctx, params);   flode.destroy();
//   ctx = { namn, avatarHtml, lagring, nyckel, go(hash), hashBas, dator?, reducedMotion?, tidsgransMs?, tankMinMs? }
// Datorn (workern) delas mellan vyerna och stängs med stangSchack().
// ============================================================================

import { skapaDator } from "./schack-dator.js";
import { lasParti, sparaParti, nyttParti, lasVal, sparaVal } from "./schack-parti.js";
import { startHtml, nivavalHtml } from "./schack-sida-delar.js";

let dator = null;

/** Stäng motorns worker (när eleven lämnar schacket). */
export function stangSchack() {
  dator?.destroy();
  dator = null;
}

function hamtaDator(ctx) {
  if (!dator) dator = ctx.dator || skapaDator();
  return dator;
}

function pagaende(ctx) {
  const p = lasParti(ctx.lagring, ctx.nyckel);
  return p && !p.slut ? p : null;
}

export function visaSchack(host, ctx, params = {}) {
  let aktiv = null; // vyn, eller löftet om partivyn tills modulen laddats
  let generation = 0;
  const lagring = ctx.lagring ?? (typeof localStorage !== "undefined" ? localStorage : null);
  const c = { ...ctx, lagring: lagring || { getItem: () => null, setItem() {}, removeItem() {} } };
  const hashBas = c.hashBas || "#/elev/schack";
  const go = c.go || ((h) => { location.hash = h; });
  const tillHash = (q) => `${hashBas}${q ? `?${q}` : ""}`;

  const stang = (a) => {
    if (!a) return;
    if (typeof a.then === "function") a.then((vy) => vy?.destroy?.()).catch(() => {});
    else a.destroy?.();
  };
  const byt = (fn) => {
    stang(aktiv);
    aktiv = null;
    generation++;
    host.innerHTML = "";
    host.className = "schack-rot";
    aktiv = fn() || null;
  };

  function visaStart() {
    const p = pagaende(c);
    host.innerHTML = startHtml(p);
    host.querySelector('[data-act="fortsatt"]')?.addEventListener("click", () => go(tillHash("vy=dator")));
    host.querySelector('[data-act="dator"]').addEventListener("click", () => go(tillHash("vy=dator&ny=1")));
  }

  function visaNivaval() {
    const val = lasVal(c.lagring, c.nyckel);
    const p = pagaende(c);
    host.innerHTML = nivavalHtml(val, p);
    const markera = (klass, attr, varde) => {
      for (const b of host.querySelectorAll(`.${klass}`)) {
        const vald = b.dataset[attr] === varde;
        b.classList.toggle("vald", vald);
        b.setAttribute("aria-checked", String(vald));
      }
    };
    host.addEventListener("click", (e) => {
      const niva = e.target.closest(".schack-niva")?.dataset.niva;
      const farg = e.target.closest(".schack-farg")?.dataset.farg;
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (niva) { val.niva = niva; markera("schack-niva", "niva", niva); }
      else if (farg) { val.farg = farg; markera("schack-farg", "farg", farg); }
      else if (act === "tillbaka") go(hashBas);
      else if (act === "fortsatt") go(tillHash("vy=dator"));
      else if (act === "starta") {
        sparaVal(c.lagring, c.nyckel, val);
        const parti = nyttParti({ niva: val.niva, farg: val.farg, slump: c.slump });
        sparaParti(c.lagring, c.nyckel, parti);
        // Hashen utan ny=1, så att en omladdning fortsätter partiet i stället för att visa väljaren.
        if (typeof history !== "undefined" && location.hash.startsWith(hashBas)) history.replaceState(null, "", tillHash("vy=dator"));
        byt(() => visaParti(parti));
      }
    });
  }

  function visaParti(parti) {
    const gen = generation;
    return import("./schack-dator-vy.js").then(({ skapaDatorVy }) => {
      if (gen !== generation) return null; // eleven hann byta vy medan modulen laddades
      const yta = document.createElement("div");
      host.replaceChildren(yta);
      return skapaDatorVy(yta, {
        parti, namn: c.namn || "Du", avatarHtml: c.avatarHtml, dator: hamtaDator(c),
        reducedMotion: c.reducedMotion, tidsgransMs: c.tidsgransMs, tankMinMs: c.tankMinMs,
        spara: (p) => sparaParti(c.lagring, c.nyckel, p),
        onNytt: () => {
          const val = lasVal(c.lagring, c.nyckel);
          const nytt = nyttParti({ niva: parti.niva, farg: val.farg === "slump" ? "slump" : parti.egenFarg, slump: c.slump });
          sparaParti(c.lagring, c.nyckel, nytt);
          byt(() => visaParti(nytt));
        },
        onBytNiva: () => go(tillHash("vy=dator&ny=1")),
        onTillbaka: () => go(hashBas),
      });
    });
  }

  if (params.vy === "dator") {
    const p = params.ny ? null : lasParti(c.lagring, c.nyckel);
    if (p) byt(() => visaParti(p));
    else byt(visaNivaval);
  } else byt(visaStart);

  return {
    /** Den aktiva vyn (partivyn är ett löfte tills modulen laddats). */
    aktiv: () => aktiv,
    destroy() {
      stang(aktiv);
      aktiv = null;
      generation++;
      host.innerHTML = "";
    },
  };
}
