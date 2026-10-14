// ============================================================================
// Bråkdraken – animations-CSS (#718)
// ----------------------------------------------------------------------------
// Andning är kontinuerlig men svag; övriga gester är engångsanimationer som
// tänds av en klass på <svg> (bd-gest-<namn>) – se spelaGest() i
// art-drake-anim.js. Klassen .bd-lugn (eller prefers-reduced-motion) stänger
// av allt utom en lugn opacitetsövergång.
// ============================================================================

const kf = (namn, steg) => `@keyframes ${namn}{${steg}}`;

export const DRAKE_CSS = `
.bd-drake{overflow:visible}
.bd-drake *{transform-box:view-box}
.bd-andas{animation:bd-andas 3.8s ease-in-out infinite}
.bd-familj-unge .bd-andas{animation-duration:3s}
.bd-familj-legend .bd-andas,.bd-familj-vuxen .bd-andas{animation-duration:4.6s}
.bd-agg.bd-andas{animation:bd-agg-puls 3.2s ease-in-out infinite}
.bd-aura{animation:bd-aura 5s ease-in-out infinite;transform-origin:center}
.bd-ande,.bd-gnistor,.bd-puff,.bd-svep{opacity:0}
${kf("bd-andas", "0%,100%{transform:scale(1,1)}50%{transform:scale(1.008,1.022)}")}
${kf("bd-agg-puls", "0%,100%{transform:scale(1)}50%{transform:scale(1.02,1.01)}")}
${kf("bd-aura", "0%,100%{opacity:.45}50%{opacity:.8}")}

.bd-gest-blink .bd-oga{animation:bd-blink .32s ease-in-out}
.bd-gest-langsamblink .bd-oga{animation:bd-blink 1.3s ease-in-out}
${kf("bd-blink", "0%,100%{transform:scaleY(1)}45%,55%{transform:scaleY(.08)}")}

.bd-gest-lut .bd-huvud{animation:bd-lut 2.4s ease-in-out}
${kf("bd-lut", "0%,100%{transform:rotate(0)}30%,70%{transform:rotate(-11deg)}")}
.bd-gest-titta .bd-huvud{animation:bd-titta 3s ease-in-out}
${kf("bd-titta", "0%,100%{transform:rotate(0)}25%,40%{transform:rotate(-8deg)}60%,80%{transform:rotate(7deg)}")}
.bd-gest-huvudlyft .bd-huvud{animation:bd-huvudlyft 3.2s ease-in-out}
${kf("bd-huvudlyft", "0%,100%{transform:rotate(0) translateY(0)}35%,70%{transform:rotate(-9deg) translateY(-4px)}")}
.bd-gest-nos .bd-huvud,.bd-gest-puff .bd-huvud{animation:bd-nos .9s ease-in-out}
${kf("bd-nos", "0%,100%{transform:translate(0,0)}20%{transform:translate(1px,-1.5px)}40%{transform:translate(-1px,0)}60%{transform:translate(1px,-1px)}")}
.bd-gest-puff .bd-puff,.bd-gest-ande .bd-ande{animation:bd-puff 1.8s ease-out}
${kf("bd-puff", "0%{opacity:0;transform:translate(0,0) scale(.6)}25%{opacity:.95}100%{opacity:0;transform:translate(14px,-6px) scale(1.4)}")}

.bd-gest-svansvick .bd-svans{animation:bd-svansvick 1.4s ease-in-out}
${kf("bd-svansvick", "0%,100%{transform:rotate(0)}25%{transform:rotate(7deg)}50%{transform:rotate(-5deg)}75%{transform:rotate(4deg)}")}
.bd-gest-svanssving .bd-svans{animation:bd-svanssving 2.6s ease-in-out}
${kf("bd-svanssving", "0%,100%{transform:rotate(0)}40%{transform:rotate(-9deg)}75%{transform:rotate(5deg)}")}

.bd-gest-vingstrack .bd-vinge-nar{animation:bd-vingstrack 2.6s ease-in-out}
${kf("bd-vingstrack", "0%,100%{transform:rotate(0)}35%,65%{transform:rotate(14deg) scale(1.06)}")}
.bd-gest-fladder .bd-vinge{animation:bd-fladder .5s ease-in-out 3}
${kf("bd-fladder", "0%,100%{transform:rotate(0)}50%{transform:rotate(12deg)}")}
.bd-gest-vingoppning .bd-vinge{animation:bd-vingoppning 3.4s ease-in-out}
${kf("bd-vingoppning", "0%,100%{transform:rotate(0) scale(1)}20%{transform:rotate(-14deg) scale(.9)}60%,80%{transform:rotate(5deg) scale(1.05)}")}

.bd-gest-sitt .bd-andas{animation:bd-sitt 1.8s ease-in-out}
${kf("bd-sitt", "0%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}70%{transform:translateY(1px) scale(1.02,.98)}")}
.bd-gest-steg .bd-ben-steg{animation:bd-steg 1.6s ease-in-out}
${kf("bd-steg", "0%,100%{transform:translate(0,0)}35%{transform:translate(4px,-5px)}65%{transform:translate(8px,6px)}")}
.bd-gest-stolt .bd-andas{animation:bd-stolt 2.4s ease-in-out}
${kf("bd-stolt", "0%,100%{transform:rotate(0) scale(1)}40%,70%{transform:rotate(-2.5deg) scale(1.03)}")}
.bd-gest-resning .bd-andas{animation:bd-resning 2.8s ease-in-out}
${kf("bd-resning", "0%,100%{transform:rotate(0)}40%,70%{transform:rotate(-5deg) translateY(-4px)}")}
.bd-gest-svav .bd-andas{animation:bd-svav 3.4s ease-in-out}
${kf("bd-svav", "0%,100%{transform:translateY(0)}45%,60%{transform:translateY(-14px)}")}
.bd-gest-svav .bd-vinge{animation:bd-fladder .6s ease-in-out 5}

.bd-gest-glod{animation:bd-glod 2.6s ease-in-out}
.bd-gest-magi{animation:bd-glod 3.4s ease-in-out}
${kf("bd-glod", "0%,100%{filter:none}50%{filter:drop-shadow(0 0 6px rgba(255,214,102,.85)) drop-shadow(0 0 14px rgba(150,230,240,.6))}")}
.bd-gest-partiklar .bd-gnistor,.bd-gest-magi .bd-gnistor{animation:bd-gnistor 3s ease-out}
${kf("bd-gnistor", "0%{opacity:0;transform:translateY(8px)}30%{opacity:1}100%{opacity:0;transform:translateY(-16px)}")}
.bd-gest-ljussvep .bd-svep,.bd-gest-magi .bd-svep{animation:bd-svep 2.2s ease-in-out}
${kf("bd-svep", "0%{opacity:0;transform:translateX(-160px)}20%,80%{opacity:.9}100%{opacity:0;transform:translateX(160px)}")}
.bd-gest-magi .bd-runa,.bd-gest-glod .bd-runa{animation:bd-runa 3s ease-in-out}
${kf("bd-runa", "0%,100%{filter:none}50%{filter:drop-shadow(0 0 3px #FFE58A) brightness(1.3)}")}

.bd-gest-vicka .bd-agg{animation:bd-vicka 1.6s ease-in-out}
${kf("bd-vicka", "0%,100%{transform:rotate(0)}20%{transform:rotate(-6deg)}45%{transform:rotate(5deg)}70%{transform:rotate(-3deg)}")}
.bd-gest-puls .bd-aura{animation:bd-aura 1.6s ease-in-out 2}

.bd-lugn *,.bd-lugn{animation:none!important}
@media (prefers-reduced-motion: reduce){.bd-drake,.bd-drake *{animation:none!important}}
`;

/** Lägger in CSS:en en gång per dokument. */
export function installeraDrakeCss(doc = document) {
  if (doc.getElementById("bd-css")) return;
  const s = doc.createElement("style");
  s.id = "bd-css";
  s.textContent = DRAKE_CSS;
  doc.head.appendChild(s);
}
