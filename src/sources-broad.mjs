// Multi-Tier Topic Scraper for GitHub
// Covers Developer Tools, Agents, MCP, LLM Infrastructure, Optimization, Reverse-Engineering
import { config, userAgent } from "./config.mjs";
import { isBlocked, isListLike, cleanUrl } from "./classify.mjs";

const GITHUB_TOPIC_QUERIES = [
  "topic:mcp OR topic:model-context-protocol stars:>20",
  "topic:ai-agents OR topic:autonomous-agents stars:>40",
  "topic:llm-tool OR topic:llm-app stars:>30",
  "topic:reverse-engineering ai stars:>40",
  "topic:browser-automation ai stars:>30",
  "topic:token-optimization OR topic:context-window stars:>20",
  "topic:vllm OR topic:ollama OR topic:local-ai stars:>50",
  "topic:ai-coding OR topic:coding-agent stars:>40",
  "topic:rag OR topic:vector-database stars:>80",
  "topic:comfyui OR topic:diffusion stars:>80",
  "topic:tts OR topic:speech-to-text stars:>50",
  "topic:deepseek OR topic:reasoning-model stars:>50",
  // Expanded queries for complete coverage:
  "topic:llmops OR topic:llm-evaluation OR topic:ai-observability stars:>40",
  "topic:inference-engine OR topic:sglang OR topic:quantization stars:>50",
  "topic:document-parser OR topic:pdf-parser OR topic:ocr ai stars:>40",
  "topic:multimodal-ai OR topic:vision-language-model OR topic:vlm stars:>40",
  "topic:fine-tuning OR topic:lora OR topic:unsloth stars:>50"
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

  // Global 30-day AI fast-risers query (catches any rapid-growth AI tool regardless of sub-topic tags)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10);
  const globalFastRisers = await fetchGitHubQuery(`topic:ai created:>${thirtyDaysAgo} stars:>100`);
  for (const repo of globalFastRisers) {
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

  return allRepos;
}
