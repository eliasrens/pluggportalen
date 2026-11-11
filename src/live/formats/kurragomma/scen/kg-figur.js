// ============================================================================
// Kurragömma (#837): FIGURERNA i 3D (spec §4.3) – elevens avatar som
// billboard (sprite) med texturen ur kg-avatar-bild.js (EN canvas per elev),
// en liten studs när figuren går, blob-skugga (ett InstancedMesh för alla) och
// en blå namnskylt ovanför sökare när namn är på. Ett hopp (egen vissling)
// styrs med `hopp` 0..1.
//
// API
//   textSprite(T, text, { bg, fg, px, h })  → Sprite (delas med kg-effekter.js)
//   skapaFigurer(T, { scen, bilder }) → {
//     satt(uid, { x, z, gar, namn, skylt, hopp })   skapa/uppdatera
//     behall(uids)       ta bort alla andra
//     bort(uid), tick(nu), namnPa(bool), antal(), dispose()
//   }
// ============================================================================

export const FIGUR_HOJD_M = 2.6;
const MAX_FIGURER = 64;
const SKYLT_BLA = "#2F80ED";

/** Text på en sprite (namnskylt, "Vissling!", "Hittad!"). */
export function textSprite(T, text, { bg = "#ffffff", fg = "#1E2240", px = 40, h = 0.7 } = {}) {
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d");
  const font = `800 ${px}px "Baloo 2", "Segoe UI Rounded", system-ui, sans-serif`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + px;
  c.width = w;
  c.height = Math.ceil(px * 1.5);
  ctx.font = font;
  if (bg) {
    ctx.fillStyle = bg;
    const r = c.height / 2;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, c.height, r);
    ctx.fill();
  }
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, c.height / 2 + px * 0.06);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set((h * w) / c.height, h, 1);
  return sp;
}

export function skapaFigurer(T, { scen, bilder }) {
  const figurer = new Map(); // uid → { grupp, sprite, tex, skylt, skyltText, x, z, gar, hopp, fas }
  let visaNamn = true;

  const skuggGeo = new T.CircleGeometry(0.8, 16).rotateX(-Math.PI / 2);
  const skuggMat = new T.MeshBasicMaterial({ color: 0x1e2240, transparent: true, opacity: 0.13, depthWrite: false });
  const skuggor = new T.InstancedMesh(skuggGeo, skuggMat, MAX_FIGURER);
  skuggor.count = 0;
  skuggor.frustumCulled = false;
  scen.add(skuggor);
  const m4 = new T.Matrix4();

  const avKlar = bilder.onKlar((uid) => {
    const f = figurer.get(uid);
    if (f) f.tex.needsUpdate = true;
  });

  function skapa(uid) {
    const canvas = bilder.bild(uid);
    const tex = new T.CanvasTexture(canvas);
    tex.colorSpace = T.SRGBColorSpace;
    const sprite = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.05 }));
    sprite.center.set(0.5, 0.03);
    sprite.scale.set((FIGUR_HOJD_M * canvas.width) / canvas.height, FIGUR_HOJD_M, 1);
    const grupp = new T.Group();
    grupp.add(sprite);
    scen.add(grupp);
    const f = { grupp, sprite, tex, skylt: null, skyltText: null, x: 0, z: 0, gar: false, hopp: 0, fas: Math.random() * 7, synligSkylt: false };
    figurer.set(uid, f);
    return f;
  }

  function skyltSatt(f, text) {
    if (f.skyltText === text) return;
    if (f.skylt) { f.grupp.remove(f.skylt); f.skylt.material.map.dispose(); f.skylt.material.dispose(); f.skylt = null; }
    f.skyltText = text;
    if (!text) return;
    f.skylt = textSprite(T, text, { bg: SKYLT_BLA, fg: "#ffffff", px: 34, h: 0.62 });
    f.skylt.position.y = FIGUR_HOJD_M + 0.4;
    f.grupp.add(f.skylt);
  }

  function satt(uid, { x, z, gar = false, namn = null, skylt = false, hopp = 0 } = {}) {
    const f = figurer.get(uid) || skapa(uid);
    f.x = x; f.z = z; f.gar = !!gar; f.hopp = hopp || 0;
    f.synligSkylt = !!skylt && !!namn;
    skyltSatt(f, f.synligSkylt ? namn : null);
    if (f.skylt) f.skylt.visible = visaNamn;
    return f;
  }

  function bort(uid) {
    const f = figurer.get(uid);
    if (!f) return;
    scen.remove(f.grupp);
    skyltSatt(f, null);
    f.tex.dispose();
    f.sprite.material.dispose();
    figurer.delete(uid);
  }

  function tick(nu) {
    let i = 0;
    for (const f of figurer.values()) {
      const studs = f.gar ? Math.abs(Math.sin(nu * 0.011 + f.fas)) * 0.14 : 0;
      const hopp = f.hopp > 0 ? Math.sin(Math.min(1, f.hopp) * Math.PI) * 0.7 : 0;
      f.grupp.position.set(f.x, studs + hopp, f.z);
      if (i < MAX_FIGURER) {
        m4.makeTranslation(f.x, 0.035, f.z);
        skuggor.setMatrixAt(i++, m4);
      }
    }
    skuggor.count = i;
    skuggor.instanceMatrix.needsUpdate = true;
  }

  return {
    satt,
    bort,
    behall(uids) {
      const s = new Set(uids);
      for (const uid of [...figurer.keys()]) if (!s.has(uid)) bort(uid);
    },
    tick,
    namnPa(v) {
      visaNamn = !!v;
      for (const f of figurer.values()) if (f.skylt) f.skylt.visible = visaNamn;
    },
    antal: () => figurer.size,
    dispose() {
      avKlar();
      for (const uid of [...figurer.keys()]) bort(uid);
      scen.remove(skuggor);
      skuggGeo.dispose();
      skuggMat.dispose();
    },
  };
}
