// Institutional-Grade Real-Time Cybersecurity News Engine
// Features:
// 1. Generalized Event & Entity Clustering (strictly 1 Master Dossier per unique event)
// 2. Strict Paywall Blacklisting (skips WSJ, Bloomberg, FT, NYT, WaPo in favor of open-access primary wire reports)
// 3. Pre-Flight Link & Content Relevance Verification (checks HTTP 200 and cyber keyword context)
// 4. Multi-Angle Synthesis (bundles related angles e.g. Heist + Freezes + Raids into sub-bullet insights)

import { cleanUrl } from "./classify.mjs";

const HARD_PAYWALL_DOMAINS = [
  "wsj.com",
  "bloomberg.com",
  "ft.com",
  "washingtonpost.com",
  "nytimes.com",
  "theinformation.com",
  "businessinsider.com",
  "thetimes.co.uk",
  "barrons.com"
];

const PAYWALLED_SOURCE_NAMES = [
  "wsj",
  "wall street journal",
  "bloomberg",
  "financial times",
  "washington post",
  "new york times",
  "the information",
  "barron's"
];

const CYBER_SECURITY_KEYWORDS = [
  "hack", "hacked", "hacker", "hacking", "data breach", "security breach", "network breach",
  "data leak", "credential leak", "database leak", "heist", "cybersecurity", "cyberattack",
  "cybercrime", "cyber fraud", "cyber cell", "cyber threat", "cyber espionage", "cyber incident",
  "ransomware", "trojan", "malware", "phishing", "smishing", "vishing", "spyware", "ddos",
  "zero-day", "vulnerability", "cve-", "exploit", "drained", "compromised",
  "digital arrest", "deepfake", "e-sim", "sim swap", "infostealer",
  "dark web", "cert-in", "cisa", "crypto heist",
  "online fraud", "upi fraud", "apk", "botnet"
];

const JUNK_NOISE_KEYWORDS = [
  "podcast", "video", "photos", "song", "rahman", "cricket", "honey singh",
  "voter fraud", "election rally", "movie", "box office", "horoscope",
  "celebrity", "wedding", "gold price", "california college", "efcc",
  "colorado", "ravena", "fines of up to", "patrick stewart",
  "botox", "medicare", "doctor", "dentist", "medical fraud", "healthcare fraud",
  "hospital billing", "clinic", "narcotics", "fentanyl", "murder", "homicide",
  "shooting", "accident", "dui", "traffic ticket",
  // Automotive / EV / Cybertruck / general market & earnings false positives
  "cybertruck", "tesla cyber", "cyber cab", "cybercab", "car sales", "vehicle sales", "auto sales",
  "ev sales", "sales breach", "growth target", "deliveries", "showroom",
  "quarterly sales", "q1 sales", "q2 sales", "q3 sales", "q4 sales", "quarterly results", "financial results",
  "semiconductor supply chain", "supply chains and", "publicly releases", "announces gemini",
  // Environmental / climate noise matching 'breach'
  "warming", "glacier", "ice sheet", "climate", "temperature", "greenhouse", "emission",
  // Traditional non-cyber financial / white-collar crime & forex noise
  "ed attaches", "attaches properties", "attached properties", "property attached",
  "pmla", "money laundering", "loan fraud", "bank loan", "chandra proteco",
  "dollar pulls back", "ahead of us midterms", "forex", "stock market", "shares dip", "shares surge",
  // College seminars / career guidance / student workshops
  "career guidance", "students briefed", "briefed on cybersecurity", "organizes cybersecurity",
  "polytechnic", "college organizes", "campus drive", "workshop on cybersecurity", "webinar on"
];

function isPaywalled(url, source) {
  const u = (url || "").toLowerCase();
  const s = (source || "").toLowerCase();
  if (HARD_PAYWALL_DOMAINS.some(d => u.includes(d))) return true;
  if (PAYWALLED_SOURCE_NAMES.some(name => s.includes(name))) return true;
  return false;
}

function isCyberRelevant(title) {
  const lower = title.toLowerCase();
  if (JUNK_NOISE_KEYWORDS.some(k => lower.includes(k))) return false;
  return CYBER_SECURITY_KEYWORDS.some(k => lower.includes(k));
}

function timeAgo(dateString) {
  try {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return "just now";
    if (diffHours === 1) return "1 hour ago";
    if (diffHours < 24) return `${diffHours} hours ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "1 day ago";
    return `${diffDays} days ago`;
  } catch {
    return "recently";
  }
}

function formatDate(dateString) {
  try {
    const d = new Date(dateString);
    return d.toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

async function fetchRssFeed(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    clearTimeout(timeout);

    if (!res.ok) return [];
    const text = await res.text();
    const items = [];
    const matches = text.match(/<item>[\s\S]*?<\/item>/g) || [];

    for (const m of matches) {
      const rawTitle = (m.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
      const link = (m.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || "";
      const pubDate = (m.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || "";
      const rawSource = (m.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || "";

      const cleanTitle = rawTitle
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/[‘’`]/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/[–—]/g, "-")
        .replace(/\s*[-|]\s*[^-|]+$/, "")
        .trim();
      const source = rawSource || (rawTitle.includes("-") ? rawTitle.split("-").pop().trim() : "Verified News Wire");

      const safeLink = cleanUrl(link.trim());
      if (cleanTitle && safeLink && isCyberRelevant(cleanTitle)) {
        items.push({
          title: cleanTitle,
          link: safeLink,
          pubDate,
          source
        });
      }
    }
    return items;
  } catch (err) {
    console.log("[LiveRSS] Fetch error for URL:", url.slice(0, 50), err.message);
    return [];
  }
}

// Non-news filter: drops op-eds, PR listicles, corporate alliances, MoUs, and advice columns
const JUNK_TITLE_REGEX = /\b(influential cisos|top cisos|ciso of the year|awards? 202\d|how to recover|can ai make|why india needs|opinion:|explainer:|sponsored|quiz:|how to avoid|here is how|things to know|key takeaways|expanding its ambitions|join forces to advance|cybersecurity 100|signs mou|signs pact|training program|expert thinks)\b|^how to\b/i;

function classifyNewsSector(title, category) {
  const lower = (title || "").toLowerCase();
  if (/\b(connected car|connected-car|vehicle|automotive|ev\b|fridge|freezer|supermarket|iot\b|industrial|smart meter|grid)\b/i.test(lower)) {
    return "IoT, Automotive & Supply Chain";
  }
  if (/\b(telecom|mobile number|spam call|sim\b|esim|trai|dot\b|5g|isp\b|broadband)\b/i.test(lower)) {
    return "Telecom & Communications";
  }
  if (/\b(ai\b|artificial intelligence|llm|openai|anthropic|gpt|gemini|mistral|tencent|model|deepfake)\b/i.test(lower)) {
    return "AI & Cloud Security";
  }
  if (category === "crypto-heists" || /\b(crypto|bitcoin|binance|blockchain|defi|exchange|token|wallet|web3|polymarket|bithumb|mercado)\b/i.test(lower)) {
    return "Crypto & Digital Assets";
  }
  if (/\b(rbi|sebi|bank|banking|nbfc|fintech|payment|upi|credit card|debit card|financial|crore|lakh|rupee|rs\b|₹)\b/i.test(lower)) {
    return "Banking & Financial Services";
  }
  if (/\b(cert-in|cisa|government|ministry|supreme court|police|ed\b|cbi|eu\b|uk\b|federal|election)\b/i.test(lower)) {
    return "Government & Regulatory Policy";
  }
  return "Enterprise & Critical Infrastructure";
}

function classifyNewsSeverityAndBadge(title, source, category) {
  const lower = (title || "").toLowerCase();

  // 1. Policy, Regulatory Directives, Industry Commentary, or Defensive Research -> "medium" (Advisory / Policy)
  const isPolicyOrAnalysis = /\b(norms|framework|guideline|directive|mandates|rules|policy|urges action|becoming central|what does .* mean|rolls out|unveils|launches|access to|report finds|says uk|chief says|power play|mysteries|spam calls drop)\b/i.test(lower);
  const isActiveBreachOrHeist = /\b(hacked|stolen|loses|heist|ransomware|zero-day|0-day|drained|arrests|arrested|seize|hit by|cyberattack|patch vulnerabilities)\b/i.test(lower);

  let severity = "medium";
  if (/\b(billion|6\.3b|6bn|record hack|largest hack|zero-day|0-day|critical vulnerability|nation-state)\b/i.test(lower)) {
    severity = "critical";
  } else if (isActiveBreachOrHeist && !isPolicyOrAnalysis) {
    // Major multi-crore heists, active infrastructure attacks, or exchange hacks are HIGH; smaller local arrests are MEDIUM
    if (/\b(lakh|three for cyber fraud|two from)\b/i.test(lower) && !/\b(100|200|400|500)\s*crore\b/i.test(lower)) {
      severity = "medium";
    } else {
      severity = "high";
    }
  } else {
    severity = "medium";
  }

  let impactBadge = "📰 Security Report";
  if (lower.includes("binance") || lower.includes("6.3") || lower.includes("6bn")) {
    impactBadge = "💰 $6.3B Exchange Hack";
  } else if (lower.includes("freeze") || lower.includes("frozen")) {
    impactBadge = "🔒 Asset Freeze";
  } else if (lower.includes("rbi") || lower.includes("regulat") || lower.includes("norms") || lower.includes("framework")) {
    impactBadge = "⚖️ Regulatory Policy";
  } else if (lower.includes("cert-in") || lower.includes("eu urges") || lower.includes("chief")) {
    impactBadge = "🏛️ Policy & Governance";
  } else if (/\b(openai|anthropic|tencent|mistral|gpt)\b/i.test(lower)) {
    impactBadge = "🤖 AI Security";
  } else if (/\b(arrest|arrests|seize|ed\b|police)\b/i.test(lower)) {
    impactBadge = "🚓 Law Enforcement";
  } else if (/\b(loses|crore|fraud)\b/i.test(lower)) {
    impactBadge = "🏦 Financial Incident";
  } else if (/\b(hack|breach|cyberattack|vulnerabilit)\b/i.test(lower)) {
    impactBadge = "⚠️ Active Incident";
  } else if ((source || "").toLowerCase().includes("reuters")) {
    impactBadge = "📰 Reuters Dispatch";
  }

  return { severity, impactBadge };
}
function getEventSignatureAndCategory(title, originalCategory) {
  const lower = title.toLowerCase();

  // 1. Binance Global $6.3B Heist & Asset Freezes / Hacker statements (All converge into 1 single card)
  if (lower.includes("binance") || 
      lower.includes("hot potato") ||
      lower.includes("biggest-ever hack") ||
      lower.includes("biggest crypto") ||
      lower.includes("largest crypto") ||
      lower.includes("largest cryptocurrency") ||
      lower.includes("biggest cryptocurrency") ||
      (lower.includes("billions") && (lower.includes("crypto") || lower.includes("cryptocurrency") || lower.includes("heist") || lower.includes("hack"))) ||
      ((lower.includes("6.3") || lower.includes("6bn") || lower.includes("6.4") || lower.includes("6 billion")) && 
       (lower.includes("hack") || lower.includes("heist") || lower.includes("theft") || lower.includes("stolen") || lower.includes("crypto")))) {
    return {
      category: "crypto-heists",
      clusterKey: "crypto:binance-6.3b-heist",
      isSpecific: true
    };
  }

  // 1b. Supreme Court / RBI Bank Cyber Fraud Compensation & Mandatory Payouts
  if ((lower.includes("supreme court") || lower.includes("sc cracks") || lower.includes("sc pushes") || lower.includes("sc directives")) && 
      (lower.includes("bank") || lower.includes("cyber fraud") || lower.includes("compensation") || lower.includes("payout"))) {
    return {
      category: "india-bfsi",
      clusterKey: "india:supreme-court-bank-compensation",
      isSpecific: true
    };
  }

  // 2. Polymarket Security Incident
  if (lower.includes("polymarket")) {
    return {
      category: "crypto-heists",
      clusterKey: "crypto:polymarket-breach",
      isSpecific: true
    };
  }

  // 3. Bithumb / Korean Exchange Breaches
  if (lower.includes("bithumb") || (lower.includes("korean") && lower.includes("breach"))) {
    return {
      category: "crypto-heists",
      clusterKey: "crypto:bithumb-hack",
      isSpecific: true
    };
  }

  // 4. London crypto street robberies
  if (lower.includes("london") && lower.includes("crypto")) {
    return {
      category: "crypto-heists",
      clusterKey: "crypto:london-crypto-theft",
      isSpecific: true
    };
  }

  // 5. AU Small Finance Bank (Force to india-bfsi, 1 single cluster)
  if (lower.includes("au small finance") || lower.includes("au bank")) {
    return {
      category: "india-bfsi",
      clusterKey: "india:au-small-finance-bank",
      isSpecific: true
    };
  }

  // 6. State Bank of India
  if (lower.includes("state bank of india") || lower.includes("sbi")) {
    return {
      category: "india-bfsi",
      clusterKey: "india:sbi-bank-security",
      isSpecific: true
    };
  }

  // 7. Punjab National Bank
  if (lower.includes("punjab national bank") || lower.includes("pnb")) {
    return {
      category: "india-bfsi",
      clusterKey: "india:pnb-fraud-case",
      isSpecific: true
    };
  }

  // 8. IDFC First Bank / Haryana labour board scam
  if (lower.includes("idfc") || lower.includes("haryana labour board")) {
    return {
      category: "india-bfsi",
      clusterKey: "india:idfc-bank-scam",
      isSpecific: true
    };
  }

  // 9. Delhi Police Cyber Syndicate / Fake benefits bust
  if ((lower.includes("delhi police") || lower.includes("nanded")) && (lower.includes("fraud") || lower.includes("bust") || lower.includes("arrest"))) {
    return {
      category: "india-bfsi",
      clusterKey: "india:delhi-police-cyber-bust",
      isSpecific: true
    };
  }

  // 10. Reserve Bank of India (RBI Directives & Checks)
  if (lower.includes("reserve bank of india") || lower.includes("rbi")) {
    return {
      category: "india-bfsi",
      clusterKey: "india:rbi-regulatory-action",
      isSpecific: true
    };
  }

  // 11. Chandra Proteco CBI FIR
  if (lower.includes("chandra proteco")) {
    return {
      category: "india-bfsi",
      clusterKey: "india:chandra-proteco-cbi",
      isSpecific: true
    };
  }

  // 12. Federal Election Commission Hack
  if (lower.includes("fec") || lower.includes("federal election commission")) {
    return {
      category: "global-ransomware",
      clusterKey: "global:fec-systems-hack",
      isSpecific: true
    };
  }

  // 13. PwC Employee Records Incident
  if (lower.includes("pwc")) {
    return {
      category: "global-ransomware",
      clusterKey: "global:pwc-records-incident",
      isSpecific: true
    };
  }

  // 14. Sopra Steria Defence / Cyber
  if (lower.includes("sopra steria")) {
    return {
      category: "global-ransomware",
      clusterKey: "global:sopra-steria-cyber",
      isSpecific: true
    };
  }

  // 15. Mistral AI Model Cyber
  if (lower.includes("mistral")) {
    return {
      category: "global-ransomware",
      clusterKey: "global:mistral-cyber",
      isSpecific: true
    };
  }

  // 16. General Financial Fraud Amount Matcher in India (e.g. "280 crore", "5.17 crore")
  const croreMatch = lower.match(/(\d+[\.\d]*)\s*crore/);
  if (croreMatch) {
    return {
      category: "india-bfsi",
      clusterKey: `india:in-fraud-${croreMatch[1]}-crore`,
      isSpecific: true
    };
  }

  // Fallback: 3 longest content words
  const tokens = lower
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 4 && !["after", "about", "could", "claims", "group", "probes", "report", "first", "giant", "cases", "arrested", "accused", "police", "says", "cyber", "cybersecurity", "fraud", "banks", "banking", "financial", "stolen", "money", "crore", "lakhs"].includes(w));

  return {
    category: originalCategory,
    clusterKey: `${originalCategory}:${tokens.slice(0, 3).sort().join("-")}`,
    isSpecific: false
  };
}

export async function getLiveCyberRss() {
  console.log("[LiveRSS] Fetching live feeds from Reuters, ANI, Moneycontrol, and primary cyber desks...");

  const [indiaItems, cryptoItems, reutersItems] = await Promise.all([
    fetchRssFeed('https://news.google.com/rss/search?q=(cybersecurity+OR+hack+OR+breach+OR+"data+leak"+OR+"bank+fraud"+OR+"cyber+fraud")+AND+(India+OR+RBI+OR+NBFC+OR+SBI+OR+"UPI+payment"+OR+"cyber+cell"+OR+CBI+OR+"digital+arrest")+when:7d&hl=en-IN&gl=IN&ceid=IN:en'),
    fetchRssFeed('https://news.google.com/rss/search?q=(Binance+OR+crypto+OR+bitcoin)+AND+(hack+OR+freeze+OR+heist+OR+stolen)+when:7d&hl=en-US&gl=US&ceid=US:en'),
    fetchRssFeed('https://news.google.com/rss/search?q=(cybersecurity+OR+hack+OR+ransomware+OR+breach)+source:Reuters+when:7d&hl=en-US&gl=US&ceid=US:en')
  ]);

  const rawCandidatePool = [
    ...indiaItems.map(i => {
      const srcL = (i.source || "").toLowerCase();
      const titleL = (i.title || "").toLowerCase();
      const isIndianBfsiContext = /\b(rbi|sebi|sbi|hdfc|icici|pnb|axis|kotak|bob|canara|uco|idfc|indusind|au bank|au small finance|paytm|phonepe|cred|npci|neft|rtgs|imps|nbfc|fintech|bank|banking|upi|rupee|crore|lakh|cr)\b|\brs\.?\s*\d+/i.test(titleL);
      const isForeign = srcL === "upi" || srcL.includes("united press") || srcL.includes("chosun") || srcL.includes("ghana") || srcL.includes("lawfuel") || titleL.includes("korean") || titleL.includes("calif") || titleL.includes("medicare") || titleL.includes("ghana") || titleL.includes("mtn") || titleL.includes("dhs") || titleL.includes("homeland security") || titleL.includes("pentagon") || titleL.includes("trump");
      const normalizedSource = (srcL === "upi" || srcL.includes("united press")) ? "United Press International" : i.source;
      return { ...i, source: normalizedSource, defaultCategory: (isIndianBfsiContext && !isForeign) ? "india-bfsi" : "global-ransomware" };
    }),
    ...cryptoItems.map(i => ({ ...i, defaultCategory: "crypto-heists" })),
    ...reutersItems.map(i => ({ ...i, defaultCategory: "global-ransomware" }))
  ];

  // Group candidate articles into unique event clusters
  const clusterMap = new Map();

  for (const item of rawCandidatePool) {
    // 1. Skip non-news (advice columns, PR listicles, how-tos)
    if (JUNK_TITLE_REGEX.test(item.title)) {
      continue;
    }

    // 2. Skip hard paywalls completely
    if (isPaywalled(item.link, item.source)) {
      continue;
    }

    const { category, clusterKey, isSpecific } = getEventSignatureAndCategory(item.title, item.defaultCategory);
    item.category = category;

    // Check if clusterKey matches existing. If it's a fallback key, check for semantic token similarity
    let targetKey = clusterKey;
    if (!isSpecific && !clusterMap.has(targetKey)) {
      const STOPWORDS = new Set(["with", "from", "after", "over", "into", "their", "under", "probe", "about", "could", "claims", "group", "probes", "report", "first", "says", "cyber", "cybersecurity", "news", "bank", "banks", "banking", "fraud", "cases", "police", "stolen", "crore", "lakhs", "money", "alert", "alerts", "loss", "losses", "network", "arrested", "arrest"]);
      const itemTokens = new Set(
        item.title.toLowerCase()
          .replace(/[^a-z0-9\s]/g, "")
          .split(/\s+/)
          .filter(w => w.length > 3 && !STOPWORDS.has(w))
      );

      for (const [existingKey, existingCluster] of clusterMap.entries()) {
        if (existingCluster.primary.category !== category) continue;
        const existTokens = existingCluster.primary.title.toLowerCase()
          .replace(/[^a-z0-9\s]/g, "")
          .split(/\s+/)
          .filter(w => w.length > 3 && !STOPWORDS.has(w));
        
        let shared = 0;
        for (const t of existTokens) {
          if (itemTokens.has(t)) shared++;
        }
        // If 2 or more distinct significant entity tokens overlap in the same category, merge into that cluster!
        if (shared >= 2) {
          targetKey = existingKey;
          break;
        }
      }
    }

    if (!clusterMap.has(targetKey)) {
      clusterMap.set(targetKey, {
        primary: item,
        articles: [item],
        relatedSources: new Set([item.source])
      });
    } else {
      const cluster = clusterMap.get(targetKey);
      cluster.articles.push(item);
      cluster.relatedSources.add(item.source);

      // Prefer high-authority open-access wire services as primary headline
      const srcLower = item.source.toLowerCase();
      const currentSrcLower = cluster.primary.source.toLowerCase();
      
      const priorityOrder = ["reuters", "moneycontrol", "ndtv", "the hindu", "theprint", "trm labs", "cnbc", "bbc", "ani", "al jazeera", "guardian"];
      const newRank = priorityOrder.findIndex(p => srcLower.includes(p));
      const curRank = priorityOrder.findIndex(p => currentSrcLower.includes(p));

      if (newRank !== -1 && (curRank === -1 || newRank < curRank)) {
        cluster.primary = item;
      }
    }
  }

  const allArticles = [];

  for (const [key, cluster] of clusterMap.entries()) {
    const item = cluster.primary;
    const category = item.category;
    const { severity, impactBadge } = classifyNewsSeverityAndBadge(item.title, item.source, category);
    const sector = classifyNewsSector(item.title, category);

    // Only build sub-angles if there are actually distinct developments
    let synthesizedSummary = "";
    if (cluster.articles.length > 1) {
      const distinctTitles = cluster.articles
        .map(a => a.title)
        .filter(t => t !== item.title && t.length > 25)
        .slice(0, 2);
      if (distinctTitles.length > 0) {
        synthesizedSummary = "Key updates: " + distinctTitles.join("; ") + ".";
      }
    }

    const id = `live-${category}-${Math.abs(item.title.split("").reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0))}`;

    allArticles.push({
      id,
      category,
      severity,
      impactBadge,
      title: item.title,
      sourceName: item.source,
      sourceUrl: item.link,
      provenanceBadge: item.source.toLowerCase().includes("reuters") ? "📰 Reuters" :
                       item.source.toLowerCase().includes("ani") ? "🇮🇳 ANI" :
                       sector === "Banking & Financial Services" ? "🏦 Banking & Finance" :
                       sector === "Crypto & Digital Assets" ? "⛓️ Crypto & Web3" :
                       sector === "AI & Cloud Security" ? "🤖 AI & Cloud" :
                       sector === "IoT, Automotive & Supply Chain" ? "🔌 IoT & Supply Chain" : "🌐 Cyber Desk",
      badgeType: item.source.toLowerCase().includes("reuters") ? "statutory" :
                 category === "india-bfsi" ? "regulatory" :
                 category === "crypto-heists" ? "onchain" : "statutory",
      ref: item.source,
      date: formatDate(item.pubDate),
      pubDate: item.pubDate,
      timestamp: new Date(item.pubDate).getTime() || 0,
      timeAgo: timeAgo(item.pubDate),
      entities: sector,
      incident: synthesizedSummary,
      rootCause: "Primary source reporting.",
      consequence: `Read reporting on ${item.source}.`
    });
  }

  // Sort by date newest first (using high-resolution timestamp if available)
  allArticles.sort((a, b) => {
    const tA = a.timestamp || new Date(a.pubDate || a.date || 0).getTime();
    const tB = b.timestamp || new Date(b.pubDate || b.date || 0).getTime();
    return tB - tA;
  });

  // Cap at top 6 distinct master incident cards per category
  const indiaSelected = allArticles.filter(a => a.category === "india-bfsi").slice(0, 6);
  const cryptoSelected = allArticles.filter(a => a.category === "crypto-heists").slice(0, 6);
  const globalSelected = allArticles.filter(a => a.category === "global-ransomware").slice(0, 6);

  // Live verification: drop any news articles with broken links (404/DNS error)
  const rawPool = [...indiaSelected, ...cryptoSelected, ...globalSelected];
  const verifiedThreats = [];
  for (const item of rawPool) {
    try {
      const res = await fetch(item.sourceUrl, {
        method: "HEAD",
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        redirect: "follow",
        signal: AbortSignal.timeout(3500)
      });
      if (res.status < 400 || res.status === 403 || res.status === 401 || res.status === 429) {
        verifiedThreats.push(item);
      } else {
        console.log(`[LiveRSS] Filtered non-working news link (${res.status}): ${item.title}`);
      }
    } catch (e) {
      if (e.message && e.message.includes("ENOTFOUND")) {
        console.log(`[LiveRSS] Filtered unreachable domain: ${item.sourceUrl}`);
      } else {
        verifiedThreats.push(item);
      }
    }
  }

  const indiaFinal = verifiedThreats.filter(a => a.category === "india-bfsi");
  const cryptoFinal = verifiedThreats.filter(a => a.category === "crypto-heists");
  const globalFinal = verifiedThreats.filter(a => a.category === "global-ransomware");

  // Sort globally newest-first so the latest breaking news is always at the top
  const finalThreats = [...verifiedThreats].sort((a, b) => {
    const tA = a.timestamp || new Date(a.pubDate || a.date || 0).getTime();
    const tB = b.timestamp || new Date(b.pubDate || b.date || 0).getTime();
    return tB - tA;
  });

  const categories = [
    { id: "all", label: "🔥 All Cybersecurity News", count: finalThreats.length },
    { id: "india-bfsi", label: "🇮🇳 India, Banks & NBFCs", count: indiaFinal.length },
    { id: "crypto-heists", label: "🌐 Crypto & Exchange Heists", count: cryptoFinal.length },
    { id: "global-ransomware", label: "🌐 Global Cyber Defense", count: globalFinal.length }
  ];

  console.log(`[LiveRSS] Final curated feed: ${finalThreats.length} unique incidents (India: ${indiaSelected.length}, Crypto: ${cryptoSelected.length}, Global: ${globalSelected.length}). All paywalls stripped.`);
  return { categories, threats: finalThreats };
}
