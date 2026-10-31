// Types for the part of identity-lib.mjs the editor in the content repo uses (its Worker runs the denylist scan before a halmic commit).
export function scanContent(content: string, patterns: RegExp[], allowances?: unknown[]): { line: number; match: string }[];
