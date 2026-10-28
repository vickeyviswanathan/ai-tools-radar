// Thought-Leader Quality Gate & Anti-Wrapper Filters
import { cleanUrl } from "./classify.mjs";

// Thin wrappers, toy clones, course tutorials, or generic personal hobby posts
const REJECT_PATTERNS = [
  /\b(simple|toy|basic|starter|sample|boilerplate|template)\b.*(wrapper|prompt|chatgpt|openai)/i,
  /\bchat[- ]?with[- ]?(pdf|your[- ]?pdf|csv|docs?)\b/i,
  /\bcourse\b|\btutorial\b|\bhomework\b|\blearn[- ]?ai\b|\bbootcamp\b/i,
  /\bcurated[- ]?list\b|\bawesome[- ]?\w+\b|\bcollection[- ]?of\b/i,
  /\bcrack(ed)?\b|\bfree[- ]?credits\b|\bapi[- ]?relay\b|中转|破解|公益站/i,
  /\bI made\b|\busing AI ofc\b|\bintroducing\b|\brandom\b|\btest\b/i,
  /\breddit\b|\bbenchmark using\b/i
];

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
  
  // 1. Anti-Wrapper / Anti-Junk / Anti-Noise checks
  for (const pat of REJECT_PATTERNS) {
    if (pat.test(text)) {
      return { pass: false, reason: "Matches template, tutorial, or thin-wrapper pattern" };
    }
  }

  // 2. Strict Thresholds per source for automated discovery
  if (item.source === "github") {
    // Must have at least 250 verified stars to prove genuine community adoption
    if ((item.metric || 0) < 250) {
      return { pass: false, reason: "Insufficient GitHub stars (< 250)" };
    }
  }

  if (item.source === "hn") {
    // Must have at least 60 upvotes and 15 comments to prove real peer discussion
    if ((item.metric || 0) < 60 || (item.comments || 0) < 15) {
      return { pass: false, reason: "Insufficient Hacker News traction" };
    }
  }

  if (item.source === "huggingface") {
    // Must have at least 60 likes
    if ((item.metric || 0) < 60) {
      return { pass: false, reason: "Insufficient Hugging Face likes (< 60)" };
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

  // 4. Clean editorial summary
  let whyItMatters = "";
  if (item.source === "github") {
    whyItMatters = `Production open-source framework with ${item.metric.toLocaleString()} verified GitHub stars.`;
  } else if (item.source === "hn") {
    whyItMatters = `Peer-vetted engineering discussion with ${item.metric} upvotes on Hacker News.`;
  } else if (item.source === "huggingface") {
    whyItMatters = `Top-trending community model with ${item.metric} likes on Hugging Face.`;
  } else {
    whyItMatters = "Verified high-utility AI tool vetted for production.";
  }

  return { pass: true, whyItMatters };
}
