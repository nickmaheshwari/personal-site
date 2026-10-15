// Remote jobs from job sites that publish free search APIs: Himalayas and Jobicy.
// Like USAJOBS they're searched by title, once per selected title. Both require
// crediting them with a link to their listing, so jobs carry `via` and `url`
// points at the listing on their site. Runs server-side only.
//
// Considered and skipped: Remotive (its free API returns only ~15 jobs),
// Arbeitnow (almost all German-language postings), The Muse (no title search,
// and it requires registering an app).

import { findKeywords } from "./keywords.ts";
import { extractMinYears, extractSalary, htmlToText } from "./normalize.ts";
import type { Job } from "./types.ts";

export const AGGREGATORS = ["himalayas", "jobicy"] as const;
export type Aggregator = (typeof AGGREGATORS)[number];

export const AGGREGATOR_NAMES: Record<Aggregator, string> = { himalayas: "Himalayas", jobicy: "Jobicy" };

const SEARCH_PAGES = 3;

// --- Himalayas: himalayas.app/jobs/api/search?q=<title>&page=<n>, 20 per page

interface HimalayasJob {
  guid: string;
  title: string;
  companyName: string;
  applicationLink?: string;
  locationRestrictions?: string[];
  pubDate?: number;
  minSalary?: number | null;
  maxSalary?: number | null;
  salaryPeriod?: string | null;
  currency?: string | null;
  description?: string;
}

export function normalizeHimalayas(jobs: HimalayasJob[]): Job[] {
  return jobs.map((j) => {
    const text = htmlToText(j.description ?? "");
    const where = j.locationRestrictions?.length ? j.locationRestrictions.join(", ") : "Anywhere";
    const salary =
      j.minSalary && j.maxSalary && j.salaryPeriod === "annual"
        ? { min: j.minSalary, max: j.maxSalary, currency: j.currency ?? "USD" }
        : extractSalary(text);
    return {
      id: `himalayas:${j.guid}`,
      company: htmlToText(j.companyName),
      title: j.title.trim(),
      // Every Himalayas job is remote; the restrictions say where you can work from.
      location: `Remote (${where})`,
      remote: true,
      url: j.applicationLink ?? j.guid,
      postedAt: j.pubDate ? new Date(j.pubDate * 1000).toISOString() : null,
      salary,
      minYears: extractMinYears(text),
      skills: findKeywords(text),
      via: "Himalayas",
    };
  });
}

async function searchHimalayas(title: string, signal?: AbortSignal): Promise<Job[]> {
  const page = async (n: number): Promise<{ totalCount: number; jobs: HimalayasJob[] }> => {
    const res = await fetch(
      `https://himalayas.app/jobs/api/search?${new URLSearchParams({ q: title, page: `${n}` })}`,
      {
        headers: { Accept: "application/json" },
        signal,
      },
    );
    if (!res.ok) throw new Error(`himalayas returned ${res.status}`);
    return (await res.json()) as { totalCount: number; jobs: HimalayasJob[] };
  };
  const first = await page(1);
  const pages: number[] = [];
  for (let n = 2; n <= SEARCH_PAGES && (n - 1) * 20 < first.totalCount; n++) pages.push(n);
  const rest = await Promise.all(pages.map(page));
  return normalizeHimalayas([first, ...rest].flatMap((p) => p.jobs ?? []));
}

// --- Jobicy: jobicy.com/api/v2/remote-jobs?count=50&tag=<title>

interface JobicyJob {
  id: number;
  url: string;
  jobTitle: string;
  companyName: string;
  jobGeo?: string;
  pubDate?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: string;
  jobDescription?: string;
}

export function normalizeJobicy(jobs: JobicyJob[]): Job[] {
  return jobs.map((j) => {
    const text = htmlToText(j.jobDescription ?? "");
    const salary =
      j.salaryMin && j.salaryMax && (!j.salaryPeriod || /year|annual/i.test(j.salaryPeriod))
        ? { min: j.salaryMin, max: j.salaryMax, currency: j.salaryCurrency ?? "USD" }
        : extractSalary(text);
    return {
      id: `jobicy:${j.id}`,
      company: htmlToText(j.companyName),
      title: htmlToText(j.jobTitle),
      location: `Remote (${j.jobGeo || "Anywhere"})`,
      remote: true,
      url: j.url,
      postedAt: j.pubDate ?? null,
      salary,
      minYears: extractMinYears(text),
      skills: findKeywords(text),
      via: "Jobicy",
    };
  });
}

async function searchJobicy(title: string, signal?: AbortSignal): Promise<Job[]> {
  const res = await fetch(`https://jobicy.com/api/v2/remote-jobs?${new URLSearchParams({ count: "50", tag: title })}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!res.ok) throw new Error(`jobicy returned ${res.status}`);
  return normalizeJobicy(((await res.json()) as { jobs?: JobicyJob[] }).jobs ?? []);
}

export function searchAggregator(source: Aggregator, title: string, signal?: AbortSignal): Promise<Job[]> {
  return source === "himalayas" ? searchHimalayas(title, signal) : searchJobicy(title, signal);
}
