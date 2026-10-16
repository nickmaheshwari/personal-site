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

// Soft skills: people and work-style skills, as opposed to technical ("hard")
// ones. Matched like every other keyword, so they also filter jobs, but kept
// out of the resume-fit comparison, where they'd be "missing" from almost every
// posting. Some come from the taxonomy too (mentoring, stakeholders); listing
// them here only marks them as soft. Spaces and hyphens match each other.
const SOFT_SKILLS = [
  "leadership",
  "communication",
  "collaboration",
  "teamwork",
  "problem solving",
  "critical thinking",
  "decision making",
  "adaptability",
  "time management",
  "attention to detail",
  "public speaking",
  "presentation skills",
  "interpersonal",
  "emotional intelligence",
  "empathy",
  "active listening",
  "conflict resolution",
  "negotiation",
  "relationship building",
  "creativity",
  "multitasking",
  "work ethic",
  "mentoring",
  "mentored",
  "coaching",
  "people management",
  "managed a team",
  "led a team",
  "cross-functional",
  "stakeholders",
  "stakeholder management",
];

// Spelling variants ("nonprofit"/"non-profit", "node.js"/"nodejs") are one keyword:
// shown under the first spelling, matched by any of them.
const variantKey = (k: string) => k.toLowerCase().replace(/[^a-z0-9+#]/g, "");
const groups = new Map<string, string[]>();
for (const k of [...FAMILIES.flatMap((f) => f.keywords), ...SOFT_SKILLS]) {
  if (TOO_COMMON.has(k)) continue;
  const spellings = groups.get(variantKey(k)) ?? [];
  if (!spellings.includes(k)) spellings.push(k);
  groups.set(variantKey(k), spellings);
}
const SOFT = new Set(SOFT_SKILLS.map(variantKey));
/** Is this keyword (as findKeywords returns it) a soft skill rather than a technical one? */
export const isSoftSkill = (keyword: string) => SOFT.has(variantKey(keyword));

const wordsOf = (text: string) => text.toLowerCase().match(/[a-z0-9]+/g) ?? [];

const KEYWORDS = [...groups.values()].map((spellings) => ({
  keyword: spellings[0] ?? "",
  spellings: spellings.map((s) => ({ pattern: phraseRegExp(s), words: [...new Set(wordsOf(s))] })),
}));

/** Could the text contain these words? Also true when they're run together ("HelpDesk" for "help desk"). */
const mayContain = (present: ReadonlySet<string>, words: readonly string[]) =>
  words.every((w) => present.has(w)) || present.has(words.join(""));

/**
 * Every skill keyword the text mentions. Each keyword's words are checked
 * against the text's words first, and only candidates get the exact regex:
 * running all ~600 regexes took ~2 ms per posting, too slow for 100k postings.
 */
export function findKeywords(text: string): string[] {
  const present = new Set(wordsOf(text));
  return KEYWORDS.filter(({ spellings }) =>
    spellings.some((s) => mayContain(present, s.words) && s.pattern.test(text)),
  ).map((k) => k.keyword);
}

export interface ResumeSkills {
  /** Technical skills and tools (Python, Tableau, budgeting). */
  hard: string[];
  /** People and work-style skills (leadership, collaboration). */
  soft: string[];
}

/**
 * A resume's most-mentioned skill keywords, split into hard and soft, each
 * most mentions first (ties keep taxonomy order) and capped at `max`, for the
 * results' skill filter.
 */
export function topSkills(resumeText: string, max = 7): ResumeSkills {
  const found = new Set(findKeywords(resumeText));
  const mentions = (keyword: string) => {
    const k = KEYWORDS.find((x) => x.keyword === keyword);
    return Math.max(
      0,
      ...(k?.spellings ?? []).map(
        (s) => resumeText.match(new RegExp(s.pattern.source, `${s.pattern.flags}g`))?.length ?? 0,
      ),
    );
  };
  const ranked = [...found]
    .map((keyword, order) => ({ keyword, order, count: mentions(keyword) }))
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .map((s) => s.keyword);
  return {
    hard: ranked.filter((k) => !isSoftSkill(k)).slice(0, max),
    soft: ranked.filter(isSoftSkill).slice(0, max),
  };
}

export interface KeywordComparison {
  /** Posting keywords the resume also mentions. */
  matched: string[];
  /** Posting keywords the resume doesn't mention. */
  missing: string[];
}

export function compareKeywords(resumeText: string, jobText: string): KeywordComparison {
  const inResume = new Set(findKeywords(resumeText));
  const matched: string[] = [];
  const missing: string[] = [];
  for (const keyword of findKeywords(jobText)) {
    if (!isSoftSkill(keyword)) (inResume.has(keyword) ? matched : missing).push(keyword);
  }
  return { matched, missing };
}

/** A typed skill as the keyword it names ("Node.js" → "node.js"), or null if it isn't one we track. */
export function trackedSkill(text: string): string | null {
  const typed = wordsOf(text).join("");
  return findKeywords(text).find((k) => wordsOf(k).join("") === typed) ?? null;
}
