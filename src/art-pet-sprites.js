// ============================================================================
// Pluggportalen – sprite-riggade husdjur (bild-assets i 6 delar)
// ----------------------------------------------------------------------------
// Parallell render-väg till de procedurella SVG-arterna i art-pets-creatures.js:
// vissa arter levereras som PNG-delar (huvud, kropp, 2 armar, 2 fötter) per
// evolutionssteg och monteras här till en riggad figur av absolut positionerade
// lager i en procent-rigg (referensyta 340×360, se DESIGNBESLUT-husdjur-hem-2.0).
//
// Till skillnad från katt-riggen i designdoket hänger de här arternas armar
// LODRÄTT (tassen nedåt), så axeln sitter i armens topp – inte i inre änden.
// Delarnas storlekar varierar per art och steg, därför räknas monteringen ut
// ur delarnas faktiska pixelmått (PART_DIMS) i stället för fasta procent:
// kroppen ankras mot bottenkanten och huvud/armar/fötter hängs på den.
//
// Animationerna (andning, gång, sprattel på rygg, blinkning) bor i styles.css
// under ".pet-sprite"/".ps-*" och styrs av samma klasser som SVG-djuren
// (.promenerar, .pet-rygg, .vand-vanster) – riggen är ren DOM.
//
// Id:na sparas i Firestore (studentData.pets[].speciesId) – håll dem STABILA.
// ============================================================================

// Assets bor i repot under design/assets/husdjur/<art>/evolution-<0..2>/
// (repo-roten servas, så sökvägen funkar relativt index.html).
const ASSET_ROOT = "design/assets/husdjur";

export const SPRITE_SPECIES = [
  { id: "butterfly", name: "Fjärlis", kind: "sprite", dir: "butterfly" },
  { id: "salamander", name: "Flammis", kind: "sprite", dir: "salamander" },
];

const BY_ID = Object.fromEntries(SPRITE_SPECIES.map((s) => [s.id, s]));

/** Är arten en sprite-art (bild-rigg) i stället för procedurell SVG? */
export function isSpriteSpecies(speciesId) {
  return !!BY_ID[speciesId];
}

// Delarnas pixelmått [w, h] per art och evolutionssteg (head/lh/torso/rh/lf/rf
// = filerna 00–05). Uppmätta ur PNG-filerna – nya arter/steg: lägg till en rad här.
const PART_DIMS = {
  butterfly: [
    { head: [212, 199], lh: [108, 173], torso: [203, 271], rh: [108, 171], lf: [121, 147], rf: [122, 149] },
    { head: [252, 219], lh: [119, 183], torso: [264, 272], rh: [119, 184], lf: [133, 157], rf: [132, 156] },
    { head: [249, 216], lh: [106, 186], torso: [224, 272], rh: [108, 184], lf: [131, 151], rf: [131, 152] },
  ],
  salamander: [
    { head: [219, 209], lh: [105, 162], torso: [225, 272], rh: [105, 162], lf: [114, 140], rf: [114, 139] },
    { head: [225, 214], lh: [112, 145], torso: [241, 276], rh: [110, 140], lf: [123, 131], rf: [123, 141] },
    { head: [252, 219], lh: [132, 188], torso: [243, 276], rh: [132, 188], lf: [130, 162], rf: [129, 161] },
  ],
};

// --- Rigg-geometri (enheter: referensytan 340×360) ---------------------------

const REF_W = 340;
const REF_H = 360;
const BOTTOM = 350; // figurens bottenkant (ankare mitt-bottenkant)
const TOP = 14; // luft ovanför huvudet
const HEAD_OVERLAP = 0.38; // så stor del av huvudet täcker kroppens topp (nacke)
const FOOT_PEEK = 0.16; // så stor del av foten sticker ut under kroppen
const SHOULDER_X = 0.45; // axelns avstånd från kroppens mitt (andel av kroppsbredd)
const SHOULDER_Y = 0.3; // axelns höjd ner från kroppens topp (andel av kroppshöjd)
const FOOT_X = 0.24; // fotens avstånd från kroppens mitt (andel av kroppsbredd)

/**
 * Montering för ett delset: { head, lh, rh, lf, rf, torso } där varje del är
 * { x, y, w } i procent av sprite-ytan (x/y = delens övre vänstra hörn).
 * Skalan väljs så att hela figuren (huvudtopp → tåspets) fyller riggen.
 */
function layoutFor(dims) {
  const [headW, headH] = dims.head;
  const [torsoW, torsoH] = dims.torso;
  const footH = Math.max(dims.lf[1], dims.rf[1]);
  // Enheter per pixel: figurhöjden (huvudets fria del + kropp + tå-utstick)
  // ska bli BOTTOM - TOP enheter.
  const su = (BOTTOM - TOP) / ((1 - HEAD_OVERLAP) * headH + torsoH + FOOT_PEEK * footH);
  const cx = REF_W / 2;
  const torsoBottom = BOTTOM - FOOT_PEEK * footH * su;
  const torsoTop = torsoBottom - torsoH * su;

  const part = (dim, centerX, topY) => ({
    x: centerX - (dim[0] * su) / 2,
    y: topY,
    w: dim[0] * su,
  });
  // Armarna ankras i axeln: rotationspunkten (50 % / 12 % av armen) ska hamna
  // på axelpunkten vid kroppens övre sidor.
  const arm = (dim, side) => {
    const shX = cx + side * SHOULDER_X * torsoW * su;
    const shY = torsoTop + SHOULDER_Y * torsoH * su;
    return part(dim, shX, shY - 0.12 * dim[1] * su);
  };
  const foot = (dim, side) => {
    const footTop = torsoBottom - (1 - FOOT_PEEK) * dim[1] * su;
    return part(dim, cx + side * FOOT_X * torsoW * su, footTop);
  };

  return {
    lh: arm(dims.lh, -1),
    rh: arm(dims.rh, 1),
    lf: foot(dims.lf, -1),
    rf: foot(dims.rf, 1),
    torso: part(dims.torso, cx, torsoTop),
    head: part(dims.head, cx, torsoTop - (1 - HEAD_OVERLAP) * headH * su),
  };
}

const pct = (u, ref) => ((u / ref) * 100).toFixed(2) + "%";

function partHtml(cls, geom, src) {
  const style = `left:${pct(geom.x, REF_W)};top:${pct(geom.y, REF_H)};width:${pct(geom.w, REF_W)}`;
  return `<span class="ps-del ${cls}" style="${style}"><img src="${src}" alt="" draggable="false"/></span>`;
}

// Humör-partiklar (designdoket: 💤 sömnig, ❤️ mätt/glad, 🍎 äter). Uttrycken
// kan inte bakas om i huvudbilden som för SVG-arterna – de visas som en liten
// svävande symbol vid huvudet i stället.
export const SPRITE_MOODS = { somnig: "💤", glad: "❤️", ater: "🍎", nyfiken: "✨" };

/**
 * HTML för en färdigmonterad sprite-rigg (eller null om arten inte är en
 * sprite-art / steget saknas). stage 1–3 → assetmapp evolution-0..2.
 * mood (valfri): "glad" | "nyfiken" | "ater" | "somnig" → humör-partikel.
 */
export function spriteRigHtml(speciesId, stage, mood) {
  const s = BY_ID[speciesId];
  const dims = s && (PART_DIMS[s.dir] || [])[Math.min(Math.max((stage || 1) - 1, 0), 2)];
  if (!dims) return null;
  const dir = `${ASSET_ROOT}/${s.dir}/evolution-${Math.min(Math.max((stage || 1) - 1, 0), 2)}`;
  const g = layoutFor(dims);
  // Blink-cykeln slumpas per rendering (3–6 s) via en CSS-variabel; själva
  // blinken (snabb scaleY-squash av huvudet) ligger i styles.css.
  const blink = (3 + Math.random() * 3).toFixed(2);
  return (
    `<span class="pet-sprite" role="img" aria-label="${s.name}" style="--blink:${blink}s">` +
    partHtml("ps-arm-v", g.lh, `${dir}/01-left-hand.png`) +
    partHtml("ps-arm-h", g.rh, `${dir}/03-right-hand.png`) +
    partHtml("ps-fot-v", g.lf, `${dir}/04-left-foot.png`) +
    partHtml("ps-fot-h", g.rf, `${dir}/05-right-foot.png`) +
    partHtml("ps-kropp", g.torso, `${dir}/02-torso.png`) +
    partHtml("ps-huvud", g.head, `${dir}/00-head.png`) +
    `<span class="ps-humor">${SPRITE_MOODS[mood] || ""}</span>` +
    `</span>`
  );
}
