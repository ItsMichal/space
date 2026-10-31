// Tiny markdown-to-HTML for the Project Mountaintop dev logs. Only what those posts use: headings (h2-h4), paragraphs, nested
// lists, fenced code, hr, links, emphasis, inline code, images (a lone image line with a "title" becomes a captioned figure),
// ":::callout{type=..}" blocks and "::youtube{id=..}" lines (rendered by the callback), and two inline marks: ":term[word]{c=green}"
// colours a term (TERM_COLOURS), ":fig[2]" is a chip pointing at the post's second image (app.js lights it on hover). No
// dependencies; all text is escaped.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Term colours: the Okabe-Ito set without its yellow (page.css .term-*). An unknown name falls back to the first. */
export const TERM_COLOURS = ['blue', 'orange', 'green', 'red', 'purple', 'sky'];
const LENS = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="m16.5 16.5 4 4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';

export function inline(src) {
  const codes = [];
  let s = src.replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(`<code>${esc(c)}</code>`) - 1}\u0000`);
  s = esc(s);
  s = s.replace(/:term\[([^\]]+)\](?:\{c=(?:&quot;)?(\w+)(?:&quot;)?\})?/g, (_, t, c) => `<span class="term term-${TERM_COLOURS.includes(c) ? c : TERM_COLOURS[0]}">${t}</span>`);
  s = s.replace(/:fig\[([1-9]\d?)\]/g, (_, n) => `<a class="figref" href="#fig-${n}" data-fig="${n}">${LENS}<span>fig ${n}</span></a>`);
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, t, u) => `<a href="${u}" rel="noopener">${t}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s.,;:!?)]|$)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[\s(])_([^_\s][^_]*)_(?=[\s.,;:!?)]|$)/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[i]);
}

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

// opts.img(src, alt) -> { src, width, height }; opts.youtube(id) -> html. Images are numbered in order (id="fig-N"); one that a
// :fig[N] cites also shows its number in its caption.
export function md(src, opts, st = { n: 0, cited: new Set([...src.matchAll(/:fig\[([1-9]\d?)\]/g)].map((m) => m[1])) }) {
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
      out.push(`<aside class="callout callout-${m[1]}">${md(inner.join('\n'), opts, st)}</aside>`);
    } else if ((m = /^::youtube\{id="([\w-]+)"\}/.exec(line))) { out.push(opts.youtube(m[1])); i++; }
    else if (/^---+\s*$/.test(line)) { out.push('<hr>'); i++; }
    else if ((m = /^(#{2,4})\s+(.*)$/.exec(line))) { out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); i++; }
    else if ((m = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*$/.exec(line))) {
      const im = opts.img(m[2], m[1]);
      const n = String(++st.n);
      const no = st.cited.has(n) ? `<span class="figno">fig ${n}</span>` : '';
      out.push(`<figure class="fig" id="fig-${n}"><img src="${im.src}" width="${im.width}" height="${im.height}" loading="lazy" decoding="async" alt="${esc(m[1])}">${m[3] || no ? `<figcaption>${no}${m[3] ? inline(m[3]) : ''}</figcaption>` : ''}</figure>`);
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
