// ============================================================================
// Kurragömma (#837): AVATARBILDEN – elevens riktiga avatar med kläder
// (avatarMarkup ur src/avatars.js) ritad EN gång per elev till en canvas
// (spec §4.3). Canvasen blir billboard-textur i 3D och sprite i 2D-reserven.
// Ingen three.js här, så 2D-reserven kan använda samma cache.
//
// Hur: markupen (SVG-figur + klädsel positionerad med CSS per slot) läggs i
// ett <foreignObject> i en SVG som ritas till canvasen. CSS-reglerna för
// .avatar-figure/.af-* hämtas ur sidans stilmallar (styles.css) – saknas de
// används en inbyggd kopia av slot-måtten. Om webbläsaren inte kan rita
// foreignObject till canvas (Safari) eller smutsar canvasen, ritas figuren
// utan kläder (avatarSvg) i stället – aldrig en tom figur.
//
// API
//   skapaAvatarBilder({ roster, bredd? }) → {
//     bild(uid) → canvas            (platshållare tills bilden är klar)
//     onKlar(fn(uid))               (texturen ska laddas om)
//     uppdatera(uid)                (avataren ändrades – rita om)
//     destroy()
//   }
// ============================================================================

import { avatarMarkup, avatarSvg, DEFAULT_AVATAR } from "../../../../avatars.js";

export const BILD_BREDD = 256;
export const BILD_HOJD = 308; // 100 × 120 i viewBox-mått

const SVG_NS = "http://www.w3.org/2000/svg";

/** Inbyggd kopia av slot-måtten (styles/08-avatar-klader.css) om stilmallen saknas. */
const RESERV_CSS = `
.avatar-figure{position:relative;display:inline-block;width:1em;height:1.2em;line-height:1}
.avatar-figure .af-base{position:absolute;inset:0}
.avatar-figure .af-base svg,.avatar-figure .af-wear svg{display:block;width:100%;height:100%}
.avatar-figure .af-wear{position:absolute;line-height:1;font-size:.4em;text-align:center}
.af-wear.af-hatt{top:-6%;left:50%;width:62%;height:26%;transform:translateX(-50%)}
.af-wear.af-ansikte{top:21%;left:50%;width:50%;height:16%;transform:translateX(-50%)}
.af-wear.af-hals{top:44%;left:50%;width:46%;height:22%;transform:translateX(-50%)}
.af-wear.af-hand{top:26%;left:65%;width:32%;height:46%}
.af-wear.af-rygg{top:28%;left:50%;width:68%;height:54%;transform:translateX(-50%)}
.af-wear.af-ansikte.af-anchor-mun{top:31%}`;

let cssCache = null;
/** CSS:en för avatar-markupen ur sidans stilmallar (en gång), annars reserven. */
function avatarCss() {
  if (cssCache != null) return cssCache;
  const regler = [];
  try {
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch { continue; } // annan origin
      for (const r of rules) {
        if (r.selectorText && /\.avatar-figure|\.af-/.test(r.selectorText)) regler.push(r.cssText);
      }
    }
  } catch { /* ingen DOM-stilmall */ }
  cssCache = regler.length ? regler.join("\n") : RESERV_CSS;
  return cssCache;
}

/** Hela figuren som en SVG-sträng (foreignObject) i bild-måtten. */
function figurSvg(markup, w, h) {
  const inre = `<div xmlns="http://www.w3.org/1999/xhtml" style="font-size:${w}px;width:${w}px;height:${h}px;margin:0">` +
    `<style>${avatarCss()}</style>${markup}</div>`;
  return `<svg xmlns="${SVG_NS}" width="${w}" height="${h}"><foreignObject width="${w}" height="${h}">${inre}</foreignObject></svg>`;
}

function laddaBild(svg) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("avatarbilden kunde inte laddas"));
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
}

/** Är det något ritat, och går canvasen att läsa (inte smutsad)? */
function ritad(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h).data; // kastar om canvasen är smutsad
  for (let i = 3; i < d.length; i += 4 * 97) if (d[i] > 0) return true;
  return false;
}

/** Rita elevens avatar (med kläder, annars utan) till canvasen. */
export async function ritaAvatar(canvas, { avatarId = DEFAULT_AVATAR, avatarItems = [] } = {}) {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  try {
    const img = await laddaBild(figurSvg(avatarMarkup(avatarId, avatarItems), w, h));
    ctx.drawImage(img, 0, 0, w, h);
    if (ritad(ctx, w, h)) return "klader";
  } catch { /* foreignObject stöds inte – rita utan kläder */ }
  ctx.clearRect(0, 0, w, h);
  const svg = avatarSvg(avatarId).replace("<svg ", `<svg xmlns="${SVG_NS}" width="${w}" height="${h}" `);
  const img = await laddaBild(svg);
  ctx.drawImage(img, 0, 0, w, h);
  return "utan-klader";
}

/** Platshållaren tills bilden är klar: en mjuk, ljus silhuett. */
function platshallare(ctx, w, h) {
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.3, w * 0.22, h * 0.18, 0, 0, Math.PI * 2);
  ctx.ellipse(w / 2, h * 0.72, w * 0.2, h * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function skapaAvatarBilder({ roster, bredd = BILD_BREDD } = {}) {
  const hojd = Math.round((bredd * BILD_HOJD) / BILD_BREDD);
  const bilder = new Map(); // uid → { canvas, klar: bool, version }
  const lyssnare = new Set();
  const emit = (uid) => { for (const fn of lyssnare) { try { fn(uid); } catch (e) { console.warn("Kurragömma avatarbild:", e); } } };

  function info(uid) {
    const i = roster && roster.info ? roster.info(uid) : null;
    return { avatarId: (i && i.avatarId) || DEFAULT_AVATAR, avatarItems: (i && i.avatarItems) || [] };
  }

  function rita(uid, post) {
    const v = ++post.version;
    ritaAvatar(post.canvas, info(uid))
      .then(() => { if (v === post.version) { post.klar = true; emit(uid); } })
      .catch((e) => console.warn("Kurragömma: avataren kunde inte ritas", uid, e));
  }

  function bild(uid) {
    let post = bilder.get(uid);
    if (post) return post.canvas;
    const canvas = document.createElement("canvas");
    canvas.width = bredd;
    canvas.height = hojd;
    platshallare(canvas.getContext("2d"), bredd, hojd);
    post = { canvas, klar: false, version: 0 };
    bilder.set(uid, post);
    rita(uid, post);
    return canvas;
  }

  const avRoster = roster && roster.onChange ? roster.onChange((uids) => { for (const u of uids) uppdatera(u); }) : null;

  function uppdatera(uid) {
    const post = bilder.get(uid);
    if (post) rita(uid, post);
  }

  return {
    bild,
    uppdatera,
    klar: (uid) => !!(bilder.get(uid) && bilder.get(uid).klar),
    onKlar(fn) { lyssnare.add(fn); return () => lyssnare.delete(fn); },
    destroy() { if (avRoster) avRoster(); lyssnare.clear(); bilder.clear(); },
  };
}
