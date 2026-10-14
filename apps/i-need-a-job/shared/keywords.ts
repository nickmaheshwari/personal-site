// Compares a resume against a job description using the taxonomy's skill
// keywords: which of the posting's keywords the resume already mentions, and
// which it doesn't. Plain text matching; runs in the browser.

import { phraseRegExp } from "./resume.ts";
import { FAMILIES } from "./taxonomy.ts";

// Very common words that would show up as "missing" on almost every posting
// without telling the candidate anything.
const TOO_COMMON = new Set([
  "api",
  "apis",
  "excel",
  "content",
  "brand",
  "campaigns",
  "operations",
  "strategy",
  "planning",
]);

// Spelling variants ("nonprofit"/"non-profit", "node.js"/"nodejs") are one keyword:
// shown under the first spelling, matched by any of them.
const variantKey = (k: string) => k.toLowerCase().replace(/[^a-z0-9+#]/g, "");
const groups = new Map<string, string[]>();
for (const k of FAMILIES.flatMap((f) => f.keywords)) {
  if (TOO_COMMON.has(k)) continue;
  const spellings = groups.get(variantKey(k)) ?? [];
  if (!spellings.includes(k)) spellings.push(k);
  groups.set(variantKey(k), spellings);
}
const KEYWORDS = [...groups.values()].map((spellings) => ({
  keyword: spellings[0] ?? "",
  patterns: spellings.map(phraseRegExp),
}));

export interface KeywordComparison {
  /** Posting keywords the resume also mentions. */
  matched: string[];
  /** Posting keywords the resume doesn't mention. */
  missing: string[];
}

export function compareKeywords(resumeText: string, jobText: string): KeywordComparison {
  const matched: string[] = [];
  const missing: string[] = [];
  for (const { keyword, patterns } of KEYWORDS) {
    if (!patterns.some((p) => p.test(jobText))) continue;
    (patterns.some((p) => p.test(resumeText)) ? matched : missing).push(keyword);
  }
  return { matched, missing };
}
