// Federal jobs from the official USAJOBS Search API (developer.usajobs.gov).
// Unlike the company job boards, USAJOBS is searched by title, once per
// selected title. Runs server-side only; needs a free API key.

import type { Job } from "./types.ts";

interface UsaJobsItem {
  MatchedObjectId: string;
  MatchedObjectDescriptor: {
    PositionTitle: string;
    PositionURI: string;
    /** Documented as a string but returned as an array of one URL. */
    ApplyURI?: string[] | string;
    PositionLocationDisplay?: string;
    OrganizationName?: string;
    DepartmentName?: string;
    PublicationStartDate?: string;
    PositionRemuneration?: { MinimumRange?: string; MaximumRange?: string; RateIntervalCode?: string }[];
  };
}

export interface UsaJobsResponse {
  SearchResult?: { SearchResultItems?: UsaJobsItem[] };
}

export function normalizeUsaJobs(data: UsaJobsResponse): Job[] {
  return (data.SearchResult?.SearchResultItems ?? []).map(({ MatchedObjectId, MatchedObjectDescriptor: d }) => {
    const location = d.PositionLocationDisplay ?? "";
    // "PA" = per annum; hourly (PH) and other intervals aren't comparable to an annual salary filter.
    const pay = d.PositionRemuneration?.find((r) => r.RateIntervalCode === "PA");
    const min = Number(pay?.MinimumRange);
    const max = Number(pay?.MaximumRange);
    return {
      id: `usajobs:${MatchedObjectId}`,
      company: d.OrganizationName || d.DepartmentName || "U.S. Federal Government",
      title: d.PositionTitle.trim(),
      location,
      remote: /\bremote\b|anywhere in the u\.?s/i.test(location),
      url: d.PositionURI,
      applyUrl: (Array.isArray(d.ApplyURI) ? d.ApplyURI[0] : d.ApplyURI) || undefined,
      postedAt: d.PublicationStartDate ?? null,
      salary: pay && min > 0 && max >= min ? { min, max, currency: "USD" } : null,
      minYears: null,
      industry: "Nonprofit & Government",
    };
  });
}

export async function searchUsaJobs(
  title: string,
  credentials: { apiKey: string; email: string },
  signal?: AbortSignal,
): Promise<Job[]> {
  const params = new URLSearchParams({ PositionTitle: title, ResultsPerPage: "500" });
  const res = await fetch(`https://data.usajobs.gov/api/search?${params}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": credentials.email,
      "Authorization-Key": credentials.apiKey,
    },
    signal,
  });
  if (!res.ok) throw new Error(`USAJOBS returned ${res.status}`);
  return normalizeUsaJobs((await res.json()) as UsaJobsResponse);
}
