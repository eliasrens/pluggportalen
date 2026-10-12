// ============================================================================
// Hitta rätt! – kartans skärmlager (src/hitta-ratt/karta/skarmlager.js) · #606
// ----------------------------------------------------------------------------
// Allt som ska ha KONSTANT storlek på skärmen ligger här, ovanför kameran:
// elevens nål, rätt nål, linjen mellan dem, km-texten, rätt svars etikett
// (först efter lås), klickringar runt små områden och tangentbordets sikte.
// Positionerna sparas i kartkoordinater och räknas om till skärm-px en gång
// per bildruta (`rita`). Få element → billigt även under panorering.
// ============================================================================

const NS = "http://www.w3.org/2000/svg";
const LITEN_PX = 26; // område vars diagonal är mindre än så (skärm-px) får klickring
const RING_R = 12;
const NAL_D = "M0 0C-3-9-12-13-12-22a12 12 0 1 1 24 0C12-13 3-9 0 0z";

export function svgEl(namn, attr = {}, foralder) {
  const e = document.createElementNS(NS, namn);
  for (const [k, v] of Object.entries(attr)) e.setAttribute(k, v);
  if (foralder) foralder.appendChild(e);
  return e;
}

const fast = (n) => n.toFixed(1);
const flytta = (g, [x, y]) => g.setAttribute("transform", `translate(${fast(x)} ${fast(y)})`);
const visa = (g, ja) => { g.style.display = ja ? "" : "none"; };

/**
 * @param svg      kartans <svg> (lagret läggs sist = överst)
 * @param omraden  Map id → { path, c: [x, y], diag } (kartenheter)
 */
export function skapaSkarmlager(svg, omraden) {
  const skarm = svgEl("g", { class: "hr-skarm" }, svg);
  const ringG = svgEl("g", { class: "hr-ringar" }, skarm);
  const linje = svgEl("line", { class: "hr-linje" }, skarm);
  const kmText = text("hr-etikett km");
  const nalRatt = nal("hr-nal-ratt");
  const nalGiss = nal("hr-nal-giss");
  const etikett = text("hr-etikett");
  const sikte = svgEl("g", { class: "hr-sikte" }, skarm);
  svgEl("circle", { r: 9 }, sikte);
  svgEl("path", { d: "M-18 0h10M8 0h10M0-18v10M0 8v10" }, sikte);

  function nal(cls) {
    const g = svgEl("g", { class: `hr-nal ${cls}` }, skarm);
    svgEl("path", { d: NAL_D }, g);
    svgEl("circle", { cy: -22, r: 4.5, class: "hr-nal-prick" }, g);
    visa(g, false);
    return g;
  }
  function text(cls) {
    const g = svgEl("g", { class: cls }, skarm);
    g.t = svgEl("text", {}, g);
    visa(g, false);
    return g;
  }

  let kmSynlig = false;

  return {
    /** Elevens nål (kartkoordinat eller null). */
    get giss() { return nalGiss.pos || null; },
    satGiss(pos, landa = true) {
      nalGiss.pos = pos;
      visa(nalGiss, !!pos);
      if (!pos || !landa) return;
      // Kort "landning" när nålen sätts (CSS-animation startas om).
      nalGiss.classList.remove("landar");
      requestAnimationFrame(() => nalGiss.classList.add("landar"));
    },
    /** Rätt plats, linje och km (punktläge efter lås). */
    satRatt(pos, kmTxt) {
      nalRatt.pos = pos;
      visa(nalRatt, !!pos);
      visa(linje, !!(pos && nalGiss.pos));
      kmSynlig = !!(pos && nalGiss.pos && kmTxt);
      kmText.t.textContent = kmTxt || "";
      visa(kmText, kmSynlig);
    },
    /** Rätt svars namn efter lås. vid: "nal" (bredvid rätt nål) | "mitt" (centrerad). */
    satEtikett(txt, pos, vid = "nal") {
      etikett.pos = txt ? pos : null;
      etikett.t.textContent = txt || "";
      if (vid === "mitt") {
        // Ovanför mittpunkten, så en klickring (små områden) syns under texten.
        etikett.t.setAttribute("x", 0); etikett.t.setAttribute("y", -18);
        etikett.t.setAttribute("text-anchor", "middle");
      } else {
        etikett.t.setAttribute("x", 16); etikett.t.setAttribute("y", -24);
        etikett.t.removeAttribute("text-anchor");
      }
      visa(etikett, !!etikett.pos);
    },
    rensa() {
      this.satGiss(null);
      this.satRatt(null);
      this.satEtikett("", null);
    },
    /** Trycket började på elevens nål? */
    arNal: (mal) => !!mal?.closest?.(".hr-nal-giss"),

    /** Räkna om allt till skärm-px. tillSkarm: kartkoordinat → px. */
    rita({ tillSkarm, k, W, H, ringar }) {
      for (const [id, o] of omraden) {
        const syns = ringar && o.diag * k < LITEN_PX;
        if (syns && !o.ring) o.ring = svgEl("circle", { class: "hr-ring", r: RING_R, "data-id": id }, ringG);
        if (!o.ring) continue;
        visa(o.ring, syns);
        if (!syns) continue;
        const [sx, sy] = tillSkarm(o.c);
        o.ring.setAttribute("cx", fast(sx));
        o.ring.setAttribute("cy", fast(sy));
        for (const c of ["vald", "ratt", "fel"]) o.ring.classList.toggle(c, o.path.classList.contains(c));
      }
      for (const n of [nalGiss, nalRatt]) if (n.pos) flytta(n, tillSkarm(n.pos));
      if (nalGiss.pos && nalRatt.pos) {
        const [x1, y1] = tillSkarm(nalGiss.pos), [x2, y2] = tillSkarm(nalRatt.pos);
        linje.setAttribute("x1", fast(x1)); linje.setAttribute("y1", fast(y1));
        linje.setAttribute("x2", fast(x2)); linje.setAttribute("y2", fast(y2));
        if (kmSynlig) flytta(kmText, [(x1 + x2) / 2 + 10, (y1 + y2) / 2 - 8]);
      }
      if (etikett.pos) flytta(etikett, tillSkarm(etikett.pos));
      flytta(sikte, [W / 2, H / 2]);
    },
  };
}
