// GET /api/i-need-a-job/jobs?source=greenhouse&slug=stripe
// Returns one company's current postings, normalized and without descriptions.
// Only companies in the allowlist can be fetched, so this can't be used as an
// open proxy. Responses are CDN-cached so most searches never hit the job boards.

import type { Config } from "@netlify/functions";
import { findCompany } from "../../apps/i-need-a-job/shared/companies.ts";
import { fetchCompanyJobs } from "../../apps/i-need-a-job/shared/normalize.ts";
import type { JobsResponse } from "../../apps/i-need-a-job/shared/types.ts";

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

export default async (req: Request) => {
  const params = new URL(req.url).searchParams;
  const company = findCompany(params.get("source") ?? "", params.get("slug") ?? "");
  if (!company) return json({ error: "Unknown company." }, 404);

  try {
    const jobs = await fetchCompanyJobs(company, AbortSignal.timeout(25_000));
    const body: JobsResponse = { company: company.name, jobs };
    return json(body, 200, {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Netlify-CDN-Cache-Control": "public, durable, s-maxage=3600, stale-while-revalidate=86400",
    });
  } catch (err) {
    console.error(`Failed to fetch ${company.source}/${company.slug}`, err);
    return json({ error: `Couldn't load ${company.name} jobs.` }, 502);
  }
};

export const config: Config = {
  path: "/api/i-need-a-job/jobs",
  method: "GET",
  rateLimit: { windowLimit: 300, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
