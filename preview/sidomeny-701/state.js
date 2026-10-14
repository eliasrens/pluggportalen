// Testläge för preview-sidomeny-701.html – allt styrs av URL-parametrar så
// varje fall kan skärmdumpas direkt (även med headless chromium --screenshot).
const q = new URLSearchParams(location.search);
const lista = (k) => (q.get(k) || "").split(",").filter(Boolean);
export const S = {
  namn: q.get("namn") || "Alva",
  coins: Number(q.get("coins") ?? 988583),
  stars: Number(q.get("stars") ?? 342),
  dolda: lista("dolda"),
  enabled: q.has("enabled") ? lista("enabled") : ["hittaratt", "ekvationsresan"],
  live: q.get("live") === "1",
  mm: q.get("mm") === "1",
  lock: q.get("lock") || "", // "lasresan" | "omrade"
  doljOvrigt: q.get("dolj") === "1",
};
