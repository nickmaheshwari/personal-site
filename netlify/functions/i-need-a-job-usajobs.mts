// GET /api/i-need-a-job/usajobs?title=Health%20Educator
// Federal postings whose title contains the given title, from the USAJOBS API.
// Off unless USAJOBS_API_KEY and USAJOBS_EMAIL are set; then it answers
// { disabled: true } so the page can say federal jobs aren't included.

import type { Config } from "@netlify/functions";
import type { JobsResponse } from "../../apps/i-need-a-job/shared/types.ts";
import { searchUsaJobs } from "../../apps/i-need-a-job/shared/usajobs.ts";

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

export default async (req: Request) => {
  const apiKey = process.env.USAJOBS_API_KEY;
  const email = process.env.USAJOBS_EMAIL;
  if (!apiKey || !email) {
    const body: JobsResponse = { company: "USAJOBS", jobs: [], disabled: true };
    return json(body, 200);
  }

  const title = new URL(req.url).searchParams.get("title")?.trim() ?? "";
  if (title.length < 2 || title.length > 80) return json({ error: "Expected a title of 2-80 characters." }, 400);

  try {
    const jobs = await searchUsaJobs(title, { apiKey, email }, AbortSignal.timeout(25_000));
    const body: JobsResponse = { company: "USAJOBS", jobs };
    return json(body, 200, {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Netlify-CDN-Cache-Control": "public, durable, s-maxage=3600, stale-while-revalidate=86400",
    });
  } catch (err) {
    console.error(`USAJOBS search failed for "${title}"`, err);
    return json({ error: "Couldn't load federal jobs." }, 502);
  }
};

export const config: Config = {
  path: "/api/i-need-a-job/usajobs",
  method: "GET",
  rateLimit: { windowLimit: 120, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
