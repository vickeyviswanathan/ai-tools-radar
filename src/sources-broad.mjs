// Multi-Tier Topic Scraper for GitHub
// Covers Developer Tools, Agents, MCP, LLM Infrastructure, Optimization, Reverse-Engineering
import { config, userAgent } from "./config.mjs";
import { isBlocked, isListLike, cleanUrl } from "./classify.mjs";

const GITHUB_TOPIC_QUERIES = [
  "topic:mcp created:>2026-08-01 stars:>25",
  "topic:ai-agents created:>2026-08-01 stars:>40",
  "topic:llm-tool created:>2026-08-01 stars:>30",
  "topic:reverse-engineering ai created:>2026-05-01 stars:>40",
  "topic:browser-automation ai created:>2026-05-01 stars:>30",
  "topic:token-optimization OR topic:context-window stars:>20",
  "topic:vllm OR topic:ollama OR topic:local-ai stars:>50",
  "topic:ai-coding OR topic:coding-agent stars:>40"
];

async function fetchGitHubQuery(q) {
  const headers = config.githubToken ? { Authorization: `token ${config.githubToken}` } : {};
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=15`;
  
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": userAgent(),
        Accept: "application/json",
        ...headers
      }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

export async function fetchGitHubBroad() {
  const allRepos = [];
  const seen = new Set();

  for (const q of GITHUB_TOPIC_QUERIES) {
    const items = await fetchGitHubQuery(q);
    for (const repo of items) {
      if (seen.has(repo.full_name)) continue;
      seen.add(repo.full_name);

      const text = `${repo.name} ${repo.description || ""} ${(repo.topics || []).join(" ")}`;
      if (isBlocked(text) || isListLike(text)) continue;

      allRepos.push({
        source: "github",
        sourceId: repo.full_name,
        sourceUrl: repo.html_url,
        name: repo.name.replace(/[-_]/g, " "),
        tagline: repo.description || "High-utility open-source AI infrastructure",
        url: cleanUrl(repo.homepage) || repo.html_url,
        metric: Number(repo.stargazers_count || 0),
        launchedAt: Math.floor(new Date(repo.created_at).getTime() / 1000),
        tags: repo.topics || [],
        extra: { stars: repo.stargazers_count, forks: repo.forks_count, repo: repo.full_name }
      });
    }
  }

  return allRepos;
}
