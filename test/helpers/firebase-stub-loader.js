// ============================================================================
// Loader-krok för node-tester (#803): ersätter Firebase-SDK:t från CDN
// (https://www.gstatic.com/firebasejs/…) med en tom stubbe, så att lärarsidans
// registry-moduler (teacher-shared.js, teacher-classes-sections.js,
// teacher-class.js) kan importeras på riktigt utan nät och utan webbläsare.
//   import { installeraFirebaseStubbe } from "./helpers/firebase-stub-loader.js";
//   installeraFirebaseStubbe();  // före första dynamiska import() av src-moduler
// Varje namn som någon src-fil importerar från en CDN-URL exporteras som en
// "allt-i-ett"-proxy (anropbar, alla egenskaper finns) – inget körs på riktigt.
// ============================================================================

import { register } from "node:module";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../../src/", import.meta.url));

function filer(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? filer(p) : f.endsWith(".js") ? [p] : [];
  });
}

/** URL → namn som importeras från den någonstans i src/. */
function namnPerUrl() {
  const map = {};
  const re = /import\s*\{([^}]*)\}\s*from\s*["'](https:\/\/[^"']+)["']/g;
  for (const f of filer(SRC)) {
    for (const m of readFileSync(f, "utf8").matchAll(re)) {
      const namn = m[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
      (map[m[2]] ||= new Set());
      namn.forEach((n) => map[m[2]].add(n));
    }
  }
  return Object.fromEntries(Object.entries(map).map(([u, s]) => [u, [...s]]));
}

let installerad = false;
export function installeraFirebaseStubbe() {
  if (installerad) return;
  installerad = true;
  const NAMN = JSON.stringify(namnPerUrl());
  const krok = `
const NAMN = ${NAMN};
const kropp = (namn) => \`const f = function () { return P; };
const P = new Proxy(f, { get: (t, k) => (k === "then" ? undefined : k === Symbol.toPrimitive ? () => "" : P), apply: () => P, construct: () => P });
\${namn.map((n) => \`export const \${n} = P;\`).join("\\n")}
export default P;\`;
export async function resolve(spec, ctx, next) {
  if (spec.startsWith("https://")) return { shortCircuit: true, url: spec };
  return next(spec, ctx);
}
export async function load(url, ctx, next) {
  if (url.startsWith("https://")) return { shortCircuit: true, format: "module", source: kropp(NAMN[url] || []) };
  return next(url, ctx);
}`;
  register(`data:text/javascript,${encodeURIComponent(krok)}`);
}

/** Tomma webbläsar-globaler (document, window, localStorage …) för moduler som rör dem vid laddning. */
export function installeraWebbStubbe() {
  const f = function () { return P; };
  const P = new Proxy(f, { get: (t, k) => (k === "then" ? undefined : k === Symbol.toPrimitive ? () => "" : P), apply: () => P, construct: () => P, set: () => true });
  for (const g of ["document", "window", "localStorage", "sessionStorage", "location", "history", "HTMLElement", "customElements", "matchMedia", "requestAnimationFrame"]) {
    if (!(g in globalThis)) globalThis[g] = P;
  }
}
