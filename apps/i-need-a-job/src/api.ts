import type { Company } from "../shared/companies.ts";
import type { Job, JobsResponse } from "../shared/types.ts";

/** One request in a search: a company's job board, or a USAJOBS title search. */
export interface SearchTask {
  label: string;
  kind: "company" | "usajobs";
  url: string;
}

export type TaskResult = { jobs: Job[]; disabled: boolean } | { error: string };

export function companyTask(company: Company): SearchTask {
  const params = new URLSearchParams({ source: company.source, slug: company.slug });
  return { label: company.name, kind: "company", url: `/api/i-need-a-job/jobs?${params}` };
}

export function usaJobsTask(title: string): SearchTask {
  const params = new URLSearchParams({ title });
  return { label: `USAJOBS: ${title}`, kind: "usajobs", url: `/api/i-need-a-job/usajobs?${params}` };
}

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

async function run(task: SearchTask, signal: AbortSignal): Promise<{ jobs: Job[]; disabled: boolean }> {
  const res = await fetch(task.url, { signal });
  if (!res.ok) throw await errorFrom(res);
  const body = (await res.json()) as JobsResponse;
  return { jobs: body.jobs, disabled: body.disabled === true };
}

/**
 * Runs every task with limited concurrency, reporting each result as it
 * arrives so the UI can fill in progressively.
 */
export async function runSearchTasks(
  tasks: readonly SearchTask[],
  onResult: (task: SearchTask, result: TaskResult) => void,
  signal: AbortSignal,
  concurrency = 8,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < tasks.length && !signal.aborted) {
      const task = tasks[next++];
      if (!task) return;
      try {
        onResult(task, await run(task, signal));
      } catch (err) {
        if (signal.aborted) return;
        onResult(task, { error: err instanceof Error ? err.message : String(err) });
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
}

const BOARD_SOURCES = new Set(["greenhouse", "lever", "ashby", "smartrecruiters"]);

/** Where to fetch a posting's description, or null for sources without one (USAJOBS). */
export function postingUrl(job: Job): string | null {
  const [source = "", slug = "", ...rest] = job.id.split(":");
  if (!BOARD_SOURCES.has(source) || !slug || rest.length === 0) return null;
  return `/api/i-need-a-job/posting?${new URLSearchParams({ source, slug, id: rest.join(":") })}`;
}

export async function fetchPostingText(url: string, signal: AbortSignal): Promise<string> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw await errorFrom(res);
  return ((await res.json()) as { text: string }).text;
}
