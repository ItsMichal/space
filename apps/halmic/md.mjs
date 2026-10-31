// Tiny markdown-to-HTML for the Project Mountaintop dev logs. Only what those posts use: headings (h2-h4), paragraphs, nested
// lists, fenced code, hr, links, emphasis, inline code, images (a lone image line with a "title" becomes a captioned figure),
// ":::callout{type=..}" blocks and "::youtube{id=..}" lines (rendered by the callback). No dependencies; all text is escaped.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function inline(src) {
  const codes = [];
  let s = src.replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(`<code>${esc(c)}</code>`) - 1}\u0000`);
  s = esc(s);
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, t, u) => `<a href="${u}" rel="noopener">${t}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s.,;:!?)]|$)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[\s(])_([^_\s][^_]*)_(?=[\s.,;:!?)]|$)/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[i]);
}

// the two conversational callouts get a fixed lead-in: a prerequisite up front, and the question the reader is asking
const CALLOUT_LABELS = { before: 'Before you continue', ask: 'You might be wondering' };
const LI = /^(\s*)([-*]|\d+\.)\s+(.*)$/;
function list(lines) {
  // lines: consecutive list lines; nesting by indent
  const build = (i, indent) => {
    const ordered = /\d/.test(LI.exec(lines[i])[2]);
    let html = '';
    while (i < lines.length) {
      const m = LI.exec(lines[i]);
      if (m[1].length < indent) break;
      if (m[1].length > indent) { const [inner, j] = build(i, m[1].length); html = html.replace(/<\/li>$/, `${inner}</li>`); i = j; continue; }
      html += `<li>${inline(m[3])}</li>`; i++;
    }
    const tag = ordered ? 'ol' : 'ul';
    return [`<${tag}>${html}</${tag}>`, i];
  };
  return build(0, LI.exec(lines[0])[1].length)[0];
}

// opts.img(src, alt) -> { src, width, height }; opts.youtube(id) -> html
export function md(src, opts) {
  const L = src.replace(/\r/g, '').split('\n');
  const out = [];
  for (let i = 0; i < L.length;) {
    const line = L[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = /^```(\w*)/.exec(line))) {
      const code = []; i++;
      while (i < L.length && !/^```/.test(L[i])) code.push(L[i++]);
      i++;
      out.push(`<pre><code${m[1] ? ` class="language-${m[1]}"` : ''}>${esc(code.join('\n'))}</code></pre>`);
    } else if ((m = /^:::callout\{type="(\w+)"\}/.exec(line))) {
      const inner = []; i++;
      while (i < L.length && L[i].trim() !== ':::') inner.push(L[i++]);
      i++;
      const label = CALLOUT_LABELS[m[1]];
      out.push(`<aside class="callout callout-${m[1]}"${label ? ` aria-label="${label}"` : ''}>${label ? `<p class="callout-label">${label}</p>` : ''}${md(inner.join('\n'), opts)}</aside>`);
    } else if ((m = /^::youtube\{id="([\w-]+)"\}/.exec(line))) { out.push(opts.youtube(m[1])); i++; }
    else if (/^---+\s*$/.test(line)) { out.push('<hr>'); i++; }
    else if ((m = /^(#{2,4})\s+(.*)$/.exec(line))) { out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); i++; }
    else if ((m = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*$/.exec(line))) {
      const im = opts.img(m[2], m[1]);
      out.push(`<figure class="fig"><img src="${im.src}" width="${im.width}" height="${im.height}" loading="lazy" decoding="async" alt="${esc(m[1])}">${m[3] ? `<figcaption>${inline(m[3])}</figcaption>` : ''}</figure>`);
      i++;
    } else if (LI.test(line)) {
      const items = [];
      while (i < L.length && LI.test(L[i])) items.push(L[i++]);
      out.push(list(items));
    } else {
      const p = [];
      while (i < L.length && L[i].trim() && !/^(```|:::|::youtube|#{2,4}\s|---+\s*$|!\[)/.test(L[i]) && !(p.length === 0 ? false : LI.test(L[i]))) p.push(L[i++]);
      if (!p.length) p.push(L[i++]);
      out.push(`<p>${inline(p.join(' '))}</p>`);
    }
  }
  return out.join('\n');
}

// "---\nkey: value\n---\nbody"
export function frontMatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  const meta = {};
  for (const l of m[1].split('\n')) { const k = /^(\w+):\s*(.*)$/.exec(l); if (k) meta[k[1]] = k[2]; }
  return { meta, body: m[2] };
}
