// Minimal, dependency-free Markdown -> HTML converter for the editorial guides.
// Supports exactly what the guides use: ## / ### headings, paragraphs, bullet and numbered lists,
// blockquotes, pipe tables, **bold**, *italic* and [text](url) links. Everything is HTML-escaped first.
const escHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function safeHref(url) {
  const u = String(url).trim();
  if (/^https?:\/\//i.test(u) || u.startsWith("/") || u.startsWith("#") || /^tel:\d+$/i.test(u)) return u;
  throw new Error(`Unsafe or unsupported link in guide markdown: ${u}`);
}

export function inline(text) {
  let out = escHtml(text);
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, url) => {
    // escHtml already encoded & in URLs as &amp;, which is what an href attribute needs.
    const raw = url.replace(/&amp;/g, "&");
    const href = safeHref(raw);
    const external = /^https?:\/\//i.test(href);
    return `<a href="${escHtml(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,;:]|$)/g, "$1<em>$2</em>");
  return out;
}

export function markdownToHtml(md) {
  const lines = String(md).replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    let m;
    if ((m = line.match(/^(#{2,3})\s+(.*)$/))) {
      const level = m[1].length;
      html.push(`<h${level}>${inline(m[2].trim())}</h${level}>`);
      i++;
      continue;
    }
    if (line.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith("|")) { rows.push(lines[i]); i++; }
      const cells = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const header = cells(rows[0]);
      const body = rows.slice(2).map(cells); // rows[1] is the --- separator
      html.push(
        `<div class="table-wrap"><table><thead><tr>${header.map((c) => `<th scope="col">${inline(c)}</th>`).join("")}</tr></thead>` +
          `<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
      );
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^[-*]\s+/, "")); i++; }
      html.push(`<ul>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</ul>`);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s+/, "")); i++; }
      html.push(`<ol>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</ol>`);
      continue;
    }
    if (line.startsWith(">")) {
      const quote = [];
      while (i < lines.length && lines[i].startsWith(">")) { quote.push(lines[i].replace(/^>\s?/, "")); i++; }
      html.push(`<blockquote><p>${inline(quote.join(" "))}</p></blockquote>`);
      continue;
    }
    // paragraph: consecutive non-empty, non-structural lines
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{2,3}\s|[-*]\s|\d+\.\s|>|\|)/.test(lines[i])
    ) { para.push(lines[i].trim()); i++; }
    html.push(`<p>${inline(para.join(" "))}</p>`);
  }
  return html.join("\n");
}
