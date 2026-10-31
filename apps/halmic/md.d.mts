// Types for md.mjs, for the editor in the content repo (TypeScript): its dev-log preview renders with the same markdown as the build.
export const TERM_COLOURS: readonly string[];
export function inline(src: string): string;
export function md(src: string, opts: { img: (src: string, alt: string) => { src: string; width: number; height: number }; youtube: (id: string) => string }): string;
export function frontMatter(text: string): { meta: Record<string, string>; body: string };
