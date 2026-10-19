// ============================================================================
// Pluggporten – lärarsidan: delat (teacher-shared.js)
// ----------------------------------------------------------------------------
// Delade byggstenar för lärarsidans undersidor:
//   * Lärarinloggning via Firebase Auth (custom claim teacher:true). Ersätter
//     det gamla hårdkodade lösenordet. Logiken bor i src/auth.js.
//   * Små DOM-/text-hjälpare (el, esc, copyText, wireHashLinks).
//   * Flik-registryn (TEACHER_TABS), toppmenyn med profilmeny (teacherNav, #803)
//     och kartan över gamla adresser (TEACHER_REDIRECTS, DEL 7 i epic #802).
//   * Diskret sidtitel (teacherHead) och vänliga tomtillstånd (emptyState).
//   * renderGate: lärarspärren, laddas lat ur teacher-gate.js.
//
// Sidorna anropas från app.js router med ett `ctx` som innehåller de delade
// hjälparna { app, go, renderTopbar }.
// ============================================================================

import { isAdmin, isTeacher, signOutCurrent } from "./auth.js";

// --- Lärarläge --------------------------------------------------------------
// isTeacher() läser custom claim (teacher:true) ur den inloggade Auth-användaren
// – re-exporteras här eftersom lärarsidans moduler importerar den härifrån.
export { isAdmin, isTeacher };

// --- Små hjälpare -----------------------------------------------------------

export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/** Enkel HTML-escape för att lägga in text säkert i markup. */
export function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Icke-blockerande anmärkningar från validateArea/mergeAreaContent (t.ex. okänd
 * frågekategori, #445/#467) som en gul ruta. Tom lista → "". Spara går ändå.
 */
export function warningsHtml(warnings) {
  if (!Array.isArray(warnings) || warnings.length === 0) return "";
  return `<div class="msg warn" role="status">
    <div style="margin-bottom:6px">⚠️ Bra att veta (du kan ändå spara):</div>
    <ul class="error-list">${warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>
  </div>`;
}

/**
 * Koppla interna navigeringslänkar/-knappar (`data-hash`) i ett element till
 * routern. Delas av alla lärarvyer så länkar mellan vyer beter sig likadant.
 */
export function wireHashLinks(ctx, root) {
  root.querySelectorAll("[data-hash]").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      ctx.go(a.dataset.hash);
    })
  );
}

// --- Linje-ikoner (lärar-chrome) --------------------------------------------
// Tunna inline-SVG-stroke-ikoner (currentColor, ~1.7px) som ersätter emojis i
// lärarsidans chrome (nav, knappar, sektionsrubriker) – issue #363. Ärver färg
// från texten, så samma ikon fungerar i både mörkt och ljust läge. Rita med
// icon("namn", storlek). Håll setet litet och delat så designspråket är enhetligt.
const ICONS = {
  users:
    '<path d="M16 19v-1.4a3.4 3.4 0 0 0-3.4-3.4H7.4A3.4 3.4 0 0 0 4 17.6V19"/><circle cx="10" cy="8" r="3.1"/><path d="M16.8 6.8a3.3 3.3 0 0 1 0 6.4"/><path d="M20 19v-1.3a3.3 3.3 0 0 0-2.4-3.2"/>',
  book:
    '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15.5H6a2 2 0 0 0-2 2z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15.5h5a2 2 0 0 1 2 2z"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><circle cx="12" cy="15" r="1.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 20 3M16 7l3 3M14 9l2 2"/>',
  pencil: '<path d="M4 16.4V20h3.6L18.2 9.4l-3.6-3.6L4 16.4z"/><path d="M12.8 7.2l3.6 3.6"/>',
  grad:
    '<path d="M12 4 2.5 9 12 14l9.5-5L12 4z"/><path d="M6 11.2v4c0 1 2.7 2.3 6 2.3s6-1.3 6-2.3v-4"/><path d="M21.5 9v4.5"/>',
  pin: '<path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z"/><circle cx="12" cy="11" r="2.3"/>',
  sliders: '<path d="M4 8h8M16 8h4M4 16h4M12 16h8"/><circle cx="14" cy="8" r="2.2"/><circle cx="10" cy="16" r="2.2"/>',
  chart: '<path d="M4 4v16h16"/><path d="M8 16v-4"/><path d="M12 16V8"/><path d="M16 16v-6"/>',
  trash:
    '<path d="M4 7h16"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/><path d="M6.2 7l.8 12.6A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.4L17.8 7"/><path d="M10 11v6M14 11v6"/>',
  school:
    '<path d="M3 21h18"/><path d="M5 21V9.5L12 5l7 4.5V21"/><path d="M9.5 21v-4.5h5V21"/>',
  inbox: '<path d="M4 13l2.1-7A2 2 0 0 1 8 4.5h8a2 2 0 0 1 1.9 1.5L20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M4 13h5l1.1 2h3.8l1.1-2h5"/>',
  logout:
    '<path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8"/><path d="M18 15l3-3-3-3"/><path d="M21 12H9"/>',
  eye:
    '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/>',
  save:
    '<path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M8 4v5h7V4"/><path d="M8 14h8v6H8z"/>',
  copy:
    '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  printer:
    '<path d="M6 9V4h12v5"/><rect x="4" y="9" width="16" height="7" rx="2"/><path d="M7 16h10v4H7z"/><circle cx="17" cy="12" r="0.8"/>',
  link:
    '<path d="M9.5 14.5 14.5 9.5"/><path d="M8 12H6.5a3.5 3.5 0 0 1 0-7H10"/><path d="M16 12h1.5a3.5 3.5 0 0 1 0 7H14"/>',
  shuffle:
    '<path d="M4 7h3l10 10h3"/><path d="M4 17h3L17 7h3"/><path d="M18 4l3 3-3 3"/><path d="M18 14l3 3-3 3"/>',
  minus: '<path d="M5 12h14"/>',
  clipboard: '<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9 3h6v3H9z"/><path d="M8.5 11h7M8.5 15h5"/>',
  trophy:
    '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4.5M16 6h3a3 3 0 0 1-3 4.5"/><path d="M12 13v4"/><path d="M8.5 20h7l-.8-3H9.3z"/>',
  bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3z"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="M5 12.5 10 17.5 19 6.5"/>',
  sparkle:
    '<path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6z"/><path d="M18.5 14.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  brak: '<circle cx="12" cy="12" r="8"/><path d="M12 4v8h8"/>',
  home: '<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v9.5h11V10"/><path d="M10 19.5v-5h4v5"/>',
  upload:
    '<path d="M12 15V4"/><path d="M8 8l4-4 4 4"/><path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"/>',
};

/**
 * Inline-SVG linje-ikon för lärar-chromet. currentColor + rund stroke.
 * @param {string} name  Nyckel i ICONS.
 * @param {number} size  Kant i px (default 18).
 */
export function icon(name, size = 18) {
  const path = ICONS[name] || "";
  return `<svg class="t-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`;
}

export async function copyText(text, btn) {
  const done = () => {
    const old = btn.innerHTML;
    btn.textContent = "✓ Kopierat!";
    btn.classList.add("copied");
    setTimeout(() => ((btn.innerHTML = old), btn.classList.remove("copied")), 1600);
  };
  try {
    await navigator.clipboard.writeText(text);
    done();
  } catch {
    // Fallback för äldre webbläsare / osäker kontext.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      done();
    } catch {
      alert("Kunde inte kopiera automatiskt – markera texten och kopiera manuellt.");
    }
    ta.remove();
  }
}

// --- Gemensam navigation & sidhuvud ----------------------------------------

/**
 * Lazy route-handler för en lärarflik: laddar sidmodulen med import() och visar
 * ett snällt fel om modulen inte kan hämtas (t.ex. mitt i en Pages-utrullning,
 * #271) i stället för en evig spinner. admin-flikar spärras för årskurskonton
 * med ett vänligt besked (#679) – reglerna (#678) spärrar på riktigt.
 */
function lazyPage(load, fn, admin = false) {
  return async (ctx) => {
    if (admin && isTeacher() && !isAdmin()) return renderAdminOnly(ctx);
    let mod;
    try {
      mod = await load();
    } catch (err) {
      return loadFailed(ctx, err);
    }
    return mod[fn](ctx);
  };
}

function loadFailed(ctx, err) {
  ctx.renderTopbar();
  ctx.app.replaceChildren(
    el(`<div class="teacher-page teacher-dark"><div class="panel"><div class="msg error">
      Kunde inte ladda lärarsidan – ladda om sidan om en stund. (${esc(err.message)})</div></div></div>`)
  );
}

/** Vänligt besked när servern nekar (#679): aldrig ett tekniskt felmeddelande. */
export const ADMIN_ONLY = "Det här kan bara admin göra.";
export function errText(err) {
  const code = String(err?.code || "").replace(/^(functions|firestore)\//, "");
  if (code === "permission-denied" || /insufficient permissions|permission.denied/i.test(err?.message || ""))
    return ADMIN_ONLY;
  return String(err?.message || err || "Okänt fel");
}

function renderAdminOnly(ctx) {
  ctx.renderTopbar();
  const page = el(`<div class="teacher-page teacher-dark"><div class="panel">
    <div class="msg warn">${ADMIN_ONLY}</div></div></div>`);
  page.prepend(teacherNav(ctx, ""));
  ctx.app.replaceChildren(page);
}

/**
 * Lärarsidans toppmeny (epic #802 DEL 1.1): Hem, Mina klasser, Material, Prov,
 * Live och – bara för admin – Admin. Varje flik i TEACHER_TABS hör till en grupp;
 * toppnaven visar grupperna och, när gruppen har flera flikar, en underrad.
 * Grupper utan synliga flikar (Admin för årskurskonton) döljs helt. Flikar med en
 * grupp utanför listan (Hjälp och guide) nås via profilmenyn.
 */
export const TEACHER_GROUPS = [
  { key: "hem", label: "Hem", icon: "home" },
  { key: "klasser", label: "Mina klasser", icon: "users" },
  { key: "material", label: "Material", icon: "book" },
  { key: "prov", label: "Prov", icon: "pencil" },
  { key: "live", label: "Live", icon: "bolt" },
  { key: "admin", label: "Admin", icon: "key" },
];

/**
 * Lärarskalets flik-registry (#440). EN rad per lärarsida: key/hash/label/title/icon
 * (id, route som app.js registrerar, fliktext, sidtitel, linje-ikon), group (ur
 * TEACHER_GROUPS), admin (bara admin, #679) och page (lat import(), #271).
 * Var varje flik hamnar efter omgörningen (#802) står i teacher-struktur.js.
 */
const tab = (key, hash, group, label, title, icon, load, fn, admin = false) =>
  ({ key, hash, group, label, title, icon, admin, page: lazyPage(load, fn, admin) });
export const TEACHER_TABS = [
  // Hem (#807): Kom igång, Att göra, Snabbval och Mina klasser (ersätter översikten).
  tab("hem", "#/larare/hem", "hem", "Hem", "Hem", "home", () => import("./teacher-hem.js"), "pageLarareHem"),
  // Mina klasser (#804): klassväljare + Hur går det? | Vad eleverna ser | Fokusläge | Elever.
  tab("klasser", "#/larare/mina-klasser", "klasser", "Mina klasser", "Mina klasser", "users", () => import("./teacher-classes.js"), "pageLarareMinaKlasser"),
  // Material (#806): en sida med underflikar (Plugga-områden, Läsresan, Ekvationsresan, Bråkresan, Hitta rätt!, Schack)
  // som laddas lat ur teacher-material.js (?flik=). Gamla adresser omdirigeras (TEACHER_REDIRECTS).
  tab("material", "#/larare/material", "material", "Material", "Material", "book", () => import("./teacher-material.js"), "pageLarareMaterial"),
  // Prov (epic #737): Mina prov (#739, skapa/redigera) + Provtillfällen (#740, öppna/stäng/översikt). Lat.
  tab("prov", "#/larare/prov", "prov", "Mina prov", "Mina prov", "clipboard", () => import("./prov/larare/page-larare-prov.js"), "pageLarareProv"),
  tab("provtillfallen", "#/larare/prov/tillfallen", "prov", "Provtillfällen", "Provtillfällen", "inbox", () => import("./prov/prov-tillfallen-sida.js"), "pageProvTillfallen"),
  // Live (#460): realtidsmatch klass mot klass. ?id=<sid> = projektorvyn.
  tab("live", "#/larare/live", "live", "Live", "Live", "bolt", () => import("./live/teacher-live.js"), "pageLarareLive"),
  // Mattematchen (#459): skapa/styr tävlingsperioder – bara admin (§2.2). Statistiken finns under Statistik.
  tab("mattematchen", "#/larare/mattematchen", "live", "Mattematchen", "Mattematchen", "trophy", () => import("./tavling/teacher-mattematchen.js"), "pageLarareMattematchen", true),
  tab("adminklasser", "#/larare/admin/klasser", "admin", "Klasser & elevkonton", "Klasser & elevkonton", "school", () => import("./teacher-classes.js"), "pageLarareAdminKlasser", true),
  tab("konton", "#/larare/konton", "admin", "Lärarkonton", "Lärarkonton", "key", () => import("./teacher-accounts.js"), "pageLarareKonton", true),
  // Säsong (#690): config/season – Sommar/Höst + Halloween på/av och slutdatum.
  tab("sasong", "#/larare/admin/sasong", "admin", "Säsong", "Säsong och Halloween", "sparkle", () => import("./teacher-season.js"), "pageLarareSasong", true),
  // Hjälp och guide (#803, fylls i sub-issue F): nås via profilmenyn, ingen toppflik.
  tab("hjalp", "#/larare/hjalp", "profil", "Hjälp och guide", "Hjälp och guide", "book", () => import("./teacher-hjalp.js"), "pageLarareHjalp"),
];

/**
 * Gamla lärar-adresser (DEL 7) → ny plats. EN karta: sub-issues B–D byter bara
 * målen här när den nya platsen finns. Mål = samma route betyder "dagens sida
 * är fortfarande platsen". Kedjor följs (klass → statistik → …), och adressens
 * egna parametrar (?prov=, ?klass= …) följer med till målet.
 */
export const TEACHER_REDIRECTS = {
  "/larare": "#/larare/hem",
  "/larare/oversikt": "#/larare/hem", // Hem
  "/larare/klasser": "#/larare/mina-klasser?flik=ser", // Mina klasser → Vad eleverna ser (#804)
  "/larare/statistik": "#/larare/mina-klasser?flik=hur", // Mina klasser → Hur går det? (#804)
  "/larare/admin/klasser": "#/larare/admin/klasser", // C: Admin / Mina klasser → Elever
  "/larare/innehall": "#/larare/material?flik=plugga", // Material → Plugga-områden (#806)
  "/larare/brakresan": "#/larare/material?flik=brakresan", // Material → Bråkresan (#806)
  "/larare/hitta-ratt": "#/larare/material?flik=hitta-ratt", // Material → Hitta rätt! (?prov= följer med, #806)
  "/larare/klass": "#/larare/statistik", // äldre sammanslagningar (#62, #299, #679)
  "/larare/elever": "#/larare/mina-klasser?flik=elever",
  "/larare/prompter": "#/larare/innehall",
};

/** Ny adress för en gammal lärarroute (path utan #, query utan ?) – null = ingen omdirigering. */
export function teacherRedirect(path, query = "") {
  let to = null;
  for (let p = path, i = 0; i < 8 && TEACHER_REDIRECTS[p]; i++) {
    const next = TEACHER_REDIRECTS[p];
    if (next.split("?")[0].slice(1) === p) break;
    to = next;
    p = next.split("?")[0].slice(1);
  }
  if (!to) return null;
  const [base, own] = to.split("?");
  const q = new URLSearchParams(own || "");
  for (const [k, v] of new URLSearchParams(query)) q.set(k, v);
  return q.size ? `${base}?${q}` : base;
}

/** Toppmenyns grupper med sina synliga flikar för rollen (admin = true/false). */
export function navGroups(admin) {
  const tabs = TEACHER_TABS.filter((t) => !t.admin || admin);
  return TEACHER_GROUPS.map((g) => ({ ...g, tabs: tabs.filter((t) => t.group === g.key) })).filter((g) => g.tabs.length);
}

const initialer = (name) =>
  String(name).split(/\s+/).filter((w) => /^[\p{L}\p{N}]/u.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

/**
 * Gemensam lärar-toppnav (sticky): huvuddelarna + ev. underrad för aktiv del,
 * profilmenyn (kontots namn ▾: Inloggad som …, Hjälp och guide, Admin, Logga ut)
 * och ☰ som fäller ut samma val på smala skärmar (DEL 1.2/1.4).
 */
export function teacherNav(ctx, active) {
  const admin = isAdmin();
  const groups = navGroups(admin);
  const activeGroup = TEACHER_TABS.find((t) => t.key === active)?.group;
  const link = (cls, on, hash, ic, label) =>
    `<a class="${cls} ${on ? "active" : ""}" data-hash="${hash}"${on ? ' aria-current="page"' : ""}><span class="tnav-ic">${icon(ic)}</span><span class="tnav-txt">${esc(label)}</span></a>`;
  const item = (hash, ic, label) => `<a class="tprof-val" role="menuitem" data-hash="${hash}">${icon(ic, 16)}<span>${esc(label)}</span></a>`;
  const sub = groups.find((g) => g.key === activeGroup && g.tabs.length > 1);
  const adminHash = groups.find((g) => g.key === "admin")?.tabs[0].hash;
  const nav = el(`<nav class="teacher-nav" aria-label="Lärarnavigation">
    <div class="teacher-nav-inner">
      <span class="teacher-nav-brand" aria-hidden="true">
        <span class="teacher-nav-logo">${icon("school", 20)}</span>
        <span class="teacher-nav-wordmark">Lärarsida</span>
      </span>
      <button type="button" class="tnav tnav-burger" aria-expanded="false" aria-controls="tnav-huvud" aria-label="Meny">☰ <span class="tnav-txt">Meny</span></button>
      <span class="teacher-nav-tabs" id="tnav-huvud">${groups.map((g) => link("tnav", g.key === activeGroup, g.tabs[0].hash, g.icon, g.label)).join("")}</span>
      <div class="tprof">
        <button type="button" class="tprof-knapp" aria-haspopup="true" aria-expanded="false" aria-controls="tprof-meny">
          <span class="tprof-ava" aria-hidden="true">${admin ? "A" : "?"}</span><span class="tprof-namn">${admin ? "Admin" : "Mitt konto"}</span><span aria-hidden="true">▾</span>
        </button>
        <div class="tprof-meny" id="tprof-meny" role="menu" hidden>
          <small class="tprof-who">Inloggad som …</small>
          ${item("#/larare/hjalp", "book", "Hjälp och guide")}
          ${adminHash ? item(adminHash, "key", "Admin") : ""}
          <button type="button" class="tprof-val" role="menuitem" data-logout="1">${icon("logout", 16)}<span>Logga ut</span></button>
        </div>
      </div>
    </div>
    ${sub ? `<div class="teacher-subnav" aria-label="${esc(sub.label)}">${sub.tabs.map((t) => link("tsub", t.key === active, t.hash, t.icon, t.label)).join("")}</div>` : ""}
  </nav>`);
  nav.querySelectorAll("[data-hash]").forEach((a) => a.addEventListener("click", () => ctx.go(a.dataset.hash)));
  nav.querySelector("[data-logout]").addEventListener("click", () => {
    signOutCurrent(); // lås lärarläget
    ctx.go("#/");
  });
  // Profilmenyn och ☰: en öppen i taget; klick utanför eller Esc stänger.
  const prof = nav.querySelector(".tprof-knapp");
  const burger = nav.querySelector(".tnav-burger");
  const open = (btn, on = btn.getAttribute("aria-expanded") !== "true") => {
    btn.setAttribute("aria-expanded", String(on));
    if (btn === prof) nav.querySelector(".tprof-meny").hidden = !on;
    else nav.classList.toggle("meny-oppen", on);
  };
  prof.addEventListener("click", () => (open(burger, false), open(prof)));
  burger.addEventListener("click", () => (open(prof, false), open(burger)));
  const close = (e) => {
    if (!nav.isConnected) return document.removeEventListener("click", close), document.removeEventListener("keydown", close);
    if (e.type === "keydown" ? e.key !== "Escape" : nav.contains(e.target)) return;
    open(prof, false), open(burger, false);
  };
  document.addEventListener("click", close);
  document.addEventListener("keydown", close);
  // Kontots namn (§5.2) läses dynamiskt (#271).
  import("./teacher-role.js").then((m) => m.myRole()).then((r) => {
    nav.querySelector(".tprof-namn").textContent = r.name;
    nav.querySelector(".tprof-ava").textContent = initialer(r.name);
    nav.querySelector(".tprof-who").textContent = `Inloggad som ${r.name}`;
  }, () => {});
  import("./prov/prov-att-ratta.js").then((m) => m.provMarke(nav), () => {}); // "Prov 18" (#807)
  return nav;
}

/**
 * Diskret sidtitel för en lärar-undersida (#304: toppnaven orienterar). `emoji`/
 * `title` behålls, ev. `lead` ignoreras – eller en flik-nyckel ur TEACHER_TABS.
 */
export function teacherHead(_ctx, opts = {}) {
  // #440: en flik-nyckel (sträng) hämtar titel + ikon ur TEACHER_TABS.
  if (typeof opts === "string") opts = TEACHER_TABS.find((t) => t.key === opts) || {};
  const { emoji = "", title = "", icon: iconName = "" } = opts;
  // Chromet är emoji-fritt (#363): linje-ikon; `emoji` ritas bara utan ikon (bakåtkompatibelt).
  const mark = iconName ? `<span class="teacher-page-ic" aria-hidden="true">${icon(iconName, 22)}</span>` : emoji ? `${esc(emoji)} ` : "";
  return el(`<header class="teacher-head-slim">
    <h1 class="teacher-page-title">${mark}<span>${esc(title)}</span></h1>
  </header>`);
}

/**
 * Vänligt tomtillstånd: ikon + rubrik + kort text + (valfri) knapp till nästa
 * steg. Används när det inte finns klasser/elever/innehåll ännu, i stället för
 * en tom yta. `text` får innehålla enkel markup.
 */
export function emptyState(
  ctx,
  { emoji = "", title = "", text = "", actionLabel = "", actionHash = "", icon: iconName = "inbox" } = {}
) {
  // Linje-ikon i chromet (issue #363); `emoji` kvar för bakåtkompatibilitet.
  const mark = iconName ? icon(iconName, 34) : esc(emoji);
  const box = el(`<div class="empty-state">
    <span class="empty-state-icon">${mark}</span>
    <h3 class="empty-state-title">${esc(title)}</h3>
    ${text ? `<p class="empty-state-text">${text}</p>` : ""}
    ${actionHash ? `<button class="btn" data-hash="${esc(actionHash)}">${esc(actionLabel || "Nästa steg →")}</button>` : ""}
  </div>`);
  if (ctx) wireHashLinks(ctx, box);
  return box;
}

// Lärarspärren (inloggningsvyn) bor i teacher-gate.js och laddas med import()
// – precis som sidorna som visar den (#271).
export function renderGate(ctx) {
  return import("./teacher-gate.js").then((m) => m.renderGate(ctx), (err) => loadFailed(ctx, err));
}
