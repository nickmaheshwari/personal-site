import { AGGREGATOR_NAMES, type Aggregator } from "../shared/aggregators.ts";
import { BATCHES, SEARCH_SOURCES } from "../shared/companies.ts";
import type { BatchResponse, Job, JobsResponse } from "../shared/types.ts";

/** One request in a search: a batch of employers, or one title on a title-searched source. */
export interface SearchTask {
  kind: "batch" | "usajobs" | "aggregator";
  url: string;
  /** Employers covered (a batch's size; 1 otherwise), for the progress bar. */
  weight: number;
  /** What to call it when the whole request fails. */
  names: string[];
  /** A batch of Workday/Oracle employers, which are run fewer at a time (see runSearchTasks). */
  careerSites?: boolean;
}

export type TaskResult = { jobs: Job[]; disabled: boolean; failed: string[]; partial: string[] } | { error: string };

/** Titles are sorted so the same selection always produces the same (CDN-cacheable) URLs. */
const titleParams = (titles: readonly string[]) => [...titles].sort().map((t) => ["title", t]);

export function batchTasks(titles: readonly string[]): SearchTask[] {
  return BATCHES.map((batch, i) => ({
    kind: "batch",
    url: `/api/i-need-a-job/jobs?${new URLSearchParams([["batch", `${i}`], ...titleParams(titles)])}`,
    weight: batch.length,
    names: batch.map((co) => co.name),
    careerSites: batch.some((co) => SEARCH_SOURCES.has(co.source)),
  }));
}

export function usaJobsTask(title: string): SearchTask {
  const params = new URLSearchParams({ source: "usajobs", title });
  return { kind: "usajobs", url: `/api/i-need-a-job/search?${params}`, weight: 1, names: [`USAJOBS (${title})`] };
}

export function aggregatorTask(source: Aggregator, title: string): SearchTask {
  const params = new URLSearchParams({ source, title });
  return {
    kind: "aggregator",
    url: `/api/i-need-a-job/search?${params}`,
    weight: 1,
    names: [`${AGGREGATOR_NAMES[source]} (${title})`],
  };
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

async function run(task: SearchTask, signal: AbortSignal): Promise<TaskResult> {
  const res = await fetch(task.url, { signal });
  if (!res.ok) throw await errorFrom(res);
  if (task.kind === "batch") {
    const body = (await res.json()) as BatchResponse;
    return { jobs: body.jobs, disabled: false, failed: body.failed, partial: body.partial ?? [] };
  }
  const body = (await res.json()) as JobsResponse;
  return { jobs: body.jobs, disabled: body.disabled === true, failed: [], partial: [] };
}

/**
 * Runs every task with limited concurrency, reporting each result as it
 * arrives so the UI can fill in progressively. Workday/Oracle batches run in
 * their own, smaller pool alongside the rest: those career sites rate-limit
 * bursts, and running more of them at once left employers with partial results.
 */
export async function runSearchTasks(
  tasks: readonly SearchTask[],
  onResult: (task: SearchTask, result: TaskResult) => void,
  signal: AbortSignal,
  { concurrency = 6, careerSiteConcurrency = 2 } = {},
): Promise<void> {
  const pool = async (queue: readonly SearchTask[], size: number) => {
    let next = 0;
    const worker = async () => {
      while (next < queue.length && !signal.aborted) {
        const task = queue[next++];
        if (!task) return;
        try {
          onResult(task, await run(task, signal));
        } catch (err) {
          if (signal.aborted) return;
          onResult(task, { error: err instanceof Error ? err.message : String(err) });
        }
      }
    };
    await Promise.all(Array.from({ length: size }, worker));
  };
  await Promise.all([
    pool(
      tasks.filter((t) => !t.careerSites),
      concurrency,
    ),
    pool(
      tasks.filter((t) => t.careerSites),
      careerSiteConcurrency,
    ),
  ]);
}

/** Sources with a description endpoint (see posting.ts). */
const DESCRIBED_SOURCES = new Set([
  "greenhouse",
  "lever",
  "ashby",
  "smartrecruiters",
  "bamboohr",
  "rippling",
  "gem",
  "workday",
  "oracle",
]);

/** Where to fetch a posting's description, or null for sources without one (USAJOBS, Breezy, job sites). */
export function postingUrl(job: Job): string | null {
  const [source = "", slug = "", ...rest] = job.id.split(":");
  if (!DESCRIBED_SOURCES.has(source) || !slug || rest.length === 0) return null;
  return `/api/i-need-a-job/posting?${new URLSearchParams({ source, slug, id: rest.join(":") })}`;
}

export async function fetchPostingText(url: string, signal: AbortSignal): Promise<string> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw await errorFrom(res);
  return ((await res.json()) as { text: string }).text;
}
