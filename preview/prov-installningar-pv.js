// ============================================================================
// #759-preview: provets inställningar (stavfel, färggränser) via adressen i
// rättnings- och statistikpreviewn. Varje kombination har sin egen sparade
// rättning i localStorage, så att valen inte blandas.
//   ?stavfel=sjalv      Rätta stavfel själv (standard: ett stavfel = halva poängen)
//   ?granser=50-75      gul från 50 %, grön från 75 % (standard 60/85)
//   ?gammalt            tillfället saknar stavfel och granser (som ett prov från
//                       Etapp 1 utan fälten) – standarden 60/85 och auto gäller
//   ?nollstall          börja om (de andra valen står kvar)
// ============================================================================

const Q = new URLSearchParams(location.search);
const g = /^(\d{1,3})-(\d{1,3})$/.exec(Q.get("granser") || "");
export const PV_STAVFEL = Q.get("stavfel") === "sjalv" ? "sjalv" : null;
export const PV_GRANSER = g ? { gul: Number(g[1]), gron: Number(g[2]) } : null;
export const PV_GAMMALT = Q.has("gammalt");

/** localStorage-nyckeln för just den här kombinationen. */
export const pvNyckel = (bas) =>
  [bas, PV_STAVFEL && "sjalv", PV_GRANSER && `g${PV_GRANSER.gul}-${PV_GRANSER.gron}`, PV_GAMMALT && "gammalt"].filter(Boolean).join(":");

/** Provets inställningar med adressens val. */
export function pvInstallningar(ins) {
  const ut = { ...ins };
  if (PV_GAMMALT) {
    delete ut.stavfel;
    delete ut.granser;
  }
  if (PV_STAVFEL) ut.stavfel = PV_STAVFEL;
  if (PV_GRANSER) ut.granser = PV_GRANSER;
  return ut;
}

/** ?nollstall: glöm den sparade rättningen och ta bort just den parametern. */
export function pvNollstall(nyckel) {
  if (!Q.has("nollstall")) return;
  localStorage.removeItem(nyckel);
  const q = new URLSearchParams(location.search);
  q.delete("nollstall");
  history.replaceState(null, "", location.pathname + (q.toString() ? `?${q}` : "") + location.hash);
}

/** Länkarna i previewns kontrollrad (samma hash, andra val). */
export function pvLankar(el) {
  const val = [["Standard (auto, 60/85)", ""], ["Rätta stavfel själv", "?stavfel=sjalv"], ["Gränser 50/75", "?granser=50-75"],
    ["Själv + 50/75", "?stavfel=sjalv&granser=50-75"], ["Gammalt tillfälle (utan fälten)", "?gammalt"]];
  const nu = location.search.replace(/[?&]nollstall/, "");
  el.replaceChildren("#759: ", ...val.flatMap(([text, q], i) => {
    const a = document.createElement("a");
    a.textContent = text;
    a.href = `${location.pathname}${q}${location.hash}`;
    if (q === nu) a.style.fontWeight = "700";
    a.addEventListener("click", (e) => {
      e.preventDefault();
      location.href = `${location.pathname}${q}${location.hash}`;
    });
    return i ? [" · ", a] : [a];
  }));
}
