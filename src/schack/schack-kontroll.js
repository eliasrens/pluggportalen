// ============================================================================
// Schackbrädets logik utan DOM (#775, spec §1 + §2.2). Brädet i
// schack-bradet.js ritar bara det här tillståndet och skickar hit trycken,
// släppen och tangenterna – så att hela interaktionen (markera, flytta, byta
// markering, förvandla, ångra, fånga ett drag innan det görs) kan testas i
// node utan webbläsare.
//
// Ingen egen regelkod: allt som är lagligt, schack, matt, patt och remi frågas
// från chess.js. Bara lagliga drag visas som möjliga och bara de kan göras –
// ett drag som ställer eller lämnar den egna kungen i schack finns alltså
// aldrig bland målrutorna och nekas om någon ändå släpper pjäsen där.
// ============================================================================

import { Chess } from "./vendor/chess.js";
import { START_FEN, statusFor, slutFor, schackRuta, tagnaPjaser, dragLista, svenskSan } from "./schack-text.js";

/** Anropa sidans callback utan att ett fel i den stoppar brädet (draget är redan gjort). */
function sakert(fn, ...args) {
  if (!fn) return;
  try {
    fn(...args);
  } catch (e) {
    console.error("schack: fel i callback", e);
  }
}

/** Ett drag som det lämnas till onMove / beforeMove (vanliga data, ingen chess.js-klass). */
function dragInfo(m) {
  return {
    from: m.from, to: m.to, promotion: m.promotion || null, piece: m.piece, color: m.color,
    captured: m.captured || null, flags: m.flags, san: m.san, sanSv: svenskSan(m.san), fore: m.before, efter: m.after,
  };
}

/**
 * @param {object} [opt]
 * @param {string} [opt.fen]            startställning (annars utgångsställningen)
 * @param {"w"|"b"} [opt.orientering]   färgen som står närmast eleven (standard: egenFarg eller vit)
 * @param {true|false|"w"|"b"} [opt.interaktiv]  vem eleven får flytta: true = den som är på tur
 *        (båda sidor, som i förhandsvisningen), "w"/"b" = bara den färgen, false = ingen
 * @param {"w"|"b"|null} [opt.egenFarg] elevens färg – styr statusraden ("Din tur", "du vann")
 * @param {"dator"|"kompis"|null} [opt.motstandare]
 * @param {{w?: string, b?: string}} [opt.namn]
 * @param {(drag, state) => boolean|void|Promise<boolean|void>} [opt.beforeMove]
 *        anropas innan elevens drag görs. Svarar den `false` (eller ett löfte som
 *        blir false) görs draget inte. Medan löftet väntar visas pjäsen halvgenomskinlig
 *        på målrutan (state.pagaende). Drag från koden (move()) passerar inte här.
 * @param {(drag, state) => void} [opt.onMove]       efter varje gjort drag (elevens och kodens)
 * @param {(slut, state) => void} [opt.onGameOver]   när partiet tar slut
 */
export function skapaSchackKontroll(opt = {}) {
  let chess = new Chess();
  try {
    if (opt.fen) chess = new Chess(opt.fen);
  } catch { /* ogiltig FEN → utgångsställningen */ }
  let startFen = chess.fen();
  let egenFarg = opt.egenFarg ?? null;
  let motstandare = opt.motstandare ?? null;
  let namn = { ...(opt.namn || {}) };
  let orientering = opt.orientering || egenFarg || "w";
  let interaktiv = opt.interaktiv ?? true;
  let vald = null;
  let forvandling = null;
  let pagaende = null;
  let senast = null;
  let pilar = [];
  let statusText = null;
  let externtSlut = null;
  const lyssnare = new Set();
  const cb = { beforeMove: opt.beforeMove, onMove: opt.onMove, onGameOver: opt.onGameOver };

  const slut = () => externtSlut || slutFor(chess);

  function tillaten(farg) {
    return interaktiv === true || interaktiv === farg;
  }

  /** Får eleven ta i pjäsen på rutan just nu? */
  function kanValja(ruta) {
    if (slut() || pagaende || forvandling) return false;
    const p = chess.get(ruta);
    return !!p && p.color === chess.turn() && tillaten(p.color);
  }

  function lagligaDrag(ruta) {
    try {
      return chess.moves({ square: ruta, verbose: true });
    } catch {
      return [];
    }
  }

  function hittaLaglig(drag) {
    if (typeof drag === "string") return chess.moves({ verbose: true }).find((m) => m.san === drag || m.lan === drag) || null;
    if (!drag) return null;
    const kandidater = lagligaDrag(drag.from).filter((m) => m.to === drag.to);
    if (!kandidater.length) return null;
    if (!kandidater[0].promotion) return kandidater[0];
    return kandidater.find((m) => m.promotion === (drag.promotion || "q")) || null;
  }

  function getState() {
    const pjaser = [];
    for (const rad of chess.board()) for (const p of rad) if (p) pjaser.push({ ruta: p.square, color: p.color, type: p.type });
    const mal = [];
    if (vald) {
      for (const m of lagligaDrag(vald)) if (!mal.some((x) => x.to === m.to)) mal.push({ to: m.to, tar: !!m.captured });
    }
    const historik = chess.history();
    const lista = dragLista(historik, startFen);
    const { tagna, fordel } = tagnaPjaser(chess);
    const s = slut();
    const status = statusText != null && !s
      ? { text: statusText, ton: chess.isCheck() ? "schack" : "normal", orsak: "" }
      : statusFor(chess, { egenFarg, motstandare, namn, slut: externtSlut });
    return {
      fen: chess.fen(), tur: chess.turn(), pjaser, vald, mal, forvandling, pagaende, senast,
      schackRuta: schackRuta(chess), orientering, interaktiv, pilar: pilar.slice(), status, slut: s,
      drag: historik, dragText: lista.text, dragRader: lista.rader, tagna, fordel, egenFarg, motstandare, namn: { ...namn },
    };
  }

  function emit(handelse) {
    if (!lyssnare.size) return;
    const state = getState();
    for (const fn of lyssnare) sakert(fn, state, handelse);
  }

  function utfor(m, kalla) {
    const gjort = chess.move({ from: m.from, to: m.to, promotion: m.promotion });
    senast = { from: gjort.from, to: gjort.to };
    vald = null;
    forvandling = null;
    pilar = [];
    statusText = null;
    const info = dragInfo(gjort);
    emit({ typ: "drag", drag: info, kalla });
    sakert(cb.onMove, info, getState());
    const s = slut();
    if (s) sakert(cb.onGameOver, s, getState());
    return info;
  }

  /** Elevens drag: frågar beforeMove först. */
  function skicka(drag) {
    const m = hittaLaglig(drag);
    if (!m) return { typ: "nekad" };
    vald = null;
    let svar;
    try {
      svar = cb.beforeMove ? cb.beforeMove(dragInfo(m), getState()) : undefined;
    } catch {
      svar = false;
    }
    if (svar && typeof svar.then === "function") {
      const fenFore = chess.fen();
      // Objektet är också väntans "token": har något annat (setPosition, undo,
      // loadGame, en nyare väntan) ersatt det är svaret inaktuellt och rör inget.
      const min = { from: m.from, to: m.to, pjas: { color: m.color, type: m.promotion || m.piece } };
      pagaende = min;
      emit({ typ: "vantar", drag: dragInfo(m) });
      const klart = Promise.resolve(svar).catch(() => false).then((ok) => {
        if (pagaende !== min) return null;
        pagaende = null;
        if (ok === false || externtSlut || chess.fen() !== fenFore) {
          emit({ typ: "nekad", drag: dragInfo(m) });
          return null;
        }
        return utfor(m, "elev");
      });
      return { typ: "vantar", klart };
    }
    if (svar === false) {
      emit({ typ: "nekad", drag: dragInfo(m) });
      return { typ: "nekad" };
    }
    return { typ: "drag", drag: utfor(m, "elev") };
  }

  /** Elevens drag från→till: öppnar förvandlingsväljaren om en bonde når sista raden. */
  function begar(from, to) {
    const kandidater = lagligaDrag(from).filter((m) => m.to === to);
    if (!kandidater.length) return { typ: "nekad" };
    if (kandidater[0].promotion) {
      forvandling = { from, to, farg: kandidater[0].color };
      vald = null;
      emit({ typ: "forvandling" });
      return { typ: "forvandling" };
    }
    return skicka({ from, to });
  }

  function valj(ruta) {
    vald = ruta;
    emit({ typ: "val" });
    return { typ: "vald", ruta };
  }

  function avmarkera() {
    const fanns = vald != null;
    vald = null;
    if (fanns) emit({ typ: "val" });
    return { typ: "avmarkerad" };
  }

  function nollstall(handelse) {
    vald = null;
    forvandling = null;
    pagaende = null;
    pilar = [];
    statusText = null;
    externtSlut = null;
    emit(handelse);
  }

  return {
    getState,
    lagligaDrag: (ruta) => lagligaDrag(ruta).map(dragInfo),
    kanValja,
    subscribe(fn) {
      lyssnare.add(fn);
      return () => lyssnare.delete(fn);
    },

    // --- Elevens handlingar (tryck, dra-och-släpp, väljaren) ---------------
    /** Ett tryck/klick/Enter på en ruta – som på chess.com. */
    tryck(ruta) {
      if (forvandling || pagaende || slut()) return { typ: "ingen" };
      if (vald) {
        if (ruta === vald) return avmarkera();
        if (lagligaDrag(vald).some((m) => m.to === ruta)) return begar(vald, ruta);
        if (kanValja(ruta)) return valj(ruta);
        return avmarkera();
      }
      return kanValja(ruta) ? valj(ruta) : { typ: "ingen" };
    },
    /** Markera en egen pjäs (när eleven börjar dra den). */
    valj: (ruta) => (kanValja(ruta) ? valj(ruta) : { typ: "ingen" }),
    avmarkera,
    /** Pjäsen från `from` släpps på `to` (dra-och-släpp). Olagligt = nekad, markeringen står kvar. */
    slapp(from, to) {
      if (!kanValja(from)) return { typ: "ingen" };
      if (from === to || !to) return valj(from);
      const svar = begar(from, to);
      if (svar.typ === "nekad") valj(from);
      return svar;
    },
    valjForvandling(typ) {
      if (!forvandling || !["q", "r", "b", "n"].includes(typ)) return { typ: "ingen" };
      const { from, to } = forvandling;
      forvandling = null;
      return skicka({ from, to, promotion: typ });
    },
    avbrytForvandling() {
      if (!forvandling) return;
      forvandling = null;
      emit({ typ: "val" });
    },

    // --- API för motståndare (dator, server) och sidan runt brädet ---------
    /** Gör ett drag från koden (datorn/servern): {from,to,promotion} eller SAN. Null om olagligt. */
    move(drag) {
      const m = hittaLaglig(drag);
      return m ? utfor(m, "kod") : null;
    },
    /** Ny ställning (FEN) utan historik. `opt.senast` = {from,to} att markera. False om FEN är ogiltig. */
    setPosition(fen, o = {}) {
      let ny;
      try {
        ny = new Chess(fen);
      } catch {
        return false;
      }
      chess = ny;
      startFen = ny.fen();
      senast = o.senast || null;
      nollstall({ typ: "position" });
      return true;
    },
    /** Ett parti: startställning + drag (SAN eller {from,to,promotion}). False om något är fel. */
    loadGame({ fen = START_FEN, drag = [] } = {}) {
      let ny;
      try {
        ny = new Chess(fen);
        for (const d of drag) ny.move(d);
      } catch {
        return false;
      }
      chess = ny;
      startFen = new Chess(fen).fen();
      const sista = ny.history({ verbose: true }).pop();
      senast = sista ? { from: sista.from, to: sista.to } : null;
      nollstall({ typ: "position" });
      return true;
    },
    /** Partiet att spara: startställning + dragen i chess.js-notation. */
    getGame: () => ({ fen: startFen, drag: chess.history() }),
    getFen: () => chess.fen(),
    getHistory: (verbose = false) => (verbose ? chess.history({ verbose: true }).map(dragInfo) : chess.history()),
    /** Ta tillbaka n drag (Ångra). Returnerar hur många som togs tillbaka. */
    undo(n = 1) {
      let gjort = 0;
      while (gjort < n && chess.undo()) gjort++;
      const sista = chess.history({ verbose: true }).pop();
      senast = sista ? { from: sista.from, to: sista.to } : null;
      nollstall({ typ: "angra", antal: gjort });
      return gjort;
    },
    setOrientation(f) {
      orientering = f === "b" ? "b" : "w";
      emit({ typ: "orientering" });
    },
    flip() {
      orientering = orientering === "w" ? "b" : "w";
      emit({ typ: "orientering" });
    },
    setInteractive(v) {
      interaktiv = v === "w" || v === "b" ? v : !!v;
      if (vald && !kanValja(vald)) vald = null;
      emit({ typ: "val" });
    },
    /** Pil från→till (t.ex. Tips). Flera pilar går; alla försvinner vid nästa drag. */
    showArrow(from, to, o = {}) {
      pilar.push({ from, to, farg: o.farg || "tips" });
      emit({ typ: "pil" });
    },
    clearArrows() {
      pilar = [];
      emit({ typ: "pil" });
    },
    /** Egen statustext (null = den automatiska). Gäller till nästa drag. */
    setStatus(text) {
      statusText = text == null ? null : String(text);
      emit({ typ: "status" });
    },
    /** Spelarna: { egenFarg, motstandare, namn: {w,b} } (de fält som skickas). */
    setSpelare(s = {}) {
      if ("egenFarg" in s) egenFarg = s.egenFarg;
      if ("motstandare" in s) motstandare = s.motstandare;
      if (s.namn) namn = { ...namn, ...s.namn };
      emit({ typ: "spelare" });
    },
    /** Avsluta utifrån (gav upp, tid, avbrutet): { resultat, orsak, vinnare, titel?, text? }. */
    avsluta(s) {
      externtSlut = { resultat: s.resultat || "½-½", orsak: s.orsak || "avbrutet", vinnare: s.vinnare || null, titel: s.titel, text: s.text };
      vald = null;
      forvandling = null;
      pagaende = null; // ett väntande drag görs inte efter slutet
      emit({ typ: "slut" });
      sakert(cb.onGameOver, externtSlut, getState());
    },
  };
}
