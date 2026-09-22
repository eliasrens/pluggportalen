// ============================================================================
// Pluggporten – bondgårdsdjuren i hagen & laggården (issue #330)
// ----------------------------------------------------------------------------
// Ritar och animerar bondgårdsdjuren (farm.animals, data-farm.js) på gårds-
// grenens två nivåer: djur placerade i "paddock" går omkring i hagen
// (gard-lagret) och djur i "barn" inne i laggården (laggard-lagret). Djur
// placerade i "room" ritas av rummet (varld-rum-djur.js) – inte här.
//
// Promenad-AI:n är rummets (rum-promenad.js) – återbrukad orörd via den
// injicerbara zonen (`zoneFor`): rörelseytan mäts ur scenernas osynliga
// zon-rektanglar (#hage-zon/#lada-zon i art-gard.js) i procent av lagret, så
// den följer scenen oavsett skärmformat och kamerazoom. Noderna använder samma
// klasser som rummets djur (.room-item.room-pet + .ri-emoji + data-pet-id) så
// gång-animationen och spegling följer med gratis; storleken sätts med samma
// cqw-mönster som trädgårdssakerna (.gard-djur-lager i styles.css).
//
// Positionerna i hagen/ladan är FLYKTIGA (slumpas per besök, sparas aldrig) –
// djuren strövar ändå fritt; bara rummets positioner persisteras. refresh()
// läser placeringarna färskt (getFarm → session-cache som invalideras av
// setAnimalPlacement) så en flytt i "Mina djur" syns vid nästa gårds-besök.
//
// OBS BOOTGRAFEN (incident #271): modulen ligger MEDVETET utanför den statiska
// bootkedjan – den importeras bara av varld-gard.js (som själv är dynamisk).
// ============================================================================

import { getFarm } from "./data-farm.js";
import { hageForgrund } from "./art-gard.js";
import { placementFor, moodForTrivsel, trivselNow, giftReadyIn } from "./farm-core.js";
import { getItem } from "./shop-items.js";
import { itemSvg, itemSize } from "./art-items.js";
import { farmMoodSvg } from "./art-pets.js";
import { farmSideSvg, farmSideSize } from "./art-pets-side.js";
import { el } from "./ui.js";
import { startPetPromenad } from "./rum-promenad.js";

const rand = (min, max) => min + Math.random() * (max - min);

/**
 * Montera bondgårdsdjuren för gårds-grenen. Anropas EN gång (varld-gard.js);
 * refresh() ritas om vid varje gårds-besök så placeringsändringar plockas upp.
 *
 * @param {object} o
 * @param {HTMLElement} o.gardLager     gårds-scenens lager (hagen, #hage-zon)
 * @param {HTMLElement} o.laggardLager  laggårdens lager (ladan, #lada-zon)
 * @returns {{ refresh: () => Promise<void> }}
 */
export function mountGardDjur({ gardLager, laggardLager }) {
  // En "plats" per nivå: eget overlay-lager (ovanpå scen-SVG:n, samma mönster
  // som trädgårdens .tradgard-lager), egen djurlista och egen promenad-loop.
  const platser = {
    // forgrund (#345): staketets FRAMKANT ritas i ett eget lager ovanpå djuren
    // så de ser ut att stå INNANFÖR hagen. Ladan behöver inget – där står
    // djuren på golvet FRAMFÖR bås/foderhoar, vilket är rätt perspektiv.
    paddock: { lager: gardLager, zonId: "hage-zon", overlay: null, forgrund: null, forgrundSvg: hageForgrund, djur: [], zon: null, startad: false },
    barn: { lager: laggardLager, zonId: "lada-zon", overlay: null, forgrund: null, forgrundSvg: null, djur: [], zon: null, startad: false },
  };

  /** Zon-rektangeln i procent av lagret (mäts ur scen-SVG:ns osynliga rect). */
  function matZon(p) {
    const rect = p.lager.querySelector("#" + p.zonId)?.getBoundingClientRect();
    const lr = p.lager.getBoundingClientRect();
    if (!rect || !lr.width || !lr.height) return null;
    return {
      l: ((rect.left - lr.left) / lr.width) * 100,
      r: ((rect.right - lr.left) / lr.width) * 100,
      t: ((rect.top - lr.top) / lr.height) * 100,
      b: ((rect.bottom - lr.top) / lr.height) * 100,
    };
  }

  /**
   * Promenad-zonen för ett djur: FÖTTERNA (nodcentrum + halfH) hålls inne i
   * zon-bandet, hela kroppen innanför sidokanterna. Ryggen får sticka upp
   * ovanför bandet (djuret står "i" hagen, staketet är bakom). Inverterade
   * intervall (jättestort djur i liten zon) faller tillbaka på bandets mitt.
   */
  function djurZon(p, st) {
    const z = p.zon;
    if (!z) return { minX: 20, maxX: 80, minY: 60, maxY: 85 }; // nödfallszon
    const midX = (z.l + z.r) / 2;
    const midY = (z.t + z.b) / 2 - st.halfH;
    return {
      minX: Math.min(midX, z.l + st.halfW),
      maxX: Math.max(midX, z.r - st.halfW),
      minY: Math.min(midY, z.t - st.halfH),
      maxY: Math.max(midY, z.b - st.halfH),
    };
  }

  /** DOM-nod för ett djur – samma klasser som rummets djur (promenad-CSS:en
   * följer med), storlek i cqw mot overlay-lagret (.gard-djur-lager). */
  function djurNode(a) {
    const item = getItem(a.art);
    if (!item) return el("<span></span>");
    const namn = a.name || item.name;
    // Ute på gården ritas häst/ko/gris i SIDOPROFIL (#336, art-pets-side.js);
    // rummet/"Mina djur" behåller framifrån-figuren. Fallback = framifrån.
    const sideSvg = farmSideSvg(a.art, namn);
    const size = (sideSvg && farmSideSize(a.art)) || itemSize(a.art);
    // Mood ur EFFEKTIV trivsel (decay vid läsning, #332); 🎁-badge när dagens
    // gåva väntar. Klick på djuret öppnar foder-panelen (varld-foder.js).
    return el(`<div class="room-item room-pet gard-djur" data-pet-id="${a.id}"
      style="left:${a.pos.x}%;top:${a.pos.y}%" title="Mata ${namn}" role="button" tabindex="0">
      <span class="ri-emoji" style="width:calc(${size.w} * min(var(--fdjur-koeff, 2) * 1cqw, var(--fdjur-cap, 30px)));height:calc(${size.h} * min(var(--fdjur-koeff, 2) * 1cqw, var(--fdjur-cap, 30px)))">${sideSvg || itemSvg(a.art) || item.emoji}</span>
      <span class="fdjur-mood" aria-hidden="true">${farmMoodSvg(moodForTrivsel(trivselNow(a)))}</span>
      ${giftReadyIn(a) ? '<span class="fdjur-gava" title="En gåva väntar!">🎁</span>' : ""}
      <span class="rp-namn">${namn}</span>
    </div>`);
  }

  function ensureOverlay(p) {
    if (!p.overlay || !p.overlay.isConnected) {
      p.overlay = el(`<div class="gard-djur-lager"></div>`);
      p.lager.appendChild(p.overlay);
    }
    // Staket-framkanten (#345) EFTER djur-overlayn i DOM → ritas ovanpå djuren.
    // Lagret är pointer-events:none (styles.css) så klick på djuren når fram.
    if (p.forgrundSvg && (!p.forgrund || !p.forgrund.isConnected)) {
      p.forgrund = el(`<div class="gard-forgrund" aria-hidden="true">${p.forgrundSvg()}</div>`);
      p.lager.appendChild(p.forgrund);
    }
  }

  function startaPromenad(p) {
    if (p.startad) return;
    p.startad = true;
    startPetPromenad({
      stage: p.overlay,
      getPets: () => p.djur,
      isPetPaused: () => false, // inga val/drag i hagen/ladan (än)
      zoneFor: (st) => djurZon(p, st),
    });
  }

  /** Läs placeringarna färskt och rita om båda platserna. */
  async function refresh() {
    const farm = await getFarm();
    for (const [plats, p] of Object.entries(platser)) {
      ensureOverlay(p);
      p.zon = matZon(p) || p.zon;
      const har = farm.animals.filter((a) => placementFor(farm, a.uid) === plats);
      // Flyktiga positioner: behåll pågående besöks position per uid (djuret
      // hoppar inte vid en refresh), nykomlingar slumpas in i zonen.
      const gamla = new Map(p.djur.map((d) => [d.id, d.pos]));
      const z = p.zon;
      p.djur = har.map((a) => ({
        id: a.uid,
        art: a.id,
        name: a.name,
        trivsel: a.trivsel,
        lastFedAt: a.lastFedAt, //   trivselNow/giftReadyIn (#332) läser dessa
        lastGiftAt: a.lastGiftAt, // direkt på runtime-objektet
        pos: gamla.get(a.uid) ||
          (z ? { x: rand(z.l + 6, z.r - 6), y: rand(z.t + 2, z.b - 4) } : { x: 50, y: 75 }),
        hatchedAt: true, // pet-format så promenad-AI:n kan driva djuret
      }));
      p.overlay.replaceChildren(...p.djur.map(djurNode));
      if (p.djur.length > 0) startaPromenad(p);
    }
  }

  return { refresh };
}
