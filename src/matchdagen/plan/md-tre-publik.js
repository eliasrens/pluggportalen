// ============================================================================
// Matchdagen (#882): LÄKTAREN OCH PUBLIKEN i 3D – ersätter den platta publik-
// texturen (färgade prickar). Bänkraderna är trappsteg (EN InstancedMesh) och
// publiken små figurer i spelarnas stil: en kropp och ett huvud (två
// InstancedMesh). Tre ritanrop totalt, ingen textur, ingen slump (fast frö).
// Vänstra halvan håller på oss, högra på motståndarna – deras tröjfärger blandat
// med neutrala jackor. Finalen: fullsatt. Jubel: figurerna hoppar, bara det
// lag som gjorde mål om lag anges (lugnt läge: ingen publik som jublar).
//
//   byggPublik(T, scen, { final, spara }) → { lagFarg(sida, farg), jubel(t, lag?), stilla(), antal }
//   sida/lag: "vi" | "dem". t = 0–1 (effektens förlopp).
// ============================================================================

export const RADER = 9;
const DJUP = 1.45, HOJD = 0.85; // varje bänkrad: djup och höjd i meter
const FRAM_Z = -40.4, FRAM_Y = 0.7; // läktarens framkant (bakom reklamskyltarna vid −37,5)
const BREDD = 124, PLATS = 1.15;
const NEUTRAL = ["#c9d2e0", "#5a6478", "#2a3448", "#8a96aa", "#e8e2d4", "#3d4a63"];
const HUD = ["#f1c9a5", "#d9a37e", "#a86f4c", "#7a4a2e", "#f5d6bd", "#c68a5e"];

/** Platserna: rad, x, sida och om platsen är tagen – samma varje gång (fast frö). */
export function platser({ final = false } = {}) {
  let s = 882;
  const slump = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const ut = [];
  const n = Math.floor(BREDD / PLATS);
  for (let r = 0; r < RADER; r++) {
    for (let k = 0; k < n; k++) {
      const x = -BREDD / 2 + (k + 0.5) * PLATS + (r % 2 ? PLATS / 2 : 0);
      const a = slump(), b = slump(), c = slump(), d = slump();
      if (a > (final ? 0.97 : 0.68)) continue; // tomma platser (finalen: fullsatt)
      ut.push({ r, x: x + (b - 0.5) * 0.25, sida: x < 0 ? "vi" : "dem", lagFarg: c < 0.62, ton: d, fas: b * Math.PI * 2 });
    }
  }
  return ut;
}

export function byggPublik(T, scen, { final = false, spara = (x) => x } = {}) {
  // Bänkraderna: trappsteg som stiger bakåt, mörk marin om vartannat.
  const steg = new T.InstancedMesh(spara(new T.BoxGeometry(BREDD + 6, 1, DJUP)), spara(new T.MeshLambertMaterial()), RADER + 1);
  const m4 = new T.Matrix4(), q = new T.Quaternion(), pv = new T.Vector3(), sk = new T.Vector3(), c = new T.Color();
  for (let r = 0; r <= RADER; r++) {
    const topp = FRAM_Y + r * HOJD + (r === RADER ? 1.6 : 0); // sista: bakväggen
    m4.compose(pv.set(0, topp / 2, FRAM_Z - (r + 0.5) * DJUP), q.identity(), sk.set(1, topp, 1));
    steg.setMatrixAt(r, m4);
    steg.setColorAt(r, c.set(r === RADER ? "#16233a" : r % 2 ? "#22324d" : "#1b2a44"));
  }
  scen.add(steg);

  const P = platser({ final });
  const kroppar = new T.InstancedMesh(spara(new T.BoxGeometry(0.62, 0.78, 0.42)), spara(new T.MeshLambertMaterial()), P.length);
  const huvuden = new T.InstancedMesh(spara(new T.SphereGeometry(0.22, 7, 5)), spara(new T.MeshLambertMaterial()), P.length);
  const bas = P.map((p) => ({ x: p.x, y: FRAM_Y + p.r * HOJD, z: FRAM_Z - (p.r + 0.55) * DJUP }));
  function placera(i, hopp) {
    const b = bas[i];
    kroppar.setMatrixAt(i, m4.compose(pv.set(b.x, b.y + 0.39 + hopp, b.z), q.identity(), sk.set(1, 1, 1)));
    huvuden.setMatrixAt(i, m4.compose(pv.set(b.x, b.y + 0.98 + hopp, b.z), q.identity(), sk.set(1, 1, 1)));
  }
  P.forEach((p, i) => {
    placera(i, 0);
    huvuden.setColorAt(i, c.set(HUD[Math.floor(p.ton * HUD.length)]));
  });
  const farg = { vi: "#2f6fe8", dem: "#e8473f" };
  function farga() {
    P.forEach((p, i) => kroppar.setColorAt(i, c.set(p.lagFarg ? farg[p.sida] : NEUTRAL[Math.floor(p.ton * NEUTRAL.length)])));
    kroppar.instanceColor.needsUpdate = true;
  }
  farga();
  scen.add(kroppar, huvuden);
  let hoppar = false;

  return {
    antal: P.length,
    /** Lagets tröjfärg på dess halva av läktaren. */
    lagFarg(sida, f) { if (f && farg[sida] !== f) { farg[sida] = f; farga(); } },
    /** Publiken hoppar (t 0–1, avtar mot slutet). lag: bara den halvan, annars alla. */
    jubel(t, lag = null) {
      const styrka = 0.45 * (1 - t);
      P.forEach((p, i) => placera(i, lag && p.sida !== lag ? 0 : Math.max(0, Math.sin(t * Math.PI * 7 + p.fas)) * styrka));
      kroppar.instanceMatrix.needsUpdate = true;
      huvuden.instanceMatrix.needsUpdate = true;
      hoppar = true;
    },
    /** Alla sitter still igen. */
    stilla() {
      if (!hoppar) return;
      P.forEach((_, i) => placera(i, 0));
      kroppar.instanceMatrix.needsUpdate = true;
      huvuden.instanceMatrix.needsUpdate = true;
      hoppar = false;
    },
    dispose() { steg.dispose(); kroppar.dispose(); huvuden.dispose(); },
  };
}
