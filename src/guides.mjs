// Scam-defense guides: content/guides/<slug>.md (+ guides.json metadata) -> /scam-defense/<slug>/index.html
// Content is authored in the repo (the site is static GitHub Pages, there is no admin/CMS). Dates:
//   published  = guides.json (set once, when the guide first goes live)
//   modified   = lastmod ledger (moves only when the article text or metadata actually changes)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { markdownToHtml } from "./md.mjs";
import { renderPageShell } from "./programmatic-seo.mjs";

const SITE_URL = "https://cipherati.com/";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const DISCLAIMER =
  "This guide provides general safety information, not legal advice or a promise of recovery. Always confirm current procedures on the official websites linked above.";

const fmtDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function loadGuides(dir = "./content/guides") {
  const meta = JSON.parse(readFileSync(`${dir}/guides.json`, "utf8"));
  return meta.map((m) => {
    const md = readFileSync(`${dir}/${m.slug}.md`, "utf8").replace(/\r\n/g, "\n");
    const lines = md.split("\n");
    if (!lines[0].startsWith("# ")) throw new Error(`${m.slug}.md must start with an H1`);
    const title = lines[0].replace(/^#\s+/, "").trim();
    const body = lines.slice(1).join("\n").trim();
    // Unique official/external sources cited inside the article text, in order of appearance.
    const sources = [];
    for (const match of body.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)) {
      if (!sources.some((s) => s.url === match[2])) sources.push({ label: match[1], url: match[2] });
    }
    return { ...m, title, body, bodyHtml: markdownToHtml(body), sources, path: `/scam-defense/${m.slug}/`, url: `${SITE_URL}scam-defense/${m.slug}/` };
  });
}

export function generateGuidePages(guides, { ledger, buildDate }) {
  const generated = [];
  for (const g of guides) {
    const modified = (() => {
      const stamped = ledger ? ledger.stamp(g.url, { t: g.title, st: g.seoTitle, d: g.description, b: g.body }) : buildDate;
      return stamped > g.published ? stamped : g.published; // never earlier than the publish date
    })();
    const others = guides.filter((o) => o.slug !== g.slug);

    const orgNode = { "@type": "Organization", "@id": `${SITE_URL}#organization`, "name": "Cipherati", "url": SITE_URL, "logo": `${SITE_URL}icons/icon-512.png` };
    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        orgNode,
        {
          "@type": "Article",
          "@id": `${g.url}#article`,
          "headline": g.title,
          "description": g.description,
          "datePublished": g.published,
          "dateModified": modified,
          "inLanguage": "en-IN",
          "mainEntityOfPage": g.url,
          "author": { "@type": "Organization", "name": "Cipherati", "url": SITE_URL },
          "publisher": { "@id": `${SITE_URL}#organization` },
          "image": `${SITE_URL}og-image.png`
        },
        {
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Cipherati", "item": SITE_URL },
            { "@type": "ListItem", "position": 2, "name": "Scam Alerts (1930)", "item": `${SITE_URL}scam-alerts.html` },
            { "@type": "ListItem", "position": 3, "name": g.title, "item": g.url }
          ]
        }
      ]
    };

    const mainHtml = `
      <article class="hero-card">
        <span class="kicker">Scam-Defense Guide · India</span>
        <h1>${esc(g.title)}</h1>
        <p class="subtitle">${esc(g.excerpt)}</p>
        <div class="guide-meta">
          <span>Published <time datetime="${g.published}">${fmtDate(g.published)}</time></span>
          <span>·</span>
          <span>Updated <time datetime="${modified}">${fmtDate(modified)}</time></span>
          <span>·</span>
          <span>By Cipherati</span>
        </div>
        <div class="cta-row">
          <a href="https://cybercrime.gov.in/" target="_blank" rel="noopener noreferrer" class="btn-primary">Report at cybercrime.gov.in ↗</a>
          <a href="tel:1930" class="btn-secondary">Call 1930</a>
          <a href="/scam-alerts.html" class="btn-secondary">← All scam alerts &amp; playbooks</a>
        </div>
      </article>

      <section class="panel prose">
        ${g.bodyHtml}
        <p class="guide-note">${esc(DISCLAIMER)}</p>
      </section>

      <section class="panel">
        <h2>Related guides</h2>
        <div class="alt-list">
          ${others
            .map(
              (o) => `<a href="${esc(o.path)}" class="alt-card" style="text-decoration:none;">
            <strong style="color:var(--text);font-size:15px;">${esc(o.title)}</strong>
            <span style="font-size:13px;color:var(--text-muted);">${esc(o.excerpt)}</span>
            <span style="font-size:13px;color:var(--accent);font-weight:700;">Read the guide →</span>
          </a>`
            )
            .join("")}
          <a href="/scam-alerts.html" class="alt-card" style="text-decoration:none;">
            <strong style="color:var(--text);font-size:15px;">Scam alerts and playbooks</strong>
            <span style="font-size:13px;color:var(--text-muted);">Browse every verified scam pattern with its defense rule and official source.</span>
            <span style="font-size:13px;color:var(--accent);font-weight:700;">Open the scam-alerts hub →</span>
          </a>
        </div>
      </section>

      <section class="panel">
        <h2>Official sources cited in this guide</h2>
        <ul class="source-list">
          ${g.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)}</a></li>`).join("\n          ")}
        </ul>
      </section>
    `;

    // Text-only social card generated by scripts/make-guide-og.mjs; falls back to the site card if it is missing.
    const ogFile = `public/og/guides/${g.slug}.png`;
    const image = existsSync(ogFile) ? `${SITE_URL}og/guides/${g.slug}.png` : `${SITE_URL}og-image.png`;
    jsonLd["@graph"][1].image = image;

    const html = renderPageShell({
      title: g.seoTitle,
      description: g.description,
      canonicalPath: `scam-defense/${g.slug}/`,
      keywords: `${g.primaryQuery}, scam India, 1930 helpline, cybercrime.gov.in, Cipherati`,
      jsonLd,
      image,
      activeNav: "scams",
      breadcrumbs: [{ name: "Scam Alerts (1930)", url: "/scam-alerts.html" }, { name: g.title }],
      mainHtml
    });

    mkdirSync(`./public/scam-defense/${g.slug}`, { recursive: true });
    writeFileSync(`./public/scam-defense/${g.slug}/index.html`, html, "utf8");
    generated.push({ loc: g.url, lastmod: modified });
  }
  return generated;
}
