// Client-side matching of normalized postings against the user's selected titles
// and filters. Pure functions so they're easy to test.

import { locationMatches } from "./locations.ts";
import type { Job } from "./types.ts";

export interface Filters {
  titles: string[];
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

// Words that don't change what a role is, so a selected "Senior Software Engineer"
// also finds "Software Engineer II" and vice versa.
const IGNORED = new Set([
  "senior",
  "junior",
  "staff",
  "principal",
  "lead",
  "distinguished",
  "associate",
  "intern",
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

export function tokenize(title: string): string[] {
  return (
    title
      .toLowerCase()
      // "Full Stack", "Full-Stack" and "Fullstack" should all be one word.
      .replace(/\b(full|front|back|dev)[\s-]?(stack|end|ops)\b/g, "$1$2")
      .replace(/[()/,|:–—]/g, " ")
      .split(/\s+/)
      .map((w) => w.replace(/^[^\w+#]+|[^\w+#]+$/g, ""))
      .flatMap((w) => (ABBREVIATIONS[w] ?? w).split(" "))
      .filter((w) => w && !IGNORED.has(w))
  );
}

/** Returns the first selected title whose words all appear in the posting's title. */
export function matchTitle(jobTitle: string, selected: readonly string[][]): number {
  const jobWords = new Set(tokenize(jobTitle));
  return selected.findIndex((words) => words.length > 0 && words.every((w) => jobWords.has(w)));
}

export interface MatchedJob extends Job {
  matchedTitle: string;
}

export function filterJobs(jobs: readonly Job[], filters: Filters): MatchedJob[] {
  const selected = filters.titles.map(tokenize);
  const out: MatchedJob[] = [];
  for (const job of jobs) {
    const idx = matchTitle(job.title, selected);
    if (idx < 0) continue;
    if (filters.remoteOnly && !job.remote) continue;
    if (filters.location && !locationMatches(filters.location, job.location)) continue;
    if (filters.yearsOfExperience !== null && job.minYears !== null && job.minYears > filters.yearsOfExperience) {
      continue;
    }
    if (filters.minSalary !== null) {
      if (job.salary === null ? !filters.includeUnlistedSalary : job.salary.max < filters.minSalary) continue;
    }
    out.push({ ...job, matchedTitle: filters.titles[idx] ?? "" });
  }
  return out;
}
