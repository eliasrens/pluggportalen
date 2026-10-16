// ============================================================================
// #743 F1/F2: texten "null" i provets vyer.
// ----------------------------------------------------------------------------
// h() (prov-vy.js) hoppar över null/false bland barnen – men DOM:ens egna
// replaceChildren()/append()/prepend() gör det INTE: de skriver ut "null".
// Två sådana fel nådde webbläsaren (Lämna in-rutan när allt var besvarat och
// Översikten när inget var rättat). Repo:t har ingen jsdom, så testet läser
// källkoden: inget argument till de anropen får kunna vara null –
//   cond ? h(…) : null            (direkt som argument)
//   const x = cond ? h(…) : null;  …replaceChildren(…, x, …)
// Skriv i stället ...(cond ? [h(…)] : []) eller lägg elementet i h(…).
// Körs med: node --test
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROT = fileURLToPath(new URL("../src/prov/", import.meta.url));
const ANROP = /\.(replaceChildren|append|prepend|replaceWith|before|after)\(/g;

function filer(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? filer(join(dir, d.name)) : d.name.endsWith(".js") ? [join(dir, d.name)] : []);
}

/** Index för den avslutande backticken i en mall som börjar vid i (efter den öppnande). */
function mallSlut(s, i) {
  let j = i;
  while (j < s.length && s[j] !== "`") {
    if (s[j] === "\\") j++;
    else if (s[j] === "$" && s[j + 1] === "{") j = tillSlut(s, j + 2, "}").slut;
    j++;
  }
  return j;
}

/** Text från index i (efter en öppnande parentes) till den matchande stängande; strängar hoppas över. */
function tillSlut(s, i, stang = ")") {
  const par = { "(": ")", "[": "]", "{": "}" };
  const stack = [stang];
  let j = i;
  while (j < s.length && stack.length) {
    const c = s[j];
    if (c === '"' || c === "'") {
      j = s.indexOf(c, j + 1);
      while (j > 0 && s[j - 1] === "\\") j = s.indexOf(c, j + 1);
    } else if (c === "`") {
      j = mallSlut(s, j + 1);
    } else if (c === "/" && s[j + 1] === "/") {
      j = s.indexOf("\n", j);
    } else if (par[c]) stack.push(par[c]);
    else if (c === stack[stack.length - 1]) stack.pop();
    j++;
  }
  return { text: s.slice(i, j - 1), slut: j - 1 };
}

/** Argumenten på översta nivån (komma utanför parenteser/strängar). */
function argument(text) {
  const ut = [];
  const par = { "(": ")", "[": "]", "{": "}" };
  let start = 0;
  let j = 0;
  while (j < text.length) {
    const c = text[j];
    if (par[c]) j = tillSlut(text, j + 1, par[c]).slut;
    else if (c === "`") j = mallSlut(text, j + 1);
    else if (c === '"' || c === "'") {
      j = text.indexOf(c, j + 1);
      while (j > 0 && text[j - 1] === "\\") j = text.indexOf(c, j + 1);
    } else if (c === ",") {
      ut.push(text.slice(start, j).trim());
      start = j + 1;
    }
    j++;
  }
  ut.push(text.slice(start).trim());
  return ut.filter(Boolean);
}

const kanBliNull = (uttryck) => /(^|[?:]\s*)null$/.test(uttryck.trim()) || /\|\|\s*null$/.test(uttryck.trim());

/** Fynd i en källtext: [{ rad, arg }]. */
export function nullArgument(kalla) {
  const nullVar = new Set();
  for (const m of kalla.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/g)) {
    let j = m.index + m[0].length;
    let k = j;
    let djup = 0;
    for (; k < kalla.length; k++) {
      const c = kalla[k];
      if ("([{".includes(c)) djup++;
      else if (")]}".includes(c)) djup--;
      else if (c === ";" && djup === 0) break;
      else if (c === "\n" && djup === 0 && !/[?:,(=&|+]\s*$/.test(kalla.slice(j, k)) && !/^\s*[?:.]/.test(kalla.slice(k + 1, k + 40))) break;
    }
    if (kanBliNull(kalla.slice(j, k))) nullVar.add(m[1]);
  }
  const fynd = [];
  for (const m of kalla.matchAll(ANROP)) {
    const { text } = tillSlut(kalla, m.index + m[0].length);
    for (const a of argument(text)) {
      if (kanBliNull(a) || nullVar.has(a)) fynd.push({ rad: kalla.slice(0, m.index).split("\n").length, arg: a.slice(0, 80) });
    }
  }
  return fynd;
}

test("inget replaceChildren/append-argument i src/prov/ kan bli null (#743 F1/F2)", () => {
  const alla = filer(ROT).flatMap((f) => nullArgument(readFileSync(f, "utf8")).map((x) => `${f.slice(ROT.length)}:${x.rad} ${x.arg}`));
  assert.deepEqual(alla, []);
});

test("testet fångar båda formerna som nådde webbläsaren", () => {
  const f1 = `ruta.replaceChildren(\n  h("p", { text: "a" }),\n  obesvarade.length ? h("p", { text: \`x \${y}\` }) : null,\n  h("p"));`;
  const f2 = `const svarast = m.svarast.length\n  ? h("p", {}, ...m.svarast.map((s) => s))\n  : null;\ntopp.replaceChildren(h("p"), svarast, h("div"));`;
  assert.equal(nullArgument(f1).length, 1);
  assert.equal(nullArgument(f2).length, 1);
  assert.deepEqual(nullArgument(`x.replaceChildren(...(a ? [h("p")] : []), h("p", {}, b ? "c" : null));`), []);
});
