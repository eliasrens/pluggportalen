// Förhandsvisningen av schackbrädet och pjäserna (#775). Modulerna laddas
// med import() precis som i appen (#271).
import { STALLNINGAR, SLUT } from "./stallningar.js";

const [{ skapaSchackbrade }, { pjasSvg, PJAS_TYPER }, { pjasText }] = await Promise.all([
  import("../../src/schack/schack-bradet.js"),
  import("../../src/schack/schack-pjaser.js"),
  import("../../src/schack/schack-text.js"),
]);

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const stilla = () => $("#stilla").checked || undefined;

// --- 1. Spelbart bräde ----------------------------------------------------
const logg = $("#logg");
const skriv = (rad) => {
  logg.textContent = `${rad}\n${logg.textContent}`.split("\n").slice(0, 14).join("\n");
};
let varna = null; // pågående "Varna mig"-fråga: resolve-funktionen

const brade = skapaSchackbrade($("#bradet"), {
  namn: { w: "Vit (Elias)", b: "Svart (Sara)" },
  avatar: { b: `<span class="pv-avatar">S</span>` }, // egen avatar-markup (B skickar avatarMarkup())
  reducedMotion: stilla(),
  beforeMove(drag) {
    if ($("#server").checked) {
      skriv(`beforeMove ${drag.sanSv} → väntar på "servern" 1 s`);
      brade.setStatus("Skickar…");
      return new Promise((ok) => setTimeout(() => {
        brade.setStatus(null);
        ok(!$("#neka").checked);
      }, 1000));
    }
    if ($("#varna").checked && (drag.captured || drag.san.includes("+"))) {
      skriv(`beforeMove ${drag.sanSv} → frågar först`);
      $("#varna-text").textContent = `Vill du verkligen spela ${drag.sanSv}?`;
      $("#varna-ruta").hidden = false;
      return new Promise((ok) => { varna = ok; });
    }
    return true;
  },
  onMove: (d, s) => skriv(`onMove ${d.sanSv} (${d.from}–${d.to}${d.promotion ? `=${d.promotion}` : ""}) · ${s.fen}`),
  onGameOver: (slut) => skriv(`onGameOver ${slut.resultat} (${slut.orsak})`),
});
window.brade = brade; // för test i konsolen / CDP

const svaraVarna = (ok) => {
  $("#varna-ruta").hidden = true;
  varna?.(ok);
  varna = null;
};
$("#varna-angra").addEventListener("click", () => svaraVarna(false));
$("#varna-ok").addEventListener("click", () => svaraVarna(true));

const knappar = $("#stallningar");
for (const st of STALLNINGAR) {
  const b = document.createElement("button");
  b.className = "btn ghost liten";
  b.textContent = st.namn;
  b.addEventListener("click", () => {
    brade.loadGame({ fen: st.fen, drag: st.drag || [] });
    $("#forklaring").textContent = st.text;
    skriv(`loadGame "${st.namn}"`);
  });
  knappar.appendChild(b);
}
const vald = STALLNINGAR.find((s) => s.id === params.get("st"));
if (vald) knappar.children[STALLNINGAR.indexOf(vald)].click();

$("#vand").addEventListener("click", () => brade.flip());
$("#angra").addEventListener("click", () => skriv(`undo → ${brade.undo(1)} drag`));
$("#tips").addEventListener("click", () => {
  const s = brade.getState();
  const drag = s.pjaser.filter((p) => p.color === s.tur).flatMap((p) => brade.lagligaDrag(p.ruta));
  const bast = drag.find((d) => d.san.includes("#")) || drag.find((d) => d.captured) || drag[0];
  if (bast) brade.showArrow(bast.from, bast.to);
});
$("#interaktiv").addEventListener("change", (e) => {
  const v = e.target.value;
  brade.setInteractive(v === "true" ? true : v === "false" ? false : v);
});
$("#egen").addEventListener("change", (e) => {
  const f = e.target.value || null;
  brade.setSpelare({ egenFarg: f, motstandare: f ? "dator" : null });
  if (f) brade.setOrientation(f);
});
$("#gav-upp").addEventListener("click", () =>
  brade.avsluta({ resultat: "0-1", orsak: "gav-upp", vinnare: "b", titel: "Sara vann – Elias gav upp." }));
$("#stilla").addEventListener("change", () => location.reload());

// --- 2. Pjäserna i flera storlekar ------------------------------------------
const pjasRutnat = $("#pjaser");
for (const storlek of [120, 80, 56, 40, 28]) {
  const rad = document.createElement("div");
  rad.className = "pv-pjasrad";
  rad.innerHTML = `<b>${storlek} px</b>` + ["ljus", "mork"].map((ruta) =>
    `<div class="pv-pjaser pv-${ruta}">` +
    ["w", "b"].map((f) => `<div>${PJAS_TYPER.map((t) =>
      `<span class="pv-pjas" style="width:${storlek}px;height:${storlek}px">${pjasSvg(f, t, { titel: pjasText(f, t) })}</span>`).join("")}</div>`).join("") +
    `</div>`).join("");
  pjasRutnat.appendChild(rad);
}

// --- 3. Bondeförvandlingen (väljaren öppen) ---------------------------------
const forv = skapaSchackbrade($("#forvandling"), { fen: "r7/1P5k/8/8/8/8/6K1/8 w - - 0 1", namn: { w: "Vit", b: "Svart" }, reducedMotion: stilla() });
forv.slapp("b7", "b8");
$("#forv-igen").addEventListener("click", () => {
  forv.setPosition("r7/1P5k/8/8/8/8/6K1/8 w - - 0 1");
  forv.slapp("b7", "b8");
});

// --- 4. Slutrutorna -----------------------------------------------------------
const slutYta = $("#slutrutor");
for (const s of SLUT) {
  const box = document.createElement("div");
  box.className = "pv-slut";
  box.innerHTML = `<h3>${s.namn}</h3><div></div>`;
  slutYta.appendChild(box);
  const b = skapaSchackbrade(box.lastElementChild, {
    egenFarg: s.egenFarg, motstandare: s.motstandare, namn: { w: "Elias", b: "Sara" }, interaktiv: false,
    slutKnappar: [{ text: "Spela igen", onClick: () => skriv(`"Spela igen" i ${s.namn}`) }],
  });
  if (s.fen) b.setPosition(s.fen, { senast: s.senast });
  if (s.gavUpp) b.avsluta({ resultat: "1-0", orsak: "gav-upp", vinnare: "w", titel: "Du vann! Sara gav upp." });
}
