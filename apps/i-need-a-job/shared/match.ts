// Client-side matching of normalized postings against the user's selected titles
// and filters. Pure functions so they're easy to test.

import { type Industry, industryOf } from "./companies.ts";
import { locationMatches } from "./locations.ts";
import type { Job } from "./types.ts";

export interface Filters {
  titles: string[];
  /** Only show companies in these industries; empty means all industries. */
  industries: Industry[];
  /** Looser title matching for long titles; see wordsMatch. */
  broadTitleMatch: boolean;
  remoteOnly: boolean;
  /** A LocationOption label, or "" for any location. */
  location: string;
  /** The candidate's years of experience; postings asking for more are excluded. */
  yearsOfExperience: number | null;
  /** Minimum acceptable annual salary; postings whose top of range is below it are excluded. */
  minSalary: number | null;
  /** When false, postings that don't list a salary are dropped while a salary filter is set. */
  includeUnlistedSalary: boolean;
}

const ABBREVIATIONS: Record<string, string> = {
  sr: "senior",
  jr: "junior",
  eng: "engineer",
  engr: "engineer",
  swe: "software engineer",
  sre: "site reliability engineer",
  sde: "software development engineer",
  ml: "machine learning",
  ai: "artificial intelligence",
  pm: "product manager",
  tpm: "technical program manager",
  qa: "quality assurance",
  ui: "user interface",
  ux: "user experience",
  devops: "devops",
  "full-stack": "fullstack",
  "front-end": "frontend",
  "back-end": "backend",
};

// Seniority words don't change what a role is, so a selected "Senior Software
// Engineer" also finds "Software Engineer II". But as the last word they ARE the
// role ("Development Associate", "Tech Lead"), so they're only dropped elsewhere.
const SENIORITY = new Set(["senior", "junior", "staff", "principal", "lead", "distinguished", "associate", "intern"]);

// Filler that never matters.
const IGNORED = new Set([
  "i",
  "ii",
  "iii",
  "iv",
  "v",
  "1",
  "2",
  "3",
  "4",
  "of",
  "and",
  "the",
  "a",
  "an",
  "for",
  "&",
  "-",
  ",",
]);

/**
 * Normalized words of a title. Selected titles drop seniority words (except a
 * trailing one); posting titles keep them, since extra words there are harmless.
 */
export function tokenize(title: string, { stripSeniority = true } = {}): string[] {
  const words = title
    .toLowerCase()
    // "Full Stack", "Full-Stack" and "Fullstack" should all be one word.
    .replace(/\b(full|front|back|dev)[\s-]?(stack|end|ops)\b/g, "$1$2")
    .replace(/[()/,|:–—]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[^\w+#]+|[^\w+#]+$/g, ""))
    .flatMap((w) => (ABBREVIATIONS[w] ?? w).split(" "))
    .filter((w) => w && !IGNORED.has(w));
  if (!stripSeniority) return words;
  return words.filter((w, i) => !SENIORITY.has(w) || i === words.length - 1);
}

/**
 * Does the posting title match a selected title's words?
 * Strict: every word must appear. Broad (titles of 3+ words): the role word
 * (the last one, e.g. "coordinator") plus at least half of the others, so
 * "Health and Wellness Coordinator" also finds "Wellness Program Coordinator".
 */
function wordsMatch(words: readonly string[], jobWords: ReadonlySet<string>, broad: boolean): boolean {
  if (words.length === 0) return false;
  if (!broad || words.length <= 2) return words.every((w) => jobWords.has(w));
  const head = words[words.length - 1] ?? "";
  const matched = words.slice(0, -1).filter((w) => jobWords.has(w));
  // Generic words alone ("Public ... Program Manager" vs "Technical Program Manager, Public Sector") don't count.
  return (
    jobWords.has(head) &&
    matched.length >= Math.ceil((words.length - 1) / 2) &&
    matched.some((w) => !GENERIC_WORDS.has(w))
  );
}

const GENERIC_WORDS = new Set([
  "program",
  "programs",
  "public",
  "technical",
  "general",
  "business",
  "services",
  "service",
  "operations",
  "project",
  "global",
  "team",
  "sector",
  "corporate",
  "assistant",
  "specialist",
]);

/** Index of the first selected title that matches the posting's title, or -1. */
export function matchTitle(jobTitle: string, selected: readonly string[][], broad = false): number {
  const jobWords = new Set(tokenize(jobTitle, { stripSeniority: false }));
  return selected.findIndex((words) => wordsMatch(words, jobWords, broad));
}

export interface MatchedJob extends Job {
  matchedTitle: string;
}

/** How many title-matching postings each filter removed, in the order they're applied. */
export interface FilterStats {
  titleMatches: number;
  removed: { industry: number; remote: number; location: number; experience: number; salary: number };
}

export function filterJobsWithStats(
  jobs: readonly Job[],
  filters: Filters,
): { matches: MatchedJob[]; stats: FilterStats } {
  const selected = filters.titles.map((t) => tokenize(t));
  const industries = new Set(filters.industries);
  const stats: FilterStats = {
    titleMatches: 0,
    removed: { industry: 0, remote: 0, location: 0, experience: 0, salary: 0 },
  };
  const matches: MatchedJob[] = [];
  for (const job of jobs) {
    const idx = matchTitle(job.title, selected, filters.broadTitleMatch);
    if (idx < 0) continue;
    stats.titleMatches++;
    if (industries.size > 0) {
      const industry = job.industry ?? industryOf(job.company);
      if (!industry || !industries.has(industry)) {
        stats.removed.industry++;
        continue;
      }
    }
    if (filters.remoteOnly && !job.remote) {
      stats.removed.remote++;
      continue;
    }
    if (filters.location && !locationMatches(filters.location, job.location)) {
      stats.removed.location++;
      continue;
    }
    if (filters.yearsOfExperience !== null && job.minYears !== null && job.minYears > filters.yearsOfExperience) {
      stats.removed.experience++;
      continue;
    }
    if (
      filters.minSalary !== null &&
      (job.salary === null ? !filters.includeUnlistedSalary : job.salary.max < filters.minSalary)
    ) {
      stats.removed.salary++;
      continue;
    }
    matches.push({ ...job, matchedTitle: filters.titles[idx] ?? "" });
  }
  return { matches, stats };
}

export function filterJobs(jobs: readonly Job[], filters: Filters): MatchedJob[] {
  return filterJobsWithStats(jobs, filters).matches;
}

/** Lowercased, with accents removed, so "Nestle" finds "Nestlé". */
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * The results search box: keeps jobs whose employer, title, location, industry or
 * matched title contain every word of the query, in any order. An empty query keeps all.
 */
export function searchJobs(jobs: readonly MatchedJob[], query: string): MatchedJob[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...jobs];
  return jobs.filter((job) => {
    const text = fold(
      [job.title, job.company, job.location, job.matchedTitle, job.industry ?? industryOf(job.company) ?? ""].join(" "),
    );
    return words.every((w) => text.indexOf(w) !== -1);
  });
}
