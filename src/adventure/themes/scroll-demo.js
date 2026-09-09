// ============================================================================
// Pluggportalen – äventyrsmotorn: themes/scroll-demo.js  (issue #220)
// ----------------------------------------------------------------------------
// DEV-/PREVIEW-tema som bevisar det OPT-IN scrollande bild-karta-läget: ren data
// (som alla teman) men med theme.mapImage + världskoordinater i stället för en
// ASCII-ruta. INTE registrerad i produktions-THEMES (themes/index.js) – syns
// aldrig för elever, precis som test-tema.js. Används av preview-harnessen
// (aventyr-scroll-demo.html) för att köra motorn utan Firebase.
//
// Kartan är en stor inline-SVG (data-URI) – en liten park sedd uppifrån med en
// damm (hinder) och några träd (hinder). Kollisionslagret är GROVT (rects över
// världskoordinater), inte pixelperfekt, precis som issue:n vill.
// ============================================================================

const W = 2400;
const H = 1600;

// Dammen och träden – normaliserat (0..1) så kollision och ritning matchar.
const POND = { x: 0.34, y: 0.42, w: 0.32, h: 0.22 };
const TREES = [
  { x: 0.12, y: 0.18, r: 0.05 },
  { x: 0.82, y: 0.2, r: 0.055 },
  { x: 0.2, y: 0.8, r: 0.05 },
  { x: 0.86, y: 0.78, r: 0.05 },
  { x: 0.62, y: 0.14, r: 0.045 },
];

function tree(t) {
  const cx = t.x * W, cy = t.y * H, r = t.r * Math.min(W, H);
  return (
    `<ellipse cx="${cx}" cy="${cy + r * 0.9}" rx="${r * 0.9}" ry="${r * 0.35}" fill="#1f3d24" opacity="0.25"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#3f9a4e" stroke="#2b6d38" stroke-width="6"/>` +
    `<circle cx="${cx - r * 0.3}" cy="${cy - r * 0.3}" r="${r * 0.35}" fill="#5fc06e"/>`
  );
}

/** Bygg bakgrundsbilden som en SVG data-URI (den "stora rasterbilden"). */
function buildMapImage() {
  const px = POND.x * W, py = POND.y * H, pw = POND.w * W, ph = POND.h * H;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="#8ccf6f"/>` +
    // mjuka gräsfläckar
    `<g fill="#7cc25f" opacity="0.5">` +
    `<circle cx="480" cy="360" r="140"/><circle cx="1900" cy="520" r="180"/>` +
    `<circle cx="700" cy="1200" r="160"/><circle cx="1700" cy="1250" r="150"/></g>` +
    // slingrande sandstig
    `<path d="M120 1480 Q700 1100 900 700 Q1100 300 2280 200" fill="none" ` +
    `stroke="#e8d199" stroke-width="90" stroke-linecap="round" opacity="0.85"/>` +
    // damm (hinder)
    `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="120" fill="#5fb6e6" ` +
    `stroke="#3f92c4" stroke-width="10"/>` +
    `<rect x="${px + 24}" y="${py + 30}" width="${pw - 120}" height="18" rx="9" fill="#bfe6f7" opacity="0.7"/>` +
    // träd (hinder)
    TREES.map(tree).join("") +
    // ram
    `<rect x="6" y="6" width="${W - 12}" height="${H - 12}" fill="none" stroke="#2b6d38" stroke-width="12" rx="24"/>` +
    `</svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

export const scrollDemoTheme = {
  id: "scroll-demo",
  namn: "Parkäventyret (scroll-demo)",
  stamning: { himmel: "#bfe3ff", mark: "#8ccf6f" },

  // Opt-in-flaggan: närvaron av mapImage → motorn väljer scroll/bild-karta-läget.
  mapImage: buildMapImage(),
  worldSize: { w: W, h: H },
  viewFraction: 1 / 6, // ~1/6 av kartan syns åt gången (tune:bar)

  startAt: { x: 0.08, y: 0.9 },
  goalAt: { x: 0.92, y: 0.1 },
  stationsAt: [
    { x: 0.24, y: 0.62 },
    { x: 0.16, y: 0.32 },
    { x: 0.5, y: 0.22 },
    { x: 0.72, y: 0.5 },
    { x: 0.5, y: 0.8 },
    { x: 0.8, y: 0.86 },
  ],
  goal: 6,

  // Grovt kollisionslager i världskoordinater (normaliserade rects).
  collision: {
    rects: [
      POND,
      ...TREES.map((t) => ({
        x: t.x - t.r * 0.7,
        y: t.y - t.r * 0.7,
        w: t.r * 1.4 * (Math.min(W, H) / W),
        h: t.r * 1.4 * (Math.min(W, H) / H),
      })),
    ],
  },

  progressIcon: "🌟",
  stationArt: () => "🎈",
  goalArt: () => "🏰",
  texter: {
    intro:
      "Scroll-demo! Kameran följer dig och kartan scrollar under dig (~1/6 syns åt " +
      "gången). Gå runt dammen och träden, samla alla 🎈 och gå sedan till slottet 🏰.",
    stationPrompt: "En ballong! 🎈 Tryck E (eller mellanslag) för att svara.",
    stationTitle: "Frågeballong",
    goalPrompt: "Slottet! 🏰 Tryck E för att avsluta.",
    klart: "Du klarade parkäventyret!",
  },
  questionKinds: ["quiz"],
};
