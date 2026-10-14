// Turns plain resume text into suggested job titles and an experience estimate.
// Pure functions, no network: the resume never leaves the browser.

import { FAMILIES, type JobFamily } from "./taxonomy.ts";
import type { ResumeAnalysis, TitleSuggestion } from "./types.ts";

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Matches a phrase as whole words, tolerating hyphen/space differences.
 * Short all-caps acronyms (SRE, PM, TAM) match case-sensitively so "pm" in
 * "5pm" or "tam" in a name don't count.
 */
function phraseRegExp(phrase: string): RegExp {
  const body = escapeRegExp(phrase).replace(/(?:\\-|\s)+/g, "[\\s-]*");
  const start = /^\w/.test(phrase) ? "(?<![\\w])" : "";
  const end = /\w$/.test(phrase) ? "(?![\\w])" : "";
  const caseSensitive = phrase.length <= 4 && phrase === phrase.toUpperCase() && /[A-Z]/.test(phrase);
  return new RegExp(`${start}${body}${end}`, caseSensitive ? "" : "i");
}

interface CompiledFamily {
  family: JobFamily;
  titles: { title: string; patterns: RegExp[] }[];
  keywords: RegExp[];
}

const COMPILED: CompiledFamily[] = FAMILIES.map((family) => ({
  family,
  titles: family.titles.map((t) => ({
    title: t.title,
    patterns: [...(t.aliasesOnly ? [] : [t.title]), ...(t.aliases ?? [])].map(phraseRegExp),
  })),
  keywords: family.keywords.map(phraseRegExp),
}));

const TITLE_WEIGHT = 4;
/** A family is "related" if it scores at least this share of the best family. */
const TOP_SHARE = 0.35;
const MAX_TOP_FAMILIES = 3;
const STRETCH_PER_FAMILY = 2;
const MAX_STRETCH = 10;
const MAX_TITLES = 30;

export function suggestTitles(text: string): TitleSuggestion[] {
  const scored = COMPILED.map((c) => {
    const mentioned = c.titles.filter((t) => t.patterns.some((p) => p.test(text))).map((t) => t.title);
    const keywordHits = c.keywords.filter((k) => k.test(text)).length;
    return { ...c, mentioned, score: TITLE_WEIGHT * mentioned.length + keywordHits };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = scored[0]?.score ?? 0;
  const top = scored.filter((s) => s.score >= 3 && s.score >= best * TOP_SHARE).slice(0, MAX_TOP_FAMILIES);
  const out = new Map<string, TitleSuggestion>();
  const add = (title: string, fit: TitleSuggestion["fit"]) => {
    if (!out.has(title) && out.size < MAX_TITLES) out.set(title, { title, fit });
  };

  // Titles the resume actually mentions, strongest families first.
  for (const s of scored) for (const title of s.mentioned) add(title, "close");
  // Everything else in the families the resume is clearly about.
  for (const s of top) for (const t of s.titles) add(t.title, "related");
  // A few titles from neighboring families, those with some resume signal first.
  const topIds = new Set(top.map((s) => s.family.id));
  const scoreOf = (id: string) => scored.find((s) => s.family.id === id)?.score ?? 0;
  const stretchIds = [...new Set(top.flatMap((s) => s.family.adjacent))]
    .filter((id) => !topIds.has(id))
    .sort((a, b) => scoreOf(b) - scoreOf(a));
  let stretch = 0;
  for (const id of stretchIds) {
    const family = COMPILED.find((c) => c.family.id === id);
    for (const t of family?.titles.slice(0, STRETCH_PER_FAMILY) ?? []) {
      if (stretch < MAX_STRETCH && !out.has(t.title)) {
        add(t.title, "stretch");
        stretch++;
      }
    }
  }
  return [...out.values()];
}

// --- Years of experience from work-history date ranges

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH = String.raw`(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?`;
const NOW = String.raw`present|current|now|today|ongoing`;
const DATE = String.raw`(?:${MONTH}\s+|(\d{1,2})\s*/\s*)?((?:19|20)\d{2})`;
const RANGE = new RegExp(String.raw`${DATE}\s*(?:-|–|—|to|until)\s*(?:${DATE}|(${NOW}))`, "gi");

const WORK_HEADING = /^(?:professional |work |relevant )?(?:experience|employment|work history|career history)\b/i;
const OTHER_HEADING =
  /^(?:education|academic|certifications?|licenses|projects?|personal projects|skills|technical skills|publications|awards|honors|volunteer|leadership|activities|interests|coursework)\b/i;

/** Month index (years * 12 + month) for a parsed date; year-only dates count as mid-year. */
function monthIndex(monthName: string | undefined, monthNum: string | undefined, year: string): number {
  const y = Number(year) * 12;
  if (monthName) return y + Math.max(0, MONTHS.indexOf(monthName.slice(0, 3).toLowerCase()));
  if (monthNum && Number(monthNum) >= 1 && Number(monthNum) <= 12) return y + Number(monthNum) - 1;
  return y + 6;
}

/**
 * Sums the months covered by date ranges in work sections (overlaps counted
 * once), skipping education/projects/etc. Returns whole years, or null.
 */
export function estimateYearsOfExperience(text: string, now = new Date()): number | null {
  const nowIndex = now.getFullYear() * 12 + now.getMonth();
  const intervals: [number, number][] = [];
  let section: "work" | "other" | "unknown" = "unknown";

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length > 0 && line.length < 40) {
      if (WORK_HEADING.test(line)) section = "work";
      else if (OTHER_HEADING.test(line)) section = "other";
    }
    if (section === "other") continue;

    for (const m of line.matchAll(RANGE)) {
      const start = monthIndex(m[1], m[2], m[3] ?? "");
      const end = m[7] ? nowIndex : monthIndex(m[4], m[5], m[6] ?? "") + (m[4] || m[5] ? 1 : 0);
      if (end > start && start <= nowIndex && end - start <= 50 * 12)
        intervals.push([start, Math.min(end, nowIndex + 1)]);
    }
  }
  if (intervals.length === 0) return null;

  intervals.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [curStart, curEnd] = intervals[0] as [number, number];
  for (const [s, e] of intervals.slice(1)) {
    if (s <= curEnd) curEnd = Math.max(curEnd, e);
    else {
      total += curEnd - curStart;
      [curStart, curEnd] = [s, e];
    }
  }
  total += curEnd - curStart;
  return Math.round(total / 12);
}

export function analyzeResume(text: string, now = new Date()): ResumeAnalysis {
  return { titles: suggestTitles(text), yearsOfExperience: estimateYearsOfExperience(text, now) };
}
