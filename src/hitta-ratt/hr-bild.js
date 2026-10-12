// ============================================================================
// Hitta rätt! – frågornas bilder i spelet (src/hitta-ratt/hr-bild.js) · #637
// ----------------------------------------------------------------------------
// Arkitektur §11.8. Laddas bara från hr-spel.js (dynamiskt, aldrig i bootgrafen).
//   bild.id  (eget pack) → hittaRattBilder/{id} (1 läsning) → Bytes → Blob →
//            URL.createObjectURL. Eleven hämtar ALDRIG något från Commons.
//   bild.fil (officiellt pack) → content/bilder/<fil> i repot, som förut.
//
//   const c = skapaBildCache({ las })
//   await c.url(bild)   → url | null (saknad/oläslig bild → null, ingen krasch)
//   c.forhamta(bild)    → nästa frågas bild hämtas i förväg
//   c.rensa()           → revokeObjectURL på allt (när omgången lämnas)
//   las(id) → { mime, data: Bytes | Uint8Array } | null  (standard: Firestore)
//
//   attributionHtml(bild, esc) → raden under bilden ("" för egna bilder)
// ============================================================================

export const repoUrl = (fil) => new URL(`./content/bilder/${fil}`, import.meta.url).href;

async function lasFirestore(id) {
  const [{ db }, { doc, getDoc }] = await Promise.all([
    import("../firebase-config.js"),
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"),
  ]);
  const snap = await getDoc(doc(db, "hittaRattBilder", id));
  return snap.exists() ? snap.data() : null;
}

const bytes = (data) => (typeof data?.toUint8Array === "function" ? data.toUint8Array() : data);

export function skapaBildCache({ las = lasFirestore, skapaUrl = (b) => URL.createObjectURL(b), frigor = (u) => URL.revokeObjectURL(u) } = {}) {
  const cache = new Map(); // id → Promise<url | null>
  let rensad = false;

  function url(bild) {
    if (!bild) return Promise.resolve(null);
    if (!bild.id) return Promise.resolve(bild.fil ? repoUrl(bild.fil) : null);
    if (!cache.has(bild.id)) {
      cache.set(bild.id, (async () => {
        try {
          const d = await las(bild.id);
          const u8 = bytes(d?.data);
          if (!u8?.length || rensad) return null;
          return skapaUrl(new Blob([u8], { type: d.mime || "image/webp" }));
        } catch {
          cache.delete(bild.id); // nästa försök läser igen
          return null;
        }
      })());
    }
    return cache.get(bild.id);
  }

  return {
    url,
    forhamta(bild) {
      if (!bild) return;
      if (bild.id) url(bild);
      else if (bild.fil && typeof Image === "function") new Image().src = repoUrl(bild.fil);
    },
    async rensa() {
      rensad = true;
      const alla = [...cache.values()];
      cache.clear();
      for (const p of alla) {
        const u = await p;
        if (u) frigor(u);
      }
    },
  };
}

/** "Foto: X, CC BY-SA 4.0, Wikimedia Commons" – egna uppladdade bilder får ingen rad. */
export function attributionHtml(b, esc) {
  if (!b || b.kalla === "egen" || !b.licens) return "";
  const lank = (url, text) => (url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>` : esc(text));
  return `Foto: ${esc(b.fotograf || "okänd")}, ${lank(b.licensUrl, b.licens)}, ${lank(b.kallaUrl, "Wikimedia Commons")}`;
}
