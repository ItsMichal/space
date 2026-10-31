// content/layout.json: how the home page's bentos are arranged. parseLayout checks the file's shape (strict keys, enums, caps);
// resolve() applies it to the model from bentos.mjs and reports ids that do not exist and arrangements that would break the page.
// An empty file ({ "version": 1 }) is the default arrangement. Only what was changed needs to be listed:
//   sections: [{ id, title?, hide?, clusters? }]  pinned sections first, in this order, then the rest in their default order.
//                                                 clusters lists the section's clusters in order; a cluster listed here moves here.
//   clusters: { <id>: { hide?, order?, sizes?, hidden? } }  order pins tiles first; sizes { <tile id>: one|w2|x4|lead }; hidden is a list of tile ids
//                                                            (a flex tile id hides the flex tile).
import { SIZES, gaps } from './bentos.mjs';

export const LAYOUT = { maxBytes: 32768, maxTitle: 40, maxList: 64 };
const ID = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,79}$/;

export class LayoutError extends Error {}
const fail = (m) => { throw new LayoutError(`layout.json: ${m}`); };
const obj = (v, where) => { if (!v || typeof v !== 'object' || Array.isArray(v)) fail(`${where} must be an object`); return v; };
const keys = (o, allowed, where) => { for (const k of Object.keys(o)) if (!allowed.includes(k)) fail(`${where}: unknown key "${k}"`); };
const bool = (v, where) => { if (v !== undefined && typeof v !== 'boolean') fail(`${where} must be true or false`); return v; };
const id = (v, where) => { if (typeof v !== 'string' || !ID.test(v)) fail(`${where} is not an id`); return v; };
const ids = (v, where) => {
  if (v === undefined) return v;
  if (!Array.isArray(v) || v.length > LAYOUT.maxList) fail(`${where} must be a list of at most ${LAYOUT.maxList} ids`);
  v.forEach((x, i) => id(x, `${where}[${i}]`));
  if (new Set(v).size !== v.length) fail(`${where} lists an id twice`);
  return v;
};

export function parseLayout(text) {
  if (typeof text !== 'string') fail('not text');
  if (new TextEncoder().encode(text).length > LAYOUT.maxBytes) fail(`larger than ${LAYOUT.maxBytes} bytes`);
  let j;
  try { j = JSON.parse(text); } catch (e) { fail(`not JSON (${e.message})`); }
  obj(j, 'the file');
  keys(j, ['version', 'sections', 'clusters'], 'the file');
  if (j.version !== 1) fail('version must be 1');
  const sections = j.sections ?? [];
  if (!Array.isArray(sections) || sections.length > LAYOUT.maxList) fail('sections must be a list');
  sections.forEach((s, i) => {
    const w = `sections[${i}]`;
    obj(s, w); keys(s, ['id', 'title', 'hide', 'clusters'], w); id(s.id, `${w}.id`); bool(s.hide, `${w}.hide`); ids(s.clusters, `${w}.clusters`);
    if (s.title !== undefined && (typeof s.title !== 'string' || !s.title.trim() || s.title.length > LAYOUT.maxTitle || /[\u0000-\u001f\u007f<>]/.test(s.title))) fail(`${w}.title must be 1 to ${LAYOUT.maxTitle} characters, no control characters or angle brackets`);
  });
  if (new Set(sections.map((s) => s.id)).size !== sections.length) fail('a section is listed twice');
  const placed = sections.flatMap((s) => s.clusters ?? []);
  if (new Set(placed).size !== placed.length) fail('a cluster is placed in two sections');
  const clusters = obj(j.clusters ?? {}, 'clusters');
  if (Object.keys(clusters).length > LAYOUT.maxList) fail('too many clusters');
  for (const [cid, c] of Object.entries(clusters)) {
    const w = `clusters.${cid}`;
    id(cid, w); obj(c, w); keys(c, ['hide', 'order', 'sizes', 'hidden'], w); bool(c.hide, `${w}.hide`); ids(c.order, `${w}.order`); ids(c.hidden, `${w}.hidden`);
    const sizes = obj(c.sizes ?? {}, `${w}.sizes`);
    for (const [tid, z] of Object.entries(sizes)) { id(tid, `${w}.sizes`); if (!Object.hasOwn(SIZES, z)) fail(`${w}.sizes.${tid} must be one of ${Object.keys(SIZES).join(', ')}`); }
  }
  return { version: 1, sections, clusters };
}

export const isDefault = (l) => !l.sections.length && !Object.keys(l.clusters).length;

// the model with the layout applied: sections (visible ones only) -> clusters (visible ones only) -> tiles with their sizes, and the flex tile or null.
// problems lists everything that is wrong; the build refuses to ship with any, the editor shows them next to the control that caused them.
export function resolve(m, layout) {
  const problems = [];
  const secIds = m.sections.map((s) => s.id);
  for (const s of layout.sections) if (!secIds.includes(s.id)) problems.push(`section "${s.id}" does not exist`);
  for (const cid of Object.keys(layout.clusters)) if (!m.clusters[cid]) problems.push(`cluster "${cid}" does not exist`);
  const moved = new Set(layout.sections.flatMap((s) => (s.clusters ?? []).filter((c) => { if (!m.clusters[c]) { problems.push(`cluster "${c}" does not exist`); return false; } return true; })));
  const pinned = layout.sections.filter((s) => secIds.includes(s.id)).map((s) => s.id);
  const order = [...pinned, ...secIds.filter((s) => !pinned.includes(s))];
  const sections = order.map((sid) => {
    const def = m.sections.find((s) => s.id === sid), lay = layout.sections.find((s) => s.id === sid) ?? {};
    const own = lay.clusters ?? [];
    const cl = [...own, ...def.clusters.filter((c) => !moved.has(c))].map((cid) => cluster(m, cid, layout.clusters[cid] ?? {}, problems)).filter(Boolean);
    return { id: sid, title: lay.title ?? def.title, anchor: !!def.anchor, hide: !!lay.hide, clusters: cl };
  });
  for (const s of sections) {
    if (s.hide && s.anchor) problems.push(`section "${s.id}" cannot be hidden: other pages link to it`);
    if (s.anchor && !s.hide && !s.clusters.length) problems.push(`section "${s.id}" cannot be empty: other pages link to it`);
    for (const c of s.clusters) for (const r of c.required) if (s.hide) problems.push(`section "${s.id}" cannot be hidden: it holds the required tile "${r}"`);
  }
  const shown = sections.filter((s) => !s.hide && s.clusters.length);
  return { sections: shown, problems };
}

// one cluster with its tile layout but never hidden: the inner pages (/games/, /videos/) show it whatever the home page does
export function arrange(m, layout, cid) {
  const problems = [];
  const c = cluster(m, cid, { ...layout.clusters[cid], hide: false }, problems, true);
  if (problems.length) throw new LayoutError(`layout.json: ${problems.join('; ')}`);
  return c;
}

// inner: an inner page, which also shows the innerOnly tiles the home page leaves out
function cluster(m, cid, lay, problems, inner = false) {
  const def = m.clusters[cid];
  const all = [...def.tiles.map((x) => x.id), ...(def.flex ? [def.flex.id] : [])];
  for (const tid of [...(lay.order ?? []), ...(lay.hidden ?? []), ...Object.keys(lay.sizes ?? {})]) if (!all.includes(tid)) problems.push(`tile "${tid}" is not in cluster "${cid}"`);
  if (def.fixed && (lay.order || lay.sizes || (lay.hidden ?? []).some((x) => x !== def.flex?.id))) problems.push(`the tiles of cluster "${cid}" are placeholders the browser replaces; arrange the cluster, not its tiles`);
  if (def.flex && lay.sizes?.[def.flex.id]) problems.push(`tile "${def.flex.id}" fills the last row of "${cid}"; it has no size`);
  const hidden = new Set(lay.hidden ?? []);
  const required = [...def.tiles, ...(def.flex ? [def.flex] : [])].filter((x) => x.required).map((x) => x.id);
  for (const r of required) if (hidden.has(r)) problems.push(`tile "${r}" cannot be hidden: the page depends on it`);
  if (lay.hide) { if (required.length) problems.push(`cluster "${cid}" cannot be hidden: it holds the required tile "${required[0]}"`); return null; }
  const pins = (lay.order ?? []).filter((x) => def.tiles.some((d) => d.id === x));
  const tiles = [...pins, ...def.tiles.map((x) => x.id).filter((x) => !pins.includes(x))].filter((x) => !hidden.has(x) && (inner || !def.tiles.find((y) => y.id === x).innerOnly)).map((x) => {
    const d = def.tiles.find((y) => y.id === x);
    return { ...d, size: def.fixed ? d.size : lay.sizes?.[x] ?? d.size };
  });
  const flex = def.flex && !hidden.has(def.flex.id) ? def.flex : null;
  if (!tiles.length && (!flex || def.needsTiles)) return null;
  if (!flex) { const g = gaps(tiles); if (g.some(Boolean)) problems.push(`cluster "${cid}" leaves a gap in its last row (${g.map((n, i) => `${n} at ${[4, 3, 2][i]} columns`).filter((x) => !x.startsWith('0')).join(', ')}); resize a tile or show its flex tile`); }
  return { id: cid, name: def.name, tiles, flex, required };
}
