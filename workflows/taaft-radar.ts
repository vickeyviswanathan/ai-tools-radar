import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { workflow, type LibrettoWorkflowContext } from "libretto";
import type { Locator } from "playwright";

/**
 * TAAFT Radar — pulls NEW and TRENDING AI tools from theresanaiforthat.com.
 *
 * How the site works (found while reverse engineering it):
 *  - The homepage is server-rendered. A single page load already contains
 *      #home-today-list  → the live "Today" feed (newest tools, mixed with news/videos)
 *      #home-tools-list  → the "Tools" listing, pre-filtered by URL params
 *  - `/?tab=tools&tools_view=trending&trending_period=day|week|month` makes the
 *    server render the Trending view directly — no clicks or XHR needed.
 *  - Cloudflare bot management watches the session: the first navigation is served,
 *    but follow-up navigations / `/api/*` calls from an automated browser get a
 *    Turnstile challenge. So we read everything from ONE page load and never navigate again.
 *
 * The trending period is picked with the TAAFT_PERIOD env var because Libretto's
 * `startUrl` is static per workflow file (input params can't change it).
 */
const PERIODS = ["day", "week", "month"] as const;
type Period = (typeof PERIODS)[number];
const envPeriod = (process.env.TAAFT_PERIOD ?? "week").toLowerCase();
const PERIOD: Period = (PERIODS as readonly string[]).includes(envPeriod) ? (envPeriod as Period) : "week";

const toolSchema = z.object({
  id: z.string(),
  name: z.string(),
  tagline: z.string().nullable(),
  url: z.string(),
  icon: z.string().nullable(),
  category: z.string().nullable(),
  price: z.string().nullable(),
  pricingModel: z.string().nullable(),
  views: z.string().nullable(),
  saves: z.number().nullable(),
  age: z.string().nullable(),
  releasedAt: z.string().nullable(),
  maker: z.string().nullable(),
  country: z.string().nullable(),
  version: z.string().nullable(),
  verified: z.boolean(),
  sponsored: z.boolean(),
});
type Tool = z.infer<typeof toolSchema>;

const inputSchema = z.object({
  // Keep sponsored ("Ad") rows that TAAFT injects into the Today feed.
  includeSponsored: z.boolean().optional(),
  // Where to write the JSON snapshot (relative to the project root).
  outDir: z.string().optional(),
});

const outputSchema = z.object({
  source: z.string(),
  fetchedAt: z.string(),
  period: z.enum(PERIODS),
  newTools: z.array(toolSchema),
  trendingTools: z.array(toolSchema),
});

// Read the first matching text without waiting (missing cells are normal).
async function textOf(scope: Locator, selector: string): Promise<string | null> {
  const values = await scope.locator(selector).allTextContents();
  const value = values[0]?.replace(/\s+/g, " ").trim();
  return value ? value : null;
}

// Read an attribute from the first match, or null when the element is absent.
async function attrOf(scope: Locator, selector: string, name: string): Promise<string | null> {
  const target = scope.locator(selector).first();
  if ((await target.count()) === 0) return null;
  return await target.getAttribute(name);
}

// Turn one TAAFT listing row (`.home-today-row[data-home-today-entity="ai"]`) into a Tool.
async function parseToolRow(row: Locator): Promise<Tool | null> {
  const name = await textOf(row, ".tools-name-text, .home-today-name-text");
  const url = (await row.getAttribute("data-tools-href")) ?? (await row.getAttribute("data-href"));
  if (!name || !url) return null;

  // Price pill: value + unit badge, and the pricing model is encoded in a modifier class.
  const priceValue = await textOf(row, ".tools-price-value");
  const priceUnit = await textOf(row, ".tools-price-unit-badge");
  const priceClass = (await attrOf(row, ".tools-price-info", "class")) ?? "";
  const pricingModel = priceClass.match(/tools-price-info--([a-z-]+)/)?.[1] ?? null;

  // Maker / company and its country flag pill.
  const maker =
    (await textOf(row, ".home-today-author-name-row strong")) ??
    (await textOf(row, ".home-today-author-cell .ytv-channel-wrap"));
  const country = await attrOf(row, ".home-today-country-flag-pill", "data-tooltip");

  // Engagement counters.
  const savesText = await textOf(row, ".tools-save-count-value");
  const views = await textOf(row, ".home-today-views-value");
  const age = await textOf(row, ".home-today-date-value");
  const icon = await attrOf(row, "img.home-today-image", "src");
  // Sponsored slots carry data-home-today-ad="1" and show "Ad" instead of an age.
  const sponsored = (await row.getAttribute("data-home-today-ad")) === "1" || age === "Ad";

  return {
    id: (await row.getAttribute("data-obj-id")) ?? url,
    name,
    tagline: await textOf(row, ".tools-name-tagline"),
    url: url.split("?")[0],
    icon: icon ? icon.replace(/\?width=\d+/, "?width=128") : null,
    category: await textOf(row, ".home-today-topic-link"),
    price: priceValue ? `${priceValue}${priceUnit ?? ""}` : null,
    pricingModel,
    views: views && views !== "—" ? views : null,
    saves: savesText && /^\d+$/.test(savesText) ? Number(savesText) : null,
    age: age === "Ad" ? null : age,
    releasedAt: await row.getAttribute("data-release-at"),
    maker,
    country,
    version: await textOf(row, ".tools-version-popover-title"),
    verified: (await row.getAttribute("data-home-today-ai-verified")) === "1",
    sponsored,
  };
}

const AI_ROW = '.home-today-row[data-home-today-entity="ai"]';

// Parse every AI-tool row inside a listing container, de-duplicated by id.
// The Today feed is "live updating" (the page re-renders rows while we read), so
// positional nth() locators go stale. Snapshot each row's stable key first, then
// address rows by that key and skip any that vanished in the meantime.
async function parseList(list: Locator): Promise<Tool[]> {
  const keys = await list
    .locator(AI_ROW)
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-home-today-key") ?? ""));
  const tools: Tool[] = [];
  const seen = new Set<string>();
  for (const key of new Set(keys.filter(Boolean))) {
    const row = list.locator(`${AI_ROW}[data-home-today-key="${key}"]`).first();
    if ((await row.count()) === 0) continue;
    // A row can be swapped out by the live feed between count() and the reads.
    const tool = await parseToolRow(row).catch((err: Error) => {
      console.warn("row-skipped", { key, reason: err.message.split("\n")[0] });
      return null;
    });
    if (!tool || seen.has(tool.id)) continue;
    seen.add(tool.id);
    tools.push(tool);
  }
  return tools;
}

export default workflow("taaftRadar", {
  input: inputSchema,
  output: outputSchema,
  // One cold load of the homepage with the Trending view pre-selected server-side.
  startUrl: `https://theresanaiforthat.com/?tab=tools&tools_view=trending&trending_period=${PERIOD}`,
  handler: async (ctx: LibrettoWorkflowContext, input) => {
    const { page } = ctx;
    console.log("taaft-radar-start", { period: PERIOD });

    // Fail clearly if Cloudflare served a challenge instead of the real page.
    const title = await page.title();
    if (/just a moment/i.test(title)) {
      throw new Error("Cloudflare challenge shown instead of TAAFT homepage. Retry later or run headed.");
    }

    // Wait for both server-rendered listings to contain tool rows. The Today list is
    // hidden while the Tools tab is active, so wait for rows to be attached, not visible.
    const todayList = page.locator("#home-today-list");
    const toolsList = page.locator("#home-tools-list");
    await todayList.locator('.home-today-row[data-home-today-entity="ai"]').first().waitFor({ state: "attached", timeout: 30_000 });
    await toolsList.locator(".tools-table-row").first().waitFor({ state: "attached", timeout: 30_000 });

    // Rows are already rendered; keep per-read timeouts short so a vanished row fails fast.
    page.setDefaultTimeout(3_000);

    // NEW = AI tools from the live "Today" feed (drop sponsored rows unless asked).
    const today = await parseList(todayList);
    const newTools = input.includeSponsored ? today : today.filter((t) => !t.sponsored);

    // TRENDING = the server-rendered Trending listing for the chosen period.
    const trendingTools = await parseList(toolsList);

    const result = {
      source: page.url(),
      fetchedAt: new Date().toISOString(),
      period: PERIOD,
      newTools,
      trendingTools,
    };

    // Persist a snapshot the UI can read: data/<period>.json
    const outDir = path.resolve(process.cwd(), input.outDir ?? "data");
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, `${PERIOD}.json`), JSON.stringify(result, null, 2), "utf8");

    console.log("taaft-radar-done", { period: PERIOD, newTools: newTools.length, trending: trendingTools.length });
    return result;
  },
});
