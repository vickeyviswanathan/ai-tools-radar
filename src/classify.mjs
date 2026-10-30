// Content rules: AI relevance, brand/ad safety, our own category taxonomy, canonical keys.

// Is this about AI? Used for sources that are not AI-only (Hacker News).
const AI_RE = new RegExp(
  "\\b(" +
    [
      "ai", "a\\.i\\.", "llms?", "gpt-?\\w*", "chatgpt", "openai", "claude", "anthropic", "gemini", "llama\\w*", "mistral",
      "deepseek", "qwen", "agents?", "agentic", "mcp", "rag", "copilots?", "chatbots?", "genai", "generative", "diffusion",
      "flux", "whisper", "tts", "text-to-\\w+", "speech-to-text", "transcri\\w*", "embeddings?", "neural", "machine learning",
      "deep learning", "prompts?", "prompting", "fine-?tun\\w*", "inference", "transformers?", "vlms?", "multimodal", "ollama",
      "vibe[- ]?cod\\w*", "voice clon\\w*", "computer vision", "ocr",
    ].join("|") +
    ")\\b",
  "i",
);
export const isAiRelated = (text) => AI_RE.test(text);

// Brand safety: a public, ad-supported site must keep adult / abusive / scammy content out.
// Conservative on purpose — a false negative costs ad approval, a false positive costs one listing.
const BLOCK_RE = new RegExp(
  "(" +
    [
      "nsfw", "uncensored", "porn\\w*", "nud(e|es|ity|ify)\\w*", "undress\\w*", "hentai", "xxx", "\\bsex(y|ual)?\\b",
      "erotic\\w*", "onlyfans", "lewd", "18\\+", "adult content", "deep-?nude", "deepfake\\w*", "face ?swap\\w*",
      "clothes? ?remov\\w*", "jailbreak\\w*", "casino", "gambl\\w*", "betting", "airdrop", "pump\\.fun", "crack(ed)? ",
      "free credits", "api relay", "中转", "破解",
    ].join("|") +
    ")",
  "i",
);
export const isBlocked = (text) => BLOCK_RE.test(text);

// Repos that are lists/guides rather than tools.
const LIST_RE = /\b(awesome|curated list|list of|collection of|resources|roadmap|interview|tutorials?|cheat ?sheet|papers?)\b|导航|合集|教程/i;
export const isListLike = (text) => LIST_RE.test(text);

// Our own taxonomy (ordered; first best match wins on ties).
const CATEGORIES = [
  ["Cybersecurity", /\b(cybersecurity|security|appsec|infosec|vulnerabilit\w*|pentest\w*|red team\w*|blue team\w*|cve|owasp|waf|sast|dast|sbom|threat\w*|exploit\w*|reverse engineer\w*|malware|sandbox|siem|forensics?|cryptograph\w*|auth0?|keycloak|zero[- ]day|secret scan\w*)\b/i],
  ["Coding", /\b(code|coding|coder|developers?|ide|repos?|sdk|devops|debug\w*|terminal|cli|programming|sql|pull requests?|vibe[- ]?cod\w*|codebase|refactor\w*|typescript|python|rust|unit tests?)\b/i],
  ["Agents & Automation", /\b(agents?|agentic|automat\w*|workflows?|autonomous|mcp|browser use|computer use|n8n|zapier|rpa|orchestrat\w*)\b/i],
  ["Image & Design", /\b(images?|photos?|design\w*|logos?|art|illustrat\w*|diffusion|sdxl|flux|avatars?|figma|upscal\w*|drawing|sketch|3d|icons?|wallpapers?|ui mockups?)\b/i],
  ["Video", /\b(videos?|film\w*|animat\w*|clips?|youtube|reels|lip-?sync|i2v|t2v|shorts|movies?)\b/i],
  ["Audio & Voice", /\b(audio|voices?|speech|tts|music|songs?|podcasts?|transcri\w*|dictation|stt|sound|singing|vocals?)\b/i],
  ["Writing", /\b(writ\w*|blogs?|copywrit\w*|essays?|articles?|grammar|paraphras\w*|summar\w*|story|stories|novels?|translat\w*|emails?)\b/i],
  ["Chat & Assistants", /\b(chat\w*|assistants?|companions?|conversation\w*|ask|q&a|personal ai)\b/i],
  ["Productivity", /\b(productivity|notes?|calendar|meetings?|tasks?|project management|docs?|pdfs?|spreadsheets?|slides|presentations?|todo|knowledge base|second brain|inbox)\b/i],
  ["Research & Data", /\b(research|data|analytics|search|rag|datasets?|databases?|dashboards?|scrap\w*|insights?|reports?|papers?|science)\b/i],
  ["Business & Marketing", /\b(marketing|sales|ads?|crm|leads?|e-?commerce|shop\w*|seo|customer support|recruit\w*|hiring|startups?|brand\w*|social media|outreach)\b/i],
  ["Education", /\b(learn\w*|study|tutor\w*|courses?|students?|quiz\w*|teach\w*|flashcards?|exam|language learning)\b/i],
  ["Models & Infra", /\b(models?|llm inference|fine-?tun\w*|training|gpus?|embeddings?|vector|benchmarks?|quantiz\w*|serving|evals?|inference|weights|lora|tokenizer|mlops)\b/i],
  ["Health & Lifestyle", /\b(health\w*|fitness|nutrition|recipes?|meals?|travel|finance|money|budget\w*|therapy|mental|sleep|dating|fashion|home)\b/i],
];
export const CATEGORY_NAMES = [...CATEGORIES.map(([n]) => n), "Other"];

export function categorize(text) {
  let best = "Other";
  let bestHits = 0;
  for (const [name, re] of CATEGORIES) {
    const hits = (text.match(new RegExp(re.source, "gi")) || []).length;
    if (hits > bestHits) {
      best = name;
      bestHits = hits;
    }
  }
  return best;
}

// Canonical key so the same product from several sources merges into one item.
const REPO_HOSTS = new Set(["github.com", "gitlab.com", "huggingface.co", "codeberg.org"]);
export function canonicalKey(rawUrl) {
  const u = new URL(rawUrl);
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  if (REPO_HOSTS.has(host)) {
    const parts = u.pathname.split("/").filter(Boolean);
    // huggingface.co/spaces/owner/name → keep 3 segments
    const keep = host === "huggingface.co" && parts[0] === "spaces" ? 3 : 2;
    return `${host}/${parts.slice(0, keep).join("/").toLowerCase()}`;
  }
  return host;
}

// Normalize a user/source URL; returns null when unusable.
export function cleanUrl(raw) {
  try {
    const u = new URL(String(raw).trim());
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return null;
    if (u.username || u.password) return null;
    // Drop tracking params.
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|ref$|fbclid|gclid|mc_)/i.test(k)) u.searchParams.delete(k);
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

export const clip = (s, n) => {
  if (!s) return null;
  const t = String(s).replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t || null;
};
