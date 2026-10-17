// Content checks shared by the local writing API (lib/editor/server/posts.ts) and the hosted editor's Worker (write/worker).
// The rules themselves live in lib/content/rules.mjs, which the site build and the content repo's CI run too.
// Relative imports only: the Worker bundle has no `@/` alias.
export { DASH_RE, STRICT_SLUG_RE, bodyProblems, dashLines, frontmatterProblem, slugProblem } from '../content/rules.mjs'
