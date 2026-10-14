// Fetches one posting's full description as plain text, for the resume keyword
// check. Runs server-side only (in the posting function).

import type { Company } from "./companies.ts";
import { htmlToText, leverText } from "./normalize.ts";

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" }, signal });
  if (!res.ok) throw new PostingError(res.status === 404 ? 404 : 502, `Job board returned ${res.status}`);
  return (await res.json()) as T;
}

export class PostingError extends Error {
  readonly status: 404 | 502;

  constructor(status: 404 | 502, message: string) {
    super(message);
    this.status = status;
  }
}

export async function fetchPostingText(company: Company, postingId: string, signal?: AbortSignal): Promise<string> {
  const slug = encodeURIComponent(company.slug);
  const id = encodeURIComponent(postingId);
  switch (company.source) {
    case "greenhouse": {
      const j = await getJson<{ content?: string }>(
        `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs/${id}`,
        signal,
      );
      return htmlToText(j.content ?? "");
    }
    case "lever": {
      const j = await getJson<Parameters<typeof leverText>[0]>(
        `https://api.lever.co/v0/postings/${slug}/${id}`,
        signal,
      );
      return leverText(j).trim();
    }
    case "ashby": {
      // Ashby has no single-posting endpoint, so find it in the board's list.
      const board = await getJson<{ jobs: { id: string; descriptionPlain?: string }[] }>(
        `https://api.ashbyhq.com/posting-api/job-board/${slug}`,
        signal,
      );
      const j = board.jobs.find((job) => job.id === postingId);
      if (!j) throw new PostingError(404, "Posting not found");
      return (j.descriptionPlain ?? "").trim();
    }
    case "smartrecruiters": {
      const j = await getJson<{ jobAd?: { sections?: Record<string, { title?: string; text?: string }> } }>(
        `https://api.smartrecruiters.com/v1/companies/${slug}/postings/${id}`,
        signal,
      );
      return Object.values(j.jobAd?.sections ?? {})
        .map((s) => `${s.title ?? ""} ${htmlToText(s.text ?? "")}`)
        .join(" ")
        .trim();
    }
  }
}
