// ============================================================================
// Enhetstest för kladdytans KNAPPSATS + UPPSTÄLLNING (issue #392)
//   • Knappsatsen öppnas/stängs bara i helskärm, byter till Text-verktyget,
//     skriver i SENAST tryckta mål (lapp/uppställningsruta/svarsruta – svarsrutan
//     bara efter elevens eget tryck), annars i en NY lapp på ytan. Räknar ALDRIG.
//   • Medan den är öppen visas inget skärmtangentbord (inputmode="none"),
//     återställs när den stängs.
//   • Uppställningen är en TOM mall: en siffra/komma per ruta, auto-hopp
//     (talrader →, svar/minne ←), räknesätt → räknesättsrutan, ny kolumn till
//     vänster. Suddet rör den inte (man ritar över den); Rensa/× tar bort den.
//   • Boot-säkerhet: båda modulerna ligger UTANFÖR den statiska bootgrafen.
//
// Modulerna är import-fria → körs mot en minimal fejk-DOM (test/helpers/fake-dom.js).
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeDoc } from "./helpers/fake-dom.js";
import { attachKeypad } from "../src/scratch-keypad.js";
import { attachUppstallning } from "../src/scratch-uppstallning.js";
import { attachTextLayer } from "../src/scratch-text.js";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../src");

// Ett kort som createScratchCard kopplar det: yta + text-lager + uppställning +
// knappsats, och ett svarsformulär UTANFÖR kortet (som i kortläget).
function setup({ full = true } = {}) {
  const doc = makeDoc();
  const card = doc.createElement("div");
  if (full) card.classList.add("scratch-fs");
  const surface = card.appendChild(doc.createElement("div"));
  const button = card.appendChild(doc.createElement("button"));
  const text = attachTextLayer(surface, { document: doc });
  text.layer.rect = { left: 0, top: 0, right: 400, bottom: 200, width: 400, height: 200 };
  const uppst = attachUppstallning(surface, { document: doc });
  const pads = [text, uppst];
  let tool = "pen";
  const selectTool = (t) => { tool = t; pads.forEach((p) => p.setTool(t)); };
  // Samma koppling som createScratchCard (scratchpad.js).
  const keypad = attachKeypad({
    card,
    button,
    document: doc,
    onToggle: (open) => { pads.forEach((p) => p.setKeypad(open)); if (open) selectTool("text"); },
    onUppstallning: () => uppst.create(),
    onNoTarget: () => text.addFreeNote(uppst.template() ? [uppst.template().getBoundingClientRect()] : []),
  });
  const form = doc.createElement("form");
  const answer = form.appendChild(doc.createElement("input"));
  answer.className = "rakna-input";
  answer.setAttribute("inputmode", "text");
  keypad.setAnswer(form);
  const press = (...keys) => keys.forEach((k) => keypad.press(k));
  // Eleven trycker själv i svarsrutan (pointerdown → mål, sedan fokus).
  const tapAnswer = () => { answer.dispatch("pointerdown"); answer.focus(); };
  return { doc, card, surface, button, text, uppst, keypad, form, answer, press, tapAnswer, getTool: () => tool, selectTool };
}

// --- Knappsatsen --------------------------------------------------------------
test("knappen växlar panelen (aria-pressed), bara i helskärm, och byter till Text", () => {
  const { card, button, keypad, text, uppst, getTool } = setup();
  assert.equal(keypad.panel.hidden, true);
  button.click();
  assert.equal(keypad.isOpen(), true);
  assert.equal(keypad.panel.hidden, false);
  assert.equal(button.getAttribute("aria-pressed"), "true");
  assert.ok(card.classList.contains("kp-open"));
  assert.equal(getTool(), "text", "öppnad knappsats → Text-verktyget");
  assert.ok(text.layer.classList.contains("is-text"));
  assert.ok(uppst.layer.classList.contains("is-text"));
  keypad.press("done"); // "Klar" stänger
  assert.equal(keypad.isOpen(), false);
  assert.equal(button.getAttribute("aria-pressed"), "false");

  const small = setup({ full: false });
  small.button.click();
  assert.equal(small.keypad.isOpen(), false, "kortläget öppnar ingen panel");
});

test("panelen har siffror, räknesätt, komma, radera, Klar och Uppställning", () => {
  const { keypad } = setup();
  const keys = keypad.panel.children.map((b) => b.dataset.key).sort();
  assert.deepEqual(keys, [..."0123456789", "+", "−", "×", "÷", "=", ",", "back", "done", "uppst"].sort());
});

test("knapptryck tar aldrig fokus: pointerdown/mousedown preventDefault", () => {
  const { keypad, button } = setup();
  const btn = keypad.panel.children[0];
  assert.ok(btn.dispatch("pointerdown").defaultPrevented);
  assert.ok(btn.dispatch("mousedown").defaultPrevented);
  assert.ok(button.dispatch("pointerdown").defaultPrevented, "inte heller Knappsats-knappen");
});

test("räknar ALDRIG; utan mål skrivs det i en NY lapp på ytan, inte i svaret", () => {
  const { keypad, text, answer, press, doc } = setup();
  answer.focus(); // räkna-läget autofokuserar svarsrutan – det gör den INTE till mål
  keypad.setOpen(true);
  press("1", "2", "+", "3", "=");
  const notes = text.notes();
  assert.equal(notes.length, 1);
  assert.equal(notes[0].value, "12+3=");
  assert.equal(notes[0].getAttribute("inputmode"), "none");
  assert.equal(doc.activeElement, notes[0]);
  assert.equal(answer.value, "");
  press("back");
  assert.equal(notes[0].value, "12+3");
});

test("utan mål skapar radera ingen lapp", () => {
  const { keypad, text, press } = setup();
  keypad.setOpen(true);
  press("back");
  assert.equal(text.notes().length, 0);
});

test("svarsrutan (efter elevens tryck): − blir bindestreck, komma och radera vid markören", () => {
  const { keypad, answer, press, tapAnswer } = setup();
  keypad.setOpen(true);
  tapAnswer();
  press("−", "3", ",", "5");
  assert.equal(answer.value, "-3,5");
  answer.selectionStart = answer.selectionEnd = 2; // efter "3"
  press("back");
  assert.equal(answer.value, "-,5");
  press("7");
  assert.equal(answer.value, "-7,5");
});

test("skriver där man senast tryckte: lapp, sedan svarsruta", () => {
  const { keypad, text, answer, press, tapAnswer } = setup();
  keypad.setOpen(true);
  text.setTool("text");
  text.layer.dispatch("click", { clientX: 100, clientY: 100 });
  const [note] = text.notes();
  press("4", "×", "6");
  assert.equal(note.value, "4×6");
  assert.equal(answer.value, "");
  tapAnswer(); // eleven trycker i svarsrutan
  press("2", "4");
  assert.equal(answer.value, "24");
  assert.equal(note.value, "4×6");
});

test("försvunnet mål (tom lapp städad) → ny lapp, inte svarsrutan", () => {
  const { keypad, text, answer, press } = setup();
  keypad.setOpen(true);
  text.layer.dispatch("click", { clientX: 100, clientY: 100 });
  text.notes()[0].blur(); // tom → bort
  press("9");
  assert.equal(answer.value, "");
  assert.deepEqual(text.notes().map((n) => n.value), ["9"]);
});

test("rättad svarsruta (readOnly) tar inte emot tecken", () => {
  const { keypad, answer, press, tapAnswer } = setup();
  keypad.setOpen(true);
  tapAnswer();
  answer.readOnly = true;
  assert.equal(keypad.target(), null);
  press("5");
  assert.equal(answer.value, "");
});

test("Penna/Sudd medan öppen: panelen förblir öppen, knappsatsen skriver i senaste lappen", () => {
  const { keypad, text, press, selectTool } = setup();
  keypad.setOpen(true);
  text.layer.dispatch("click", { clientX: 100, clientY: 100 });
  press("4");
  selectTool("pen");
  assert.equal(keypad.isOpen(), true);
  assert.ok(!text.layer.classList.contains("is-text"), "ytan ritar igen");
  press("2");
  assert.deepEqual(text.notes().map((n) => n.value), ["42"]);
});

test("inget skärmtangentbord medan panelen är öppen – återställs efteråt", () => {
  const { keypad, text, uppst, answer, press } = setup();
  text.setTool("text");
  text.layer.dispatch("click", { clientX: 100, clientY: 100 });
  const [note] = text.notes();
  note.value = "1";
  note.blur();
  keypad.setOpen(true);
  press("uppst");
  const cell = uppst.cells()[1][1];
  assert.equal(answer.getAttribute("inputmode"), "none");
  assert.equal(note.getAttribute("inputmode"), "none");
  assert.equal(cell.getAttribute("inputmode"), "none");
  text.layer.dispatch("click", { clientX: 300, clientY: 150 }); // ny lapp medan öppen
  assert.equal(text.notes()[1].getAttribute("inputmode"), "none");
  keypad.setOpen(false);
  assert.equal(answer.getAttribute("inputmode"), "text");
  assert.equal(note.getAttribute("inputmode"), null);
  assert.equal(cell.getAttribute("inputmode"), "numeric");
});

test("fälls kortet in stängs panelen (resize-kroken); destroy återställer", () => {
  const { card, keypad, answer } = setup();
  keypad.setOpen(true);
  card.classList.remove("scratch-fs");
  keypad.resize();
  assert.equal(keypad.isOpen(), false);
  assert.equal(answer.getAttribute("inputmode"), "text");
  card.classList.add("scratch-fs");
  keypad.setOpen(true);
  keypad.destroy();
  assert.equal(answer.getAttribute("inputmode"), "text");
});

test("nytt svarsformulär medan öppen: det nya får inputmode none, det gamla återställs", () => {
  const { doc, keypad, answer } = setup();
  keypad.setOpen(true);
  const form2 = doc.createElement("form");
  const answer2 = form2.appendChild(doc.createElement("input"));
  answer2.className = "rakna-input";
  answer2.setAttribute("inputmode", "text");
  keypad.setAnswer(form2);
  assert.equal(answer.getAttribute("inputmode"), "text");
  assert.equal(answer2.getAttribute("inputmode"), "none");
});

// --- Uppställningen -------------------------------------------------------------
test("Uppställning lägger en TOM mall i procent; finns den redan fokuseras den", () => {
  const { uppst, keypad, doc } = setup();
  keypad.setOpen(true);
  keypad.press("uppst");
  const box = uppst.template();
  assert.ok(box);
  assert.equal(box.style.left, "4%");
  assert.equal(box.style.top, "6%");
  const cells = uppst.cells();
  assert.equal(cells.length, 4, "minne, tal 1, tal 2, svar");
  assert.equal(cells[1].filter(Boolean).length, 5, "5 kolumner");
  assert.ok(cells[2][0].classList.contains("uppst-op"), "räknesättsruta i tal 2:s rad");
  assert.ok(cells[0][1].classList.contains("uppst-mem"));
  assert.ok(cells.flat().filter(Boolean).every((c) => c.value === ""), "förifylls aldrig");
  assert.equal(doc.activeElement, cells[1][1]);
  keypad.press("uppst");
  assert.equal(uppst.layer.children.length, 1, "ingen dubblett");
});

test("ny mall krockar inte med lappar: flyttas ned under dem", () => {
  const { uppst } = setup(); // text-lagret 400×200; uppst-lagrets rect sätts här
  uppst.layer.rect = { left: 0, top: 0, right: 400, bottom: 200, width: 400, height: 200 };
  const realCreate = uppst.create;
  // Mallens egen rect i fejk-DOM:en är 0×0 → ge den en storlek vid skapandet.
  uppst.layer.appendChild = function (c) {
    c.rect = { left: 16, top: 12, right: 216, bottom: 112 };
    return Object.getPrototypeOf(this).appendChild.call(this, c);
  };
  realCreate([{ left: 4, top: 0, right: 60, bottom: 30 }]);
  assert.equal(uppst.template().style.top, "19.00%"); // (30 + 8) / 200
  uppst.clear();
  // Ryms inte under lappen (ytan 200 hög, mallen 100) → till höger om den.
  realCreate([{ left: 4, top: 20, right: 150, bottom: 120 }]);
  assert.equal(uppst.template().style.top, "6%");
  assert.equal(uppst.template().style.left, "39.50%"); // (150 + 8) / 400
});

test("knappsatsen fyller rutorna: en siffra per ruta, talrad hoppar åt höger", () => {
  const { uppst, keypad, press, doc } = setup();
  keypad.setOpen(true);
  press("uppst", "3", "4", "7");
  const row = uppst.cells()[1];
  assert.deepEqual(row.slice(1, 4).map((c) => c.value), ["3", "4", "7"]);
  assert.equal(doc.activeElement, row[4]);
  row[2].focus(); // markeras → nästa siffra ersätter
  press("9");
  assert.equal(row[2].value, "9");
  assert.equal(doc.activeElement, row[3]);
});

test("svarsraden hoppar åt vänster (ental först); = avvisas utan att sudda siffran", () => {
  const { uppst, keypad, press, doc } = setup();
  keypad.setOpen(true);
  press("uppst");
  const sum = uppst.cells()[3];
  sum[5].focus();
  press("=");
  assert.equal(sum[5].value, "");
  press("2", "1");
  assert.equal(sum[5].value, "2");
  assert.equal(sum[4].value, "1");
  assert.equal(doc.activeElement, sum[3]);
  sum[4].focus(); // markerad "1"
  press("=");
  assert.equal(sum[4].value, "1", "ogiltigt tecken ersätter inte siffran");
});

test("räknesätt i en sifferruta → räknesättsrutan; från tal 1 vidare till tal 2", () => {
  const { uppst, keypad, press, doc } = setup();
  keypad.setOpen(true);
  press("uppst", "3", "4", "7", "+");
  const c = uppst.cells();
  assert.equal(c[2][0].value, "+");
  assert.deepEqual(c[1].slice(1, 4).map((x) => x.value), ["3", "4", "7"], "talet orört");
  assert.equal(doc.activeElement, c[2][1], "första tomma rutan i tal 2");
  press("1", "5");
  c[3][5].focus(); // i svarsraden: räknesättet byts, markören stannar
  press("×");
  assert.equal(c[2][0].value, "×");
  assert.equal(doc.activeElement, c[3][5]);
  assert.equal(c[3][5].value, "");
  // Fysiskt tangentbord: "-" i en sifferruta blir − i räknesättsrutan.
  assert.ok(c[3][5].dispatch("keydown", { key: "-" }).defaultPrevented);
  assert.equal(c[2][0].value, "−");
});

test("decimalkomma är tillåtet i sifferrutorna (egen kolumn)", () => {
  const { uppst, keypad, press } = setup();
  keypad.setOpen(true);
  press("uppst", "3", ",", "5");
  assert.deepEqual(uppst.cells()[1].slice(1, 4).map((x) => x.value), ["3", ",", "5"]);
});

test("räknesättsrutan: tangentbordets * - / blir × − ÷, siffror avvisas", () => {
  const { uppst } = setup();
  uppst.create();
  const op = uppst.cells()[2][0];
  for (const [typed, want] of [["*", "×"], ["-", "−"], ["/", "÷"], ["+", "+"], ["7", ""]]) {
    op.value = typed;
    op.dispatch("input");
    assert.equal(op.value, want, `${typed} → ${want}`);
  }
});

test("radera i tom ruta går bakåt och tömmer; Enter skickar aldrig formuläret", () => {
  const { uppst, keypad, press, doc } = setup();
  keypad.setOpen(true);
  press("uppst", "5", "6");
  const row = uppst.cells()[1];
  assert.equal(doc.activeElement, row[3]);
  press("back"); // tom → tillbaka till 6:an och töm den
  assert.equal(row[2].value, "");
  assert.equal(doc.activeElement, row[2]);
  press("back", "back");
  assert.equal(row[1].value, "");
  assert.ok(row[1].dispatch("keydown", { key: "Enter" }).defaultPrevented);
});

test("piltangenter flyttar i rutnätet (fysiskt tangentbord)", () => {
  const { uppst, doc } = setup();
  uppst.create();
  const c = uppst.cells();
  c[1][2].focus();
  c[1][2].dispatch("keydown", { key: "ArrowDown" });
  assert.equal(doc.activeElement, c[2][2]);
  c[2][1].focus();
  c[2][1].dispatch("keydown", { key: "ArrowLeft" });
  assert.equal(doc.activeElement, c[2][0], "till räknesättet");
  c[2][0].dispatch("keydown", { key: "ArrowUp" });
  assert.equal(doc.activeElement, c[2][0], "ingen ruta ovanför räknesättet");
});

test("+ kolumn lägger till till VÄNSTER och behåller innehållet (max 9)", () => {
  const { uppst } = setup();
  uppst.create();
  let c = uppst.cells();
  c[1][5].value = "8";
  c[2][0].value = "+";
  const add = uppst.template().querySelector(".uppst-add");
  assert.equal(add.textContent, "+ kolumn", "chip, inte ett ensamt plus bredvid talet");
  assert.equal(add.getAttribute("aria-label"), "Lägg till en kolumn");
  add.click();
  c = uppst.cells();
  assert.equal(c[1].filter(Boolean).length, 6);
  assert.equal(c[1][6].value, "8");
  assert.equal(c[1][1].value, "");
  assert.equal(c[2][0].value, "+");
  for (let i = 0; i < 10; i++) add.click();
  assert.equal(uppst.cells()[1].filter(Boolean).length, 9);
  assert.equal(add.hidden, true);
});

test("man ritar över mallen: Sudd tar inte bort den; Rensa och × gör det", () => {
  const { uppst, surface } = setup();
  uppst.create();
  uppst.template().rect = { left: 10, top: 10, right: 200, bottom: 150 };
  uppst.setTool("pen");
  assert.ok(!uppst.layer.classList.contains("is-text"), "rit-läge: pekaren släpps igenom (CSS)");
  uppst.setTool("eraser");
  surface.dispatch("pointerdown", { clientX: 100, clientY: 100 });
  surface.dispatch("pointermove", { clientX: 120, clientY: 100 });
  surface.dispatch("pointerup", {});
  assert.ok(uppst.template(), "suddet suddar bara bläck");
  uppst.setTool("text");
  assert.ok(uppst.layer.classList.contains("is-text"));
  uppst.template().querySelector(".uppst-close").click();
  assert.equal(uppst.template(), null);
  uppst.create();
  uppst.clear();
  assert.equal(uppst.layer.children.length, 0);
});

// --- Boot-säkerhet --------------------------------------------------------------
test("knappsats/uppställning ligger UTANFÖR den statiska bootgrafen från app.js", () => {
  const staticImportRe = /^\s*import\s+(?:[^'";]*?\s+from\s+)?["']([^"']+)["']/gm;
  const seen = new Set();
  const queue = ["app.js"];
  while (queue.length) {
    const rel = queue.pop();
    if (seen.has(rel)) continue;
    seen.add(rel);
    let code;
    try { code = readFileSync(resolve(SRC, rel), "utf8"); }
    catch { continue; }
    let m;
    while ((m = staticImportRe.exec(code))) {
      const spec = m[1];
      if (!spec.startsWith(".")) continue;
      const target = resolve(dirname(resolve(SRC, rel)), spec);
      queue.push(target.slice(SRC.length + 1));
    }
  }
  assert.ok(seen.size > 10, "bootgrafen ska ha hittats");
  for (const f of ["scratch-keypad.js", "scratch-uppstallning.js", "scratchpad.js"]) {
    assert.ok(!seen.has(f), `${f} får inte vara statiskt nåbar från app.js`);
  }
  // …men nås via scratchpad.js (den dynamiskt laddade kedjan).
  const pad = readFileSync(resolve(SRC, "scratchpad.js"), "utf8");
  assert.match(pad, /from "\.\/scratch-keypad\.js"/);
  assert.match(pad, /from "\.\/scratch-uppstallning\.js"/);
});
