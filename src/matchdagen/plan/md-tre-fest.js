// ============================================================================
// Matchdagen (#873, Etapp 3): FIRANDET i 3D (spec §10.1, §10.2) – pokalen som
// lyfts och fyrverkerier i lugnt tempo. Byggs först när en titel är vunnen
// (md-tre-ritare.js fest()), så en vanlig match ritar inget extra.
//
//   skapaFest(T, scen, { lugnt }) → {
//     pokal(sort) → THREE.Group   "superliga" (stor guldpokal) | "mastarcup" (störst: silver
//                                 med guldkanter och stora handtag)
//     steg(dt, tid)              fyrverkerierna (inga i lugnt läge)
//     dispose()
//   }
// Fyrverkerierna är EN Points-mesh (ett ritanrop): högst SMALL × PER partiklar som
// stiger långsamt, slår ut och faller – en ny smäll ungefär varannan sekund.
// ============================================================================

const SMALL = 6; // smällar i luften samtidigt
const PER = 70; // partiklar per smäll
const FARGER = ["#ffd23f", "#ffffff", "#ff7a59", "#7ad7ff", "#9dff8a", "#ff9ad5"];

export function skapaFest(T, scen, { lugnt = false } = {}) {
  const sparat = [];
  const spara = (...x) => { sparat.push(...x); return x[0]; };

  /** En pokal av en profil som roteras (LatheGeometry) + handtag (halva torusar). */
  function pokal(sort) {
    const stor = sort === "mastarcup";
    // Phong med eget sken: metallen ser blank ut utan miljökarta (inga extra texturer att ladda).
    const guld = spara(new T.MeshPhongMaterial({ color: "#ffc928", emissive: "#7a5200", specular: "#fff3c0", shininess: 70 }));
    const silver = spara(new T.MeshPhongMaterial({ color: "#e3eaf5", emissive: "#4a5466", specular: "#ffffff", shininess: 90 }));
    const kropp = stor ? silver : guld;
    const profil = (stor
      ? [[0, 0], [0.34, 0], [0.34, 0.08], [0.2, 0.12], [0.08, 0.2], [0.07, 0.5], [0.14, 0.58], [0.3, 0.7], [0.4, 0.95], [0.43, 1.2], [0.4, 1.22]]
      : [[0, 0], [0.28, 0], [0.28, 0.07], [0.16, 0.1], [0.06, 0.18], [0.05, 0.45], [0.12, 0.52], [0.27, 0.66], [0.34, 0.9], [0.32, 0.92]])
      .map(([x, y]) => new T.Vector2(x, y));
    const g = new T.Group();
    const skal = new T.Mesh(spara(new T.LatheGeometry(profil, 20)), kropp);
    skal.material.side = T.DoubleSide;
    g.add(skal);
    const topp = stor ? 1.22 : 0.92;
    const kant = new T.Mesh(spara(new T.TorusGeometry(stor ? 0.41 : 0.32, 0.025, 6, 24)), guld);
    kant.rotation.x = Math.PI / 2;
    kant.position.y = topp;
    g.add(kant);
    const orat = spara(new T.TorusGeometry(stor ? 0.3 : 0.17, stor ? 0.045 : 0.03, 6, 16, Math.PI));
    for (const sida of [-1, 1]) {
      const h = new T.Mesh(orat, stor ? guld : kropp);
      h.rotation.z = sida * Math.PI / 2;
      h.position.set(sida * (stor ? 0.36 : 0.3), stor ? 0.86 : 0.7, 0);
      g.add(h);
    }
    return g;
  }

  // ---- fyrverkerierna ---------------------------------------------------------
  let pts = null, pos = null, fart = null, liv = null, nastaSmall = 0, nr = 0, tid0 = 0;
  const N = SMALL * PER;
  if (!lugnt) {
    const geo = spara(new T.BufferGeometry());
    pos = new Float32Array(N * 3);
    fart = new Float32Array(N * 3);
    liv = new Float32Array(N); // sekunder kvar (0 = släckt, ritas under marken)
    const farg = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) pos[i * 3 + 1] = -50;
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    geo.setAttribute("color", new T.BufferAttribute(farg, 3));
    // En rund, mjuk gnista (canvas-textur) i stället för fyrkantiga punkter.
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const g = c.getContext("2d");
    const rg = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    rg.addColorStop(0, "rgba(255,255,255,1)"); rg.addColorStop(0.35, "rgba(255,255,255,.85)"); rg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = rg;
    g.fillRect(0, 0, 32, 32);
    const gnista = spara(new T.CanvasTexture(c));
    const mat = spara(new T.PointsMaterial({ map: gnista, size: 1.7, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, blending: T.AdditiveBlending }));
    pts = new T.Points(geo, mat);
    pts.frustumCulled = false;
    scen.add(pts);
  }

  /** En smäll: PER partiklar ut från en punkt högt över läktaren – långsamt (lugnt tempo, inga blixtar). */
  function small(slump) {
    const bas = (nr++ % SMALL) * PER;
    const c = new T.Color(FARGER[nr % FARGER.length]);
    const cx = (slump() - 0.5) * 56, cy = 8 + slump() * 5, cz = -20 - slump() * 8;
    const farg = pts.geometry.attributes.color.array;
    for (let i = 0; i < PER; i++) {
      const k = (bas + i) * 3;
      const v = Math.acos(2 * slump() - 1), u = slump() * Math.PI * 2, s = 5 + slump() * 2;
      pos[k] = cx; pos[k + 1] = cy; pos[k + 2] = cz;
      fart[k] = Math.sin(v) * Math.cos(u) * s; fart[k + 1] = Math.cos(v) * s; fart[k + 2] = Math.sin(v) * Math.sin(u) * s;
      farg[k] = c.r; farg[k + 1] = c.g; farg[k + 2] = c.b;
      liv[bas + i] = 2.6 + slump() * 0.6;
    }
    pts.geometry.attributes.color.needsUpdate = true;
  }
  // Deterministisk slump (ingen Math.random i ritningen – samma firande varje gång).
  let fro = 11;
  const slump = () => ((fro = (fro * 16807) % 2147483647) / 2147483647);

  return {
    pokal,
    steg(dt, tid) {
      if (!pts) return;
      if (!tid0) tid0 = tid;
      if (tid >= nastaSmall) { small(slump); nastaSmall = tid + 1.6 + slump() * 0.8; }
      for (let i = 0; i < N; i++) {
        if (liv[i] <= 0) continue;
        const k = i * 3;
        liv[i] -= dt;
        fart[k + 1] -= 2.2 * dt; // tyngdkraften, mjukt
        fart[k] *= 0.985; fart[k + 2] *= 0.985;
        pos[k] += fart[k] * dt; pos[k + 1] += fart[k + 1] * dt; pos[k + 2] += fart[k + 2] * dt;
        if (liv[i] <= 0) pos[k + 1] = -50;
      }
      pts.geometry.attributes.position.needsUpdate = true;
    },
    dispose() {
      if (pts) scen.remove(pts);
      for (const x of sparat) x.dispose?.();
    },
  };
}
