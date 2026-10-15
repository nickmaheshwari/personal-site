// GET /api/i-need-a-job/jobs?batch=3&title=Financial%20Analyst&title=Accountant
// One batch of companies (see BATCHES), returning only postings whose titles
// match a selected title. Matching uses broad mode, which accepts everything
// strict mode does, so the browser can still switch between the two.
//
// Filtering here instead of in the browser keeps responses small: there are
// ~900 companies and well over 100k postings. Only allowlisted companies are
// fetched, so this can't be used as an open proxy. Responses are CDN-cached per
// batch and title list, and each company's postings are kept in memory for an
// hour so repeat searches on a warm instance don't refetch them.

import type { Config } from "@netlify/functions";
import { BATCHES, type Company, SEARCH_SOURCES } from "../../apps/i-need-a-job/shared/companies.ts";
import { matchTitle, tokenize } from "../../apps/i-need-a-job/shared/match.ts";
import { fetchCompanyJobs, searchCompanyJobs } from "../../apps/i-need-a-job/shared/normalize.ts";
import type { BatchResponse, Job } from "../../apps/i-need-a-job/shared/types.ts";

const MAX_TITLES = 20;
const CACHE_MS = 60 * 60 * 1000;
// Functions are stopped after 60 seconds. Title searches stop starting new
// titles after SEARCH_BUDGET_MS and are aborted at SEARCH_TIMEOUT_MS, keeping
// whatever they found.
const BOARD_TIMEOUT_MS = 25_000;
const SEARCH_BUDGET_MS = 35_000;
const SEARCH_TIMEOUT_MS = 50_000;

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

type Result = { jobs: Job[]; complete: boolean };

const cache = new Map<string, { at: number; result: Promise<Result> }>();

/**
 * A company's postings, from memory when fetched within the hour. Failed and
 * partial results aren't kept, so the next search tries again.
 */
function cachedJobs(company: Company, titles: readonly string[]): Promise<Result> {
  // Title searches depend on the titles; job boards don't.
  const search = SEARCH_SOURCES.has(company.source);
  const key = search ? `${company.source}:${company.slug}:${titles.join("|")}` : `${company.source}:${company.slug}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.result;
  const result = search
    ? searchCompanyJobs(company, titles, SEARCH_BUDGET_MS, AbortSignal.timeout(SEARCH_TIMEOUT_MS))
    : fetchCompanyJobs(company, AbortSignal.timeout(BOARD_TIMEOUT_MS)).then((jobs) => ({ jobs, complete: true }));
  cache.set(key, { at: Date.now(), result });
  result.then(
    (r) => r.complete || cache.delete(key),
    () => cache.delete(key),
  );
  return result;
}

export default async (req: Request) => {
  const params = new URL(req.url).searchParams;
  const batch = BATCHES[Number(params.get("batch"))];
  if (!/^\d+$/.test(params.get("batch") ?? "") || !batch) return json({ error: "Unknown batch." }, 404);

  const titles = [...new Set(params.getAll("title").map((t) => t.trim()))];
  if (titles.length === 0 || titles.length > MAX_TITLES || titles.some((t) => t.length < 2 || t.length > 80)) {
    return json({ error: `Expected 1-${MAX_TITLES} titles of 2-80 characters.` }, 400);
  }
  const selected = titles.map((t) => tokenize(t));

  const results = await Promise.allSettled(batch.map((company) => cachedJobs(company, titles)));
  const body: BatchResponse = { jobs: [], failed: [], partial: [] };
  results.forEach((result, i) => {
    const company = batch[i] as Company;
    if (result.status === "rejected") {
      console.error(`Failed to fetch ${company.source}/${company.slug}`, result.reason);
      body.failed.push(company.name);
      return;
    }
    if (!result.value.complete) {
      console.warn(`Partial results for ${company.source}/${company.slug}: ran out of time`);
      body.partial.push(company.name);
    }
    for (const job of result.value.jobs) if (matchTitle(job.title, selected, true) >= 0) body.jobs.push(job);
  });

  return json(body, 200, {
    "Cache-Control": "public, max-age=0, must-revalidate",
    // Failed and partial results are cached briefly, so they're retried soon.
    "Netlify-CDN-Cache-Control":
      body.failed.length > 0 || body.partial.length > 0
        ? "public, durable, s-maxage=300"
        : "public, durable, s-maxage=3600, stale-while-revalidate=86400",
  });
};

export const config: Config = {
  path: "/api/i-need-a-job/jobs",
  method: "GET",
  rateLimit: { windowLimit: 300, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
