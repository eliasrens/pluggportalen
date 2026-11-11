// ============================================================================
// Kurragömma (#837): MODELLERNA – Pluggportens 2D-konst som low-poly 3D
// (spec §4.2). Ren data utan three.js: varje föremålstyp i kg-karta.js blir
// en lista DELAR { geo, p, f, x, y, z, rx, ry, rz, sx, sy, sz, kontur, grupp }
// som kg-varld.js bygger och slår ihop till få ritanrop.
//
//   geo   cyl [rTopp, rBotten, höjd, segment] · box [b, h, d] · kon [r, h, seg]
//         iko [r] · dod [r] · sfar [r, bredd-seg, höjd-seg] · cirkel [r, seg] (platt på marken)
//   f     färg ur paletten i art-style.js (inga nya färger utan skäl)
//   kontur false = ingen kontur (platta saker: skuggor, vatten, stigen)
//   grupp "dekor" = döljs på nivån Låg (blommor, moln, stigen)
//
// Färgerna: gräs/jord ur art-gard.js, resten ur art-style.js palett.
// ============================================================================

export const F = Object.freeze({
  kontur: "#3B3350", gras: "#8FCB74", grasMork: "#6FA85B", grasLjus: "#A8DA8F", sand: "#FFF3DC", jord: "#8A6242",
  tra: "#B0805A", traLjus: "#E0B98C", gul: "#F7C948", barnsten: "#F2A93B", orange: "#F49E4C", rod: "#EF6F6C",
  rodMork: "#C4574A", blaHimmel: "#7FC7E8", stal: "#A9C2DE", grabla: "#A8BAD1", gron: "#6FC66F", mint: "#58C6A9",
  vit: "#FFFFFF", rosa: "#F890B7", lila: "#B79BE0", mork: "#4C4661", marin: "#46557A",
});

/** En del. o = { rx, ry, rz, sx, sy, sz, kontur, grupp }. */
const d = (geo, p, f, x = 0, y = 0, z = 0, o = {}) => ({ geo, p, f, x, y, z, ...o });
const PLATT = { kontur: false };
const DEKOR = { kontur: false, grupp: "dekor" };

/** Liten deterministisk variation per föremål (så inte alla träd ser lika ut). */
function hash(id) {
  let h = 7;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** Mjuk blob-skugga under ett föremål (ritas av kg-varld.js som egen grupp). */
export const skugga = (r) => ({ r });

const MODELLER = {
  lada: () => [
    d("box", [6, 4, 5], F.rod, 0, 2, 0),
    d("cyl", [3.6, 3.6, 5.4, 3], F.rodMork, 0, 4.9, 0, { rx: Math.PI / 2, sx: 1.15, sz: 0.5 }),
    d("box", [2.2, 2.8, 0.1], F.vit, 0, 1.4, 2.52),
    d("box", [1.8, 2.4, 0.12], F.rodMork, 0, 1.3, 2.55),
    d("box", [1, 0.9, 0.12], F.gul, 0, 3.4, 2.55),
  ],
  hostack: () => [
    d("cyl", [1.7, 1.9, 1.8, 10], F.gul, 0, 0.9, 0),
    d("kon", [1.8, 1.5, 10], F.barnsten, 0, 2.5, 0),
  ],
  sten: (f) => {
    const r = f.fast * 0.87;
    return [
      d("dod", [r], F.grabla, 0, r * 0.65, 0, { sx: 1.3, sy: 0.95 }),
      d("dod", [r * 0.45], F.stal, r * 1.1, r * 0.3, r * 0.5, { ry: 1 }),
    ];
  },
  gran: () => [
    d("cyl", [0.35, 0.45, 1.4, 6], F.jord, 0, 0.7, 0),
    d("kon", [2.4, 2.8, 7], F.grasMork, 0, 2.4, 0),
    d("kon", [1.8, 2.3, 7], F.gron, 0, 3.8, 0),
    d("kon", [1.1, 1.9, 7], F.gras, 0, 5.0, 0),
  ],
  ek: () => [
    d("cyl", [0.5, 0.7, 2.6, 7], F.jord, 0, 1.3, 0),
    d("iko", [2.6], F.gron, 0, 3.9, 0),
    d("iko", [1.7], F.gras, 1.6, 3.2, 0.8),
    d("iko", [1.5], F.grasMork, -1.5, 3.4, -0.6),
  ],
  trad: (f) => {
    const s = 0.85 + (hash(f.id) % 5) * 0.06;
    const stam = d("cyl", [0.25 * s, 0.35 * s, 1.3 * s, 6], F.jord, 0, 0.65 * s, 0);
    if (hash(f.id) % 2) {
      return [stam,
        d("kon", [1.6 * s, 2.4 * s, 7], F.grasMork, 0, 2.1 * s, 0),
        d("kon", [1.1 * s, 1.8 * s, 7], F.gron, 0, 3.2 * s, 0)];
    }
    return [stam, d("iko", [1.6 * s], hash(f.id) % 3 ? F.gron : F.gras, 0, 2.4 * s, 0)];
  },
  buskage: (f) => {
    const s = f.r / 2.6;
    const klot = [[0, 1.2, 0, 1.6], [1.6, 0.9, 0.6, 1.2], [-1.4, 0.9, 0.4, 1.3], [0.4, 0.8, 1.5, 1]]
      .map(([x, y, z, r]) => d("iko", [r * s], F.gron, x * s, y * s, z * s));
    return [...klot,
      d("sfar", [0.18, 6, 4], F.rod, 0.9 * s, 2.2 * s, 0.9 * s, PLATT),
      d("sfar", [0.18, 6, 4], F.rod, -0.8 * s, 1.9 * s, 1.1 * s, PLATT)];
  },
  bro: () => {
    const delar = [d("box", [8, 0.35, 2.4], F.tra, 0, 0.45, 0)];
    for (const z of [-1.1, 1.1]) {
      delar.push(d("box", [8, 0.15, 0.15], F.jord, 0, 1.3, z));
      for (let x = -3.6; x <= 3.7; x += 1.8) delar.push(d("box", [0.2, 1, 0.2], F.jord, x, 0.9, z));
    }
    return delar;
  },
  damm: (f) => [
    d("cirkel", [f.yta || 5.9, 32], F.traLjus, 0, 0.012, 0, PLATT),
    d("cirkel", [(f.yta || 5.9) - 0.5, 32], F.blaHimmel, 0, 0.03, 0, PLATT),
  ],
  brunn: () => [
    d("cyl", [1.2, 1.3, 1.1, 10], F.grabla, 0, 0.55, 0),
    d("cyl", [0.95, 0.95, 0.05, 10], F.blaHimmel, 0, 1.1, 0, PLATT),
    d("box", [0.2, 2, 0.2], F.jord, -1, 2, 0),
    d("box", [0.2, 2, 0.2], F.jord, 1, 2, 0),
    d("kon", [1.7, 1, 4], F.rod, 0, 3.3, 0, { ry: Math.PI / 4 }),
    d("cyl", [0.3, 0.25, 0.4, 8], F.jord, 0, 1.9, 0),
  ],
  vedtrave: () => {
    const delar = [];
    [[4, 0.35], [3, 1.0], [2, 1.65]].forEach(([n, y]) => {
      for (let i = 0; i < n; i++) {
        delar.push(d("cyl", [0.36, 0.36, 2.6, 7], i % 2 ? F.tra : F.traLjus, (i - (n - 1) / 2) * 0.74, y, 0, { rx: Math.PI / 2 }));
      }
    });
    return delar;
  },
  vagn: () => [
    d("box", [3.4, 1, 2], F.tra, 0, 1.1, 0),
    d("box", [3, 0.6, 1.6], F.gul, 0, 1.8, 0),
    ...[[-1.1, 1.05], [1.1, 1.05], [-1.1, -1.05], [1.1, -1.05]].map(([x, z]) =>
      d("cyl", [0.6, 0.6, 0.2, 10], F.mork, x, 0.6, z, { rx: Math.PI / 2 })),
    d("box", [1.8, 0.15, 0.15], F.jord, 2.5, 0.8, 0),
  ],
  tunnor: () => [[-0.7, 0, 0], [0.7, 0, 0.2], [0, 1.25, 0.1]].flatMap(([x, y, z]) => [
    d("cyl", [0.6, 0.6, 1.2, 10], F.tra, x, 0.6 + y, z),
    d("cyl", [0.62, 0.62, 0.12, 10], F.jord, x, 0.9 + y, z),
  ]),
  talt: () => [
    d("kon", [2.2, 2.8, 4], F.orange, 0, 1.4, 0, { ry: Math.PI / 4 }),
    d("box", [0.9, 1.3, 0.05], F.jord, 0, 0.65, 1.12, { rx: -0.45 }),
    d("cyl", [0.05, 0.05, 1.2, 4], F.mork, 0, 3.2, 0),
    d("box", [0.7, 0.4, 0.04], F.lila, 0.35, 3.5, 0),
  ],
  // Lågt staket (ingen kollision) – man ser att man kliver över det.
  staket: () => [
    ...[-1.4, 0, 1.4].map((x) => d("box", [0.16, 0.9, 0.16], F.traLjus, x, 0.45, 0)),
    d("box", [3.1, 0.1, 0.08], F.traLjus, 0, 0.42, 0),
    d("box", [3.1, 0.1, 0.08], F.traLjus, 0, 0.75, 0),
  ],
  blommor: (f) => {
    const h = hash(f.id);
    const farger = [F.vit, F.gul, F.rosa, F.lila];
    return Array.from({ length: 6 }, (_, i) => {
      const a = ((h + i * 97) % 360) * (Math.PI / 180);
      const r = 0.4 + ((h >> (i + 1)) % 7) * 0.12;
      return d("sfar", [0.16, 5, 3], farger[(h + i) % 4], Math.cos(a) * r, 0.15, Math.sin(a) * r, DEKOR);
    });
  },
  // Molnen svävar högt över sin kartplats (som molnen i gårds-scenerna).
  moln: (f) => {
    const y = 20 + (hash(f.id) % 5);
    return [[0, 0, 0, 2.2], [2.2, -0.4, 0.3, 1.6], [-2.1, -0.5, 0, 1.5], [0.8, 0.9, -0.4, 1.4]]
      .map(([x, dy, z, r]) => d("sfar", [r, 10, 8], F.vit, x, y + dy, z, { grupp: "dekor" }));
  },
};

/** Delarna för ett föremål ur kartan (okänd typ → en liten sten så inget saknas). */
export function delarFor(f) {
  const m = MODELLER[f.typ];
  return m ? m(f) : [d("dod", [0.5], F.grabla, 0, 0.3, 0)];
}

/** Blob-skuggans radie för ett föremål (0 = ingen skugga). */
export function skuggRadie(f) {
  switch (f.typ) {
    case "lada": return 4.6;
    case "sten": return f.fast * 1.2;
    case "gran": case "ek": case "buskage": case "hostack": return f.r;
    case "trad": return 1.6;
    case "brunn": return 1.8;
    case "vedtrave": case "vagn": case "tunnor": case "talt": return f.fast + 0.4;
    default: return 0;
  }
}

export const TYPER = Object.freeze(Object.keys(MODELLER));

/** Själva ön: gräs, sandkant och jord under, plus ängen vid brunnen och stigen. */
export function onDelar(karta) {
  const R = karta.radie;
  const delar = [
    d("cyl", [R + 1, R + 1, 2, 48], F.gras, 0, -1, 0),
    d("cyl", [R + 3, R - 1, 3, 48], F.sand, 0, -2.5, 0),
    d("cyl", [R, R - 8, 5, 48], F.jord, 0, -6, 0),
    d("cirkel", [5.5, 32], F.sand, karta.sokarStart.x, 0.02, karta.sokarStart.z, PLATT),
  ];
  // Stigen: en ring av stenar runt mitten (dekor).
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const r = 11 + Math.sin(i * 1.7) * 1.2;
    delar.push(d("cyl", [0.7, 0.7, 0.08, 8], F.traLjus, Math.cos(a) * r, 0.03, Math.sin(a) * r, { ...DEKOR, ry: a }));
  }
  return delar;
}
