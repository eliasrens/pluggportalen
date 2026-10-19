// ============================================================================
// Elevens schackflöde (#776, §4; kompisläget #780, §7): startsidan → nivåval →
// partiet mot datorn → slutrutan, och lobbyn → partiet mot en kompis.
// Fristående från ui.js/data.js så att samma kod kör i appen (page-schack.js)
// och i förhandsvisningarna utan Firebase. Vyn väljs av hash-parametrarna:
//
//   #/elev/schack                    startsidan (pågående parti överst)
//   #/elev/schack?vy=dator           fortsätt det sparade partiet (annars nivåval)
//   #/elev/schack?vy=dator&ny=1      nivåval → nytt parti
//   #/elev/schack?vy=kompis          lobbyn "Spela mot en kompis"
//   #/elev/schack?vy=kompis&parti=X  partiet mot en kompis
//   #/elev/schack?vy=lar             guiden "Lär dig schack" (#790, schack-guide-vy.js)
//   #/elev/schack?vy=lar&lektion=N   lektion N
//   #/elev/schack?vy=pussel          pusslen: Matt i ett / Matt i två (#791, schack-pussel-vy.js)
//   #/elev/schack?vy=pussel&sort=ett|tva(&nr=N)  ett pussel i taget (nr = direktlänk)
//
//   const flode = visaSchack(host, ctx, params);   flode.destroy();
//   ctx = { namn, avatarHtml, lagring, nyckel, go(hash), hashBas, dator?, reducedMotion?, tidsgransMs?, tankMinMs?,
//           kompis?: { moln, classId, uid, klasslista }, fortsattParti?, onDatorSlut?,
//           guide?: { lektioner(), spara(nr, stjarnor) },     framstegen i guiden (#790)
//           pussel?: { framsteg(), spara(sort, nr) },         framstegen i pusslen (#791)
//           mynt?: skapaMynt(…) }                             pluggmynten (#798, schack-mynt.js) – utan den inga mynt
// Utan ctx.kompis är kortet "Spela mot en kompis" avstängt (förhandsvisningen mot datorn).
// Med kompis: EN lyssnare på klassdokumentet (schack-kompis.js) medan eleven är på
// schacksidan utanför ett pågående kompisparti – den visar inkommande utmaningar och tar
// eleven till partiet när ett startar. Datorn (workern) och lyssnaren stängs med stangSchack().
// ============================================================================

import { skapaDator } from "./schack-dator.js";
import { lasParti, sparaParti, nyttParti, lasVal, sparaVal } from "./schack-parti.js";
import { startHtml, nivavalHtml } from "./schack-sida-delar.js";

let dator = null;
let kompisModul = null; // schack-kompis.js när den laddats (för stangSchack)

/**
 * Stäng motorns worker och lobbyns lyssnare (när eleven lämnar schacket).
 * Returnerar löftet om att elevens väntan tagits bort (schackSlutaVanta).
 */
export function stangSchack() {
  dator?.destroy();
  dator = null;
  return kompisModul ? kompisModul.stangKompis() : Promise.resolve(false);
}

function hamtaDator(ctx) {
  if (!dator) dator = ctx.dator || skapaDator();
  return dator;
}

function pagaende(ctx) {
  const p = lasParti(ctx.lagring, ctx.nyckel);
  return p && !p.slut ? p : null;
}

const laddaKompis = () => import("./schack-kompis.js").then((m) => (kompisModul = m));

export function visaSchack(host, ctx, params = {}) {
  let aktiv = null; // vyn, eller löftet om vyn tills modulen laddats
  let generation = 0;
  let ruta = null; // utmaningsrutan (löfte eller vy)
  let foljer = null; // avregistrering: "ta eleven till partiet när ett startar"
  let levande = true;
  const lagring = ctx.lagring ?? (typeof localStorage !== "undefined" ? localStorage : null);
  const c = { ...ctx, lagring: lagring || { getItem: () => null, setItem() {}, removeItem() {} } };
  const hashBas = c.hashBas || "#/elev/schack";
  const go = c.go || ((h) => { location.hash = h; });
  const tillHash = (q) => `${hashBas}${q ? `?${q}` : ""}`;
  const kompis = c.kompis?.classId && c.kompis?.uid ? c.kompis : null;
  const partiHash = (id) => tillHash(`vy=kompis&parti=${encodeURIComponent(id)}`);

  host.innerHTML = `<div class="schack-utmaning-yta" hidden></div><div class="schack-vy"></div>`;
  host.className = "schack-rot";
  const rutaEl = host.firstElementChild;
  const yta = host.lastElementChild;

  const stang = (a) => {
    if (!a) return;
    if (typeof a.then === "function") a.then((vy) => vy?.destroy?.()).catch(() => {});
    else a.destroy?.();
  };
  const byt = (fn) => {
    stang(aktiv);
    aktiv = null;
    generation++;
    yta.innerHTML = "";
    yta.className = "schack-vy";
    aktiv = fn() || null;
  };

  /** Lyssnaren på lobbyn medan eleven inte är i ett pågående kompisparti. */
  function lobbyPa(vyPartiId = null) {
    if (!kompis || ruta) return;
    const gen = generation;
    ruta = laddaKompis().then(async (m) => {
      const { skapaUtmaningsruta } = await import("./schack-lobby-vy.js");
      if (!levande || gen !== generation) return null;
      foljer = m.bevakaKlass(kompis, (klass) => {
        const mitt = m.partiFor(klass.partier, kompis.uid);
        if (mitt && mitt !== vyPartiId && !m.arLamnat(mitt)) go(partiHash(mitt));
      });
      return skapaUtmaningsruta(rutaEl, { kompis, tillParti: (id) => go(partiHash(id)) });
    });
  }
  function lobbyAv() {
    stang(ruta);
    ruta = null;
    foljer?.();
    foljer = null;
  }

  function visaStart() {
    const p = pagaende(c);
    yta.innerHTML = startHtml(p, { kompis: Boolean(kompis) });
    yta.querySelector('[data-act="fortsatt"]')?.addEventListener("click", () => go(tillHash("vy=dator")));
    yta.querySelector('[data-act="dator"]').addEventListener("click", () => go(tillHash("vy=dator&ny=1")));
    yta.querySelector('[data-act="lar"]').addEventListener("click", () => go(tillHash("vy=lar")));
    yta.querySelector('[data-act="pussel"]').addEventListener("click", () => go(tillHash("vy=pussel")));
    if (kompis) yta.querySelector('[data-act="kompis"]').addEventListener("click", () => go(tillHash("vy=kompis")));
  }

  function visaNivaval() {
    const val = lasVal(c.lagring, c.nyckel);
    const p = pagaende(c);
    const gen = generation;
    const rita = () => { yta.innerHTML = nivavalHtml(val, p, c.mynt ? c.mynt.nu() : undefined); };
    rita();
    // Bockarna (#798): kvittot läses en gång per besök – rita om när det kommit.
    if (c.mynt && !c.mynt.nu()) c.mynt.kvitto().then((k) => { if (k && levande && gen === generation) rita(); });
    const markera = (klass, attr, varde) => {
      for (const b of yta.querySelectorAll(`.${klass}`)) {
        const vald = b.dataset[attr] === varde;
        b.classList.toggle("vald", vald);
        b.setAttribute("aria-checked", String(vald));
      }
    };
    yta.addEventListener("click", (e) => {
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
      const el = document.createElement("div");
      yta.replaceChildren(el);
      return skapaDatorVy(el, {
        parti, namn: c.namn || "Du", avatarHtml: c.avatarHtml, dator: hamtaDator(c),
        reducedMotion: c.reducedMotion, tidsgransMs: c.tidsgransMs, tankMinMs: c.tankMinMs,
        spara: (p) => sparaParti(c.lagring, c.nyckel, p),
        onSlut: c.onDatorSlut,
        mynt: c.mynt,
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

  function visaGuide(lektion) {
    const gen = generation;
    return import("./schack-guide-vy.js").then(({ skapaGuideVy }) => {
      if (gen !== generation) return null;
      const el = document.createElement("div");
      yta.replaceChildren(el);
      return skapaGuideVy(el, {
        lektion, guide: c.guide, mynt: c.mynt, go, tillHash, hashBas, namn: c.namn, avatarHtml: c.avatarHtml,
        dator: () => hamtaDator(c), lagring: c.lagring, nyckel: c.nyckel,
        reducedMotion: c.reducedMotion, tidsgransMs: c.tidsgransMs, tankMinMs: c.tankMinMs,
      });
    });
  }

  function visaPussel(sort, nr) {
    const gen = generation;
    return import("./schack-pussel-vy.js").then(({ skapaPusselVy }) => {
      if (gen !== generation) return null;
      const el = document.createElement("div");
      yta.replaceChildren(el);
      return skapaPusselVy(el, {
        sort, nr, pussel: c.pussel, mynt: c.mynt, go, tillHash, hashBas, lagring: c.lagring, nyckel: c.nyckel,
        reducedMotion: c.reducedMotion, forsvarMs: c.forsvarMs,
      });
    });
  }

  function visaLobby() {
    const gen = generation;
    return import("./schack-lobby-vy.js").then(({ skapaLobbyVy }) => {
      if (gen !== generation) return null;
      const el = document.createElement("div");
      yta.replaceChildren(el);
      return skapaLobbyVy(el, { kompis, tillParti: (id) => go(partiHash(id)), tillStart: () => go(hashBas) });
    });
  }

  function visaKompisParti(partiId, { fortsatt = false } = {}) {
    const gen = generation;
    return Promise.all([import("./schack-kompis-vy.js"), laddaKompis()]).then(([{ skapaKompisVy }]) => {
      if (gen !== generation) return null;
      const el = document.createElement("div");
      yta.replaceChildren(el);
      const tillLobby = ({ ersatt = false } = {}) => {
        if (ersatt && typeof history !== "undefined" && location.hash.startsWith(hashBas)) {
          history.replaceState(null, "", tillHash("vy=kompis"));
          byt(visaLobby);
          lobbyPa();
        } else go(tillHash("vy=kompis"));
      };
      return skapaKompisVy(el, {
        kompis, partiId, fortsatt, avatarHtml: c.avatarHtml, reducedMotion: c.reducedMotion, tillLobby,
        // Efter slutet: utmaningsrutan igen och "till partiet" när ett nytt startar (Spela igen).
        onSlut: () => lobbyPa(partiId),
        spelaIgen: async (p) => {
          const moln = await kompis.moln();
          const motst = p.vit === kompis.uid ? p.svart : p.vit;
          await moln.lobby.utmana(p.classId || kompis.classId, motst, p.klocka?.minuter ?? null);
          tillLobby();
        },
      });
    });
  }

  if (params.vy === "kompis" && kompis) {
    if (params.parti) byt(() => visaKompisParti(params.parti));
    else {
      byt(visaLobby);
      lobbyPa();
    }
  } else if (params.vy === "lar") {
    byt(() => visaGuide(params.lektion || null));
    lobbyPa();
  } else if (params.vy === "pussel") {
    // Direktlänken &nr=N gäller en gång: hashen skrivs om utan den, så att en omladdning
    // fortsätter där eleven är (läget sparas lokalt) i stället för att hoppa tillbaka.
    const nr = Number.parseInt(params.nr, 10);
    if (params.nr && typeof history !== "undefined" && location.hash.startsWith(hashBas)) {
      history.replaceState(null, "", tillHash(`vy=pussel&sort=${encodeURIComponent(params.sort || "")}`));
    }
    byt(() => visaPussel(params.sort || null, Number.isInteger(nr) && nr >= 1 ? nr : undefined));
    lobbyPa();
  } else if (params.vy === "dator") {
    const p = params.ny ? null : lasParti(c.lagring, c.nyckel);
    if (p) byt(() => visaParti(p));
    else byt(visaNivaval);
    lobbyPa();
  } else if (kompis && c.fortsattParti) {
    // Eleven kom in på schacksidan med ett pågående kompisparti: tillbaka till det (§7.1).
    if (typeof history !== "undefined" && location.hash.startsWith(hashBas)) history.replaceState(null, "", partiHash(c.fortsattParti));
    const id = c.fortsattParti;
    byt(() => visaKompisParti(id, { fortsatt: true }));
  } else {
    byt(visaStart);
    lobbyPa();
  }

  return {
    /** Den aktiva vyn (lobbyn/partivyerna är löften tills modulen laddats). */
    aktiv: () => aktiv,
    destroy() {
      levande = false;
      lobbyAv();
      stang(aktiv);
      aktiv = null;
      generation++;
      host.innerHTML = "";
    },
  };
}
