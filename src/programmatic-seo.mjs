// Programmatic SEO, AEO & GEO Static Page Generator for Cipherati
// Automatically builds 300+ dedicated, crawlable, rich HTML pages at build time:
// 1. /tools/[slug].html      — 223+ individual AI developer tool engineering evaluation pages
// 2. /compare/[a]-vs-[b].html — 50+ high-intent head-to-head tool comparison matrices
// 3. /scams/[slug].html      — 19+ citizen cyber scam defense playbooks (1930 Golden Hour + FAQPage)
// 4. /realities/[slug].html  — 22+ production AI engineering failure post-mortems & reference stacks

import { writeFileSync, mkdirSync, rmSync } from "node:fs";

const SITE_URL = "https://cipherati.com/";

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

export function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

const SELF_HOSTABLE = /ollama|vllm|llama\.cpp|qdrant|meilisearch|langfuse|ragflow|openhands|cline|promptfoo|deepeval|aider|outlines|lmstudio|dify|flowise|supabase|appwrite|nocodb/i;

export function deriveToolEvaluation(tool) {
  const isGithub = /github\.com/i.test(tool.url);
  const isHf = /huggingface\.co/i.test(tool.url);
  const hay = `${tool.name} ${tool.url} ${tool.tagline}`;
  const isSelfHost = isGithub || isHf || SELF_HOSTABLE.test(hay);

  const licenseModel = isGithub
    ? "Open-Source Repository (inspect LICENSE in repo before commercial redistribution)"
    : isHf
    ? "Open-Weight Model / Space (check model card license: Apache-2.0, MIT, or community license)"
    : "Commercial / Freemium SaaS or CLI (check vendor pricing & enterprise terms)";

  const deploymentModel = isSelfHost
    ? (isGithub ? "Self-Hostable / Local Runtime (CLI, Docker, or Python/Node package)" : "Local / Self-Hosted or Hybrid Cloud")
    : "Managed Cloud / API or Desktop Client";

  const dataPosture = isSelfHost
    ? "Can be run within your own VPC or local workstation with zero external code/prompt telemetry when configured with local endpoints."
    : "Prompts and context may transit vendor cloud infrastructure; verify SOC2/DPDP data retention and zero-data-retention (ZDR) policies before sending proprietary code or PII.";

  const categoryTradeoffs = {
    "Coding": {
      useWhen: "Accelerating multi-file refactoring, test generation, or codebase Q&A with human-in-the-loop diff review.",
      tradeoff: "Unsupervised autonomous edits can introduce regressions or hallucinated dependencies; always gate with CI test suites."
    },
    "Agents & Automation": {
      useWhen: "Orchestrating bounded, deterministic multi-step workflows, browser automation, or tool-calling pipelines via MCP.",
      tradeoff: "Unbounded multi-agent loops risk runaway API token costs and compounding hallucinations; enforce max-step budgets and schema validation."
    },
    "Cybersecurity": {
      useWhen: "Automating SAST/DAST reconnaissance, secret scanning, container SBOM auditing, or LLM prompt-injection red-teaming in CI/CD.",
      tradeoff: "Automated scanners generate false positives and do not replace manual business-logic penetration testing or architectural threat modeling."
    },
    "Models & Infra": {
      useWhen: "Running quantized open-weight models locally or serving high-throughput inference on dedicated GPU clusters.",
      tradeoff: "Self-hosting requires GPU VRAM provisioning and KV-cache tuning; evaluate hardware utilization vs. pay-per-token API economics."
    },
    "Research & Data": {
      useWhen: "Parsing complex PDFs/tables into clean Markdown, building hybrid BM25 + vector retrieval, or inspecting binary artifacts.",
      tradeoff: "Chunking quality and layout OCR accuracy directly bottleneck downstream RAG precision; benchmark against your own document corpus."
    },
    "Chat & Assistants": {
      useWhen: "Providing teams with a unified, self-hosted or multi-provider workspace connecting local Ollama models and external APIs.",
      tradeoff: "Requires role-based access control (RBAC) and API key governance when deployed for multi-user enterprise teams."
    },
    "Image & Design": {
      useWhen: "Running reproducible node-based diffusion pipelines, local image synthesis, or UI component generation.",
      tradeoff: "Local diffusion models require 8GB–24GB+ GPU VRAM and careful checkpoint license verification for commercial asset use."
    },
    "Audio & Voice": {
      useWhen: "Performing low-latency local speech-to-text transcription or open-weight voice synthesis without per-minute cloud API fees.",
      tradeoff: "Voice cloning models carry strict consent and anti-impersonation compliance requirements."
    },
    "Video": {
      useWhen: "Automating programmatic video assembly, captioning, or local temporal diffusion workflows.",
      tradeoff: "High compute and VRAM footprint per generated second compared to text or static image workloads."
    },
    "Productivity": {
      useWhen: "Automating document OCR, personal knowledge indexing, or reusable terminal prompt pipelines.",
      tradeoff: "Verify local storage encryption and sync boundaries before indexing proprietary corporate documents."
    }
  };

  const guide = categoryTradeoffs[tool.category] || {
    useWhen: "Evaluating open-source or developer tooling within a sandboxed test environment.",
    tradeoff: "GitHub stars and community metrics indicate popularity, not enterprise security or production SLA readiness."
  };

  return { isGithub, isHf, isSelfHost, licenseModel, deploymentModel, dataPosture, ...guide };
}

function formatSignalText(signals = []) {
  for (const s of signals) {
    const [src, metric] = s.split(":");
    const num = Number(metric) || 0;
    const fmt = num >= 1000 ? (num / 1000).toFixed(1) + "k" : String(num);
    if (src === "github") return `★ ${fmt} GitHub stars (public popularity metric)`;
    if (src === "huggingface") return `♥ ${fmt} Hugging Face likes`;
    if (src === "hn") return `▲ ${fmt} Hacker News points`;
  }
  return "Editorially indexed developer tool";
}

export function renderPageShell({ title, description, canonicalPath, keywords, jsonLd, activeNav, breadcrumbs, mainHtml, extraCss = "", ogType = "article", image = "https://cipherati.com/og-image.png" }) {
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;
  const safeJsonLd = JSON.stringify(jsonLd).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://cipherati.com https://docs.google.com https://script.google.com https://script.googleusercontent.com https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com; form-action 'self' https://docs.google.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; upgrade-insecure-requests;" />
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-6YXH14ZGPR"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-6YXH14ZGPR');
  </script>
  <meta name="referrer" content="strict-origin-when-cross-origin" />
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="keywords" content="${esc(keywords)}" />
  <link rel="canonical" href="${esc(canonicalUrl)}" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="manifest" href="/manifest.json" />
  <meta property="og:site_name" content="Cipherati" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:type" content="${esc(ogType)}" />
  <meta property="og:url" content="${esc(canonicalUrl)}" />
  <meta property="og:image" content="${esc(image)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${esc(image)}" />
  <script type="application/ld+json">${safeJsonLd}</script>
  <script>
    (function () {
      try {
        if (localStorage.getItem("cipherati-theme") === "dark") {
          document.documentElement.setAttribute("data-theme", "dark");
        }
      } catch (e) {}
    })();
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #f8fafc;
      --surface: #ffffff;
      --surface-subtle: #f1f5f9;
      --card: #ffffff;
      --line: #e2e8f0;
      --line-strong: #cbd5e1;
      --text: #0f172a;
      --text-secondary: #334155;
      --text-muted: #64748b;
      --accent: #2563eb;
      --accent-hover: #1d4ed8;
      --accent-soft: #eff6ff;
      --accent-border: #bfdbfe;
      --accent-text: #1d4ed8;
      --green: #059669;
      --green-soft: #ecfdf5;
      --green-border: #a7f3d0;
      --green-text: #065f46;
      --amber: #d97706;
      --amber-soft: #fffbeb;
      --amber-border: #fde68a;
      --amber-text: #92400e;
      --red: #e11d48;
      --red-soft: #fff1f2;
      --red-border: #fecdd3;
      --red-text: #881337;
      --header-bg: rgba(255, 255, 255, 0.94);
      --shadow-sm: 0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.02);
    }
    html[data-theme="dark"] {
      --bg: #090d16;
      --surface: #0d1321;
      --surface-subtle: #1e293b;
      --card: #111827;
      --line: #1e293b;
      --line-strong: #334155;
      --text: #f8fafc;
      --text-secondary: #cbd5e1;
      --text-muted: #94a3b8;
      --accent: #3b82f6;
      --accent-hover: #60a5fa;
      --accent-soft: rgba(59, 130, 246, 0.15);
      --accent-border: rgba(59, 130, 246, 0.35);
      --accent-text: #60a5fa;
      --green: #10b981;
      --green-soft: rgba(16, 185, 129, 0.12);
      --green-border: rgba(16, 185, 129, 0.3);
      --green-text: #a7f3d0;
      --amber: #f59e0b;
      --amber-soft: rgba(245, 158, 11, 0.12);
      --amber-border: rgba(245, 158, 11, 0.3);
      --amber-text: #fde68a;
      --red: #ef4444;
      --red-soft: rgba(239, 68, 68, 0.12);
      --red-border: rgba(239, 68, 68, 0.35);
      --red-text: #fecaca;
      --header-bg: rgba(13, 19, 33, 0.92);
      --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.25);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }
    a { color: var(--accent-text); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .topbar {
      border-bottom: 1px solid var(--line);
      background: var(--header-bg);
      backdrop-filter: blur(10px);
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .topbar-inner {
      max-width: 1120px;
      margin: 0 auto;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      flex-wrap: wrap;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 800;
      font-size: 17px;
      color: var(--text);
      text-decoration: none;
    }
    .brand-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent-text);
      border: 1px solid var(--accent-border);
    }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .nav-link {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary);
      padding: 6px 11px;
      border-radius: 8px;
      border: 1px solid transparent;
      text-decoration: none;
    }
    .nav-link:hover, .nav-link.active {
      color: var(--accent-text);
      background: var(--accent-soft);
      border-color: var(--accent-border);
      text-decoration: none;
    }
    .theme-btn {
      background: var(--surface-subtle);
      color: var(--text-secondary);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 6px 10px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
    }
    .theme-btn:hover { border-color: var(--line-strong); color: var(--text); }
    .container {
      max-width: 960px;
      margin: 0 auto;
      padding: 24px 20px 64px;
    }
    .breadcrumbs {
      font-size: 12.5px;
      color: var(--text-muted);
      margin-bottom: 16px;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    .hero-card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 26px;
      margin-bottom: 20px;
      box-shadow: var(--shadow-sm);
    }
    .kicker {
      display: inline-block;
      font-size: 11.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--accent-text);
      background: var(--accent-soft);
      border: 1px solid var(--accent-border);
      padding: 3px 9px;
      border-radius: 6px;
      margin-bottom: 10px;
    }
    h1 {
      margin: 0 0 10px;
      font-size: clamp(23px, 3.2vw, 32px);
      line-height: 1.25;
      letter-spacing: -0.02em;
      color: var(--text);
    }
    .subtitle {
      font-size: 15.5px;
      color: var(--text-secondary);
      margin: 0 0 18px;
    }
    .meta-pills {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 18px;
    }
    .pill {
      font-size: 12.5px;
      font-weight: 600;
      padding: 4px 11px;
      border-radius: 999px;
      background: var(--surface-subtle);
      border: 1px solid var(--line);
      color: var(--text-secondary);
    }
    .cta-row {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .btn-primary {
      background: var(--accent);
      color: #fff;
      font-weight: 700;
      font-size: 13.5px;
      padding: 9px 16px;
      border-radius: 8px;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn-primary:hover { background: var(--accent-hover); text-decoration: none; }
    .btn-secondary {
      background: var(--surface-subtle);
      color: var(--text);
      font-weight: 600;
      font-size: 13.5px;
      padding: 9px 16px;
      border-radius: 8px;
      border: 1px solid var(--line);
      text-decoration: none;
    }
    .btn-secondary:hover { border-color: var(--line-strong); text-decoration: none; }
    .grid-2 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }
    .panel {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 22px;
      margin-bottom: 20px;
      box-shadow: var(--shadow-sm);
    }
    .panel h2 {
      margin: 0 0 14px;
      font-size: 18px;
      font-weight: 700;
      color: var(--text);
    }
    .spec-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    .spec-table th, .spec-table td {
      padding: 11px 13px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }
    .spec-table th {
      width: 28%;
      color: var(--text-muted);
      font-weight: 700;
      background: var(--surface-subtle);
    }
    .alert-box {
      padding: 15px 17px;
      border-radius: 10px;
      margin-bottom: 16px;
      font-size: 14px;
    }
    .alert-green { background: var(--green-soft); border: 1px solid var(--green-border); color: var(--green-text); }
    .alert-amber { background: var(--amber-soft); border: 1px solid var(--amber-border); color: var(--amber-text); }
    .alert-red { background: var(--red-soft); border: 1px solid var(--red-border); color: var(--red-text); }
    .alt-list {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 12px;
    }
    .alt-card {
      background: var(--surface-subtle);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 8px;
    }
    .alt-card:hover { border-color: var(--line-strong); }
    .faq-item {
      border-bottom: 1px solid var(--line);
      padding: 14px 0;
    }
    .faq-item:last-child { border-bottom: none; }
    .faq-q { font-weight: 700; color: var(--text); margin: 0 0 6px; font-size: 15px; }
    .faq-a { color: var(--text-secondary); margin: 0; font-size: 14px; }
    footer {
      border-top: 1px solid var(--line);
      padding: 28px 20px;
      text-align: center;
      font-size: 13px;
      color: var(--text-muted);
    }
    .page-nav-row { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin: 4px 0 24px; font-size: 14px; font-weight: 700; }
    .prose { font-size: 16px; line-height: 1.7; color: var(--text-secondary); }
    .prose h2 { font-size: 22px; line-height: 1.3; color: var(--text); margin: 30px 0 10px; }
    .prose h3 { font-size: 18px; color: var(--text); margin: 22px 0 8px; }
    .prose p { margin: 0 0 14px; }
    .prose ul, .prose ol { margin: 0 0 16px; padding-left: 22px; }
    .prose li { margin: 0 0 6px; }
    .prose strong { color: var(--text); }
    .prose blockquote { margin: 0 0 16px; padding: 12px 16px; border-left: 4px solid var(--accent); background: var(--surface-subtle); border-radius: 0 10px 10px 0; color: var(--text); }
    .prose blockquote p { margin: 0; }
    .table-wrap { overflow-x: auto; margin: 0 0 18px; border: 1px solid var(--line); border-radius: 10px; }
    .table-wrap table { width: 100%; border-collapse: collapse; font-size: 14.5px; min-width: 460px; }
    .table-wrap th, .table-wrap td { padding: 10px 14px; text-align: left; vertical-align: top; border-bottom: 1px solid var(--line); }
    .table-wrap th { background: var(--surface-subtle); color: var(--text); font-weight: 700; }
    .table-wrap tr:last-child td { border-bottom: none; }
    .guide-meta { display: flex; gap: 10px; flex-wrap: wrap; margin: 0 0 16px; font-size: 13px; color: var(--text-muted); }
    .guide-note { font-size: 13.5px; color: var(--text-muted); border-top: 1px solid var(--line); padding-top: 14px; margin-top: 8px; }
    .source-list { margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.7; }
    @media (max-width: 600px) {
      .container { padding: 20px 14px 48px; }
      .hero-card { padding: 20px; }
      .prose { font-size: 15.5px; }
    }
    ${extraCss}
  </style>
</head>
<body>
  <header class="topbar">
    <div class="topbar-inner">
      <a href="/" class="brand">
        <span>🛡️ Cipherati</span>
        <span class="brand-badge">Engineering &amp; Cyber Intelligence</span>
      </a>
      <nav class="nav-links" aria-label="Primary Navigation">
        <a href="/cybersecurity-news.html" class="nav-link${activeNav === "news" ? " active" : ""}">🛡️ Cyber News</a>
        <a href="/scam-alerts.html" class="nav-link${activeNav === "scams" ? " active" : ""}">🚨 Scam Alerts (1930)</a>
        <a href="/ai-realities.html" class="nav-link${activeNav === "realities" ? " active" : ""}">⚡ 22 AI Realities</a>
        <a href="/ai-tools.html" class="nav-link${activeNav === "tools" ? " active" : ""}">🧭 AI Tools (${223})</a>
        <a href="/newsletter/today.html" class="nav-link">📬 Daily Briefing</a>
        <button type="button" class="theme-btn" id="theme-toggle-btn" aria-label="Toggle light or dark theme">🌙 Dark</button>
      </nav>
    </div>
  </header>

  <main class="container">
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/">Cipherati</a>
      ${breadcrumbs.map((b) => `<span>›</span> ${b.url ? `<a href="${esc(b.url)}">${esc(b.name)}</a>` : `<span>${esc(b.name)}</span>`}`).join(" ")}
    </nav>
    ${mainHtml}
  </main>

  <footer>
    <p><strong>Cipherati</strong> — Open Engineering Directory, Cybersecurity News &amp; Citizen Scam Defense.</p>
    <p>
      <a href="/">Home</a> ·
      <a href="/cybersecurity-news.html">Cybersecurity News</a> ·
      <a href="/scam-alerts.html">1930 Scam Alerts</a> ·
      <a href="/ai-realities.html">22 AI Realities</a> ·
      <a href="/ai-tools.html">AI Tools Directory</a> ·
      <a href="/scam-defense/upi-fraud-what-to-do/">UPI Fraud Guide</a> ·
      <a href="/scam-defense/digital-arrest-scam-india/">Digital Arrest Guide</a> ·
      <a href="/scam-defense/report-scam-call-india/">Report a Scam Call</a> ·
      <a href="/sitemap.xml">Sitemap</a> ·
      <a href="/llms-full.txt">LLMs.txt</a>
    </p>
  </footer>
  <script>
    (function () {
      var btn = document.getElementById("theme-toggle-btn");
      if (!btn) return;
      function sync() {
        var dark = document.documentElement.getAttribute("data-theme") === "dark";
        btn.textContent = dark ? "☀️ Light" : "🌙 Dark";
      }
      sync();
      btn.addEventListener("click", function () {
        var nextDark = document.documentElement.getAttribute("data-theme") !== "dark";
        if (nextDark) document.documentElement.setAttribute("data-theme", "dark");
        else document.documentElement.removeAttribute("data-theme");
        try { localStorage.setItem("cipherati-theme", nextDark ? "dark" : "light"); } catch (e) {}
        sync();
      });
    })();
  </script>
</body>
</html>`;
}

/** Stable, unique review-page slug per tool name. Shared by the build (tools.json) and the page generator. */
export function buildToolSlugMap(tools) {
  const map = new Map();
  const used = new Set();
  for (const t of tools) {
    let s = slugify(t.name);
    if (!s) s = "tool";
    if (used.has(s)) s = `${s}-${slugify(t.category || "ai")}`;
    used.add(s);
    map.set(t.name, s);
  }
  return map;
}

export function generateProgrammaticSeoPages({ tools = [], scams = [], realities = [], updatedAt, guides = [], ledger = null }) {
  rmSync("./public/tools", { recursive: true, force: true });
  rmSync("./public/compare", { recursive: true, force: true });
  mkdirSync("./public/tools", { recursive: true });
  mkdirSync("./public/compare", { recursive: true });
  mkdirSync("./public/scams", { recursive: true });
  mkdirSync("./public/realities", { recursive: true });

  const buildDate = (updatedAt || new Date().toISOString()).slice(0, 10);
  // lastmod only moves when the page's substantive content changes (see lastmod-ledger.mjs).
  const stamp = (url, payload) => (ledger ? ledger.stamp(url, payload) : buildDate);
  const generatedUrls = [];

  const orgNode = {
    "@type": "Organization",
    "@id": `${SITE_URL}#organization`,
    "name": "Cipherati",
    "url": SITE_URL,
    "logo": `${SITE_URL}icons/icon-512.png`
  };

  // Precompute slugs for all entities
  const toolSlugMap = buildToolSlugMap(tools);

  const realitySlugMap = new Map();
  for (const r of realities) {
    const s = slugify(r.title);
    realitySlugMap.set(r.id, s);
  }

  const scamSlugMap = new Map();
  for (const s of scams) {
    const slug = slugify(s.id || s.title);
    scamSlugMap.set(s.id || s.title, slug);
  }

  // Build comparison pairs (top tools within each category)
  const categories = [...new Set(tools.map((t) => t.category).filter(Boolean))];
  const comparisonPairs = [];
  const toolComparisonsLookup = new Map(); // tool.name -> [{ slug, otherName, title }]

  for (const cat of categories) {
    const inCat = tools
      .filter((t) => t.category === cat)
      .sort((a, b) => (b.rank || 0) - (a.rank || 0))
      .slice(0, 6);

    for (let i = 0; i < inCat.length; i++) {
      for (let j = i + 1; j < inCat.length; j++) {
        if (comparisonPairs.length >= 65) break;
        const a = inCat[i];
        const b = inCat[j];
        const slugA = toolSlugMap.get(a.name);
        const slugB = toolSlugMap.get(b.name);
        const compSlug = `${slugA}-vs-${slugB}`;
        comparisonPairs.push({ a, b, compSlug, category: cat });

        if (!toolComparisonsLookup.has(a.name)) toolComparisonsLookup.set(a.name, []);
        if (!toolComparisonsLookup.has(b.name)) toolComparisonsLookup.set(b.name, []);
        toolComparisonsLookup.get(a.name).push({ slug: compSlug, other: b.name });
        toolComparisonsLookup.get(b.name).push({ slug: compSlug, other: a.name });
      }
    }
  }

  // Previous/next within each category (ranked) so every review is reachable through a crawlable chain.
  const rankedByCategory = new Map();
  for (const t of tools) {
    if (!rankedByCategory.has(t.category)) rankedByCategory.set(t.category, []);
    rankedByCategory.get(t.category).push(t);
  }
  for (const list of rankedByCategory.values()) list.sort((a, b) => (b.rank || 0) - (a.rank || 0));

  // 1. Generate 223+ Individual Tool Evaluation Pages (/tools/[slug].html)
  for (const tool of tools) {
    const slug = toolSlugMap.get(tool.name);
    const canonicalPath = `tools/${slug}.html`;
    const toolLastmod = stamp(`${SITE_URL}${canonicalPath}`, {
      n: tool.name, t: tool.tagline, w: tool.why_it_matters || "", c: tool.category, u: tool.url
    });
    const categoryUrl = `${SITE_URL}ai-tools.html#tools/${encodeURIComponent(tool.category)}`;
    const catList = rankedByCategory.get(tool.category) || [];
    const catIdx = catList.findIndex((t) => t.name === tool.name);
    const prevTool = catIdx > 0 ? catList[catIdx - 1] : null;
    const nextTool = catIdx >= 0 && catIdx < catList.length - 1 ? catList[catIdx + 1] : null;
    const evalSpec = deriveToolEvaluation(tool);
    const signalStr = formatSignalText(tool.signals);

    const alternatives = tools
      .filter((t) => t.category === tool.category && t.name !== tool.name)
      .sort((a, b) => (b.rank || 0) - (a.rank || 0))
      .slice(0, 5);

    const matchingRealities = realities.filter((r) =>
      (r.tools || []).some((rt) => rt.name.toLowerCase() === tool.name.toLowerCase() || tool.name.toLowerCase().includes(rt.name.toLowerCase()))
    );

    const relatedComparisons = (toolComparisonsLookup.get(tool.name) || []).slice(0, 4);

    const faqItems = [
      {
        q: `What is ${tool.name} used for in AI engineering?`,
        a: `${tool.name} is an indexed tool in the ${tool.category} category: ${tool.tagline} Primary engineering fit: ${evalSpec.useWhen}`
      },
      {
        q: `Can ${tool.name} be self-hosted or run locally?`,
        a: `${evalSpec.deploymentModel}. Data & privacy posture: ${evalSpec.dataPosture}`
      },
      {
        q: `What are the operational trade-offs and limitations of ${tool.name}?`,
        a: `${evalSpec.tradeoff} Note that public community metrics (${signalStr}) measure repository or community popularity, not an independent security audit or enterprise SLA.`
      },
      {
        q: `What are the top alternatives to ${tool.name}?`,
        a: alternatives.length
          ? `Top alternatives to ${tool.name} in ${tool.category} include ${alternatives.map((a) => `${a.name} (${a.tagline})`).join("; ")}.`
          : `Explore the Cipherati ${tool.category} directory for alternatives.`
      }
    ];

    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        orgNode,
        {
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Cipherati", "item": SITE_URL },
            { "@type": "ListItem", "position": 2, "name": "AI Tools Directory", "item": `${SITE_URL}ai-tools.html` },
            { "@type": "ListItem", "position": 3, "name": tool.category, "item": categoryUrl },
            { "@type": "ListItem", "position": 4, "name": tool.name, "item": `${SITE_URL}${canonicalPath}` }
          ]
        },
        evalSpec.isGithub
          ? {
              "@type": "SoftwareSourceCode",
              "name": tool.name,
              "codeRepository": tool.url,
              "url": `${SITE_URL}${canonicalPath}`,
              "description": `${tool.tagline} — Engineering evaluation, deployment model, privacy posture, and alternatives.`,
              "dateModified": toolLastmod
            }
          : {
              "@type": "SoftwareApplication",
              "name": tool.name,
              "url": `${SITE_URL}${canonicalPath}`,
              "applicationCategory": tool.category || "DeveloperApplication",
              "operatingSystem": "Cross-platform",
              "description": `${tool.tagline} — Engineering evaluation, deployment model, privacy posture, and alternatives.`
            },
        {
          "@type": "FAQPage",
          "mainEntity": faqItems.map((f) => ({
            "@type": "Question",
            "name": f.q,
            "acceptedAnswer": { "@type": "Answer", "text": f.a }
          }))
        }
      ]
    };

    const mainHtml = `
      <article class="hero-card">
        <span class="kicker">${esc(tool.category)} · Engineering Evaluation</span>
        <h1>${esc(tool.name)} — Architecture, Trade-offs &amp; Alternatives</h1>
        <p class="subtitle">${esc(tool.tagline)}</p>
        ${tool.why_it_matters ? `<div class="alert-box alert-green"><strong>Technical Summary:</strong> ${esc(tool.why_it_matters)}</div>` : ""}
        <div class="meta-pills">
          <span class="pill">📦 ${esc(evalSpec.isSelfHost ? "Self-Hostable / Local Capable" : "Cloud / Managed Client")}</span>
          <span class="pill">📊 ${esc(signalStr)}</span>
          <span class="pill">📂 Category: ${esc(tool.category)}</span>
        </div>
        <div class="cta-row">
          <a href="${esc(tool.url)}" target="_blank" rel="noopener noreferrer" class="btn-primary">Inspect Official Source / Repository ↗</a>
          <a href="/ai-tools.html" class="btn-secondary">← Browse All ${tools.length} AI Tools</a>
        </div>
      </article>

      <section class="panel">
        <h2>⚙️ Engineering Evaluation &amp; Trade-offs Spec Sheet</h2>
        <table class="spec-table">
          <tbody>
            <tr>
              <th>📦 Deployment &amp; Runtime</th>
              <td>${esc(evalSpec.deploymentModel)}</td>
            </tr>
            <tr>
              <th>⚖️ License &amp; Access Model</th>
              <td>${esc(evalSpec.licenseModel)}</td>
            </tr>
            <tr>
              <th>🔒 Data &amp; Privacy Posture</th>
              <td>${esc(evalSpec.dataPosture)}</td>
            </tr>
            <tr>
              <th>✅ Primary Engineering Fit</th>
              <td>${esc(evalSpec.useWhen)}</td>
            </tr>
            <tr>
              <th>⚠️ Operational Caveats</th>
              <td>${esc(evalSpec.tradeoff)}</td>
            </tr>
            <tr>
              <th>📊 Evidence Standard</th>
              <td>${esc(signalStr)}. Community stars and upvotes measure public developer interest, not an independent security audit or enterprise SLA endorsement.</td>
            </tr>
          </tbody>
        </table>
      </section>

      ${
        matchingRealities.length > 0
          ? `<section class="panel">
        <h2>⚡ Production AI Realities Addressed by ${esc(tool.name)}</h2>
        <div class="alt-list">
          ${matchingRealities
            .map(
              (r) => `<div class="alt-card">
            <div>
              <span class="kicker">Reality #${esc(r.id)} · ${esc(r.category)}</span>
              <h3 style="margin:4px 0 8px;font-size:16px;"><a href="/realities/${esc(realitySlugMap.get(r.id))}.html">${esc(r.title)}</a></h3>
              <p style="margin:0;font-size:13.5px;color:var(--text-secondary);"><strong>Architectural Fix:</strong> ${esc(r.fix)}</p>
            </div>
            <a href="/realities/${esc(realitySlugMap.get(r.id))}.html" style="font-size:13px;font-weight:700;">Read Full Post-Mortem →</a>
          </div>`
            )
            .join("")}
        </div>
      </section>`
          : ""
      }

      ${
        relatedComparisons.length > 0
          ? `<section class="panel">
        <h2>⚖️ Head-to-Head Comparisons for ${esc(tool.name)}</h2>
        <div class="alt-list">
          ${relatedComparisons
            .map(
              (c) => `<a href="/compare/${esc(c.slug)}.html" class="alt-card" style="text-decoration:none;">
            <strong style="color:var(--text);font-size:15px;">${esc(tool.name)} vs ${esc(c.other)}</strong>
            <span style="font-size:13px;color:var(--accent);font-weight:700;">Compare runtime, privacy &amp; trade-offs →</span>
          </a>`
            )
            .join("")}
        </div>
      </section>`
          : ""
      }

      <section class="panel">
        <h2>🔄 Top Alternatives to ${esc(tool.name)} in ${esc(tool.category)}</h2>
        <div class="alt-list">
          ${alternatives
            .map((alt) => {
              const altSlug = toolSlugMap.get(alt.name);
              return `<div class="alt-card">
              <div>
                <h3 style="margin:0 0 6px;font-size:15.5px;"><a href="/tools/${esc(altSlug)}.html">${esc(alt.name)}</a></h3>
                <p style="margin:0;font-size:13px;color:var(--text-secondary);">${esc(alt.tagline)}</p>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;border-top:1px solid var(--line);font-size:12.5px;">
                <a href="/tools/${esc(altSlug)}.html" style="font-weight:700;">Evaluation Spec →</a>
                <a href="${esc(alt.url)}" target="_blank" rel="noopener noreferrer" style="color:var(--text-muted);">Source ↗</a>
              </div>
            </div>`;
            })
            .join("")}
        </div>
      </section>

      <section class="panel">
        <h2>❓ Frequently Asked Questions about ${esc(tool.name)}</h2>
        ${faqItems
          .map(
            (f) => `<div class="faq-item">
          <h3 class="faq-q">${esc(f.q)}</h3>
          <p class="faq-a">${esc(f.a)}</p>
        </div>`
          )
          .join("")}
      </section>

      <nav class="page-nav-row" aria-label="More ${esc(tool.category)} tools">
        ${prevTool ? `<a href="/tools/${esc(toolSlugMap.get(prevTool.name))}.html" rel="prev">← Previous in ${esc(tool.category)}: ${esc(prevTool.name)}</a>` : "<span></span>"}
        <a href="/ai-tools.html#tools/${encodeURIComponent(tool.category)}">All ${esc(tool.category)} tools</a>
        ${nextTool ? `<a href="/tools/${esc(toolSlugMap.get(nextTool.name))}.html" rel="next">Next in ${esc(tool.category)}: ${esc(nextTool.name)} →</a>` : "<span></span>"}
      </nav>
    `;

    const htmlOut = renderPageShell({
      title: `${tool.name} — Engineering Review, Self-Hosting, Privacy & Alternatives | Cipherati`,
      description: `Independent engineering evaluation of ${tool.name} (${tool.category}): ${tool.tagline} Compare deployment runtime, data privacy posture, operational caveats, and top open-source alternatives.`,
      canonicalPath,
      keywords: `${tool.name}, ${tool.name} alternatives, ${tool.name} review, ${tool.name} self hosted, ${tool.category} AI tools, Cipherati`,
      jsonLd,
      activeNav: "tools",
      breadcrumbs: [
        { name: "AI Tools", url: "/ai-tools.html" },
        { name: tool.category, url: `/ai-tools.html#tools/${encodeURIComponent(tool.category)}` },
        { name: tool.name }
      ],
      mainHtml
    });

    writeFileSync(`./public/${canonicalPath}`, htmlOut, "utf8");
    generatedUrls.push({ loc: `${SITE_URL}${canonicalPath}`, lastmod: toolLastmod });
  }

  // 2. Generate 50+ Head-to-Head Comparison Pages (/compare/[a]-vs-[b].html)
  for (const pair of comparisonPairs) {
    const { a, b, compSlug, category } = pair;
    const canonicalPath = `compare/${compSlug}.html`;
    const evalA = deriveToolEvaluation(a);
    const evalB = deriveToolEvaluation(b);
    const sigA = formatSignalText(a.signals);
    const sigB = formatSignalText(b.signals);
    const slugA = toolSlugMap.get(a.name);
    const slugB = toolSlugMap.get(b.name);

    const faqItems = [
      {
        q: `What is the main difference between ${a.name} and ${b.name}?`,
        a: `${a.name} focuses on: "${a.tagline}" (${evalA.deploymentModel}). ${b.name} focuses on: "${b.tagline}" (${evalB.deploymentModel}). Both operate in the ${category} stack.`
      },
      {
        q: `Which is better for local or self-hosted privacy: ${a.name} or ${b.name}?`,
        a: `${a.name}: ${evalA.dataPosture} | ${b.name}: ${evalB.dataPosture}`
      }
    ];

    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        orgNode,
        {
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Cipherati", "item": SITE_URL },
            { "@type": "ListItem", "position": 2, "name": "AI Tools Directory", "item": `${SITE_URL}ai-tools.html` },
            { "@type": "ListItem", "position": 3, "name": `${a.name} vs ${b.name}`, "item": `${SITE_URL}${canonicalPath}` }
          ]
        },
        {
          "@type": "FAQPage",
          "mainEntity": faqItems.map((f) => ({
            "@type": "Question",
            "name": f.q,
            "acceptedAnswer": { "@type": "Answer", "text": f.a }
          }))
        }
      ]
    };

    const mainHtml = `
      <article class="hero-card">
        <span class="kicker">${esc(category)} · Head-to-Head Architecture Comparison</span>
        <h1>${esc(a.name)} vs ${esc(b.name)}: Runtime, Privacy &amp; Engineering Trade-offs</h1>
        <p class="subtitle">Side-by-side technical evaluation comparing <strong>${esc(a.name)}</strong> and <strong>${esc(b.name)}</strong> across deployment architecture, licensing, data privacy posture, and production caveats.</p>
        <div class="cta-row">
          <a href="/tools/${esc(slugA)}.html" class="btn-primary">Inspect ${esc(a.name)} Spec →</a>
          <a href="/tools/${esc(slugB)}.html" class="btn-secondary">Inspect ${esc(b.name)} Spec →</a>
        </div>
      </article>

      <section class="panel">
        <h2>📊 Side-by-Side Technical Matrix</h2>
        <table class="spec-table">
          <thead>
            <tr>
              <th>Dimension</th>
              <th><a href="/tools/${esc(slugA)}.html">${esc(a.name)}</a></th>
              <th><a href="/tools/${esc(slugB)}.html">${esc(b.name)}</a></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Core Function</th>
              <td>${esc(a.tagline)}</td>
              <td>${esc(b.tagline)}</td>
            </tr>
            <tr>
              <th>Deployment &amp; Runtime</th>
              <td>${esc(evalA.deploymentModel)}</td>
              <td>${esc(evalB.deploymentModel)}</td>
            </tr>
            <tr>
              <th>License &amp; Access</th>
              <td>${esc(evalA.licenseModel)}</td>
              <td>${esc(evalB.licenseModel)}</td>
            </tr>
            <tr>
              <th>Data &amp; Privacy Posture</th>
              <td>${esc(evalA.dataPosture)}</td>
              <td>${esc(evalB.dataPosture)}</td>
            </tr>
            <tr>
              <th>Community Popularity</th>
              <td>${esc(sigA)}</td>
              <td>${esc(sigB)}</td>
            </tr>
            <tr>
              <th>Operational Caveat</th>
              <td>${esc(evalA.tradeoff)}</td>
              <td>${esc(evalB.tradeoff)}</td>
            </tr>
            <tr>
              <th>Official Source</th>
              <td><a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">${esc(a.url)} ↗</a></td>
              <td><a href="${esc(b.url)}" target="_blank" rel="noopener noreferrer">${esc(b.url)} ↗</a></td>
            </tr>
          </tbody>
        </table>
      </section>

      <div class="grid-2">
        <section class="panel" style="margin-bottom:0;">
          <h2>✅ When to Choose ${esc(a.name)}</h2>
          <p style="font-size:14px;color:var(--text-secondary);">${esc(a.tagline)} ${esc( a.why_it_matters || evalA.useWhen )}</p>
          <a href="/tools/${esc(slugA)}.html" style="font-weight:700;font-size:13.5px;">Full ${esc(a.name)} Evaluation →</a>
        </section>
        <section class="panel" style="margin-bottom:0;">
          <h2>✅ When to Choose ${esc(b.name)}</h2>
          <p style="font-size:14px;color:var(--text-secondary);">${esc(b.tagline)} ${esc( b.why_it_matters || evalB.useWhen )}</p>
          <a href="/tools/${esc(slugB)}.html" style="font-weight:700;font-size:13.5px;">Full ${esc(b.name)} Evaluation →</a>
        </section>
      </div>

      <section class="panel" style="margin-top:22px;">
        <h2>❓ Frequently Asked Questions</h2>
        ${faqItems
          .map(
            (f) => `<div class="faq-item">
          <h3 class="faq-q">${esc(f.q)}</h3>
          <p class="faq-a">${esc(f.a)}</p>
        </div>`
          )
          .join("")}
      </section>
    `;

    const htmlOut = renderPageShell({
      title: `${a.name} vs ${b.name} (2026) — Architecture, Privacy & Self-Hosting Comparison | Cipherati`,
      description: `Compare ${a.name} vs ${b.name} side-by-side: deployment runtime, open-source licensing, data privacy posture, and production engineering trade-offs in ${category}.`,
      canonicalPath,
      keywords: `${a.name} vs ${b.name}, ${b.name} vs ${a.name}, ${a.name} alternative, ${b.name} alternative, ${category}`,
      jsonLd,
      activeNav: "tools",
      breadcrumbs: [
        { name: "AI Tools", url: "/ai-tools.html" },
        { name: `${a.name} vs ${b.name}` }
      ],
      mainHtml
    });

    writeFileSync(`./public/${canonicalPath}`, htmlOut, "utf8");
    generatedUrls.push({
      loc: `${SITE_URL}${canonicalPath}`,
      lastmod: stamp(`${SITE_URL}${canonicalPath}`, {
        a: [a.name, a.tagline, a.url], b: [b.name, b.tagline, b.url], c: category
      })
    });
  }

  // 3. Generate 19+ Citizen Scam Defense Playbook Pages (/scams/[slug].html)
  for (const scam of scams) {
    const slug = scamSlugMap.get(scam.id || scam.title);
    const canonicalPath = `scams/${slug}.html`;
    const otherScams = scams.filter((s) => (s.id || s.title) !== (scam.id || scam.title)).slice(0, 6);
    // Contextual links from each scam playbook to the relevant in-depth defense guides.
    const scamText = `${scam.title} ${scam.tag} ${scam.scam} ${scam.protection}`;
    const relatedGuides = guides.filter((g) => {
      if (g.slug === "digital-arrest-scam-india") return /digital arrest/i.test(scamText);
      if (g.slug === "upi-fraud-what-to-do") return /\bupi\b/i.test(scamText);
      return true; // reporting guide applies to every suspicious call/SMS/WhatsApp scam
    });

    const faqItems = [
      {
        q: `How does "${scam.title}" (${scam.tag}) work?`,
        a: `Vector (${scam.platform}): ${scam.scam}`
      },
      {
        q: `How do I protect myself from "${scam.title}"?`,
        a: `${scam.protection} Official advisory source: ${scam.sourceName}.`
      },
      {
        q: `What should I do if I already lost money or clicked a suspicious link in India?`,
        a: `Immediately dial the National Cyber Crime Helpline 1930 (Toll-Free) within the Golden Hour (first 2 hours) to trigger an inter-bank freeze on the scammer's mule account, and file a formal complaint at https://cybercrime.gov.in/.`
      }
    ];

    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        orgNode,
        {
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Cipherati", "item": SITE_URL },
            { "@type": "ListItem", "position": 2, "name": "Scam Alerts (1930)", "item": `${SITE_URL}scam-alerts.html` },
            { "@type": "ListItem", "position": 3, "name": scam.title, "item": `${SITE_URL}${canonicalPath}` }
          ]
        },
        {
          "@type": "HowTo",
          "name": `How to Spot and Defend Against ${scam.title} (${scam.tag})`,
          "description": scam.protection,
          "step": [
            { "@type": "HowToStep", "position": 1, "name": "Identify the Modus Operandi", "text": scam.scam },
            { "@type": "HowToStep", "position": 2, "name": "Apply the Citizen Defense Rule", "text": scam.protection },
            { "@type": "HowToStep", "position": 3, "name": "Emergency 1930 Golden Hour Reporting", "text": "If money was debited or an APK was installed, disconnect from the internet, call 1930 immediately, and report at https://cybercrime.gov.in/." }
          ]
        },
        {
          "@type": "FAQPage",
          "mainEntity": faqItems.map((f) => ({
            "@type": "Question",
            "name": f.q,
            "acceptedAnswer": { "@type": "Answer", "text": f.a }
          }))
        }
      ]
    };

    const mainHtml = `
      <article class="hero-card">
        <span class="kicker">🚨 Citizen Scam Defense Playbook · ${esc(scam.platform)}</span>
        <h1>${esc(scam.title)} (${esc(scam.tag)}) — Modus Operandi &amp; 1930 Protection Guide</h1>
        <p class="subtitle">Statutory citizen cyber defense advisory based on <strong>${esc(scam.sourceName)}</strong> guidelines.</p>
        <div class="meta-pills">
          <span class="pill">📱 Attack Vector: ${esc(scam.platform)}</span>
          <span class="pill">🏷️ Pattern: ${esc(scam.tag)}</span>
          <span class="pill">🏛️ Source: ${esc(scam.sourceName)}</span>
        </div>
        <div class="cta-row">
          <a href="${esc(scam.actionUrl || scam.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="btn-primary">${esc(scam.actionLinkText || "Verify Official Government Portal ↗")}</a>
          <a href="/scam-alerts.html" class="btn-secondary">← View All ${scams.length} Scam Alerts</a>
        </div>
      </article>

      <section class="panel">
        <h2>🕵️ How the Scam Works (Modus Operandi)</h2>
        <div class="alert-box alert-red">
          <strong>⚠️ The Trap (${esc(scam.platform)}):</strong> ${esc(scam.scam)}
        </div>
        <h2>🛡️ Mandatory Defense Rule</h2>
        <div class="alert-box alert-green">
          <strong>✅ How to Protect Yourself &amp; Your Family:</strong> ${esc(scam.protection)}
        </div>
      </section>

      ${
        scam.playbook
          ? `
      <section class="panel">
        <h2>1. Scam Overview</h2>
        <p style="font-size:14.5px;color:var(--text-secondary);line-height:1.75;margin:0;">${esc(scam.playbook.overview)}</p>
      </section>

      <section class="panel">
        <h2>2. The Initial Contact <span class="pill" style="margin-left:8px;vertical-align:middle;">Simulated Educational Example</span></h2>
        <p style="font-size:13px;color:var(--text-muted);margin:0 0 10px;"><strong>Channel:</strong> ${esc(scam.playbook.initialContact.channel)} · <em>Note: The message below is a simulated educational example showing typical wording used by fraudsters.</em></p>
        <div style="background:var(--surface-2);border:1px solid var(--border);border-left:4px solid var(--accent);border-radius:10px;padding:14px 16px;font-family:var(--mono, ui-monospace, monospace);font-size:13.5px;color:var(--text);line-height:1.65;white-space:pre-wrap;">${esc(scam.playbook.initialContact.message)}</div>
      </section>

      <section class="panel">
        <h2>3. How the Scam Works (Step-by-Step)</h2>
        <ol style="font-size:14.5px;color:var(--text-secondary);padding-left:20px;line-height:1.8;margin:0;">
          ${scam.playbook.howItWorks.map((step) => `<li style="margin-bottom:8px;">${esc(step)}</li>`).join("")}
        </ol>
      </section>

      <section class="panel">
        <h2>4. What the Victim Sees <span class="pill" style="margin-left:8px;vertical-align:middle;">Simulated Screen — Educational Example</span></h2>
        <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:12px;padding:16px;">
          <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-bottom:8px;">${esc(scam.playbook.whatVictimSees.screenTitle)}</div>
          <div style="background:var(--surface);border:1px dashed var(--border);border-radius:8px;padding:14px;font-size:13.5px;color:var(--text);line-height:1.65;white-space:pre-wrap;">${esc(scam.playbook.whatVictimSees.screenBody)}</div>
          ${scam.playbook.whatVictimSees.caption ? `<p style="font-size:12.5px;color:var(--text-muted);margin:10px 0 0;">${esc(scam.playbook.whatVictimSees.caption)}</p>` : ""}
        </div>
      </section>

      <section class="panel">
        <h2>5. The Psychology Behind It</h2>
        <p style="font-size:14.5px;color:var(--text-secondary);line-height:1.75;margin:0;">${esc(scam.playbook.psychology)}</p>
      </section>

      <section class="panel">
        <h2>6. Red Flags to Spot Immediately</h2>
        <ul style="font-size:14.5px;color:var(--text-secondary);padding-left:20px;line-height:1.8;margin:0;">
          ${scam.playbook.redFlags.map((flag) => `<li style="margin-bottom:6px;">${esc(flag)}</li>`).join("")}
        </ul>
      </section>

      <section class="panel">
        <h2>7. What Happens If the Victim Falls for It</h2>
        <ul style="font-size:14.5px;color:var(--text-secondary);padding-left:20px;line-height:1.8;margin:0;">
          ${scam.playbook.consequences.map((c) => `<li style="margin-bottom:6px;">${esc(c)}</li>`).join("")}
        </ul>
      </section>

      <section class="panel">
        <h2>8. How to Protect Yourself</h2>
        <ul style="font-size:14.5px;color:var(--text-secondary);padding-left:20px;line-height:1.8;margin:0;">
          ${scam.playbook.prevention.map((p) => `<li style="margin-bottom:6px;">${esc(p)}</li>`).join("")}
        </ul>
      </section>

      <section class="panel">
        <h2>9. What to Do If Already Scammed</h2>
        <ol style="font-size:14.5px;color:var(--text-secondary);padding-left:20px;line-height:1.8;margin:0;">
          ${scam.playbook.immediateAction.map((a) => `<li style="margin-bottom:8px;">${esc(a)}</li>`).join("")}
        </ol>
      </section>

      <section class="panel">
        <h2>10. India-Specific Reporting Channels</h2>
        <ul style="font-size:14.5px;color:var(--text-secondary);padding-left:20px;line-height:1.8;margin:0;">
          ${scam.playbook.reportingChannels.map((ch) => `<li style="margin-bottom:6px;"><strong>${esc(ch.name)}:</strong> ${esc(ch.detail)}${ch.url ? ` (<a href="${esc(ch.url)}" target="_blank" rel="noopener noreferrer">${esc(ch.url)}</a>)` : ""}</li>`).join("")}
        </ul>
      </section>
      `
          : ""
      }

      <section class="panel">
        <h2>🚨 Emergency 4-Step Golden Hour Protocol (If Targeted)</h2>
        <ol style="font-size:14.5px;color:var(--text-secondary);padding-left:20px;line-height:1.75;">
          <li><strong>Dial 1930 Immediately (Golden Hour):</strong> Call the toll-free National Cyber Crime Helpline <strong>1930</strong> within 2 hours of an unauthorized UPI/bank transfer to freeze the funds in the recipient mule account before ATM withdrawal.</li>
          <li><strong>Disconnect Device if an APK Was Installed:</strong> If a file ending in <code>.apk</code> (e.g. e-Challan, Wedding Invite, KYC app) was installed, turn on Airplane Mode immediately to stop SMS OTP forwarding, then uninstall the malicious package.</li>
          <li><strong>Preserve Uncropped Digital Evidence:</strong> Save screenshots of the 12-digit UPI UTR number, bank SMS alerts, WhatsApp/Telegram caller numbers, and chat logs.</li>
          <li><strong>File Formal e-FIR &amp; Notify Bank:</strong> Submit a complaint at <a href="https://cybercrime.gov.in/" target="_blank" rel="noopener noreferrer">cybercrime.gov.in</a> and hand the 14-digit acknowledgement receipt to your home bank branch within 24 hours.</li>
        </ol>
      </section>

      <section class="panel">
        <h2>❓ Frequently Asked Questions</h2>
        ${faqItems
          .map(
            (f) => `<div class="faq-item">
          <h3 class="faq-q">${esc(f.q)}</h3>
          <p class="faq-a">${esc(f.a)}</p>
        </div>`
          )
          .join("")}
      </section>

      ${
        relatedGuides.length
          ? `<section class="panel">
        <h2>📘 In-Depth Defense Guides</h2>
        <div class="alt-list">
          ${relatedGuides
            .map(
              (g) => `<a href="${esc(g.path)}" class="alt-card" style="text-decoration:none;">
            <strong style="color:var(--text);font-size:14.5px;">${esc(g.title)}</strong>
            <span style="font-size:12.5px;color:var(--text-muted);">${esc(g.excerpt)}</span>
            <span style="font-size:12.5px;color:var(--accent);font-weight:700;">Read the guide →</span>
          </a>`
            )
            .join("")}
        </div>
      </section>`
          : ""
      }

      <section class="panel">
        <h2>🔍 Other Active Citizen Scam Playbooks</h2>
        <div class="alt-list">
          ${otherScams
            .map(
              (os) => `<a href="/scams/${esc(scamSlugMap.get(os.id || os.title))}.html" class="alt-card" style="text-decoration:none;">
            <strong style="color:var(--text);font-size:14.5px;">${esc(os.title)}</strong>
            <span style="font-size:12.5px;color:var(--text-muted);">${esc(os.platform)} · ${esc(os.tag)}</span>
            <span style="font-size:12.5px;color:var(--accent);font-weight:700;">Read Defense Rule →</span>
          </a>`
            )
            .join("")}
        </div>
      </section>
    `;

    const htmlOut = renderPageShell({
      title: `${scam.title} (${scam.tag}) — How to Spot & Report (1930 Helpline) | Cipherati`,
      description: `How to spot and protect yourself from ${scam.title} (${scam.platform}): ${scam.protection} Emergency 1930 helpline protocol and ${scam.sourceName} guidelines.`,
      canonicalPath,
      keywords: `${scam.title}, ${scam.tag}, ${scam.platform} scam India, 1930 cyber helpline, cybercrime.gov.in, ${scam.sourceName}`,
      jsonLd,
      activeNav: "scams",
      breadcrumbs: [
        { name: "Scam Alerts (1930)", url: "/scam-alerts.html" },
        { name: scam.title }
      ],
      mainHtml
    });

    writeFileSync(`./public/${canonicalPath}`, htmlOut, "utf8");
    generatedUrls.push({
      loc: `${SITE_URL}${canonicalPath}`,
      lastmod: stamp(`${SITE_URL}${canonicalPath}`, {
        id: scam.id, t: scam.title, s: scam.scam, p: scam.protection, pl: scam.platform, src: scam.sourceName, g: relatedGuides.map((g) => g.slug)
      })
    });
  }

  // 4. Generate 22+ AI Production Reality Pages (/realities/[slug].html)
  for (const reality of realities) {
    const slug = realitySlugMap.get(reality.id);
    const canonicalPath = `realities/${slug}.html`;
    const otherRealities = realities.filter((r) => r.id !== reality.id).slice(0, 6);

    const faqItems = [
      {
        q: `Why does "${reality.title}" happen in production AI systems?`,
        a: reality.reality
      },
      {
        q: `How do you fix "${reality.title}" architecturally?`,
        a: `${reality.fix} Reference open-source stack: ${(reality.tools || []).map((t) => t.name).join(", ")}.`
      },
      {
        q: `What is the business impact of ignoring "${reality.title}"?`,
        a: reality.impact
      }
    ];

    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        orgNode,
        {
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Cipherati", "item": SITE_URL },
            { "@type": "ListItem", "position": 2, "name": "22 AI Realities", "item": `${SITE_URL}ai-realities.html` },
            { "@type": "ListItem", "position": 3, "name": `Reality #${reality.id}: ${reality.title}`, "item": `${SITE_URL}${canonicalPath}` }
          ]
        },
        {
          "@type": "TechArticle",
          "headline": `AI Production Reality #${reality.id}: ${reality.title}`,
          "description": `${reality.reality} Architectural Fix: ${reality.fix}`,
          "author": orgNode,
          "publisher": orgNode,
          "dateModified": stamp(`${SITE_URL}${canonicalPath}`, {
          id: reality.id, t: reality.title, m: reality.myth, r: reality.reality, f: reality.fix, i: reality.impact
        }),
          "mainEntityOfPage": `${SITE_URL}${canonicalPath}`
        },
        {
          "@type": "FAQPage",
          "mainEntity": faqItems.map((f) => ({
            "@type": "Question",
            "name": f.q,
            "acceptedAnswer": { "@type": "Answer", "text": f.a }
          }))
        }
      ]
    };

    const mainHtml = `
      <article class="hero-card">
        <span class="kicker">⚡ AI Production Reality #${esc(reality.id)} · ${esc(reality.category)}</span>
        <h1>${esc(reality.title)} — Production Failure Mode &amp; Architectural Fix</h1>
        <p class="subtitle">Symptoms in production: ${(reality.symptoms || []).map((s) => `<code>${esc(s)}</code>`).join(" · ")}</p>
        <div class="cta-row">
          <a href="/ai-realities.html" class="btn-secondary">← View All ${realities.length} Production AI Realities</a>
        </div>
      </article>

      <section class="panel">
        <h2>❌ The Vendor Hype Myth</h2>
        <div class="alert-box alert-amber">
          "${esc(reality.myth)}"
        </div>

        <h2>💥 What Actually Breaks in Production</h2>
        <div class="alert-box alert-red">
          ${esc(reality.reality)}
        </div>

        <h2>✅ What Works Instead (The Architectural Fix)</h2>
        <div class="alert-box alert-green">
          ${esc(reality.fix)}
        </div>

        <h2>📉 Quantified Business &amp; Security Impact</h2>
        <p style="font-size:14.5px;color:var(--text-secondary);margin:0;">${esc(reality.impact)}</p>
      </section>

      <section class="panel">
        <h2>🧰 Reference Open-Source Engineering Stack</h2>
        <div class="alt-list">
          ${(reality.tools || [])
            .map((rt) => {
              const matchedTool = tools.find((t) => t.name.toLowerCase() === rt.name.toLowerCase());
              const tSlug = matchedTool ? toolSlugMap.get(matchedTool.name) : null;
              return `<div class="alt-card">
                <div>
                  <h3 style="margin:0 0 6px;font-size:15.5px;">
                    ${tSlug ? `<a href="/tools/${esc(tSlug)}.html">${esc(rt.name)}</a>` : `<a href="${esc(rt.url)}" target="_blank" rel="noopener noreferrer">${esc(rt.name)} ↗</a>`}
                  </h3>
                  <p style="margin:0;font-size:13px;color:var(--text-secondary);">
                    ${esc(matchedTool ? matchedTool.tagline : "Reference engineering tool for this production reality.")}
                  </p>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;border-top:1px solid var(--line);font-size:12.5px;">
                  ${tSlug ? `<a href="/tools/${esc(tSlug)}.html" style="font-weight:700;">Engineering Evaluation →</a>` : `<span></span>`}
                  <a href="${esc(rt.url)}" target="_blank" rel="noopener noreferrer" style="color:var(--text-muted);">Official Repo ↗</a>
                </div>
              </div>`;
            })
            .join("")}
        </div>
      </section>

      <section class="panel">
        <h2>❓ Frequently Asked Questions</h2>
        ${faqItems
          .map(
            (f) => `<div class="faq-item">
          <h3 class="faq-q">${esc(f.q)}</h3>
          <p class="faq-a">${esc(f.a)}</p>
        </div>`
          )
          .join("")}
      </section>

      <section class="panel">
        <h2>⚡ Related Production AI Realities</h2>
        <div class="alt-list">
          ${otherRealities
            .map(
              (or) => `<a href="/realities/${esc(realitySlugMap.get(or.id))}.html" class="alt-card" style="text-decoration:none;">
            <span class="kicker" style="margin-bottom:4px;">Reality #${esc(or.id)} · ${esc(or.category)}</span>
            <strong style="color:var(--text);font-size:14.5px;">${esc(or.title)}</strong>
            <span style="font-size:12.5px;color:var(--accent);font-weight:700;">Inspect Architectural Fix →</span>
          </a>`
            )
            .join("")}
        </div>
      </section>
    `;

    const htmlOut = renderPageShell({
      title: `Reality #${reality.id}: ${reality.title} — Production AI Fix & Stack | Cipherati`,
      description: `Why "${reality.title}" breaks in production AI: ${reality.reality} Architectural fix: ${reality.fix}`,
      canonicalPath,
      keywords: `${reality.title}, ${(reality.symptoms || []).join(", ")}, production AI post-mortem, LLM architecture, Cipherati`,
      jsonLd,
      activeNav: "realities",
      breadcrumbs: [
        { name: "22 AI Realities", url: "/ai-realities.html" },
        { name: `Reality #${reality.id}: ${reality.title}` }
      ],
      mainHtml
    });

    writeFileSync(`./public/${canonicalPath}`, htmlOut, "utf8");
    generatedUrls.push({
      loc: `${SITE_URL}${canonicalPath}`,
      lastmod: stamp(`${SITE_URL}${canonicalPath}`, {
        id: reality.id, t: reality.title, m: reality.myth, r: reality.reality, f: reality.fix, i: reality.impact
      })
    });
  }

  return {
    generatedUrls,
    counts: {
      tools: tools.length,
      comparisons: comparisonPairs.length,
      scams: scams.length,
      realities: realities.length,
      total: generatedUrls.length
    },
    toolSlugMap,
    scamSlugMap,
    realitySlugMap,
    comparisonPairs
  };
}
