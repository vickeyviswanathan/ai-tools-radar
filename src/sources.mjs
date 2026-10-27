// Source adapters: Hacker News (Algolia API), GitHub Search API, Hugging Face Spaces API.
import { config, userAgent } from "./config.mjs";
import { isAiRelated, isBlocked, isListLike, cleanUrl } from "./classify.mjs";

const fetchJson = async (url, headers = {}) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": userAgent(),
        Accept: "application/json",
        ...headers,
      },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
};

/**
 * 1. Hacker News "Show HN" launches via Algolia API (Free, no auth required)
 */
export async function fetchHackerNews() {
  const since = Math.floor(Date.now() / 1000) - 7 * 86400; // last 7 days
  const url = `https://hn.algolia.com/api/v1/search_by_date?tags=show_hn&numericFilters=created_at_i>${since}&hitsPerPage=50`;
  const data = await fetchJson(url);
  const items = [];

  for (const hit of data.hits || []) {
    const title = (hit.title || "").replace(/^Show HN:\s*/i, "").trim();
    const targetUrl = cleanUrl(hit.url) || `https://news.ycombinator.com/item?id=${hit.objectID}`;
    const textBlob = `${title} ${hit.story_text || ""}`;

    if (!isAiRelated(textBlob) || isBlocked(textBlob)) continue;

    items.push({
      source: "hn",
      sourceId: String(hit.objectID),
      sourceUrl: `https://news.ycombinator.com/item?id=${hit.objectID}`,
      name: title.split(/[-–—:|]/)[0].trim(),
      tagline: title,
      url: targetUrl,
      metric: Number(hit.points || 0),
      comments: Number(hit.num_comments || 0),
      launchedAt: hit.created_at_i,
      extra: { points: hit.points, comments: hit.num_comments },
    });
  }
  return items;
}

/**
 * 2. GitHub Trending & New AI Repos (Free GitHub Search API)
 */
export async function fetchGitHub() {
  const d = new Date(Date.now() - 14 * 86400e3).toISOString().slice(0, 10);
  const q = encodeURIComponent(`topic:ai created:>${d} stars:>15`);
  const headers = config.githubToken ? { Authorization: `token ${config.githubToken}` } : {};
  const url = `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=40`;

  let data;
  try {
    data = await fetchJson(url, headers);
  } catch (err) {
    console.warn("GitHub fetch error or rate limit:", err.message);
    return [];
  }

  const items = [];
  for (const repo of data.items || []) {
    const text = `${repo.name} ${repo.description || ""} ${(repo.topics || []).join(" ")}`;
    if (isBlocked(text) || isListLike(text)) continue;

    items.push({
      source: "github",
      sourceId: repo.full_name,
      sourceUrl: repo.html_url,
      name: repo.name.replace(/[-_]/g, " "),
      tagline: repo.description || "Open-source AI tool / repository",
      url: cleanUrl(repo.homepage) || repo.html_url,
      metric: Number(repo.stargazers_count || 0),
      launchedAt: Math.floor(new Date(repo.created_at).getTime() / 1000),
      tags: repo.topics || [],
      extra: { stars: repo.stargazers_count, forks: repo.forks_count, repo: repo.full_name },
    });
  }
  return items;
}

/**
 * 3. Hugging Face Trending Spaces (Free HF API)
 */
export async function fetchHuggingFace() {
  const url = `https://huggingface.co/api/spaces?sort=trendingScore&direction=-1&limit=40&full=true`;
  const list = await fetchJson(url);
  const items = [];

  for (const s of list || []) {
    const title = s.cardData?.title || s.id.split("/")[1] || s.id;
    const desc = s.cardData?.short_description || "";
    const text = `${title} ${desc} ${(s.tags || []).join(" ")}`;
    if (isBlocked(text)) continue;

    items.push({
      source: "huggingface",
      sourceId: s.id,
      sourceUrl: `https://huggingface.co/spaces/${s.id}`,
      name: title,
      tagline: desc || `Interactive AI space by ${s.id.split("/")[0]}`,
      url: `https://huggingface.co/spaces/${s.id}`,
      emoji: s.cardData?.emoji || "🤗",
      metric: Number(s.likes || 0),
      launchedAt: s.createdAt ? Math.floor(new Date(s.createdAt).getTime() / 1000) : Math.floor(Date.now() / 1000) - 86400 * 3,
      extra: { trendingScore: s.trendingScore, likes: s.likes, sdk: s.sdk },
    });
  }
  return items;
}
