// Lärarsidans schackikon (#776, #781): en bonde i samma linjestil som icon() i
// teacher-shared.js. Ligger i en egen liten fil i stället för i ICONS, som är en
// bootfil på gränsen till 400 rader (#271). Används av Synlighet och sektionsfliken.
export function schackLararIkon(size = 20) {
  return `<svg class="t-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="6.5" r="2.6"/><path d="M9.5 10.5h5"/><path d="M10.2 10.5c0 2.6-1.6 4.3-2.4 6.3h8.4c-.8-2-2.4-3.7-2.4-6.3"/><path d="M6 19.5h12"/></svg>`;
}
