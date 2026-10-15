// ============================================================================
// Bråkresan – komponentbiblioteket (src/brakresan/komponenter/index.js) · #707
// ----------------------------------------------------------------------------
// Spec §4 komponent 1–12, kontraktet i docs/BRAKRESAN.md §5. Varje komponent
// laddas LAT med import() – bara de som uppgiften behöver (spec §14), och
// inget här hamnar i bootgrafen (#271).
//
//   createComponent(host, view, opts)  → komponentens API (view.component väljer)
//   mountTask(host, task, opts)         → uppgiftens modell + svarsyta som ETT API
//
// Komponenternas API: { el, getAnswer, setAnswer, reset, setLocked, showResult,
// highlight, onChange, destroy } (+ ibland validate, onSubmit, focus, regroup, steg).
// opts = { interactive, size: "stor" | "kort" | "mini", label, reducedMotion, answer }
// opts.answer = uppgiftens OFFENTLIGA svarsyta (task.answer) – avgör läget.
// Förhandsvisning: preview/preview-brakresan-komponenter.html.
// ============================================================================

export const KOMPONENTER = Object.freeze({
  notation: () => import("./notation.js").then((m) => m.createNotation),
  stav: () => import("./stav.js").then((m) => m.createStav),
  cirkel: () => import("./cirkel.js").then((m) => m.createCirkel),
  rutnat: () => import("./rutnat.js").then((m) => m.createRutnat),
  hundraruta: () => import("./hundraruta.js").then((m) => m.createHundraruta),
  tallinje: () => import("./tallinje.js").then((m) => m.createTallinje),
  mangd: () => import("./mangd.js").then((m) => m.createMangd),
  kort: () => import("./kort.js").then((m) => m.createKort),
  sortering: () => import("./sortering.js").then((m) => m.createSortering),
  areamodell: () => import("./areamodell.js").then((m) => m.createAreamodell),
  // E #710: sammansatta uppgifter, figurer med olika stora delar, jämförelse med ord.
  sammansatt: () => import("./sammansatt.js").then((m) => m.createSammansatt),
  figur: () => import("./figur.js").then((m) => m.createFigur),
  relationsval: () => import("./relationsval.js").then((m) => m.createRelationsval),
  bygge: () => import("./bygge.js").then((m) => m.createBygge),
  gruppering: () => import("./gruppering.js").then((m) => m.createGruppering),
});

/** Svarstyper varje komponent själv tar emot (resten läggs i en notation under). */
export const SVARSTYPER = Object.freeze({
  notation: ["number", "relation"],
  stav: ["paint"], cirkel: ["paint"], rutnat: ["paint"], hundraruta: ["paint"], mangd: ["paint"], areamodell: ["paint"],
  tallinje: ["point", "choice"],
  kort: ["choice", "select", "pairs"],
  sortering: ["categories", "order"],
  sammansatt: ["choice", "yesno", "relation", "select", "pairs", "categories", "order", "paint", "number", "point", "multi"],
  figur: [],
  relationsval: ["relation"],
  bygge: ["number"],
  gruppering: ["categories"],
});

export const createHjalp = (...a) => import("./hjalp.js").then((m) => m.createHjalp(...a));
export const createResultat = (...a) => import("./resultat.js").then((m) => m.createResultat(...a));
export const createAterkoppling = (...a) => import("./resultat.js").then((m) => m.createAterkoppling(...a));

/** En komponent ur `view.component`. */
export async function createComponent(host, view, opts = {}) {
  const ladda = KOMPONENTER[view?.component];
  if (!ladda) throw new TypeError(`Bråkresan: okänd komponent ${view?.component}`);
  const [skapa] = await Promise.all([ladda(), import("./bas.js").then((m) => m.ensureCss())]);
  return skapa(host, view, opts);
}

/**
 * En uppgift (publicTask) på arbetsytan: modellen ur task.view och – om
 * svaret är ett tal eller ett jämförelsetecken och modellen inte själv tar det –
 * en notationsrad under modellen (view.expr, annars bara svarsfälten). Svarar
 * ett samlat API där getAnswer kommer från den del som tar svaret.
 * Svarstypen "multi" sätts ihop av sidan med createComponent per del.
 */
export async function mountTask(host, task, opts = {}) {
  const answer = task.answer || null;
  const view = task.view;
  const tar = SVARSTYPER[view.component] || [];
  const modellTar = answer && tar.includes(answer.type);
  const modell = await createComponent(host, view, { ...opts, answer: modellTar ? answer : null, interactive: modellTar && opts.interactive !== false });
  let svar = modellTar ? modell : null;
  let notation = null;
  if (!modellTar && answer && (answer.type === "number" || answer.type === "relation")) {
    notation = await createComponent(host, { component: "notation", expr: view.expr || [] }, { ...opts, answer, size: opts.size });
    svar = notation;
  }
  const delar = [modell, notation].filter(Boolean);
  return {
    el: host,
    model: modell,
    input: notation,
    getAnswer: () => svar?.getAnswer() ?? null,
    setAnswer: (a) => svar?.setAnswer(a),
    reset: () => delar.forEach((d) => d.reset()),
    setLocked: (l) => delar.forEach((d) => d.setLocked(l)),
    showResult: (r) => (svar || modell).showResult(r),
    highlight: (t) => modell.highlight(t),
    onChange: (cb) => { const av = delar.map((d) => d.onChange(cb)); return () => av.forEach((f) => f()); },
    onSubmit: (cb) => notation?.onSubmit(cb) || (() => {}),
    validate: () => svar?.validate?.() ?? { ok: true },
    focus: () => (notation?.focus ? notation.focus() : modell.el.querySelector("[tabindex='0'], button, input")?.focus()),
    destroy: () => delar.forEach((d) => d.destroy()),
  };
}
