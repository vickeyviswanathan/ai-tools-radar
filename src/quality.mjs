// Thought-Leader Quality Gate & Anti-Wrapper Filters
import { cleanUrl } from "./classify.mjs";
import { isEditoriallyBlocked } from "./blocklist.mjs";

// Thin wrappers, toy clones, course tutorials, or generic personal hobby posts
const REJECT_PATTERNS = [
  /\b(simple|toy|basic|starter|sample|boilerplate|template)\b.*(wrapper|prompt|chatgpt|openai)/i,
  /\bchat[- ]?with[- ]?(pdf|your[- ]?pdf|csv|docs?)\b/i,
  /\bcourse\b|\btutorial\b|\bhomework\b|\blearn[- ]?ai\b|\bbootcamp\b/i,
  /\bcurated[- ]?list\b|\bawesome[- ]?\w+\b|\bcollection[- ]?of\b/i,
  /\bcrack(ed)?\b|\bfree[- ]?credits\b|\bapi[- ]?relay\b|中转|破解|公益站/i,
  /\bI made\b|\busing AI ofc\b|\bintroducing\b|\brandom\b|\btest\b/i,
  /\breddit\b|\bbenchmark using\b/i,
  // Learning material, not tools
  /\bfor beginners\b|\bfrom scratch\b|\bhandbook\b|\bcookbook\b|\bnotebooks\b|\blessons?\b|\bcheat ?sheet\b|\bmade with ml\b/i,
  // Leaked / copied proprietary material, unofficial access to other people's services
  /\bleaked?\b|\bsystem prompts?\b|\breverse[- ]engineered api\b|\bunofficial api\b/i,
  // Free-API relays, scrapers of social platforms, watermark removal, downloaders
  /\bfree (gpt|llm|model|api)\b|\bapi free\b|\bwatermarks?\b|\b(youtube|tiktok|douyin|instagram) (download|scrap)\w*|\bdownloader\b/i,
  // Hype and profanity have no place on a reference site
  /\bslop\b|\bmaxxing\b|\buncensored\b|\b(shit|fuck\w*|bitch|damn)\b/i,
  // Throwaway experiments
  /\bcolab\b|\bdreambooth\b/i,
];

// Anything still written in a non-English script after translation is dropped.
const NON_ENGLISH_SCRIPT = /[\u0400-\u04FF\u0590-\u06FF\u0900-\u097F\u0E00-\u0E7F\u1100-\u11FF\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/;

// Placeholder descriptions the scrapers fall back to when a repo has none.
const PLACEHOLDER_TAGLINE = /^(open-source ai tool \/ repository|high-utility open-source ai infrastructure)$/i;

// Promo fragments scrapers pick up from READMEs that add no information.
const PROMO_FRAGMENT = /\s*(only\s+)?official\s+(website|site|repo(sitory)?)\s*[:=]?\s*\S+\.?\s*$/i;

// Compact, locale-independent number formatting (291K / 1.4M) so the site
// never shows environment-dependent grouping like "2,91,410".
const fmtCompact = (n) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);

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

  // 0. Basic presentability: a real name, a real English description, not editorially blocked
  if (isEditoriallyBlocked(item.name)) {
    return { pass: false, reason: "Editorially blocked" };
  }
  if (String(item.name || "").trim().length < 3) {
    return { pass: false, reason: "Name too short to be meaningful" };
  }
  const tagline = String(item.tagline || "").trim();
  if (tagline.length < 15 || PLACEHOLDER_TAGLINE.test(tagline)) {
    return { pass: false, reason: "Missing or placeholder description" };
  }
  if (NON_ENGLISH_SCRIPT.test(String(item.name || ""))) {
    return { pass: false, reason: "Name not in English" };
  }
  // Many projects write a bilingual description. Keep the English half; drop the entry only when
  // there is no usable English left.
  let cleanTagline = tagline.replace(PROMO_FRAGMENT, "").trim();
  if (NON_ENGLISH_SCRIPT.test(tagline)) {
    cleanTagline = cleanTagline
      .replace(new RegExp(NON_ENGLISH_SCRIPT.source, "g"), " ")
      .replace(/[|｜（）()【】\[\]、。，；：]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (cleanTagline.length < 25 || !/[a-z]{3,}.*\s.*[a-z]{3,}/i.test(cleanTagline)) {
      return { pass: false, reason: "Description not in English" };
    }
  }

  // 1. Anti-Wrapper / Anti-Junk / Anti-Noise checks
  for (const pat of REJECT_PATTERNS) {
    if (pat.test(text)) {
      return { pass: false, reason: "Matches template, tutorial, or thin-wrapper pattern" };
    }
  }

  // 2. Strict Thresholds per source for automated discovery
  if (item.source === "github") {
    // Must have at least 1,000 stars to prove genuine community adoption
    if ((item.metric || 0) < 1000) {
      return { pass: false, reason: "Insufficient GitHub stars (< 1000)" };
    }
  }

  if (item.source === "hn") {
    // Must have real peer discussion (comments are only known at ingest time)
    if ((item.metric || 0) < 150 || (item.comments !== undefined && item.comments < 30)) {
      return { pass: false, reason: "Insufficient Hacker News traction" };
    }
  }

  if (item.source === "huggingface") {
    // Spaces are cheap to make; require clear community adoption
    if ((item.metric || 0) < 500) {
      return { pass: false, reason: "Insufficient Hugging Face likes (< 500)" };
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
    whyItMatters = `Production open-source framework with ${fmtCompact(item.metric)} verified GitHub stars.`;
  } else if (item.source === "hn") {
    whyItMatters = `Peer-vetted engineering discussion with ${item.metric} upvotes on Hacker News.`;
  } else if (item.source === "huggingface") {
    whyItMatters = `Top-trending community model with ${item.metric} likes on Hugging Face.`;
  } else {
    whyItMatters = "Verified high-utility AI tool vetted for production.";
  }

  return { pass: true, whyItMatters, cleanTagline };
}
