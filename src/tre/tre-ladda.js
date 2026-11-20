// ============================================================================
// three.js – den delade laddningen (#869, utbruten ur Kurragömmas kg-tre.js #837).
// Den ENDA platsen i src/ som når src/vendor/three/, och bara med import() – three
// ligger aldrig i bootgrafen (#271). Kurragömma (kg-tre.js) och Matchdagen
// (src/matchdagen/plan/) laddar three härifrån först när scenen startar.
//
//   harWebGL()    → bool (provar en WebGL-kontext utan three och släpper den direkt)
//   laddaThree()  → Promise<three-modulen>
// ============================================================================

export function harWebGL() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (!gl) return false;
    const ext = gl.getExtension("WEBGL_lose_context"); // släpp provkontexten direkt
    if (ext) ext.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** Lat laddning – den enda platsen som når src/vendor/three/. */
export function laddaThree() {
  return import("../vendor/three/three.module.min.js");
}
