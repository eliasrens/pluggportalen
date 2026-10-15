// ============================================================================
// Bråkdraken – gemensam drakpanel (src/brakresan/drakpanel.js) · #713 H
// ----------------------------------------------------------------------------
// Spec §9 "Gemensam drakpanel" + §11 "Huvudvy". LAT modul – Bråkresan och
// huset (I #714) importerar den dynamiskt, aldrig från bootgrafen.
//
//   drakInfo(state, { idag })   → texterna (ren, testad): namn, nivå, stjärnor,
//                                 nästa tröskel, jaktens intervall/historik
//   createDrakkort(host, o)     → kompakt kort i huvudvyn: draken, namn, nivå,
//                                 nästa mål och ingången "Om draken" → panelen
//   oppnaDrakpanel(o)           → SAMMA panel i Bråkresan och huset (dialog):
//                                 namn + byt namn, nivå, stjärnor totalt, nästa
//                                 tröskel, dagens jakt, intervall, genomförda
//                                 jakter och funna mynt; "Fullt utvecklad" vid 150.
//                                 o.forandring = { fran, till } spelar kläckning
//                                 (fran 0) eller evolution FÖRST i panelen –
//                                 progressionen är redan sparad av servern (§9).
//
// o = { state, byt?(namn) → { name }, jakt?(yta, info), onStang?, fokusTillbaka? }
//   byt   – standard: data.js renameDragon (servern rensar texten)
//   jakt  – guldjaktens knapp/animation (J #715) ritas i `yta`; utan den
//           visas status och historik men ingen knapp. Ägget har aldrig knapp.
// ============================================================================

import { h } from "./komponenter/bas.js";
import {
  dragonProgress, huntMax, cleanDragonName, DRAGON_DEFAULT_NAME, DRAGON_NAME_MAX, MAX_TOTAL_STARS,
} from "./schema/regler.js";

let cssLaddad = null;
export function ensureDrakpanelCss() {
  if (cssLaddad) return cssLaddad;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./drakpanel.css", import.meta.url).href;
  cssLaddad = new Promise((resolve) => {
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", resolve, { once: true });
    setTimeout(resolve, 1500);
  });
  document.head.appendChild(link);
  return cssLaddad;
}

const stjarnor = (n) => `${n} ${n === 1 ? "stjärna" : "stjärnor"}`;

/** Panelens innehåll som text. `idag` = "ÅÅÅÅ-MM-DD" (bara för visning – servern avgör jakten). */
export function drakInfo(state, { idag = null } = {}) {
  const stars = Math.max(0, Math.min(MAX_TOTAL_STARS, Math.floor(Number(state?.totalStars) || 0)));
  const p = dragonProgress(stars);
  const klackt = !p.egg;
  const fran = p.egg ? 0 : p.level * 10;
  const till = p.fullyGrown ? MAX_TOTAL_STARS : p.nextAt;
  const hunts = state?.hunts || {};
  return {
    stars,
    level: p.level,
    egg: p.egg,
    fullyGrown: p.fullyGrown,
    namn: klackt ? (state?.dragon?.name || DRAGON_DEFAULT_NAME) : "Drakägget",
    nivaText: p.egg ? "Ägg" : `Nivå ${p.level} av 15`,
    starsText: `${stars} av ${MAX_TOTAL_STARS} stjärnor`,
    nastaText: p.fullyGrown ? "Fullt utvecklad"
      : p.egg ? `${stjarnor(p.starsToNext)} kvar tills ägget kläcks`
        : `${stjarnor(p.starsToNext)} kvar till nivå ${p.level + 1}`,
    progress: { fran, till, andel: p.fullyGrown ? 1 : (stars - fran) / (till - fran) },
    jakt: p.egg ? null : {
      max: huntMax(p.level),
      intervallText: `1–${huntMax(p.level)} mynt`,
      antal: hunts.count || 0,
      mynt: hunts.coins || 0,
      klarIdag: !!idag && hunts.lastDate === idag,
    },
  };
}

/** Draken som SVG (lat konst) + tomgångsrörelser. Returnerar stoppfunktion. */
async function ritaDrake(yta, info, { tomgang = true } = {}) {
  const [{ drakeSvg }, anim] = await Promise.all([import("./art-drake.js"), tomgang ? import("./art-drake-anim.js") : null]);
  yta.innerHTML = drakeSvg(info.level, {
    stjarnor: info.stars,
    titel: info.egg ? `Drakägg, ${info.nastaText}` : `${info.namn}, Bråkdraken nivå ${info.level}`,
  });
  const svg = yta.querySelector("svg");
  return anim && svg ? anim.startaTomgang(svg) : () => {};
}

function progressNod(info) {
  const proc = Math.round(info.progress.andel * 100);
  return h("div", { class: "bdp-progress" },
    h("div", {
      class: "bdp-stapel", role: "progressbar", "aria-valuemin": info.progress.fran, "aria-valuemax": info.progress.till,
      "aria-valuenow": info.stars, "aria-valuetext": info.nastaText,
    }, h("span", { class: "bdp-fyllnad", style: `width:${proc}%` })),
    h("p", { class: "bdp-nasta" }, info.fullyGrown ? "✪ Fullt utvecklad" : info.nastaText));
}

/**
 * Kompakt drakkort för huvudvyn (§11): tar liten plats, öppnar panelen.
 * @returns {Promise<{ el, uppdatera(state), destroy() }>}
 */
export async function createDrakkort(host, { state, oppna }) {
  await ensureDrakpanelCss();
  let stopp = () => {};
  const el = h("section", { class: "bdp-kort", "aria-label": "Din Bråkdrake" });
  host.append(el);
  async function rita(st) {
    stopp();
    const info = drakInfo(st);
    const bild = h("button", { type: "button", class: "bdp-kort-bild", "aria-label": `Öppna drakpanelen för ${info.namn}`, onclick: () => oppna?.(bild) });
    const om = h("button", { type: "button", class: "bdp-om", onclick: () => oppna?.(om) },
      info.egg ? "Om ägget" : "Om draken och guldjakten");
    el.replaceChildren(bild, h("div", { class: "bdp-kort-text" },
      h("p", { class: "bdp-kort-namn" }, info.namn),
      h("p", { class: "bdp-kort-niva" }, info.nivaText),
      progressNod(info), om));
    stopp = await ritaDrake(bild, info);
  }
  await rita(state);
  return { el, uppdatera: rita, destroy: () => { stopp(); el.remove(); } };
}

/** Namnraden: namnet + "Byt namn" → litet formulär (servern rensar texten). */
function namnRad(info, { byt, onNytt, fraga = false }) {
  const rad = h("div", { class: "bdp-namnrad" });
  const status = h("p", { class: "bdp-namnstatus", role: "status" });
  const visa = () => {
    rad.replaceChildren(h("h2", { class: "bdp-namn", id: "bdp-titel" }, info.namn),
      h("button", { type: "button", class: "bdp-lank", onclick: redigera }, "Byt namn"));
  };
  function redigera() {
    const falt = h("input", {
      type: "text", class: "bdp-falt", maxlength: DRAGON_NAME_MAX, value: info.namn, autocomplete: "off",
      "aria-label": "Drakens namn", spellcheck: "false",
    });
    const form = h("form", { class: "bdp-namnform" },
      fraga ? h("p", { class: "bdp-fraga" }, `Vad ska din drake heta? Du kan också behålla ${info.namn} och byta senare.`) : null,
      h("h2", { class: "bdp-namn bdp-namn--dold", id: "bdp-titel" }, info.namn),
      falt,
      h("button", { type: "submit", class: "bdp-knapp bdp-knapp--primar" }, "Spara namnet"),
      h("button", { type: "button", class: "bdp-knapp", onclick: () => { status.textContent = ""; visa(); } }, fraga ? "Behåll namnet" : "Avbryt"));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const namn = cleanDragonName(falt.value);
      if (!namn) { status.textContent = `Skriv ett namn med 1–${DRAGON_NAME_MAX} tecken.`; falt.focus(); return; }
      if (namn === info.namn) { status.textContent = ""; visa(); return; }
      form.querySelectorAll("button, input").forEach((x) => { x.disabled = true; });
      status.textContent = "Sparar …";
      try {
        const res = await byt(namn);
        info.namn = res?.name || namn;
        status.textContent = `Sparat! Draken heter nu ${info.namn}.`;
        onNytt?.(info.namn);
        visa();
      } catch (err) {
        form.querySelectorAll("button, input").forEach((x) => { x.disabled = false; });
        status.textContent = err?.message || "Namnet kunde inte sparas. Försök igen.";
      }
    });
    rad.replaceChildren(form);
    falt.focus();
    falt.select();
  }
  visa();
  return { el: h("div", null, rad, status), redigera };
}

function jaktDel(info, jakt) {
  if (!info.jakt) {
    return h("section", { class: "bdp-jakt", "aria-label": "Guldjakt" },
      h("h3", null, "Daglig guldjakt"),
      h("p", null, "Guldjakten börjar när ägget har kläckts vid 10 stjärnor. Då kan draken leta mynt en gång per dag."));
  }
  const j = info.jakt;
  const yta = h("div", { class: "bdp-jakt-yta" },
    h("p", { class: "bdp-jakt-status" }, j.klarIdag ? "Dagens jakt är klar – tillbaka imorgon." : "Dagens jakt är inte gjord än."));
  const del = h("section", { class: "bdp-jakt", "aria-label": "Guldjakt" },
    h("h3", null, "Daglig guldjakt"),
    yta,
    h("dl", { class: "bdp-fakta" },
      h("div", null, h("dt", null, "Fynd per jakt"), h("dd", null, j.intervallText)),
      h("div", null, h("dt", null, "Genomförda jakter"), h("dd", null, String(j.antal))),
      h("div", null, h("dt", null, "Funna mynt totalt"), h("dd", null, String(j.mynt)))));
  jakt?.(yta, info);
  return del;
}

/**
 * Drakpanelen som dialog (Esc/Stäng, fokus tillbaka). Samma i Bråkresan och huset.
 * @returns {Promise<void>} när panelen stängts
 */
export async function oppnaDrakpanel({ state, byt, jakt, forandring = null, onVisad, onNamn, fokusTillbaka = null, idag = null } = {}) {
  await ensureDrakpanelCss();
  const info = drakInfo(state, { idag });
  byt ||= async (namn) => (await import("./data.js")).renameDragon(namn);
  let stopp = () => {};
  // Kläckning/evolution räknas som visad när scenen är klar, hoppats över ELLER panelen stängts.
  let visadKlar = !forandring;
  const visad = () => { if (!visadKlar) { visadKlar = true; onVisad?.(forandring.till); } };
  const dlg = h("dialog", { class: "bdp-dialog", "aria-labelledby": "bdp-titel" });
  const bild = h("div", { class: "bdp-bild" });
  const namn = namnRad(info, { byt, onNytt: onNamn, fraga: forandring?.fran === 0 });
  dlg.append(
    h("button", { type: "button", class: "bdp-stang", "aria-label": "Stäng drakpanelen", onclick: () => dlg.close() }, "✕"),
    bild,
    h("div", { class: "bdp-innehall" },
      namn.el,
      h("p", { class: "bdp-niva" }, h("strong", null, info.nivaText), " · ", info.starsText),
      progressNod(info),
      jaktDel(info, jakt)));
  document.body.append(dlg);
  const klar = new Promise((resolve) => {
    dlg.addEventListener("close", () => {
      stopp();
      visad();
      dlg.remove();
      fokusTillbaka?.focus?.();
      resolve();
    }, { once: true });
  });
  dlg.showModal();

  if (forandring && forandring.till > forandring.fran) {
    // Servern har redan sparat nivån – animationen är ren presentation och kan hoppas över.
    const anim = await import("./art-drake-anim.js");
    bild.classList.add("bdp-bild--scen");
    try {
      const svg = forandring.fran === 0
        ? await anim.spelaKlackning(bild, { namn: info.namn })
        : await anim.spelaEvolution(bild, forandring.fran, forandring.till);
      visad();
      if (dlg.open && svg) stopp = anim.startaTomgang(svg);
      if (dlg.open && forandring.fran === 0) namn.redigera();
    } catch {
      visad();
    }
  } else {
    stopp = await ritaDrake(bild, info);
  }
  return klar;
}
