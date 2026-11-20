// ============================================================================
// Matchdagen (#869): PLANEN – väljer 3D eller 2D-reserven och spelar upp
// motorns händelser (md-motor.js spela() → h) som animationer (spec §4).
// three.js laddas först här, när matchen startar (src/tre/tre-ladda.js).
// 2D-reserven tar över utan WebGL, om three inte går att ladda och med ?2d=1 –
// samma händelser, samma tider, samma match.
//
//   skapaPlan({ yta, lugnt, tvinga2d, vi, dem, avatar?, hooks? }) → Promise<plan>
//     vi/dem: { troja, byxor, mv, kapten? }   hooks: { utrop(text, ms), ljud(namn) }
//   plan.typ                    "3d" | "2d"
//   plan.stall(m, { avspark })  ställ upp direkt efter motorns tillstånd
//   plan.spela(h, m)            → Promise: händelsens animation (väntar tills den är klar)
//   plan.fps(), plan.dispose()
//   valjTyp({ webgl, tvinga2d }) → "3d" | "2d"   (ren, testad)
// ============================================================================

import { firande, formation, planX } from "./md-formation.js";

export const valjTyp = ({ webgl, tvinga2d = false }) => (!webgl || tvinga2d ? "2d" : "3d");

/** Tiderna (ms) för animationerna – ryms i balansens TID.anim (md-config.js). */
export const ANIM = { pass: 750, lang: 1050, skott: 650, mal: 2600, raddning: 900, efter: 450, tillbaka: 900 };

async function ritare({ yta, lugnt, tvinga2d }) {
  const { harWebGL, laddaThree } = await import("../../tre/tre-ladda.js");
  if (valjTyp({ webgl: harWebGL(), tvinga2d }) === "3d") {
    try {
      const [T, { skapa3dRitare }] = await Promise.all([laddaThree(), import("./md-tre-ritare.js")]);
      return skapa3dRitare({ T, yta, lugnt });
    } catch (err) {
      console.warn("Matchdagen: 3D kunde inte startas – 2D-reserven tar över", err);
      yta.querySelector(".md-canvas")?.remove();
    }
  }
  const { skapa2dRitare } = await import("./md-plan-2d.js");
  return skapa2dRitare({ yta, lugnt });
}

export async function skapaPlan({ yta, lugnt = false, tvinga2d = false, vi, dem, avatar = null, hooks = {} }) {
  const r = await ritare({ yta, lugnt, tvinga2d });
  r.lag("vi", vi);
  r.lag("dem", dem);
  if (avatar) r.avatar(avatar);
  const utrop = (t, ms) => hooks.utrop?.(t, ms);
  const ljud = (n) => hooks.ljud?.(n);
  const vanta = (ms) => new Promise((ok) => setTimeout(ok, lugnt ? Math.min(ms, 350) : ms));

  /** Spelarna till sina platser för läget (bollen ligger kvar där den är). */
  function stallUpp(x, y, innehav, { avspark = false, direkt = false } = {}) {
    const f = formation({ x, y, innehav, avspark });
    r.spelare("vi", f.vi, { direkt });
    r.spelare("dem", f.dem, { direkt });
    return f;
  }
  /** Bollen till en punkt i motorns skala (x 0–100). */
  const bollTill = (x, y, o) => r.boll(planX(x), y, o);

  return {
    get typ() { return r.typ; },
    stall(m, { avspark = false } = {}) {
      stallUpp(m.x, m.y, m.boll, { avspark, direkt: true });
      bollTill(m.x, m.y, { ms: 0 });
    },
    async spela(h, m) {
      const { till } = h;
      if (h.hojd === "skott") return skott(h, m);
      if (h.typ === "anfall") {
        ljud("spark");
        const lang = h.val === "lang";
        bollTill(till.x, till.y, { hojd: lang ? 6 : 0, ms: lang ? ANIM.lang : ANIM.pass });
        stallUpp(till.x, till.y, h.boll);
        await vanta((lang ? ANIM.lang : ANIM.pass) + ANIM.efter);
        return;
      }
      // derasPass, forsvar: bollen förs/tas – samma rörelse, innehavet efteråt avgör formationen.
      if (h.utfall !== "vunnen" && h.utfall !== "stoppad") ljud("spark");
      bollTill(till.x, till.y, { ms: ANIM.pass });
      stallUpp(till.x, till.y, h.boll);
      await vanta(ANIM.pass + ANIM.efter);
    },
    fps: () => r.fps(),
    dispose: () => r.dispose(),
  };

  /** Ett skott – vårt eller deras: mot målet, sedan mål, räddning, stolpe eller utanför. */
  async function skott(h, m) {
    const vart = h.typ === "anfall";
    const malX = vart ? 100 : 0;
    const sida = vart ? "dem" : "vi"; // målet som skottet går mot
    const y = 34 + (h.utfall === "stolpe" ? (h.till.y < 34 ? -3.6 : 3.6) : h.utfall === "utanfor" ? (h.fran.y < 34 ? -6 : 6) : ((h.fran.y - 34) / 34) * 2.5);
    ljud("spark");
    bollTill(malX + (h.utfall === "utanfor" ? (vart ? 2 : -2) : 0), y, { hojd: h.utfall === "utanfor" ? 2.2 : 1.3, ms: ANIM.skott });
    await vanta(ANIM.skott);
    if (h.utfall === "mal") {
      r.malEffekt(sida);
      r.firar(vart ? "vi" : "dem", true);
      if (vart) r.zoom(true);
      ljud(vart ? "jubel" : "sorl");
      utrop(vart ? "MÅÅÅL!" : `Mål för ${kortNamn(m.mot.namn)}`, ANIM.mal - 600);
      const f = formation({ x: h.fran.x, y: h.fran.y, innehav: vart ? "oss" : "dem" });
      r.spelare(vart ? "vi" : "dem", firande(vart ? f.vi : f.dem, [planX(malX), y]));
      await vanta(ANIM.mal);
      r.firar("vi", false);
      r.firar("dem", false);
      r.zoom(false);
      stallUpp(50, 34, h.boll, { avspark: true });
      bollTill(50, 34, { ms: ANIM.tillbaka });
      await vanta(ANIM.tillbaka);
      return;
    }
    if (h.utfall === "raddning") {
      utrop("RÄDDNING!", ANIM.raddning);
      ljud("raddning");
    } else ljud("oj");
    await vanta(ANIM.raddning);
    if (h.horna) {
      bollTill(h.till.x, h.till.y, { ms: ANIM.pass });
      stallUpp(h.till.x, h.till.y, "oss");
      await vanta(ANIM.pass);
      return;
    }
    bollTill(h.till.x, h.till.y, { hojd: 4, ms: ANIM.lang });
    stallUpp(h.till.x, h.till.y, h.boll);
    await vanta(ANIM.lang);
  }
}

/** "Ekebacka IF" → "EIF" (skylten och utropet, som i skissen). */
export function kortNamn(namn) {
  return String(namn || "").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
}
