import type { Company } from "../shared/companies.ts";
import type { Job, JobsResponse } from "../shared/types.ts";

async function errorFrom(res: Response): Promise<Error> {
  let message = `Request failed (${res.status})`;
  try {
    const body: unknown = await res.json();
    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") message = body.error;
  } catch {
    // Non-JSON error body (e.g. a Netlify rate-limit page); keep the generic message.
  }
  if (res.status === 429) message = "Too many requests. Wait a minute and try again.";
  return new Error(message);
}

async function fetchJobs(company: Company, signal: AbortSignal): Promise<Job[]> {
  const params = new URLSearchParams({ source: company.source, slug: company.slug });
  const res = await fetch(`/api/i-need-a-job/jobs?${params}`, { signal });
  if (!res.ok) throw await errorFrom(res);
  return ((await res.json()) as JobsResponse).jobs;
}

/**
 * Fetches every company's postings with limited concurrency, reporting each
 * company's result as it arrives so the UI can fill in progressively.
 */
export async function fetchAllJobs(
  companies: readonly Company[],
  onResult: (company: Company, result: { jobs: Job[] } | { error: string }) => void,
  signal: AbortSignal,
  concurrency = 8,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < companies.length && !signal.aborted) {
      const company = companies[next++];
      if (!company) return;
      try {
        onResult(company, { jobs: await fetchJobs(company, signal) });
      } catch (err) {
        if (signal.aborted) return;
        onResult(company, { error: err instanceof Error ? err.message : String(err) });
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
}
