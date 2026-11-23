// QA #913 test 23: WCAG-kontrast på porten (steg-kropp i mat.mjs). Bakgrunden
// = närmaste förälder med ogenomskinlig bakgrundsfärg; SVG-skylten läses ur fill.
const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const kontrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100; };
const bg = (el) => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length === 3 || (c.length === 4 && c[3] > 0.9)) return c.slice(0, 3); } return [255, 255, 255]; };
const mat = (namn, el) => el ? { namn, text: getComputedStyle(el).color, bg: `rgb(${bg(el)})`, kontrast: kontrast(rgb(getComputedStyle(el).color).slice(0, 3), bg(el)) } : { namn, saknas: true };
const knapp = document.querySelector("#submit");
const larare = document.querySelector(".port-larare-lank");
const skylt = [...document.querySelectorAll("svg text")].find((t) => /Pluggporten/.test(t.textContent));
let skyltK = null;
if (skylt) {
  const tf = rgb(getComputedStyle(skylt).fill);
  // Skyltens bräda = närmaste rect/path före texten i samma grupp.
  const g = skylt.closest("g") || skylt.parentElement;
  const plank = [...g.querySelectorAll("rect, path")].map((e) => rgb(getComputedStyle(e).fill)).filter((c) => c.length >= 3);
  skyltK = { namn: "skylt", text: `rgb(${tf})`, brador: plank.slice(0, 3).map((c) => `rgb(${c.slice(0, 3)})`), kontrast: plank.length ? Math.min(...plank.slice(0, 3).map((c) => kontrast(tf.slice(0, 3), c.slice(0, 3)))) : null };
}
return { sasong: document.documentElement.dataset.sasong || "-", jul: document.documentElement.dataset.jul || "-", matt: [mat("Logga in-knappen", knapp), mat("Lärare →", larare), mat("fältets text", document.querySelector("#u")), skyltK] };
