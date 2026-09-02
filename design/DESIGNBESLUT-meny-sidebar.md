# Designbeslut: Sidomeny 2.0 (sidebar-hover, förfinad sidebar, coin-ikon, slimmad hem-vy)

> **Status: FÖRSLAG – inväntar användarens uttryckliga godkännande.**
> Interaktiv prototyp (Artifact): https://claude.ai/code/artifact/07277e6f-99f8-4130-a612-5b0cf5f8bffc
> Implementationen ska följa värdena nedan exakt när godkännandet är klart.

## 1. Förfinad sidebar

| Del | Värde |
| --- | --- |
| Panelbakgrund | `linear-gradient(180deg, #ffffff 0%, #f2f7ff 100%)` |
| Panelradie | `22px` (behåll flush mot skärmkant på mobil-off-canvas om det ser bättre ut där) |
| Panelskugga | `0 10px 28px rgba(31, 45, 74, 0.14)` |
| Karaktärspanel | `linear-gradient(160deg, #eaf3ff 0%, #dcebff 100%)`, radie 18px, `box-shadow: inset 0 2px 0 rgba(255,255,255,0.9), 0 2px 8px rgba(47,128,237,0.10)` |
| Avatar-hover | `translateY(-3px) scale(1.06) rotate(-3deg)`, 180 ms `cubic-bezier(0.34,1.56,0.64,1)` |
| XP-bar | spår `#ffffff` med `inset 0 1px 3px rgba(31,45,74,0.15)`; fyllning oförändrad `linear-gradient(90deg, #6fa8ff, #3a5bbf)` |
| ⚡-genväg | `linear-gradient(160deg, #f6d666, #f2c94c)`, hover `translateY(-2px) rotate(8deg)` 150 ms samma easing |
| Avdelare | 2px hög, radie 2px, `#e4ecfa` |

## 2. Navlänkarnas tre lägen + hover-animation

Gemensamt: radie `16px`, padding `12px 14px`, gap mellan länkar `6px`, fontvikt 800.

**Vila:** transparent bakgrund, text `#22314a`.

**Hover (ej aktiv):**
- Bakgrund `linear-gradient(160deg, #eaf3ff 0%, #ddefff 100%)`
- Raden glider `translateX(4px)`; skugga `0 3px 10px rgba(47,128,237,0.14)`
- Övergångar: bakgrund/skugga `220ms ease`, transform `220ms cubic-bezier(0.34,1.56,0.64,1)`
- Ikonstuds, körs en gång per hover-inträde:
  ```css
  @keyframes ikon-studs {
    0%   { transform: scale(1) rotate(0deg); }
    40%  { transform: scale(1.25) rotate(-8deg); }
    70%  { transform: scale(0.95) rotate(4deg); }
    100% { transform: scale(1) rotate(0deg); }
  }
  /* animation: ikon-studs 450ms cubic-bezier(0.34, 1.56, 0.64, 1); */
  ```

**Aktiv:**
- Bakgrund `linear-gradient(160deg, #56ccf2, #2f80ed)` (samma som `.big-card.bla`)
- Vit text; ikonen får vit bricka `rgba(255,255,255,0.22)` radie `10px` (2rem × 2rem)
- Skugga `0 6px 14px rgba(47,128,237,0.38)`
- Glödpunkt till höger: 8px vit cirkel, `box-shadow: 0 0 8px rgba(255,255,255,0.9)`

**Klick/nedtryck:** `scale(0.97)` (kombineras med ev. translateX).

**Tillgänglighet:** allt hover/studs stängs av under `prefers-reduced-motion: reduce`; fokus­synlighet med `outline: 3px solid var(--bla)`.

## 3. Coin-ikon (ersätter 🪙 överallt)

**Vald variant: A "Stjärnmyntet"** (alternativ B blixt / C präglat P visades i prototypen).

```svg
<svg viewBox="0 0 24 24" role="img" aria-label="Pluggcoin">
  <defs>
    <linearGradient id="pc-guld" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffe083"/>
      <stop offset="1" stop-color="#f2b93b"/>
    </linearGradient>
  </defs>
  <circle cx="12" cy="12" r="10.4" fill="url(#pc-guld)" stroke="#c98a12" stroke-width="1.6"/>
  <circle cx="12" cy="12" r="7.7" fill="none" stroke="#e8a92a" stroke-width="1.1"/>
  <path d="M12 7.4 L13.18 10.38 L16.37 10.58 L13.9 12.62 L14.7 15.72 L12 14 L9.3 15.72 L10.1 12.62 L7.63 10.58 L10.82 10.38 Z"
        fill="#fffbe8" stroke="#d9931c" stroke-width="0.9" stroke-linejoin="round"/>
  <path d="M6.3 8.2 A7 7 0 0 1 9.6 5.5" fill="none" stroke="#ffffff" stroke-width="1.5"
        stroke-linecap="round" opacity="0.55"/>
</svg>
```

Storlekar i sammanhang: sidomenyfot 22px, hjälte-hälsning 19px, shop-saldo 24px (skala med `1em`-teknik som övriga SVG:er). OBS: gradient-`id` måste vara unikt per instans (eller centraliseras i en delad `<defs>`).

**Coins-chip:** `linear-gradient(160deg, #f9dd7e, #f2c94c)`, text `#7a5c00` vikt 800, radie 999px, skugga `0 3px 0 #d9ac1f`, padding `7px 14px 7px 10px`, gap 7px.

## 4. Slimmad hem-vy (#/elev/hem)

- Kort-rutnätet (`.card-grid` med Plugga/Shoppen/Mitt rum) **tas bort** – det dubblerar sidomenyn.
- Kvar: välkomst-hjälten, luftigare: större avatar (~4.2rem), `Hej {namn}! 👋`, uppmuntrande rad
  och coins-chip med nya myntikonen (i stället för texten "Du har 🪙 N pluggcoins").
- Ingen annan navigering läggs till i vyn.

## Berörda filer vid implementation

`src/ui.js` (renderTopbar), `src/styles.css` (`.sido-*`, `.coins`), `src/pages-elev.js` (pageElevHem),
samt shop-saldo/priser där 🪙 förekommer.
