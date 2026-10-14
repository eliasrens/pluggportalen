// ============================================================================
// Datakuppen 💾 (#653): IKONERNA som SVG (spec §1.1, §1.3, §4.1). Emojierna i
// filtabellen är bara beskrivning – här ritas varje filtyp med EGEN ikon i
// formatets neonfärger, så att de ser likadana ut på alla datorer (inga
// Emoji 13+). Projektorn kan använda samma ikoner.
//
// API
//   dataIcon(size?)        → disketten (valutan "💾 250 MB")
//   fileIcon(id, size?)    → filtypens ikon (id ur delat/files-config.js)
//   lockedFileIcon(size?)  → den krypterade, ännu inte öppnade filen
//   shieldIcon(size?)      → skyddet (brandväggens sköld)
// ============================================================================

const svg = (size, body, label = "") => `<svg class="dk-ikon" width="${size}" height="${size}" viewBox="0 0 64 64" ${label
  ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'} focusable="false">${body}</svg>`;

const C = { gron: "#3dffa2", cyan: "#3ee6ff", varm: "#ffb347", rosa: "#ff6fb5", mork: "#0b1630", natt: "#13254a", vit: "#e9fbff" };

export function dataIcon(size = "1em") {
  return svg(size, `
    <rect x="8" y="8" width="48" height="48" rx="7" fill="${C.natt}" stroke="${C.cyan}" stroke-width="3.5"/>
    <rect x="18" y="8" width="26" height="17" rx="2" fill="${C.cyan}" opacity=".9"/>
    <rect x="34" y="11" width="6" height="11" rx="1.5" fill="${C.natt}"/>
    <rect x="16" y="33" width="32" height="20" rx="3" fill="${C.vit}"/>
    <path d="M21 40h22M21 46h16" stroke="${C.natt}" stroke-width="2.6" stroke-linecap="round" opacity=".55"/>`, "data");
}

export function shieldIcon(size = "1em") {
  return svg(size, `
    <path d="M32 6 L54 14 V30 C54 44 44 53 32 58 C20 53 10 44 10 30 V14 Z" fill="${C.natt}" stroke="${C.gron}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M22 32 L29 39 L43 24" fill="none" stroke="${C.gron}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`);
}

export function lockedFileIcon(size = "1em") {
  return svg(size, `
    <path d="M14 6 H40 L52 18 V58 H14 Z" fill="${C.natt}" stroke="${C.cyan}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M40 6 V18 H52" fill="none" stroke="${C.cyan}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M20 16h12M20 22h16" stroke="${C.cyan}" stroke-width="2.4" stroke-linecap="round" opacity=".45"/>
    <rect x="22" y="34" width="22" height="16" rx="3" fill="${C.gron}"/>
    <path d="M26 34 V29 a7 7 0 0 1 14 0 V34" fill="none" stroke="${C.gron}" stroke-width="3.5"/>
    <circle cx="33" cy="41" r="2.6" fill="${C.mork}"/><rect x="32" y="42" width="2" height="5" rx="1" fill="${C.mork}"/>`);
}

const doc = (stroke, fill = C.natt) => `
    <path d="M16 6 H40 L50 16 V58 H16 Z" fill="${fill}" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M40 6 V16 H50" fill="none" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/>`;
const folder = (stroke, fill = C.natt) => `
    <path d="M6 16 H24 L29 22 H58 V54 H6 Z" fill="${fill}" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M6 27 H58" stroke="${stroke}" stroke-width="3" opacity=".6"/>`;

const FILES = {
  liten_fil: () => `${doc(C.cyan)}<path d="M22 26h20M22 33h20M22 40h13" stroke="${C.cyan}" stroke-width="3" stroke-linecap="round"/>`,
  mapp: () => `${folder(C.gron)}<path d="M18 38h28M18 45h18" stroke="${C.gron}" stroke-width="3" stroke-linecap="round"/>`,
  stor_fil: () => `
    <rect x="8" y="12" width="48" height="40" rx="6" fill="${C.natt}" stroke="${C.cyan}" stroke-width="3"/>
    <circle cx="32" cy="32" r="13" fill="none" stroke="${C.cyan}" stroke-width="3"/>
    <circle cx="32" cy="32" r="4" fill="${C.gron}"/>
    <circle cx="48" cy="45" r="2.4" fill="${C.gron}"/>`,
  serverhall: () => [12, 27, 42].map((y, i) => `
    <rect x="12" y="${y}" width="40" height="12" rx="3" fill="${C.natt}" stroke="${C.varm}" stroke-width="2.6"/>
    <circle cx="20" cy="${y + 6}" r="2.2" fill="${C.gron}"/><circle cx="27" cy="${y + 6}" r="2.2" fill="${i === 1 ? C.varm : C.cyan}"/>
    <path d="M34 ${y + 6}h12" stroke="${C.varm}" stroke-width="2.4" stroke-linecap="round"/>`).join(""),
  overklockning: () => `
    <rect x="12" y="12" width="40" height="40" rx="6" fill="${C.natt}" stroke="${C.varm}" stroke-width="3"/>
    ${[20, 32, 44].map((x) => `<path d="M${x} 5v7M${x} 52v7M5 ${x}h7M52 ${x}h7" stroke="${C.varm}" stroke-width="2.6" stroke-linecap="round"/>`).join("")}
    <path d="M35 17 L23 35 H31 L28 47 L41 28 H33 Z" fill="${C.varm}" stroke="${C.varm}" stroke-width="1.5" stroke-linejoin="round"/>`,
  virus: () => `
    <ellipse cx="32" cy="36" rx="13" ry="16" fill="#3a2a5c" stroke="${C.rosa}" stroke-width="3"/>
    <circle cx="32" cy="17" r="7" fill="#3a2a5c" stroke="${C.rosa}" stroke-width="3"/>
    <path d="M28 11 L23 5M36 11 L41 5M19 30 H9M19 40 H9M45 30 H55M45 40 H55M21 49 L14 56M43 49 L50 56" stroke="${C.rosa}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="29" cy="16" r="1.8" fill="${C.vit}"/><circle cx="35" cy="16" r="1.8" fill="${C.vit}"/>
    <path d="M23 34h18M24 41h16" stroke="${C.rosa}" stroke-width="2.4" opacity=".7"/>`,
  tom_mapp: () => `${folder("#7f93b8")}<path d="M24 41 Q32 35 40 41" fill="none" stroke="#7f93b8" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="3 4"/>`,
  brandvagg: () => `
    <rect x="6" y="10" width="52" height="44" rx="4" fill="${C.natt}" stroke="${C.gron}" stroke-width="3"/>
    <path d="M6 24.5H58M6 39.5H58M22 10v14.5M42 10v14.5M14 24.5V39.5M32 24.5V39.5M50 24.5V39.5M22 39.5V54M42 39.5V54" stroke="${C.gron}" stroke-width="2.8"/>`,
  hack: () => `
    <rect x="8" y="10" width="48" height="32" rx="4" fill="${C.natt}" stroke="${C.gron}" stroke-width="3"/>
    <path d="M16 20l6 5-6 5" fill="none" stroke="${C.gron}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M26 31h10" stroke="${C.gron}" stroke-width="3" stroke-linecap="round"/>
    <path d="M4 50 H60 L55 44 H9 Z" fill="${C.natt}" stroke="${C.gron}" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="46" cy="22" r="5" fill="none" stroke="${C.varm}" stroke-width="2.6"/><path d="M46 27v6M46 30h3" stroke="${C.varm}" stroke-width="2.6" stroke-linecap="round"/>`,
};

export function fileIcon(id, size = "1em") {
  const draw = FILES[id] || FILES.liten_fil;
  return svg(size, draw());
}
