// Hard Quality Gate & Anti-Wrapper Filters for Thought-Leader Index
import { cleanUrl } from "./classify.mjs";

// Thin wrappers, toy clones, course tutorials, or generic templates
const REJECT_PATTERNS = [
  /\b(simple|toy|basic|starter|sample|boilerplate|template)\b.*(wrapper|prompt|chatgpt|openai)/i,
  /\bchat[- ]?with[- ]?(pdf|your[- ]?pdf|csv|docs?)\b/i,
  /\bcourse\b|\btutorial\b|\bhomework\b|\blearn[- ]?ai\b|\bbootcamp\b/i,
  /\bcurated[- ]?list\b|\bawesome[- ]?\w+\b|\bcollection[- ]?of\b/i,
  /\bcrack(ed)?\b|\bfree[- ]?credits\b|\bapi[- ]?relay\b|中转|破解|公益站/i,
];

// Domains typically indicating an unpolished personal playground rather than a production product
// (Allowed only if stars/points exceed exceptional threshold > 1500)
const FREE_SUBDOMAIN_PATTERNS = [
  /\.vercel\.app$/i,
  /\.pages\.dev$/i,
  /\.github\.io$/i,
  /\.streamlit\.app$/i,
  /\.replit\.app$/i,
  /\.onrender\.com$/i,
  /\.netlify\.app$/i,
];

export function evaluateQuality(item) {
  const text = `${item.name} ${item.tagline || ""} ${(item.tags || []).join(" ")}`;
  
  // 1. Anti-Wrapper / Anti-Junk checks
  for (const pat of REJECT_PATTERNS) {
    if (pat.test(text)) {
      return { pass: false, reason: "Matches template, tutorial, or thin-wrapper pattern" };
    }
  }

  // 2. Strict Thresholds per source
  if (item.source === "github") {
    // Must have at least 150 stars to prove genuine community traction
    if ((item.metric || 0) < 150) {
      return { pass: false, reason: "Insufficient GitHub stars (< 150)" };
    }
  }

  if (item.source === "hn") {
    // Must have at least 30 upvotes or 10 comments to prove real peer discussion
    if ((item.metric || 0) < 30 && (item.comments || 0) < 10) {
      return { pass: false, reason: "Insufficient Hacker News traction" };
    }
  }

  if (item.source === "huggingface") {
    // Must have at least 40 likes
    if ((item.metric || 0) < 40) {
      return { pass: false, reason: "Insufficient Hugging Face likes (< 40)" };
    }
  }

  // 3. Domain Quality Check
  if (item.url) {
    try {
      const u = new URL(item.url);
      const isSubdomain = FREE_SUBDOMAIN_PATTERNS.some(pat => pat.test(u.hostname));
      if (isSubdomain && (item.metric || 0) < 1500) {
        return { pass: false, reason: "Hosted on free playground subdomain without exceptional traction" };
      }
    } catch {
      return { pass: false, reason: "Malformed destination URL" };
    }
  }

  // 4. Synthesize a professional editorial "Why it matters" highlight
  let whyItMatters = "";
  if (item.source === "github") {
    whyItMatters = `Production open-source breakthrough with ${item.metric.toLocaleString()} verified GitHub stars.`;
  } else if (item.source === "hn") {
    whyItMatters = `Ranked in top community discussions with ${item.metric} upvotes on Hacker News.`;
  } else if (item.source === "huggingface") {
    whyItMatters = `Trending community demo & model with ${item.metric} likes on Hugging Face.`;
  } else {
    whyItMatters = "Verified high-utility AI tool vetted for production.";
  }

  return { pass: true, whyItMatters };
}
