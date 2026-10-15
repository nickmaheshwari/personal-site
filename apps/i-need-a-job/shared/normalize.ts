// Fetches a company's postings from its public job-board API and normalizes them
// into compact Job records. Runs server-side only (in the jobs function).

import type { Company } from "./companies.ts";
import { findKeywords } from "./keywords.ts";
import { matchTitle, tokenize } from "./match.ts";
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
      skills: findKeywords(text),
    };
  });
}

// --- Lever: api.lever.co/v0/postings/<slug>?mode=json

interface LeverJob {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl?: string;
  createdAt?: number;
  workplaceType?: string;
  categories?: { location?: string; allLocations?: string[] };
  descriptionPlain?: string;
  additionalPlain?: string;
  lists?: { text?: string; content?: string }[];
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
}

/** A Lever posting's full text: description, bullet lists, and closing section. */
export function leverText(j: Pick<LeverJob, "descriptionPlain" | "lists" | "additionalPlain">): string {
  const lists = (j.lists ?? []).map((l) => `${l.text ?? ""} ${htmlToText(l.content ?? "")}`).join(" ");
  return `${j.descriptionPlain ?? ""} ${lists} ${j.additionalPlain ?? ""}`;
}

export function normalizeLever(company: Company, data: LeverJob[]): Job[] {
  return data.map((j) => {
    const text = leverText(j);
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
      applyUrl: j.applyUrl,
      postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
      salary: structuredSalary ?? extractSalary(text),
      minYears: extractMinYears(text),
      skills: findKeywords(text),
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
  applyUrl?: string;
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
        applyUrl: j.applyUrl,
        postedAt: j.publishedAt ?? null,
        salary: salaryComponent
          ? {
              min: salaryComponent.minValue ?? 0,
              max: salaryComponent.maxValue ?? 0,
              currency: salaryComponent.currencyCode ?? "USD",
            }
          : extractSalary(text),
        minYears: extractMinYears(text),
        skills: findKeywords(text),
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

// --- BambooHR: <slug>.bamboohr.com/careers/list
// Like SmartRecruiters, the list has no descriptions, so salary and experience stay null.

interface BambooJob {
  id: string;
  jobOpeningName: string;
  location?: { city?: string | null; state?: string | null };
  atsLocation?: { city?: string | null; state?: string | null; country?: string | null };
  isRemote?: boolean | null;
  locationType?: string | null;
}

export function normalizeBambooHR(company: Company, data: { result: BambooJob[] }): Job[] {
  return data.result.map((j) => {
    const loc = j.location?.city || j.location?.state ? j.location : j.atsLocation;
    const location = [loc?.city, loc?.state].filter(Boolean).join(", ");
    // locationType "1" is remote, "2" hybrid.
    const remote = j.isRemote === true || j.locationType === "1";
    return {
      id: `bamboohr:${company.slug}:${j.id}`,
      company: company.name,
      title: j.jobOpeningName.trim(),
      location: remote && !location ? "Remote" : location,
      remote,
      url: `https://${company.slug}.bamboohr.com/careers/${j.id}`,
      postedAt: null,
      salary: null,
      minYears: null,
    };
  });
}

// --- Breezy: <slug>.breezy.hr/json (no descriptions; salary is a display string)

interface BreezyJob {
  id: string;
  name: string;
  url: string;
  published_date?: string;
  salary?: string;
  location?: { name?: string; is_remote?: boolean };
}

export function normalizeBreezy(company: Company, data: BreezyJob[]): Job[] {
  return data.map((j) => {
    const location = j.location?.name ?? "";
    return {
      id: `breezy:${company.slug}:${j.id}`,
      company: company.name,
      title: j.name.trim(),
      location,
      remote: j.location?.is_remote === true || isRemoteText(location),
      url: j.url,
      postedAt: j.published_date ?? null,
      salary: extractSalary(j.salary ?? ""),
      minYears: null,
    };
  });
}

// --- Rippling: api.rippling.com/platform/api/ats/v1/board/<slug>/jobs (no descriptions)

interface RipplingJob {
  uuid: string;
  name: string;
  url: string;
  workLocation?: { label?: string };
}

export function normalizeRippling(company: Company, data: RipplingJob[]): Job[] {
  return data.map((j) => {
    const location = j.workLocation?.label ?? "";
    return {
      id: `rippling:${company.slug}:${j.uuid}`,
      company: company.name,
      title: j.name.trim(),
      location,
      remote: isRemoteText(location),
      url: j.url,
      postedAt: null,
      salary: null,
      minYears: null,
    };
  });
}

// --- Gem: api.gem.com/job_board/v0/<slug>/job_posts/ (Greenhouse-like, with descriptions)

interface GemJob {
  id: string;
  title: string;
  absolute_url: string;
  content_plain?: string;
  first_published_at?: string;
  location?: { name?: string };
  location_type?: string;
}

export function normalizeGem(company: Company, data: GemJob[]): Job[] {
  return data.map((j) => {
    const text = j.content_plain ?? "";
    const location = j.location?.name ?? "";
    return {
      id: `gem:${company.slug}:${j.id}`,
      company: company.name,
      title: j.title.trim(),
      location,
      remote: j.location_type === "remote" || isRemoteText(location),
      url: j.absolute_url,
      postedAt: j.first_published_at ?? null,
      salary: extractSalary(text),
      minYears: extractMinYears(text),
      skills: findKeywords(text),
    };
  });
}

// --- Workday: POST <tenant>.wd<N>.myworkdayjobs.com/wday/cxs/<tenant>/<site>/jobs
// The JSON endpoint behind Workday career sites. It returns 20 postings per page
// and big employers have thousands, so it's searched by title, a few pages each.

export function workdayParts(slug: string): { tenant: string; host: string; site: string } {
  const [tenant = "", wd = "", site = ""] = slug.split("/");
  return { tenant, host: `${tenant}.${wd}.myworkdayjobs.com`, site };
}

interface WorkdayJob {
  title: string;
  externalPath: string;
  locationsText?: string;
  postedOn?: string;
}

interface WorkdayPage {
  total: number;
  jobPostings: WorkdayJob[];
}

/** "Posted Today", "Posted Yesterday", "Posted 3 Days Ago", "Posted 30+ Days Ago" → an approximate date. */
export function workdayPostedAt(postedOn: string | undefined, now = Date.now()): string | null {
  if (!postedOn) return null;
  const days = /today/i.test(postedOn)
    ? 0
    : /yesterday/i.test(postedOn)
      ? 1
      : Number(/(\d+)\+?\s*days?/i.exec(postedOn)?.[1] ?? Number.NaN);
  return Number.isFinite(days) ? new Date(now - days * 86_400_000).toISOString() : null;
}

export function normalizeWorkday(company: Company, jobs: WorkdayJob[]): Job[] {
  const { host, site } = workdayParts(company.slug);
  return jobs.map((j) => {
    const location = j.locationsText ?? "";
    return {
      id: `workday:${company.slug}:${j.externalPath}`,
      company: company.name,
      title: j.title.trim(),
      location,
      remote: isRemoteText(location),
      url: `https://${host}/${site}${j.externalPath}`,
      postedAt: workdayPostedAt(j.postedOn),
      salary: null,
      minYears: null,
    };
  });
}

const WD_PAGE = 20;
const SEARCH_PAGES = 2;
const RETRIES = 2;

/**
 * Should a title search fetch the next page? Only when this page was full and
 * at least a quarter real matches: the career sites' searches are fuzzy, so a
 * page of near-misses means the rest are worse. Measured on a 5-title finance
 * search, this finds ~94% of the matches that always fetching page 2 does, with
 * half the requests (always fetching page 2 set off Workday's rate limiting).
 */
function worthNextPage(pageTitles: readonly string[], pageSize: number, title: string): boolean {
  if (pageTitles.length < pageSize) return false;
  const selected = [tokenize(title)];
  return pageTitles.filter((t) => matchTitle(t, selected, true) >= 0).length * 4 >= pageSize;
}

/**
 * fetch() that waits and retries when the server is rate limiting (429/503).
 * Career sites limit bursts, so title searches also keep their requests few and spaced out.
 */
async function politeFetch(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, init);
    if ((res.status !== 429 && res.status !== 503) || attempt >= RETRIES) return res;
    const retryAfter = Number(res.headers.get("Retry-After"));
    const waitMs =
      Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 5) * 1000 : 1500 * (attempt + 1);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    init.signal?.throwIfAborted();
  }
}

async function searchWorkday(company: Company, title: string, signal?: AbortSignal): Promise<WorkdayJob[]> {
  const { tenant, host, site } = workdayParts(company.slug);
  const jobs: WorkdayJob[] = [];
  for (let offset = 0; offset < WD_PAGE * SEARCH_PAGES; offset += WD_PAGE) {
    const res = await politeFetch(`https://${host}/wday/cxs/${tenant}/${site}/jobs`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ appliedFacets: {}, limit: WD_PAGE, offset, searchText: title }),
      signal,
    });
    if (!res.ok) throw new Error(`workday returned ${res.status} for ${company.slug}`);
    const page = (await res.json()) as WorkdayPage;
    const postings = page.jobPostings ?? [];
    jobs.push(...postings);
    if (
      !worthNextPage(
        postings.map((p) => p.title),
        WD_PAGE,
        title,
      )
    )
      break;
  }
  return jobs;
}

// --- Oracle Recruiting Cloud: <host>/hcmRestApi/resources/latest/recruitingCEJobRequisitions
// The JSON endpoint behind Oracle career sites (JPMorgan Chase, Oracle). Searched by keyword.

export function oracleParts(slug: string): { host: string; site: string } {
  const [host = "", site = ""] = slug.split("/");
  return { host, site };
}

interface OracleJob {
  Id: string;
  Title: string;
  PostedDate?: string;
  PrimaryLocation?: string;
  WorkplaceType?: string;
}

interface OracleResponse {
  items?: { TotalJobsCount?: number; requisitionList?: OracleJob[] }[];
}

export function normalizeOracle(company: Company, jobs: OracleJob[]): Job[] {
  const { host, site } = oracleParts(company.slug);
  return jobs.map((j) => {
    const location = j.PrimaryLocation ?? "";
    return {
      id: `oracle:${company.slug}:${j.Id}`,
      company: company.name,
      title: j.Title.trim(),
      location,
      remote: /remote/i.test(j.WorkplaceType ?? "") || isRemoteText(location),
      url: `https://${host}/hcmUI/CandidateExperience/en/sites/${site}/job/${j.Id}`,
      postedAt: j.PostedDate ?? null,
      salary: null,
      minYears: null,
    };
  });
}

const ORACLE_PAGE = 25;

async function searchOracle(company: Company, title: string, signal?: AbortSignal): Promise<OracleJob[]> {
  const { host, site } = oracleParts(company.slug);
  // The finder's arguments are comma-separated, so commas in the title would break it.
  const keyword = encodeURIComponent(title.replace(/[,;"]/g, " "));
  const jobs: OracleJob[] = [];
  for (let offset = 0; offset < ORACLE_PAGE * SEARCH_PAGES; offset += ORACLE_PAGE) {
    const url =
      `https://${host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList` +
      `&finder=findReqs;siteNumber=${site},keyword=${keyword},limit=${ORACLE_PAGE},offset=${offset},sortBy=POSTING_DATES_DESC`;
    const res = await politeFetch(url, { headers: { Accept: "application/json" }, signal });
    if (!res.ok) throw new Error(`oracle returned ${res.status} for ${company.slug}`);
    const postings = ((await res.json()) as OracleResponse).items?.[0]?.requisitionList ?? [];
    jobs.push(...postings);
    if (
      !worthNextPage(
        postings.map((p) => p.Title),
        ORACLE_PAGE,
        title,
      )
    )
      break;
  }
  return jobs;
}

/** Titles searched at once per company: faster than one at a time, without bursting the career site. */
const TITLE_CONCURRENCY = 2;

/**
 * A Workday or Oracle employer's postings for the given titles, searched one
 * title per request. Stops starting new titles after `budgetMs`, and keeps what
 * it found when a title fails or runs out of time, so a slow employer returns
 * partial results instead of none. Throws only when nothing succeeded.
 */
export async function searchCompanyJobs(
  company: Company,
  titles: readonly string[],
  budgetMs: number,
  signal?: AbortSignal,
): Promise<{ jobs: Job[]; complete: boolean }> {
  const started = Date.now();
  const jobs: Job[] = [];
  let searched = 0;
  let firstError: unknown = null;
  let next = 0;
  const worker = async () => {
    while (next < titles.length && Date.now() - started < budgetMs && !signal?.aborted) {
      const title = titles[next++] as string;
      try {
        jobs.push(
          ...(company.source === "workday"
            ? normalizeWorkday(company, await searchWorkday(company, title, signal))
            : normalizeOracle(company, await searchOracle(company, title, signal))),
        );
        searched++;
      } catch (err) {
        firstError ??= err;
      }
    }
  };
  await Promise.all(Array.from({ length: TITLE_CONCURRENCY }, worker));
  if (searched === 0 && titles.length > 0) throw firstError ?? new Error(`${company.source} search timed out`);
  const seen = new Set<string>();
  return {
    jobs: jobs.filter((j) => !seen.has(j.id) && seen.add(j.id)),
    complete: searched === titles.length,
  };
}

// --- Fetching

type BoardSource = Exclude<Company["source"], "smartrecruiters" | "workday" | "oracle">;

const ENDPOINTS: Record<BoardSource, (slug: string) => string> = {
  greenhouse: (slug) => `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`,
  lever: (slug) => `https://api.lever.co/v0/postings/${slug}?mode=json`,
  ashby: (slug) => `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`,
  bamboohr: (slug) => `https://${slug}.bamboohr.com/careers/list`,
  breezy: (slug) => `https://${slug}.breezy.hr/json`,
  rippling: (slug) => `https://api.rippling.com/platform/api/ats/v1/board/${slug}/jobs`,
  gem: (slug) => `https://api.gem.com/job_board/v0/${slug}/job_posts/`,
};

/** Every posting on a company's job board. Workday and Oracle (SEARCH_SOURCES) use searchCompanyJobs instead. */
export async function fetchCompanyJobs(company: Company, signal?: AbortSignal): Promise<Job[]> {
  if (company.source === "workday" || company.source === "oracle") {
    throw new Error(`${company.source} is searched by title; use searchCompanyJobs`);
  }
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
    case "bamboohr":
      return normalizeBambooHR(company, data as { result: BambooJob[] });
    case "breezy":
      return normalizeBreezy(company, data as BreezyJob[]);
    case "rippling":
      return normalizeRippling(company, data as RipplingJob[]);
    case "gem":
      return normalizeGem(company, data as GemJob[]);
  }
}
