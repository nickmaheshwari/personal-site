// Fetches a company's postings from its public job-board API and normalizes them
// into compact Job records. Runs server-side only (in the jobs function).

import type { Company } from "./companies.ts";
import type { Job } from "./types.ts";

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

/** Greenhouse returns entity-escaped HTML, so decode, strip tags, then decode again. */
export function htmlToText(html: string): string {
  return decodeEntities(decodeEntities(html).replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function parseAmount(raw: string): number {
  const n = Number.parseFloat(raw.replace(/[,$\s]/g, ""));
  return /k$/i.test(raw.trim()) ? n * 1000 : n;
}

const AMOUNT = String.raw`\$\s?(\d{1,3}(?:,\d{3})+|\d{2,3}(?:\.\d+)?\s?[kK])`;
const SALARY_RANGE = new RegExp(`${AMOUNT}(?:\\s*(?:USD|usd))?\\s*(?:-|–|—|to)\\s*${AMOUNT}`);

/** Finds the first annual-looking USD range ("$150,000 - $200,000", "$150K–$200K") in free text. */
export function extractSalary(text: string): Job["salary"] {
  const m = SALARY_RANGE.exec(text);
  if (!m?.[1] || !m[2]) return null;
  const min = parseAmount(m[1]);
  const max = parseAmount(m[2]);
  // Skip hourly rates and nonsense ranges.
  if (min < 20_000 || max < min) return null;
  return { min, max, currency: "USD" };
}

const YEARS =
  /(\d{1,2})\s*(?:\+|plus)?\s*(?:(?:-|–|to)\s*\d{1,2}\s*)?\+?\s*years?(?:\s+of)?(?:\s+[\w/-]+){0,4}?\s+experience/gi;

/** Smallest "N+ years of ... experience" requirement mentioned in the text. */
export function extractMinYears(text: string): number | null {
  let min: number | null = null;
  for (const m of text.matchAll(YEARS)) {
    const n = Number(m[1]);
    if (n > 0 && n <= 30 && (min === null || n < min)) min = n;
  }
  return min;
}

const isRemoteText = (s: string) => /\bremote\b/i.test(s);

// --- Greenhouse: boards-api.greenhouse.io/v1/boards/<slug>/jobs?content=true

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  updated_at?: string;
  first_published?: string;
  location?: { name?: string };
  content?: string;
}

export function normalizeGreenhouse(company: Company, data: { jobs: GreenhouseJob[] }): Job[] {
  return data.jobs.map((j) => {
    const text = htmlToText(j.content ?? "");
    const location = j.location?.name ?? "";
    return {
      id: `greenhouse:${company.slug}:${j.id}`,
      company: company.name,
      title: j.title.trim(),
      location,
      remote: isRemoteText(location),
      url: j.absolute_url,
      postedAt: j.first_published ?? j.updated_at ?? null,
      salary: extractSalary(text),
      minYears: extractMinYears(text),
    };
  });
}

// --- Lever: api.lever.co/v0/postings/<slug>?mode=json

interface LeverJob {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt?: number;
  workplaceType?: string;
  categories?: { location?: string; allLocations?: string[] };
  descriptionPlain?: string;
  additionalPlain?: string;
  lists?: { text?: string; content?: string }[];
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
}

export function normalizeLever(company: Company, data: LeverJob[]): Job[] {
  return data.map((j) => {
    const lists = (j.lists ?? []).map((l) => `${l.text ?? ""} ${htmlToText(l.content ?? "")}`).join(" ");
    const text = `${j.descriptionPlain ?? ""} ${lists} ${j.additionalPlain ?? ""}`;
    const locations = j.categories?.allLocations?.length ? j.categories.allLocations : [j.categories?.location ?? ""];
    const location = locations.filter(Boolean).join(" • ");
    const range = j.salaryRange;
    const structuredSalary =
      range?.min && range.max && /year/i.test(range.interval ?? "")
        ? { min: range.min, max: range.max, currency: range.currency ?? "USD" }
        : null;
    return {
      id: `lever:${company.slug}:${j.id}`,
      company: company.name,
      title: j.text.trim(),
      location,
      remote: j.workplaceType === "remote" || isRemoteText(location),
      url: j.hostedUrl,
      postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
      salary: structuredSalary ?? extractSalary(text),
      minYears: extractMinYears(text),
    };
  });
}

// --- Ashby: api.ashbyhq.com/posting-api/job-board/<slug>?includeCompensation=true

interface AshbyJob {
  id: string;
  title: string;
  location?: string;
  secondaryLocations?: { location?: string }[];
  isRemote?: boolean | null;
  workplaceType?: string | null;
  isListed?: boolean;
  jobUrl: string;
  publishedAt?: string;
  descriptionPlain?: string;
  compensation?: {
    summaryComponents?: {
      compensationType?: string;
      interval?: string;
      currencyCode?: string | null;
      minValue?: number | null;
      maxValue?: number | null;
    }[];
  };
}

export function normalizeAshby(company: Company, data: { jobs: AshbyJob[] }): Job[] {
  return data.jobs
    .filter((j) => j.isListed !== false)
    .map((j) => {
      const text = j.descriptionPlain ?? "";
      const location = [j.location, ...(j.secondaryLocations ?? []).map((s) => s.location)].filter(Boolean).join(" • ");
      const salaryComponent = j.compensation?.summaryComponents?.find(
        (c) => c.compensationType === "Salary" && c.interval === "1 YEAR" && c.minValue && c.maxValue,
      );
      return {
        id: `ashby:${company.slug}:${j.id}`,
        company: company.name,
        title: j.title.trim(),
        location,
        // Ashby sets isRemote on hybrid roles too, so prefer workplaceType when present.
        remote: j.workplaceType ? j.workplaceType === "Remote" : j.isRemote === true || isRemoteText(location),
        url: j.jobUrl,
        postedAt: j.publishedAt ?? null,
        salary: salaryComponent
          ? {
              min: salaryComponent.minValue ?? 0,
              max: salaryComponent.maxValue ?? 0,
              currency: salaryComponent.currencyCode ?? "USD",
            }
          : extractSalary(text),
        minYears: extractMinYears(text),
      };
    });
}

// --- SmartRecruiters: api.smartrecruiters.com/v1/companies/<id>/postings
// The list endpoint has no descriptions, so salary and experience stay null
// (fetching each posting's details would be one request per job).

interface SmartRecruitersJob {
  id: string;
  name: string;
  releasedDate?: string;
  company?: { identifier?: string };
  location?: {
    city?: string;
    country?: string;
    remote?: boolean;
    fullLocation?: string;
  };
}

interface SmartRecruitersPage {
  totalFound: number;
  content: SmartRecruitersJob[];
}

export function normalizeSmartRecruiters(company: Company, jobs: SmartRecruitersJob[]): Job[] {
  return jobs.map((j) => {
    const loc = j.location ?? {};
    const full = loc.fullLocation ?? "";
    // Outside the US, region codes ("Barcelona, CT, Spain") would collide with
    // US state abbreviations, so keep just the city and country.
    const location =
      loc.country === "us" || !full.includes(",")
        ? full
        : [loc.city, full.split(", ").at(-1)].filter(Boolean).join(", ");
    return {
      id: `smartrecruiters:${company.slug}:${j.id}`,
      company: company.name,
      title: j.name.trim(),
      location: loc.remote ? `${location} (Remote)` : location,
      remote: loc.remote === true,
      url: `https://jobs.smartrecruiters.com/${j.company?.identifier ?? company.slug}/${j.id}`,
      postedAt: j.releasedDate ?? null,
      salary: null,
      minYears: null,
    };
  });
}

const SR_PAGE = 100;
/** Large employers (Bosch has ~5,000 postings) are capped to keep the function fast. */
const SR_MAX_POSTINGS = 2000;

async function fetchSmartRecruiters(company: Company, signal?: AbortSignal): Promise<Job[]> {
  const page = async (offset: number): Promise<SmartRecruitersPage> => {
    const url = `https://api.smartrecruiters.com/v1/companies/${company.slug}/postings?limit=${SR_PAGE}&offset=${offset}`;
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal });
    if (!res.ok) throw new Error(`smartrecruiters returned ${res.status} for ${company.slug}`);
    return (await res.json()) as SmartRecruitersPage;
  };
  const first = await page(0);
  const total = Math.min(first.totalFound, SR_MAX_POSTINGS);
  const offsets: number[] = [];
  for (let offset = SR_PAGE; offset < total; offset += SR_PAGE) offsets.push(offset);
  const rest = await Promise.all(offsets.map(page));
  return normalizeSmartRecruiters(
    company,
    [first, ...rest].flatMap((p) => p.content),
  );
}

const ENDPOINTS: Record<Exclude<Company["source"], "smartrecruiters">, (slug: string) => string> = {
  greenhouse: (slug) => `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`,
  lever: (slug) => `https://api.lever.co/v0/postings/${slug}?mode=json`,
  ashby: (slug) => `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`,
};

export async function fetchCompanyJobs(company: Company, signal?: AbortSignal): Promise<Job[]> {
  if (company.source === "smartrecruiters") return fetchSmartRecruiters(company, signal);
  const res = await fetch(ENDPOINTS[company.source](company.slug), {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!res.ok) throw new Error(`${company.source} returned ${res.status} for ${company.slug}`);
  const data: unknown = await res.json();
  switch (company.source) {
    case "greenhouse":
      return normalizeGreenhouse(company, data as { jobs: GreenhouseJob[] });
    case "lever":
      return normalizeLever(company, data as LeverJob[]);
    case "ashby":
      return normalizeAshby(company, data as { jobs: AshbyJob[] });
  }
}
