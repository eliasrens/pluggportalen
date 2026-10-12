// ============================================================================
// Ekvationsresan – frågeflödet för typ C–F (src/ekvationsresan/spelvy-typer.js)
// ----------------------------------------------------------------------------
// #625, spec E2.3. Styrs av spelvy.js när uppgiften är av typ C–F. Ritar
// frågepanelen (.ekv-fraga), uppgiftstexten (.ekv-uppgiftstext) och häftet,
// och låter typ-svar.js rätta:
//
//   C Nästa rad      operationsraden står i häftet, eleven skriver/väljer nästa
//                    förenklade rad → vågen animerar draget, nästa steg
//   D Bild → ekv.    vågen utan ekvationsrubrik + texten → eleven skriver ekvationen
//   E Hitta felet    häftet blir "ALVAS LÖSNING", raderna är knappar
//   F Problemlösning texten (+ bild vid föremål) → ekvationen → ctx.onSolve()
//                    (vanliga lösningsvyn i spelvy.js) → losningKlar() →
//                    "Vad betyder x i uppgiften?" → svaret skrivs i häftet
//
// Tangentbord: skrivfrågor har ett eget fält (ENTER svarar), valfrågor tar
// siffrorna 1–3, felraderna i E är knappar (Tab + ENTER).
// ============================================================================

import { TYPE_TEXT } from "./config.js";
import { startTyp, svara, aktuellFraga, typKlar, losningKlar } from "./typ-svar.js";
import { stegRader } from "./uppgiftstyper.js";
import { felForklaring } from "./hitta-felet.js";
import { equationRow } from "./notation.js";
import { fromJSON } from "./equation.js";
import { formatSv, q } from "./rational.js";
import { rowsHtml, rowHtml } from "./min-losning.js";
import { esc } from "./spelvy-html.js";

const genitiv = (namn) => (/[sxz]$/i.test(namn) ? namn : `${namn}s`);

/**
 * @param {object} ctx
 *   ctx.root, ctx.panel (.ekv-fraga), ctx.text (.ekv-uppgiftstext), ctx.rader,
 *   ctx.rubrik (häftets rubrik), ctx.say(html, kind), ctx.vag, ctx.task, ctx.rules
 *   ctx.onSolve(equation)  F: starta den vanliga lösningsvyn
 *   ctx.onFinish({ keepSay })  uppgiften klar → spelvy.finish
 */
export function createTypFlode(ctx) {
  const { task, rules, panel } = ctx;
  const start = fromJSON(task.equation);
  let st = startTyp(task);
  // Raderna i häftet som är klara (notation.js-form); C börjar med uppgiften.
  let hafte = task.type === "C" ? [equationRow(start, "start")] : [];
  let done = false;

  const setFas = (fas) => (ctx.root.dataset.fas = fas);
  const visaHafte = (extra = "") => {
    ctx.rader.innerHTML = rowsHtml(hafte) + extra;
    ctx.rader.parentElement.scrollTop = ctx.rader.parentElement.scrollHeight;
  };

  // --- uppgiftstexten ovanför vågen ------------------------------------------

  function renderText() {
    let html = "";
    if (task.type === "D") html = `<p>${esc(task.bild.text)}</p><p class="ekv-uppgiftstext-x">${esc(task.bild.x)}</p>`;
    if (task.type === "F") html = `<p>${esc(task.problem.text)} <b>${esc(task.problem.fraga)}</b></p>`;
    ctx.text.innerHTML = html;
    ctx.text.hidden = !html;
  }

  // --- frågepanelen ------------------------------------------------------------

  const titel = () => `<span class="ekv-typ-etikett">${esc(TYPE_TEXT[task.type].title)}</span>`;

  function skrivHtml(prompt) {
    return `${titel()}<p class="ekv-fraga-text">${esc(prompt)}</p>
      <form class="ekv-svar" autocomplete="off" novalidate>
        <input class="ekv-svar-falt" type="text" inputmode="text" maxlength="40" enterkeyhint="send"
          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
          aria-label="${esc(prompt)}" placeholder="${esc(TYPE_TEXT.placeholder)}" />
        <button type="submit" class="ekv-gor">${esc(TYPE_TEXT.check)}</button>
      </form>`;
  }

  function valHtml(prompt, alternativ) {
    return `${titel()}<p class="ekv-fraga-text">${esc(prompt)}</p>
      <div class="ekv-val" role="group" aria-label="${esc(prompt)}">${alternativ
        .map((html, i) => `<button type="button" class="ekv-val-knapp" data-val="${i}"><span class="ekv-val-nr">${i + 1}</span> <span>${html}</span></button>`)
        .join("")}</div>`;
  }

  function render() {
    const fraga = aktuellFraga(st);
    if (!fraga) return finish();
    if (fraga.kind === "los") {
      setFas("los");
      panel.hidden = true;
      return ctx.onSolve(start);
    }
    panel.hidden = false;
    if (fraga.kind === "rad") {
      setFas("fraga");
      const [opRad] = stegRader(fraga, rules);
      hafte.push(opRad);
      visaHafte(`<li class="ekv-rad ekv-rad--lucka" aria-label="Nästa rad">… = …</li>`);
      hafte.pop();
      panel.innerHTML =
        fraga.mode === "valj"
          ? valHtml(TYPE_TEXT.C.askChoice, fraga.val.map((eq) => rowHtml(equationRow(eq))))
          : skrivHtml(TYPE_TEXT.C.ask);
      ctx.rader.lastElementChild?.previousElementSibling?.classList.add("ekv-rad--given");
    } else if (fraga.kind === "ekvation") {
      setFas("bygg");
      visaHafte();
      panel.innerHTML = skrivHtml(TYPE_TEXT[task.type].ask);
    } else if (fraga.kind === "steg") {
      setFas("fraga");
      ctx.rubrik.textContent = `${genitiv(task.fel.namn).toUpperCase()} LÖSNING`;
      ctx.rader.innerHTML =
        rowsHtml([equationRow(start, "start")]) +
        fraga.rows
          .map((r, i) => `<li class="ekv-rad ekv-rad--${r.kind} ekv-rad--valbar${r.kind === "op" && i > 0 ? " ekv-rad--nytt-drag" : ""}"><button type="button" class="ekv-rad-knapp" data-rad="${i}" aria-label="Rad ${i + 2}: ${esc(r.text)}">${rowHtml(r)}</button></li>`)
          .join("");
      panel.innerHTML = `${titel()}<p class="ekv-fraga-text">${esc(TYPE_TEXT.E.ask(task.fel.namn))}</p>`;
      ctx.rader.querySelector(".ekv-rad-knapp")?.focus();
    } else if (fraga.kind === "betydelse") {
      setFas("fraga");
      panel.innerHTML = valHtml(`Du fick x = ${formatSv(q(task.solution.n, task.solution.d))}. ${TYPE_TEXT.F.meaning}`, fraga.val.map(esc));
    }
    panel.querySelector(".ekv-svar-falt")?.focus();
    if (!panel.querySelector(".ekv-svar-falt")) panel.querySelector(".ekv-val-knapp")?.focus();
  }

  // --- svar ---------------------------------------------------------------------

  /** Efter rätt (eller visat) svar: häftet/vågen uppdateras, sedan nästa fråga. */
  function framat(fraga, visad) {
    if (fraga.kind === "rad") {
      hafte.push(...stegRader(fraga, rules));
      ctx.vag.visa(fraga.after, { move: fraga.step });
      visaHafte();
      ctx.rader.lastElementChild?.classList.add("ekv-rad--ny");
    } else if (fraga.kind === "ekvation") {
      hafte = [equationRow(start, "start")];
      visaHafte();
    } else if (fraga.kind === "steg") {
      const f = felForklaring(task.fel, start, rules);
      ctx.rader.querySelectorAll(".ekv-rad-knapp").forEach((b) => (b.disabled = true));
      ctx.rader.querySelector(`[data-rad="${fraga.answer}"]`)?.closest("li").classList.add("ekv-rad--felet");
      ctx.say(`${visad ? `${esc(TYPE_TEXT.shown)} ` : "Rätt! "}${esc(f.text)} <span class="ekv-hjalp-forslag">${rowHtml(f.rattRad)}</span>`, visad ? "hjalp" : "feedback");
      ctx.keepSay = true;
    } else if (fraga.kind === "betydelse") {
      const svar = fraga.val[fraga.answer];
      ctx.rader.insertAdjacentHTML("beforeend", `<li class="ekv-rad ekv-rad--svar ekv-rad--ny">Svar: ${esc(svar)}</li>`);
      ctx.say(`${visad ? esc(TYPE_TEXT.shown) : "Rätt!"} ${esc(svar)}`, visad ? "hjalp" : "feedback");
      ctx.keepSay = true;
    }
    if (fraga.kind === "rad" || fraga.kind === "ekvation") {
      ctx.say(visad ? `${esc(TYPE_TEXT.shown)} <b>${esc(equationRow(fraga.kind === "rad" ? fraga.after : fraga.target).text)}</b>` : "Rätt!", visad ? "hjalp" : "feedback");
    }
    render();
  }

  function svar(input, knapp = null) {
    if (done) return;
    const fraga = aktuellFraga(st);
    const r = svara(st, input);
    st = r.st;
    const u = r.utfall;
    if (u.kind === "ratt") return framat(fraga, false);
    if (u.kind === "visad") {
      // Visa svaret och låt eleven läsa innan det går vidare.
      panel.innerHTML = `${titel()}<p class="ekv-fraga-text">${esc(u.message)}</p><button type="button" class="ekv-fortsatt ekv-typ-vidare">FORTSÄTT →</button>`;
      ctx.say(`${esc(TYPE_TEXT.shown)} <b>${esc(visatSvar(fraga))}</b>`, "hjalp");
      const b = panel.querySelector(".ekv-typ-vidare");
      b.addEventListener("click", () => framat(fraga, true), { once: true });
      b.focus();
      return;
    }
    ctx.say(esc(u.message), u.kind === "fel" ? "sparr" : "info");
    if (u.kind === "fel" && knapp) {
      knapp.disabled = true;
      knapp.classList.add("is-fel");
    }
    const falt = panel.querySelector(".ekv-svar-falt");
    if (falt) {
      falt.focus();
      falt.select();
    }
  }

  function visatSvar(fraga) {
    if (fraga.kind === "rad") return equationRow(fraga.after).text;
    if (fraga.kind === "ekvation") return equationRow(fraga.target).text;
    if (fraga.kind === "steg") return fraga.rows[fraga.answer].text;
    return String(fraga.val[fraga.answer]);
  }

  function finish() {
    if (done) return;
    done = true;
    panel.hidden = true;
    ctx.onFinish({ keepSay: !!ctx.keepSay });
  }

  // --- händelser ------------------------------------------------------------------

  const onSubmit = (e) => {
    if (!e.target.closest(".ekv-svar")) return;
    e.preventDefault();
    const v = panel.querySelector(".ekv-svar-falt")?.value.trim();
    if (v) svar(v);
  };
  const onClick = (e) => {
    const val = e.target.closest(".ekv-val-knapp");
    if (val && !val.disabled) svar(Number(val.dataset.val), val);
    const rad = e.target.closest(".ekv-rad-knapp");
    if (rad && !rad.disabled) svar(Number(rad.dataset.rad), null);
  };
  const onKey = (e) => {
    if (done || e.repeat || !/^[1-9]$/.test(e.key) || e.target.closest?.("input")) return;
    const b = panel.querySelector(`.ekv-val-knapp[data-val="${Number(e.key) - 1}"]`);
    if (b && !b.disabled) {
      e.preventDefault();
      svar(Number(b.dataset.val), b);
    }
  };
  panel.addEventListener("submit", onSubmit);
  panel.addEventListener("click", onClick);
  ctx.rader.addEventListener("click", onClick);
  document.addEventListener("keydown", onKey);

  return {
    start() {
      ctx.root.dataset.bild = task.type === "F" && !task.problem.bild ? "nej" : "ja";
      renderText();
      render();
    },
    /** F: eleven har löst ekvationen i den vanliga vyn → "Vad betyder x?" */
    losningKlar(rows) {
      st = losningKlar(st);
      hafte = rows;
      if (typKlar(st)) return finish();
      render();
    },
    get state() {
      return st;
    },
    destroy() {
      done = true;
      panel.removeEventListener("submit", onSubmit);
      panel.removeEventListener("click", onClick);
      ctx.rader.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
      delete ctx.root.dataset.fas;
      delete ctx.root.dataset.bild;
      ctx.text.hidden = true;
      panel.hidden = true;
      ctx.rubrik.textContent = "MIN LÖSNING";
    },
  };
}
