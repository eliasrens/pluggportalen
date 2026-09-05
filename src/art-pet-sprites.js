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
// ur delarnas faktiska pixelmått: kroppen ankras mot bottenkanten och
// huvud/armar/fötter hängs på den.
//
// SJÄLVMÄTANDE RIGG: måtten läses i runtime ur PNG:ernas intrinsiska storlek
// (naturalWidth/naturalHeight via new Image()) – ingen handmatad måttabell.
// Måtten cachas per art+steg (mäts bara en gång) och riggen flödar om när de
// finns. Se "async-laddning" nedan.
//
// >>> RECEPT: lägg till en ny art (ingen kod-mätning behövs) <<<
//   1. Släpp in 18 PNG-filer:
//        design/assets/husdjur/<dir>/evolution-{0,1,2}/
//          00-head.png 01-left-hand.png 02-torso.png
//          03-right-hand.png 04-left-foot.png 05-right-foot.png
//   2. Lägg till EN rad i SPRITE_SPECIES: { id, name, kind: "sprite", dir }.
//   Klart – riggen mäter PNG:erna själv och monterar figuren.
//
// Animationerna (andning, gång, rull-på-rygg + sprattel) bor i styles.css
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

// Delarnas filnamn i z-/mät-ordning: head, lh, torso, rh, lf, rf (00–05).
const PART_FILES = [
  "00-head.png",
  "01-left-hand.png",
  "02-torso.png",
  "03-right-hand.png",
  "04-left-foot.png",
  "05-right-foot.png",
];
const PART_KEYS = ["head", "lh", "torso", "rh", "lf", "rf"];

// --- Självmätning av delbildernas intrinsiska mått ---------------------------
// Måtten (naturalWidth/naturalHeight) laddas ASYNKRONT och cachas per art+steg.
// dimCache: färdiga mått. dimPromises: pågående mätning (mät bara en gång).

const dimCache = new Map(); // "dir:stageIdx" -> { head:[w,h], lh, torso, rh, lf, rf }
const dimPromises = new Map(); // "dir:stageIdx" -> Promise<dims|null>

const clampStage = (stage) => Math.min(Math.max((stage || 1) - 1, 0), 2);
const cacheKey = (dir, stageIdx) => `${dir}:${stageIdx}`;
const evoDir = (dir, stageIdx) => `${ASSET_ROOT}/${dir}/evolution-${stageIdx}`;

/** Läs en delbilds [w, h] via new Image(). Resolvar null om laddningen failar. */
function measureOne(src) {
  return new Promise((resolve) => {
    if (typeof Image === "undefined") return resolve(null);
    const img = new Image();
    img.onload = () => resolve([img.naturalWidth, img.naturalHeight]);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Mät alla 6 delar för en art+steg och cacha resultatet. Returnerar ett löfte
 * som resolvar dims-objektet (eller null om någon del inte kunde laddas).
 */
function measureDims(dir, stageIdx) {
  const key = cacheKey(dir, stageIdx);
  if (dimCache.has(key)) return Promise.resolve(dimCache.get(key));
  if (dimPromises.has(key)) return dimPromises.get(key);
  const base = evoDir(dir, stageIdx);
  const p = Promise.all(PART_FILES.map((f) => measureOne(`${base}/${f}`))).then((sizes) => {
    if (sizes.some((s) => !s)) return null; // en del kunde inte laddas
    const dims = {};
    PART_KEYS.forEach((k, i) => (dims[k] = sizes[i]));
    dimCache.set(key, dims);
    return dims;
  });
  dimPromises.set(key, p);
  return p;
}

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

// Geometri-nyckel → delens CSS-klass (för omflöde av redan renderade riggar).
const PART_SEL = {
  lf: ".ps-fot-v",
  rf: ".ps-fot-h",
  torso: ".ps-kropp",
  lh: ".ps-arm-v",
  rh: ".ps-arm-h",
  head: ".ps-huvud",
};

function partHtml(cls, geom, src) {
  // geom saknas medan måtten laddas → dela renderas utan position (dold via
  // .ps-laddar) och positioneras när måtten är klara.
  const style = geom
    ? `left:${pct(geom.x, REF_W)};top:${pct(geom.y, REF_H)};width:${pct(geom.w, REF_W)}`
    : "";
  return `<span class="ps-del ${cls}" style="${style}"><img src="${src}" alt="" draggable="false"/></span>`;
}

/** Skriv beräknad geometri på en redan renderad .pet-sprite-nod. */
function applyGeom(sprite, g) {
  for (const key in PART_SEL) {
    const node = sprite.querySelector(PART_SEL[key]);
    if (!node) continue;
    const geom = g[key];
    node.style.left = pct(geom.x, REF_W);
    node.style.top = pct(geom.y, REF_H);
    node.style.width = pct(geom.w, REF_W);
  }
}

/**
 * Flöda om alla redan monterade riggar för en art+steg när måtten blivit klara.
 * Rör bara inline-positioner + laddar-klassen – innehållet (och därmed
 * animationerna) rörs inte, så pågående animationer nollställs inte.
 */
function reflowSprites(key, g) {
  if (typeof document === "undefined") return;
  document.querySelectorAll(`.pet-sprite[data-sprite="${key}"]`).forEach((sprite) => {
    applyGeom(sprite, g);
    sprite.classList.remove("ps-laddar");
  });
}

// Humör-partiklar (designdoket: 💤 sömnig, ❤️ mätt/glad, 🍎 äter). Uttrycken
// kan inte bakas om i huvudbilden som för SVG-arterna – de visas som en liten
// svävande symbol vid huvudet i stället.
export const SPRITE_MOODS = { somnig: "💤", glad: "❤️", ater: "🍎", nyfiken: "✨" };

/**
 * HTML för en färdigmonterad sprite-rigg (eller null om arten inte är en
 * sprite-art). stage 1–3 → assetmapp evolution-0..2. mood (valfri):
 * "glad" | "nyfiken" | "ater" | "somnig" → humör-partikel.
 *
 * Async-laddning: är måtten redan cachade byggs riggen direkt med rätt
 * geometri. Annars renderas delarna dolda (.ps-laddar) med korrekt yttermått
 * (containern har fast aspect-ratio → ingen yttre layout-"pop"), mätningen
 * startas, och när måtten finns positioneras delarna och tonas in på plats.
 */
export function spriteRigHtml(speciesId, stage, mood) {
  const s = BY_ID[speciesId];
  if (!s) return null;
  const stageIdx = clampStage(stage);
  const key = cacheKey(s.dir, stageIdx);
  const dims = dimCache.get(key);
  const dir = evoDir(s.dir, stageIdx);
  const g = dims ? layoutFor(dims) : null;

  if (!dims) {
    // Mät (en gång) och flöda om alla riggar för art+steg när måtten finns.
    measureDims(s.dir, stageIdx).then((d) => {
      if (d) reflowSprites(key, layoutFor(d));
    });
  }

  // Stapling bakifrån och fram (senare = ovanpå): fötter → torso → ARMAR →
  // huvud. Armarna ritas FRAMFÖR kroppen så de syns framför magen, huvudet överst.
  return (
    `<span class="pet-sprite${dims ? "" : " ps-laddar"}" data-sprite="${key}" role="img" aria-label="${s.name}">` +
    partHtml("ps-fot-v", g && g.lf, `${dir}/04-left-foot.png`) +
    partHtml("ps-fot-h", g && g.rf, `${dir}/05-right-foot.png`) +
    partHtml("ps-kropp", g && g.torso, `${dir}/02-torso.png`) +
    partHtml("ps-arm-v", g && g.lh, `${dir}/01-left-hand.png`) +
    partHtml("ps-arm-h", g && g.rh, `${dir}/03-right-hand.png`) +
    partHtml("ps-huvud", g && g.head, `${dir}/00-head.png`) +
    `<span class="ps-humor">${SPRITE_MOODS[mood] || ""}</span>` +
    `</span>`
  );
}
