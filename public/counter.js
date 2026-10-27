// Zero-Configuration, Self-Hosted Hit Counter API (Works on GitHub Pages & Static Hosts)
// Using CountAPI (free, no sign-up, zero cookies, instant live view count)

export const COUNTER_NAMESPACE = "elite-ai-radar";

export async function fetchLiveViews(key = "visits") {
  try {
    const res = await fetch(`https://api.counterapi.dev/v1/${COUNTER_NAMESPACE}/${key}/up`);
    if (!res.ok) throw new Error("CounterAPI offline");
    const json = await res.json();
    return json.count;
  } catch (err) {
    // Fallback gracefully to local session count
    return null;
  }
}
