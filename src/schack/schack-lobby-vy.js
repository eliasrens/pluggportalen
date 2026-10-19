// ============================================================================
// Lobbyn "Spela mot en kompis" (#780, §7.1, §8) och rutan för inkommande
// utmaningar. Båda läser klassdokumentet via bevakaKlass (EN delad
// onSnapshot, schack-kompis.js) och gör allt annat med callables
// (moln.lobby.*) – inga skrivningar per sekund, ingen närvaro-ping.
// Utgångna väntan/utmaningar filtreras bort lokalt (lobbyVy) och vyn ritar om
// när nästa post går ut.
//
//   const vy = skapaLobbyVy(host, { kompis, go, tillParti(partiId), tillStart() });   vy.destroy();
//   const ruta = skapaUtmaningsruta(host, { kompis, tillParti });                      ruta.destroy();
//   kompis = { moln, classId, uid, klasslista: () => Promise<[{uid, namn, avatarHtml}]> }
// ============================================================================

import { bevakaKlass } from "./schack-kompis.js";
import { esc } from "./schack-bradet-delar.js";
import { lobbyVy, utmanaLista, topplistaRader } from "./schack-kompis-data.js";
import {
  lobbySkalHtml, minDelHtml, vantarHtml, utmanaHtml, pagaendeHtml, topplistaHtml, inkommandeHtml,
} from "./schack-kompis-delar.js";

const FEL_MS = 8_000;

/** Klockvalet minns under besöket (null = ingen klocka). */
let senastKlocka = 10;

const nu = (moln) => (moln?.serverNow ? moln.serverNow() : Date.now());
const felText = (e) => e?.message || "Det gick inte just nu – försök igen.";

/** Ritar om en sektion bara när innehållet ändrats (fokus och skroll står kvar). */
function satt(el, html) {
  if (el && el._html !== html) {
    el._html = html;
    el.innerHTML = html;
  }
}

/** Timer som ritar om när nästa väntan/utmaning går ut. */
function utgangsTimer(rita) {
  let t = null;
  return {
    satt(ms) {
      clearTimeout(t);
      t = ms == null ? null : setTimeout(rita, Math.min(ms + 50, 2 ** 31 - 1));
    },
    stopp: () => clearTimeout(t),
  };
}

export function skapaLobbyVy(host, ctx) {
  const k = ctx.kompis;
  let moln = null;
  let klass = null;
  let klasslista = null;
  let upptagen = false;
  let levande = true;
  host.innerHTML = lobbySkalHtml();
  const $ = (s) => host.querySelector(s);
  const felEl = $(".schack-lobby-fel");
  const timer = utgangsTimer(() => rita());

  let felTimer = null;
  /** Felraden; ett fel från ett anrop försvinner efter några sekunder (F4). */
  const visaFel = (text, { kvar = false } = {}) => {
    clearTimeout(felTimer);
    felEl.textContent = text || "";
    felEl.hidden = !text;
    if (text && !kvar) felTimer = setTimeout(() => { if (levande) visaFel(""); }, FEL_MS);
  };
  const namnFor = (uid) => klasslista?.find((x) => x.uid === uid)?.namn || "";
  const avatarFor = (uid) => klasslista?.find((x) => x.uid === uid)?.avatarHtml || "";

  function rita() {
    if (!levande) return;
    if (!klass) {
      satt($(".schack-lobby-min"), `<p class="hint schack-lobby-tom">Öppnar lobbyn …</p>`);
      return;
    }
    const vy = lobbyVy(klass, k.uid, nu(moln));
    const utmanadNamn = vy.utgaende ? namnFor(vy.utgaende.till) : "";
    satt($(".schack-lobby-min"), minDelHtml(vy, { klocka: senastKlocka, upptagen, utmanadNamn }));
    satt($(".schack-lobby-vantar"), vantarHtml(vy, { avatarFor, upptagen }));
    satt($(".schack-lobby-utmana"), utmanaHtml(utmanaLista(klasslista || [], k.uid, vy), { avatarFor, upptagen, klocka: senastKlocka, laddar: !klasslista }));
    satt($(".schack-lobby-pagaende"), pagaendeHtml(vy));
    const top = $(".schack-lobby-topplista");
    satt(top, topplistaHtml(topplistaRader(klass.tabell, k.uid, namnFor), { dold: klass.dold }));
    top.hidden = klass.dold === true;
    timer.satt(vy.nastaUtgang);
  }

  /** Ett lobbyanrop: knapparna låsta medan det går, serverns fel som text. */
  async function gor(fn) {
    if (upptagen || !moln) return null;
    upptagen = true;
    visaFel("");
    rita();
    try {
      return await fn(moln.lobby);
    } catch (e) {
      if (levande) visaFel(felText(e));
      return null;
    } finally {
      upptagen = false;
      if (levande) rita();
    }
  }

  const HANDLING = {
    tillbaka: () => ctx.tillStart?.(),
    vanta: () => gor((l) => l.vanta(k.classId, senastKlocka)),
    "sluta-vanta": () => gor((l) => l.slutaVanta(k.classId)),
    "ta-tillbaka": () => gor((l) => l.slutaVanta(k.classId)),
    spela: async (b) => {
      const r = await gor((l) => l.gaMed(k.classId, b.dataset.uid));
      if (r?.partiId && levande) ctx.tillParti?.(r.partiId);
    },
    utmana: (b) => gor((l) => l.utmana(k.classId, b.dataset.uid, senastKlocka)),
  };
  const klick = (e) => {
    const kl = e.target.closest("[data-klocka]");
    if (kl) {
      senastKlocka = kl.dataset.klocka === "" ? null : Number(kl.dataset.klocka);
      rita();
      host.querySelector(`[data-klocka="${senastKlocka ?? ""}"]`)?.focus({ preventScroll: true });
      return;
    }
    const b = e.target.closest("[data-act]");
    if (b && !b.disabled && HANDLING[b.dataset.act]) HANDLING[b.dataset.act](b);
  };
  host.addEventListener("click", klick);

  Promise.resolve(k.moln()).then((m) => { moln = m; if (levande) rita(); }).catch(() => {});
  Promise.resolve(k.klasslista?.() ?? []).then((l) => { klasslista = l || []; if (levande) rita(); }).catch(() => { klasslista = []; if (levande) rita(); });
  const sluta = bevakaKlass(k, (ny) => {
    klass = ny;
    rita();
  }, () => {
    visaFel("Lobbyn gick inte att öppna just nu. Prova att ladda om sidan.", { kvar: true });
  });
  rita();

  return {
    rita,
    destroy() {
      levande = false;
      timer.stopp();
      clearTimeout(felTimer);
      sluta();
      host.removeEventListener("click", klick);
      host.innerHTML = "";
    },
  };
}

/**
 * Inkommande utmaningar (§7.1): en tydlig ruta "Sara vill spela schack med dig
 * (10 min)" med Spela!/Nej tack. Försvinner 2 min efter `sedan` (lokalt räknat).
 */
export function skapaUtmaningsruta(host, ctx) {
  const k = ctx.kompis;
  let moln = null;
  let klass = null;
  let upptagen = false;
  let fel = "";
  let levande = true;
  const timer = utgangsTimer(() => rita());

  function rita() {
    if (!levande) return;
    const vy = klass && moln ? lobbyVy(klass, k.uid, nu(moln)) : null;
    const lista = vy && !vy.mittParti ? vy.inkommande : [];
    const html = inkommandeHtml(lista, { upptagen }) + (fel ? `<p class="schack-lobby-fel" role="alert">${esc(fel)}</p>` : "");
    satt(host, html);
    host.hidden = !html;
    timer.satt(vy?.nastaUtgang ?? null);
  }

  async function svara(id, ja) {
    if (upptagen || !moln) return;
    upptagen = true;
    fel = "";
    rita();
    try {
      const r = await moln.lobby.svara(id, ja, k.classId);
      if (ja && r?.partiId && levande) ctx.tillParti?.(r.partiId);
    } catch (e) {
      fel = felText(e);
      setTimeout(() => { fel = ""; rita(); }, FEL_MS);
    } finally {
      upptagen = false;
      rita();
    }
  }
  const klick = (e) => {
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    if (b.dataset.act === "svara-ja") svara(b.dataset.id, true);
    else if (b.dataset.act === "svara-nej") svara(b.dataset.id, false);
  };
  host.addEventListener("click", klick);
  host.hidden = true;
  Promise.resolve(k.moln()).then((m) => { moln = m; rita(); }).catch(() => {});
  const sluta = bevakaKlass(k, (ny) => { klass = ny; rita(); });

  return {
    destroy() {
      levande = false;
      timer.stopp();
      sluta();
      host.removeEventListener("click", klick);
      host.innerHTML = "";
      host._html = undefined;
      host.hidden = true;
    },
  };
}
