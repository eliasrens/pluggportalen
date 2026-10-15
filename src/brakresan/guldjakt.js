// ============================================================================
// Bråkdraken – daglig guldjakt i drakpanelen (src/brakresan/guldjakt.js) · #715 J
// ----------------------------------------------------------------------------
// Spec §10 "Säkert och begripligt jaktflöde". LAT modul – drakpanel.js laddar
// den när panelen visar en kläckt drake, i Bråkresan OCH huset (samma jakt).
//
//   monteraJakt(yta, info, o)  ritar "Skicka på guldjakt" i panelens jaktruta
//     o = { hunt?() → svar, onJakt?(svar), lugn?: bool }
//     1. Knappen låses DIREKT vid klick (dubbelklick ger inget andra anrop).
//     2. Servern (brakresaHunt) avgör dag, nivå, belopp och betalar – en gång.
//     3. FÖRST när svaret är bekräftat: ~4,5 s scen i panelens bild – draken
//        lyfter, flyger iväg, kommer tillbaka med en kista som öppnas och visar
//        det redan fastställda fyndet. Reducerad rörelse → fyndet direkt.
//     4. "Dagens jakt är klar – tillbaka imorgon." + statistiken ur svaret.
//     Fel: saklig text, inga mynt visas, "Försök igen" (servern är idempotent –
//     ett nytt försök samma dag ger samma jakt, aldrig en till).
//     already: true (omladdning, annan flik, huset) → samma fynd igen, utan scen.
//   jaktTexter(svar), jaktFelText(fel)  – texterna (rena, testade)
//   kistaSvg(oppen)                      – kistan (aria-hidden)
// ============================================================================

import { h } from "./komponenter/bas.js";

export const KLAR_TEXT = "Dagens jakt är klar – tillbaka imorgon.";
const mynt = (n) => `${n} mynt`;

/** Texterna för ett bekräftat jaktsvar från servern. */
export function jaktTexter(res) {
  const fynd = mynt(res.amount);
  return {
    fynd: res.already ? `Dagens jakt är redan gjord. Draken hittade ${fynd}.` : `Draken hittade ${fynd}!`,
    plus: `+${res.amount}`,
    detalj: `Nivå ${res.level} letar 1–${res.max} mynt.`,
    klar: KLAR_TEXT,
  };
}

/** Saklig feltext – aldrig ett fynd när resultatet är okänt. */
export function jaktFelText(err) {
  const code = String(err?.code || "");
  if (code === "failed-precondition") return { text: err.message || "Guldjakten börjar när ägget har kläckts.", igen: false };
  if (code === "permission-denied") return { text: "Guldjakten är bara för elever.", igen: false };
  if (code === "unauthenticated") return { text: "Logga in igen för att skicka draken på guldjakt.", igen: false };
  const orsak = err?.retryable ? "Ingen kontakt med servern just nu." : "Guldjakten kunde inte genomföras just nu.";
  return { text: `${orsak} Inga mynt har lagts till. Försök igen – draken jagar ändå bara en gång per dag.`, igen: true };
}

const lugnSystem = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Skattkistan, stängd eller öppen (locket fälls bakåt runt gångjärnet). */
export function kistaSvg(oppen = false) {
  return `<svg class="gj-kista${oppen ? " gj-kista--oppen" : ""}" viewBox="0 0 120 100" aria-hidden="true" focusable="false">` +
    `<g class="gj-glans"><ellipse cx="60" cy="50" rx="34" ry="16" fill="#FFE58A" opacity=".85"/>` +
    `<circle cx="46" cy="50" r="7" fill="#F5C232" stroke="#B9831A" stroke-width="2"/>` +
    `<circle cx="62" cy="46" r="7" fill="#F5C232" stroke="#B9831A" stroke-width="2"/>` +
    `<circle cx="76" cy="51" r="7" fill="#F5C232" stroke="#B9831A" stroke-width="2"/></g>` +
    `<rect x="18" y="50" width="84" height="44" rx="6" fill="#9A5B2E" stroke="#5E3415" stroke-width="3"/>` +
    `<rect x="18" y="62" width="84" height="7" fill="#E8A915"/>` +
    `<rect x="53" y="58" width="14" height="16" rx="3" fill="#E8A915" stroke="#7A5600" stroke-width="2"/>` +
    `<g class="gj-lock"><path d="M18 52 V36 Q18 20 60 20 Q102 20 102 36 V52 Z" fill="#B06A36" stroke="#5E3415" stroke-width="3"/>` +
    `<rect x="18" y="40" width="84" height="7" fill="#E8A915"/></g></svg>`;
}

function stjarnregn(lager) {
  const out = [];
  for (let i = 0; i < 6; i++) {
    const g = h("span", { class: "gj-gnista", style: `left:${62 + i * 5}%;top:${44 + (i % 3) * 10}%` });
    lager.append(g);
    out.push(g);
  }
  return out;
}

/** Kör animationerna; ett borttaget element (panelen stängd) räknas som klart. */
const kor = (steg) => Promise.all(steg.map(([el, kf, o]) =>
  el.animate(kf, { fill: "forwards", easing: "ease-in-out", ...o }).finished.catch(() => {})));

/**
 * Scenen i panelens bild. Ren presentation: fyndet är redan sparat och betalt.
 * @returns {Promise<void>} när kistan står öppen bredvid draken (~4,5 s)
 */
export async function spelaJakt(bild, res, { lugn = lugnSystem() } = {}) {
  if (!bild) return;
  const drake = bild.querySelector(":scope > svg");
  bild.querySelector(".gj-lager")?.remove();
  const lager = h("div", { class: "gj-lager" });
  const kista = h("div", { class: "gj-kista-ruta" });
  kista.innerHTML = kistaSvg(lugn);
  const plus = h("p", { class: "gj-plus" }, jaktTexter(res).plus);
  const text = h("p", { class: "gj-scentext", "aria-hidden": "true" });
  lager.append(kista, plus, text);
  bild.append(lager);
  bild.classList.add("gj-aktiv");
  if (lugn || !drake || typeof drake.animate !== "function") {
    kista.style.opacity = "1";
    plus.style.opacity = "1";
    return;
  }
  const { spelaGest } = await import("./art-drake-anim.js");
  // Knappen ligger under bilden – på en låg skärm måste scenen rullas fram.
  bild.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  // 1. lyfter (0–0,7 s) och 2. flyger iväg åt höger (0,7–1,6 s)
  spelaGest(drake, "fladder");
  text.textContent = "Draken letar guld …";
  await kor([
    [drake, [{ transform: "none" }, { transform: "translateY(-14%) rotate(-4deg)", offset: 0.45 },
      { transform: "translate(130%, -40%) rotate(-12deg) scale(.6)", opacity: 0 }], { duration: 1600 }],
    [text, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 1100 }],
  ]);
  // 3. borta en stund (1,6–2,2 s), 4. tillbaka från vänster med kistan (2,2–3,4 s)
  const kistaIn = kista.animate([{ transform: "translate(-150%, -60%) scale(.7)", opacity: 1 },
    { transform: "none", opacity: 1 }], { duration: 1200, delay: 600, fill: "forwards", easing: "ease-out" });
  spelaGest(drake, "fladder");
  await kor([
    [drake, [{ transform: "translate(-130%, -40%) rotate(8deg) scale(.6)", opacity: 0 },
      { transform: "translate(-30%, -18%) rotate(4deg) scale(.9)", opacity: 1, offset: 0.6 }, { transform: "none", opacity: 1 }],
    { duration: 1200, delay: 600, easing: "ease-out" }],
    [text, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 600 }],
  ]);
  await kistaIn.finished.catch(() => {});
  // 5. kistan öppnas och fyndet syns (3,4–4,5 s)
  kista.querySelector(".gj-kista")?.classList.add("gj-kista--oppen");
  const gnistor = stjarnregn(lager);
  await kor([
    [plus, [{ opacity: 0, transform: "translateY(10px) scale(.8)" }, { opacity: 1, transform: "none" }], { duration: 600, delay: 250 }],
    ...gnistor.map((g, i) => [g, [{ opacity: 0, transform: "scale(.3)" }, { opacity: 1, transform: "translateY(-18px) scale(1)", offset: 0.5 },
      { opacity: 0, transform: "translateY(-34px) scale(.6)" }], { duration: 900, delay: 150 + i * 60 }]),
  ]);
  gnistor.forEach((g) => g.remove());
  // Inga kvarhängande fill: forwards – draken står där den stod från början.
  drake.getAnimations().forEach((a) => a.cancel());
}

/** Hämtar data.js lat (huset laddar inte Bråkresans dataskikt i förväg). */
const standardHunt = async () => (await import("./data.js")).hunt();

/**
 * Jaktrutan i drakpanelen. `info` = drakInfo(state) (info.jakt finns bara för en kläckt drake).
 * @returns {{ el }}
 */
export function monteraJakt(yta, info, { hunt = standardHunt, onJakt, lugn } = {}) {
  const j = info?.jakt;
  if (!j) return { el: yta };
  const status = h("p", { class: "bdp-jakt-status", role: "status" });
  const fynd = h("p", { class: "gj-fynd", "aria-live": "polite" });
  const knapp = h("button", { type: "button", class: "bdp-knapp gj-knapp" }, "🐉 Skicka på guldjakt");
  const dialog = yta.closest(".bdp-dialog");
  const bild = dialog?.querySelector(".bdp-bild");

  const visaKlar = (text) => {
    knapp.remove();
    status.textContent = KLAR_TEXT;
    fynd.textContent = text || "";
    fynd.hidden = !text;
  };
  const uppdateraFakta = (hunts) => {
    if (!hunts) return;
    const del = yta.closest(".bdp-jakt");
    const antal = del?.querySelector('[data-falt="antal"]');
    const summa = del?.querySelector('[data-falt="mynt"]');
    if (antal) antal.textContent = String(hunts.count);
    if (summa) summa.textContent = String(hunts.coins);
  };

  knapp.addEventListener("click", async () => {
    if (knapp.disabled) return;
    knapp.disabled = true; // låses DIREKT – ett dubbelklick blir aldrig ett andra anrop
    knapp.setAttribute("aria-busy", "true");
    knapp.textContent = "Draken gör sig redo …";
    status.textContent = "Skickar draken på guldjakt …";
    fynd.hidden = true;
    let res;
    try {
      res = await hunt();
    } catch (err) {
      const f = jaktFelText(err);
      knapp.removeAttribute("aria-busy");
      status.textContent = f.text;
      if (f.igen) {
        knapp.disabled = false;
        knapp.textContent = "Försök igen";
      } else {
        knapp.remove();
      }
      return;
    }
    const t = jaktTexter(res);
    knapp.textContent = "Draken är ute och letar …";
    status.textContent = res.already ? "" : "Draken är ute och letar guld …";
    // Scenen spelas först när servern har bekräftat fyndet – stängd panel avbryter bara bilden.
    // Summor och saldo visas när kistan öppnats (annars avslöjar de fyndet i förväg).
    try {
      await spelaJakt(bild, res, { lugn: res.already ? true : (lugn ?? lugnSystem()) });
    } finally {
      uppdateraFakta(res.hunts);
      onJakt?.(res);
      visaKlar(`${t.fynd} ${t.detalj}`);
    }
  });

  yta.replaceChildren(status, knapp, fynd);
  if (j.klarIdag) {
    visaKlar(Number.isInteger(j.idagFynd) ? `Dagens fynd: ${mynt(j.idagFynd)}.` : "");
  } else {
    status.textContent = `Draken kan leta ${j.intervallText} en gång per dag.`;
    fynd.hidden = true;
  }
  return { el: yta };
}
