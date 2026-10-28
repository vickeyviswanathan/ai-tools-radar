// Multi-Tier Topic Scraper for GitHub
// Covers Developer Tools, Agents, MCP, LLM Infrastructure, Optimization, Reverse-Engineering
import { config, userAgent } from "./config.mjs";
import { isBlocked, isListLike, cleanUrl } from "./classify.mjs";

// NOTE: GitHub's search API rejects "topic:a OR topic:b" with HTTP 422, so each topic
// is queried on its own. [topic, minStars]
const GITHUB_TOPICS = [
  // Coding agents & harnesses
  ["claude-code", 100], ["ai-coding", 40], ["coding-agent", 40], ["codex", 100], ["agent-skills", 50],
  ["cursor", 100], ["vibe-coding", 50], ["ai-pair-programming", 50],
  // Agents, MCP & automation
  ["mcp", 100], ["model-context-protocol", 50], ["mcp-server", 100], ["ai-agents", 200], ["autonomous-agents", 100],
  ["multi-agent", 100], ["agentic-ai", 100], ["browser-automation", 100], ["llm-agents", 100],
  // Apps & tooling
  ["llm-tool", 50], ["llm-app", 50], ["llm", 1000], ["generative-ai", 500], ["prompt-engineering", 200],
  // Local models, inference, serving
  ["ollama", 100], ["local-ai", 100], ["vllm", 50], ["llama-cpp", 100], ["inference-engine", 50], ["sglang", 50],
  ["quantization", 100], ["fine-tuning", 100], ["lora", 100], ["unsloth", 50],
  // RAG, search, memory, parsing
  ["rag", 200], ["vector-database", 200], ["ai-memory", 50], ["document-parser", 50], ["pdf-parser", 50], ["ocr", 200],
  // Evals & observability
  ["llmops", 50], ["llm-evaluation", 50], ["ai-observability", 50],
  // Multimodal, image, audio, reasoning
  ["multimodal-ai", 50], ["vision-language-model", 50], ["vlm", 50], ["comfyui", 100], ["stable-diffusion", 500],
  ["text-to-speech", 100], ["speech-to-text", 100], ["deepseek", 100], ["reasoning-model", 50],
  // Security / RE / token cost
  ["reverse-engineering", 100], ["token-optimization", 20], ["context-engineering", 50],
];
const GITHUB_TOPIC_QUERIES = GITHUB_TOPICS.map(([t, s]) => `topic:${t} stars:>${s}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    if (!res.ok) {
      console.warn(`[GitHub] Query failed (${res.status}): ${q}`);
      if (res.status === 403 || res.status === 429) {
        // Secondary rate limit: back off once and retry
        await sleep(15000);
        const retry = await fetch(url, { headers: { "User-Agent": userAgent(), Accept: "application/json", ...headers } });
        if (retry.ok) return (await retry.json()).items || [];
      }
      return [];
    }
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
    await sleep(2200); // stay under GitHub's 30 searches/minute limit
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
