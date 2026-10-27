// Automated Non-English/Chinese Detection and English Translation Module
const CHINESE_REGEX = /[\u4e00-\u9fa5]/;

export function containsChinese(text) {
  if (!text) return false;
  return CHINESE_REGEX.test(text);
}

export async function translateToEnglish(text) {
  if (!text || !containsChinese(text)) return text;

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 350))}&langpair=zh|en`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);

    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (data.responseData && data.responseData.translatedText) {
        let clean = data.responseData.translatedText.trim();
        clean = clean.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
        // Verify it actually translated away from Chinese characters
        if (clean && !containsChinese(clean)) {
          return clean;
        }
      }
    }
  } catch (err) {
    console.warn("[Translate Warning]", err.message);
  }

  return text;
}

// Translate all existing rows stored in SQLite
export async function translateDatabase(db) {
  const rows = db.prepare(`SELECT id, name, tagline FROM items WHERE name GLOB '*[一-鿿]*' OR tagline GLOB '*[一-鿿]*'`).all();
  console.log(`[Translate] Found ${rows.length} stored rows containing Chinese characters.`);

  const update = db.prepare(`UPDATE items SET name = ?, tagline = ? WHERE id = ?`);

  for (const r of rows) {
    let name = r.name;
    let tagline = r.tagline;

    if (containsChinese(name)) {
      name = await translateToEnglish(name);
    }
    if (containsChinese(tagline)) {
      tagline = await translateToEnglish(tagline);
    }

    update.run(name, tagline, r.id);
  }

  console.log(`[Translate] Completed translating existing database rows.`);
}
