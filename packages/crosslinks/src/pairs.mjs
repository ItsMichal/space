// The map of content that is genuinely the same project or piece on both sites. Plain data so the Next app, the halmic
// build and the checks all read one source.
//   post         the michal.ai post's stable frontmatter id (never its slug: slugs get renamed, the path is resolved from the id)
//   halmic       the live Halmic path
//   halmicTitle  the title exactly as Halmic prints it (shown on michal.ai)
//   michalTitle  the michal.ai title Halmic may print beside the domain, or null when that title carries a name Halmic does not print
//   relation     a neutral key, never rendered
// Anything not listed is not linked (near-misses are listed in the PR).
export const PAIRS = [
  { relation: 'project', post: 'project-mountaintop', halmic: '/work/project-mountaintop/', halmicTitle: 'Project Mountaintop', michalTitle: 'Project Mountaintop' },
  { relation: 'log', post: 'mountaintop-first-steps-week-1-2-recap', halmic: '/work/project-mountaintop/first-steps-week-1-2-recap/', halmicTitle: 'First Steps - Week 1→2 Recap', michalTitle: 'First Steps - Week 1→2 Recap' },
  { relation: 'log', post: 'mountaintop-stay-on-beat-week-2-3-recap', halmic: '/work/project-mountaintop/stay-on-beat-week-2-3-recap/', halmicTitle: 'Stay on Beat - Week 2→3 Recap', michalTitle: 'Stay on Beat - Week 2→3 Recap' },
  { relation: 'log', post: 'mountaintop-week-3-4-integration', halmic: '/work/project-mountaintop/week-3-4-integration/', halmicTitle: 'Week 3→4 - Integration', michalTitle: 'Week 3→4 - Integration' },
  { relation: 'log', post: 'mountaintop-week-4-5-deluxe-combos', halmic: '/work/project-mountaintop/week-4-5-deluxe-combos/', halmicTitle: 'Week 4→5 - Deluxe Combos', michalTitle: 'Week 4→5 - Deluxe Combos' },
  { relation: 'log', post: 'mountaintop-week-5-6-spaaaaace', halmic: '/work/project-mountaintop/week-5-6-spaaaaace/', halmicTitle: 'Week 5→6 - SPAAAAACE!', michalTitle: 'Week 5→6 - SPAAAAACE!' },
  { relation: 'log', post: 'mountaintop-danny-rankin-mentor-extraordinaire', halmic: '/work/project-mountaintop/danny-mentor-extraordinaire/', halmicTitle: 'Danny - Mentor Extraordinaire', michalTitle: null },
  { relation: 'project', post: 'taco-neko-development', halmic: '/games/taco-neko/', halmicTitle: 'Taco Neko', michalTitle: 'Taco Neko Development' },
]
