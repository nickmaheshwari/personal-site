// GET /api/i-need-a-job/posting?source=lever&slug=sierraclub&id=<posting id>
// One posting's description as plain text, for comparing against a resume in
// the browser. Only allowlisted companies; responses are CDN-cached.

import type { Config } from "@netlify/functions";
import { findCompany } from "../../apps/i-need-a-job/shared/companies.ts";
import { fetchPostingText, PostingError } from "../../apps/i-need-a-job/shared/posting.ts";

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

export default async (req: Request) => {
  const params = new URL(req.url).searchParams;
  const company = findCompany(params.get("source") ?? "", params.get("slug") ?? "");
  const id = params.get("id") ?? "";
  if (!company) return json({ error: "Unknown company." }, 404);
  // Workday postings are identified by their path on the career site.
  const validId =
    company.source === "workday"
      ? id.length <= 300 && /^\/job(\/[\w%.()~-]+)+$/.test(id) && !id.includes("..")
      : /^[\w-]{1,80}$/.test(id);
  if (!validId) return json({ error: "Invalid posting id." }, 400);

  try {
    const text = await fetchPostingText(company, id, AbortSignal.timeout(25_000));
    return json({ text }, 200, {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Netlify-CDN-Cache-Control": "public, durable, s-maxage=3600, stale-while-revalidate=86400",
    });
  } catch (err) {
    if (err instanceof PostingError && err.status === 404)
      return json({ error: "This posting is no longer listed." }, 404);
    console.error(`Failed to fetch posting ${company.source}/${company.slug}/${id}`, err);
    return json({ error: "Couldn't load the job description." }, 502);
  }
};

export const config: Config = {
  path: "/api/i-need-a-job/posting",
  method: "GET",
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
