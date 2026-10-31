// The home page's bentos as data: sections, the clusters in them and each cluster's tiles, with stable ids and default sizes.
// build.mjs renders this model; content/layout.json rearranges it (layout.mjs); the editor in space-content reads both to show the
// same arrangement. Pure and dependency-free: it takes the parsed content files and touches nothing else.

// cells a tile spans at 4 / 3 / 2 columns, and the classes that give it that size
export const SIZES = { one: [1, 1, 1], w2: [2, 2, 2], x4: [2, 1, 1], lead: [4, 4, 4] };
export const SIZE_CLS = { one: '', w2: 'w2', x4: 'x4', lead: 'lead w2' };
export const COLS = [4, 3, 2];

// the lists every renderer agrees on: which videos, which games, in which order
export function derive({ videos, exclude, curation, games, posts }) {
  const out = new Set(exclude.ids);
  const byId = Object.fromEntries(videos.videos.filter((v) => !out.has(v.id)).map((v) => [v.id, v]));
  const vc = curation.videos;
  const episodes = vc.series.episodes.map((id, i) => ({ ...byId[id], ep: i + 1 }));
  const others = vc.other.map((o) => ({ ...byId[o.id], ...o }));
  const films = others.filter((o) => o.kind === 'short film');
  const edits = others.filter((o) => !films.includes(o));
  const order = Object.keys(curation.games);
  const gl = games.games.slice().sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug)).filter((g) => (curation.games[g.slug]?.tier ?? 'more') !== 'off').map((g) => ({ ...g, ...curation.games[g.slug], tier: curation.games[g.slug]?.tier ?? 'more' }));
  return { byId, vc, episodes, others, films, edits, gl, posts: posts.posts };
}

const t = (id, size, label, o = {}) => ({ id, size, label, ...o });

// sections in their default order; a cluster belongs to one section. anchor: other pages link to the section's id, so it cannot be hidden.
// A flex tile fills its cluster's last row; required tiles (ids app.js or the nav depend on) cannot be hidden. fixed: the tiles are placeholders
// the browser replaces (Twitch clips), so they are not arranged one by one.
export function model(content) {
  const d = derive(content);
  const { films, episodes, edits, gl, posts, vc } = d;
  const lead4 = posts.length >= 4;
  const clusters = {
    films: { name: films[0]?.group ?? 'Short films', tiles: [t(`film:${films[0].id}`, 'lead', films[0].name ?? films[0].title), t(`film:${films[1].id}`, 'x4', films[1].name ?? films[1].title)], flex: t('films:year', null, 'Year and runtime') },
    fifa: { name: vc.series.title, tiles: [t('fifa:year', 'x4', 'First episode year'), ...episodes.slice().reverse().map((v) => t(`ep:${v.id}`, 'one', `Episode ${v.ep}`)), t('fifa:minutes', 'x4', 'Minutes of bad shots')], flex: null },
    edits: { name: 'More from the channel', tiles: edits.map((v) => t(`video:${v.id}`, 'one', v.title)), flex: t('edits:youtube', null, 'All videos on YouTube') },
    clips: { name: 'Twitch clips', tiles: [0, 1, 2, 3, 4, 5].map((i) => t(`clip:${i}`, i === 0 ? 'w2' : 'one', `Clip ${i + 1}`)), fixed: true, flex: t('twitch', null, 'Watch live on Twitch', { required: true }) },
    mountaintop: { name: content.mountaintop?.title ?? 'Project Mountaintop', tiles: [t('mt:lead', 'lead', content.mountaintop?.title ?? 'Project Mountaintop'), t('mt:year', 'x4', 'Capstone year')], flex: t('mt:logs', null, 'Dev log word count') },
    tiny: { name: 'Tiny games', tiles: [...gl.filter((g) => g.tier === 'feature').map((g) => t(`game:${g.slug}`, 'w2', g.title)), ...gl.filter((g) => g.tier !== 'feature').map((g) => t(`game:${g.slug}`, 'one', g.title)), t('games:engines', 'one', 'Engines')], flex: t('itch', null, 'Play on itch.io') },
    phoenix: { name: content.phoenix?.title ?? 'Pokémon Phoenix Rising', tiles: [t('pr:lead', 'lead', 'QA on Phoenix Rising'), t('pr:channel', 'x4', 'The game on YouTube')], flex: t('pr:reddit', null, 'The subreddit') },
    dental: { name: 'Southeast Denver Dental', tiles: [t('sedd', 'w2', 'Southeast Denver Dental logo')], flex: t('sedd:site', null, 'sedenverdental.com') },
    posts: { name: 'Posts on X', needsTiles: true, tiles: posts.map((p, i) => t(`post:${p.id}`, i === 0 && lead4 ? 'lead' : 'one', p.text.slice(0, 60))), flex: t('x:more', null, 'More on X') },
    elsewhere: { name: 'Elsewhere', tiles: [t('hi', 'w2', 'Say hi on X', { required: true })], flex: t('medium', null, 'Posts on Medium') },
  };
  const sections = [
    { id: 'stream', title: 'Watch', anchor: true, clusters: ['films', 'fifa', 'edits', 'clips'] },
    { id: 'games', title: 'Play', anchor: true, clusters: ['mountaintop', 'tiny'] },
    { id: 'work', title: 'Work', anchor: true, clusters: ['phoenix', 'dental'] },
    { id: 'posts', title: 'Posts', clusters: posts.length ? ['posts'] : [] },
    { id: 'elsewhere', title: 'Elsewhere', clusters: ['elsewhere'] },
  ];
  return { sections, clusters, data: d };
}

// cells a list of sized tiles covers at each column count; a cluster without a flex tile must fill whole rows at every count
export const cells = (tiles) => COLS.map((_, i) => tiles.reduce((n, x) => n + SIZES[x.size][i], 0));
export const gaps = (tiles) => cells(tiles).map((c, i) => c % COLS[i]).map((r, i) => (r ? COLS[i] - r : 0));
