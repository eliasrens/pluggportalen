// ============================================================================
// Hitta rätt! – varning när eleven lämnar en pågående omgång (hr-lamna-vakt.js)
// ----------------------------------------------------------------------------
// #605: spelflödet (E #608) anropar `armeraLamnaVakt()` när omgången startar
// och kör den returnerade `avarmera()` när den är klar. Under tiden:
//   • hash-byte (sidomenyn, bakåtknappen, länkar) → confirm(); "Avbryt" =
//     eleven stannar och hashen återställs utan att routern ritar om.
//   • stäng/ladda om fliken → webbläsarens egen "Lämna sidan?"-dialog.
// Vakten lyssnar på hashchange i CAPTURE-fasen: på window (målet) körs
// capture-lyssnare före appens router (Chrome ≥ 89, Firefox, Safari), så
// stopImmediatePropagation() hinner stoppa routern. Ingen ändring i app.js.
// ============================================================================

export const LAMNA_TEXT = "Du är mitt i en omgång. Om du går härifrån sparas inte omgången. Vill du lämna?";

let aktiv = null;

/**
 * Slå på vakten. Returnerar avarmera(). Bara en vakt åt gången (en ny ersätter).
 * @param {{ text?: string, fraga?: (text:string)=>boolean, win?: Window }} [opt]
 */
export function armeraLamnaVakt(opt = {}) {
  aktiv?.();
  const win = opt.win || window;
  const text = opt.text || LAMNA_TEXT;
  const fraga = opt.fraga || ((t) => win.confirm(t));

  const onHash = (e) => {
    if (e.oldURL === e.newURL) return;
    if (fraga(text)) {
      avarmera(); // eleven valde att gå → routern får bytet
      return;
    }
    e.stopImmediatePropagation();
    const gammal = String(e.oldURL || "");
    const i = gammal.indexOf("#");
    // replaceState ger ingen ny hashchange → routern ritar inte om.
    win.history.replaceState(win.history.state, "", i >= 0 ? gammal.slice(i) : "#/elev/hitta-ratt");
  };
  const onUnload = (e) => {
    e.preventDefault();
    e.returnValue = text; // äldre Chrome kräver returnValue
    return text;
  };
  win.addEventListener("hashchange", onHash, true);
  win.addEventListener("beforeunload", onUnload);

  function avarmera() {
    win.removeEventListener("hashchange", onHash, true);
    win.removeEventListener("beforeunload", onUnload);
    if (aktiv === avarmera) aktiv = null;
  }
  aktiv = avarmera;
  return avarmera;
}

/** Är en vakt aktiv just nu? */
export function lamnaVaktAktiv() {
  return !!aktiv;
}
