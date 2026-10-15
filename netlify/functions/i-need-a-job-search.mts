// GET /api/i-need-a-job/search?source=usajobs&title=Health%20Educator
// Postings from a title-searched source, one title per request:
//   usajobs    federal jobs from the USAJOBS API. Off unless USAJOBS_API_KEY and
//              USAJOBS_EMAIL are set; then it answers { disabled: true } so the
//              page can say federal jobs aren't included.
//   himalayas  remote jobs from Himalayas (see aggregators.ts)
//   jobicy     remote jobs from Jobicy
// The job sites' searches are fuzzy, so their results are narrowed to postings
// whose titles match (broad mode) before they're returned.

import type { Config } from "@netlify/functions";
import { AGGREGATORS, type Aggregator, searchAggregator } from "../../apps/i-need-a-job/shared/aggregators.ts";
import { matchTitle, tokenize } from "../../apps/i-need-a-job/shared/match.ts";
import type { JobsResponse } from "../../apps/i-need-a-job/shared/types.ts";
import { searchUsaJobs } from "../../apps/i-need-a-job/shared/usajobs.ts";

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

const cached = (body: JobsResponse) =>
  json(body, 200, {
    "Cache-Control": "public, max-age=0, must-revalidate",
    "Netlify-CDN-Cache-Control": "public, durable, s-maxage=3600, stale-while-revalidate=86400",
  });

const isAggregator = (s: string): s is Aggregator => (AGGREGATORS as readonly string[]).includes(s);

export default async (req: Request) => {
  const params = new URL(req.url).searchParams;
  const source = params.get("source") ?? "";
  const title = params.get("title")?.trim() ?? "";
  if (source !== "usajobs" && !isAggregator(source)) return json({ error: "Unknown source." }, 404);
  if (title.length < 2 || title.length > 80) return json({ error: "Expected a title of 2-80 characters." }, 400);

  if (source === "usajobs") {
    const apiKey = process.env.USAJOBS_API_KEY;
    const email = process.env.USAJOBS_EMAIL;
    if (!apiKey || !email) {
      const body: JobsResponse = { company: "USAJOBS", jobs: [], disabled: true };
      return json(body, 200);
    }
    try {
      return cached({
        company: "USAJOBS",
        jobs: await searchUsaJobs(title, { apiKey, email }, AbortSignal.timeout(25_000)),
      });
    } catch (err) {
      console.error(`USAJOBS search failed for "${title}"`, err);
      return json({ error: "Couldn't load federal jobs." }, 502);
    }
  }

  try {
    const selected = [tokenize(title)];
    const jobs = (await searchAggregator(source, title, AbortSignal.timeout(25_000))).filter(
      (j) => matchTitle(j.title, selected, true) >= 0,
    );
    return cached({ company: source, jobs });
  } catch (err) {
    console.error(`${source} search failed for "${title}"`, err);
    return json({ error: `Couldn't load ${source} jobs.` }, 502);
  }
};

export const config: Config = {
  path: "/api/i-need-a-job/search",
  method: "GET",
  rateLimit: { windowLimit: 120, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
