// ============================================================================
// Enhetstest för kladdytans KNAPPSATS + UPPSTÄLLNING (issue #392)
//   • Knappsatsen öppnas/stängs bara i helskärm, skriver i SENAST tryckta mål
//     (lapp/uppställningsruta/svarsruta, annars svarsrutan) och räknar ALDRIG.
//   • Medan den är öppen visas inget skärmtangentbord (inputmode="none"),
//     återställs när den stängs.
//   • Uppställningen är en TOM mall: en siffra per ruta, auto-hopp (talrader →,
//     svar/minne ←), ny kolumn till vänster, Sudd/Rensa tar bort den.
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
  const keypad = attachKeypad({
    card,
    button,
    document: doc,
    onToggle: (open) => pads.forEach((p) => p.setKeypad(open)),
    onUppstallning: () => uppst.create(),
  });
  const form = doc.createElement("form");
  const answer = form.appendChild(doc.createElement("input"));
  answer.className = "rakna-input";
  answer.setAttribute("inputmode", "text");
  keypad.setAnswer(form);
  const press = (...keys) => keys.forEach((k) => keypad.press(k));
  return { doc, card, surface, button, text, uppst, keypad, form, answer, press };
}

// --- Knappsatsen --------------------------------------------------------------
test("knappen växlar panelen (aria-pressed), bara i helskärm", () => {
  const { card, button, keypad } = setup();
  assert.equal(keypad.panel.hidden, true);
  button.click();
  assert.equal(keypad.isOpen(), true);
  assert.equal(keypad.panel.hidden, false);
  assert.equal(button.getAttribute("aria-pressed"), "true");
  assert.ok(card.classList.contains("kp-open"));
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

test("räknar ALDRIG: tecknen skrivs bara in (svarsrutan som standardmål)", () => {
  const { keypad, answer, press, doc } = setup();
  keypad.setOpen(true);
  press("1", "2", "+", "3", "=");
  assert.equal(answer.value, "12+3=");
  assert.equal(doc.activeElement, answer, "inget mål → svarsrutan får fokus");
});

test("svarsrutan: − blir bindestreck, komma och radera vid markören", () => {
  const { keypad, answer, press } = setup();
  keypad.setOpen(true);
  press("−", "3", ",", "5");
  assert.equal(answer.value, "-3,5");
  answer.selectionStart = answer.selectionEnd = 2; // efter "3"
  press("back");
  assert.equal(answer.value, "-,5");
  press("7");
  assert.equal(answer.value, "-7,5");
});

test("skriver där man senast tryckte: lapp, sedan svarsruta", () => {
  const { keypad, text, answer, press } = setup();
  keypad.setOpen(true);
  text.setTool("text");
  text.layer.dispatch("click", { clientX: 100, clientY: 100 });
  const [note] = text.notes();
  press("4", "×", "6");
  assert.equal(note.value, "4×6");
  assert.equal(answer.value, "");
  answer.focus(); // eleven trycker i svarsrutan
  press("2", "4");
  assert.equal(answer.value, "24");
  assert.equal(note.value, "4×6");
});

test("försvunnet mål (tom lapp städad, ruta suddad) → tillbaka till svarsrutan", () => {
  const { keypad, text, answer, press } = setup();
  keypad.setOpen(true);
  text.setTool("text");
  text.layer.dispatch("click", { clientX: 100, clientY: 100 });
  text.notes()[0].blur(); // tom → bort
  press("9");
  assert.equal(answer.value, "9");
});

test("rättad svarsruta (readOnly) tar inte emot tecken", () => {
  const { keypad, answer, press } = setup();
  keypad.setOpen(true);
  answer.readOnly = true;
  assert.equal(keypad.target(), null);
  press("5");
  assert.equal(answer.value, "");
});

test("inget skärmtangentbord medan panelen är öppen – återställs efteråt", () => {
  const { keypad, text, uppst, answer, press } = setup();
  text.setTool("text");
  text.layer.dispatch("click", { clientX: 100, clientY: 100 });
  const [note] = text.notes();
  note.value = "1";
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

test("svarsraden hoppar åt vänster (ental först); = och räknesätt avvisas i sifferrutor", () => {
  const { uppst, keypad, press, doc } = setup();
  keypad.setOpen(true);
  press("uppst");
  const sum = uppst.cells()[3];
  sum[5].focus();
  press("=", "×");
  assert.equal(sum[5].value, "");
  press("2", "1");
  assert.equal(sum[5].value, "2");
  assert.equal(sum[4].value, "1");
  assert.equal(doc.activeElement, sum[3]);
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
  const add = uppst.template().children.find((x) => x.classList.contains("uppst-add"));
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

test("Sudd över mallen och Rensa tar bort den (flyktig)", () => {
  const { uppst, surface } = setup();
  uppst.create();
  uppst.template().rect = { left: 10, top: 10, right: 200, bottom: 150 };
  uppst.setTool("eraser");
  surface.dispatch("pointermove", { clientX: 100, clientY: 100 }); // ej nedtryckt
  assert.ok(uppst.template());
  surface.dispatch("pointerdown", { clientX: 300, clientY: 300 });
  surface.dispatch("pointermove", { clientX: 205, clientY: 100 }); // inom suddradien
  assert.equal(uppst.template(), null);
  assert.equal(uppst.layer.children.length, 0);
  surface.dispatch("pointerup", {});
  uppst.setTool("pen");
  uppst.create();
  uppst.clear();
  assert.equal(uppst.layer.children.length, 0);
  uppst.destroy();
  assert.equal((surface._ls.pointerdown || []).filter(Boolean).length, 1, "bara text-lagrets lyssnare kvar");
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
