import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeHimalayas, normalizeJobicy } from "./aggregators.ts";
import { BATCHES, COMPANIES, type Company, SEARCH_SOURCES } from "./companies.ts";
import { dedupeJobs } from "./match.ts";
import {
  normalizeBambooHR,
  normalizeBreezy,
  normalizeGem,
  normalizeOracle,
  normalizeRippling,
  normalizeWorkday,
  searchCompanyJobs,
  workdayPostedAt,
} from "./normalize.ts";
import type { Job } from "./types.ts";

const co = (source: Company["source"], slug: string): Company => ({
  name: "Acme",
  source,
  slug,
  industry: "Finance",
});

describe("BATCHES", () => {
  it("covers every company exactly once, keeping title-searched sources apart", () => {
    expect(BATCHES.flat()).toHaveLength(COMPANIES.length);
    expect(new Set(BATCHES.flat()).size).toBe(COMPANIES.length);
    for (const batch of BATCHES) {
      expect(new Set(batch.map((c) => SEARCH_SOURCES.has(c.source))).size).toBe(1);
    }
  });

  it("has no duplicate company names or boards", () => {
    expect(new Set(COMPANIES.map((c) => c.name)).size).toBe(COMPANIES.length);
    expect(new Set(COMPANIES.map((c) => `${c.source}:${c.slug.toLowerCase()}`)).size).toBe(COMPANIES.length);
  });
});

describe("workdayPostedAt", () => {
  const now = Date.parse("2026-10-14T12:00:00Z");
  it("turns Workday's relative dates into dates", () => {
    expect(workdayPostedAt("Posted Today", now)).toBe("2026-10-14T12:00:00.000Z");
    expect(workdayPostedAt("Posted Yesterday", now)).toBe("2026-10-13T12:00:00.000Z");
    expect(workdayPostedAt("Posted 3 Days Ago", now)).toBe("2026-10-11T12:00:00.000Z");
    expect(workdayPostedAt("Posted 30+ Days Ago", now)).toBe("2026-09-14T12:00:00.000Z");
    expect(workdayPostedAt(undefined, now)).toBeNull();
    expect(workdayPostedAt("Posted recently", now)).toBeNull();
  });
});

describe("career-site normalizers", () => {
  it("builds Workday posting links from the tenant, server and site", () => {
    const [job] = normalizeWorkday(co("workday", "pnc/wd5/External"), [
      {
        title: " Financial Analyst ",
        externalPath: "/job/PA---Pittsburgh/Financial-Analyst_R1",
        locationsText: "PA - Pittsburgh",
      },
    ]);
    expect(job).toMatchObject({
      id: "workday:pnc/wd5/External:/job/PA---Pittsburgh/Financial-Analyst_R1",
      title: "Financial Analyst",
      url: "https://pnc.wd5.myworkdayjobs.com/External/job/PA---Pittsburgh/Financial-Analyst_R1",
      location: "PA - Pittsburgh",
      remote: false,
    });
  });

  it("builds Oracle posting links from the host and site", () => {
    const [job] = normalizeOracle(co("oracle", "jpmc.fa.oraclecloud.com/CX_1001"), [
      {
        Id: "123",
        Title: "Credit Analyst",
        PostedDate: "2026-10-01",
        PrimaryLocation: "New York, NY",
        WorkplaceType: "",
      },
    ]);
    expect(job).toMatchObject({
      id: "oracle:jpmc.fa.oraclecloud.com/CX_1001:123",
      url: "https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/123",
      location: "New York, NY",
      postedAt: "2026-10-01",
    });
  });
});

describe("job board normalizers", () => {
  it("reads BambooHR locations and remote flags", () => {
    const jobs = normalizeBambooHR(co("bamboohr", "acme"), {
      result: [
        { id: "1", jobOpeningName: "Accountant", location: { city: "Boston", state: "Massachusetts" } },
        { id: "2", jobOpeningName: "Analyst", location: { city: null, state: null }, isRemote: true },
      ],
    });
    expect(jobs.map((j) => [j.location, j.remote, j.url])).toEqual([
      ["Boston, Massachusetts", false, "https://acme.bamboohr.com/careers/1"],
      ["Remote", true, "https://acme.bamboohr.com/careers/2"],
    ]);
  });

  it("parses Breezy's salary text, skipping hourly pay", () => {
    const [annual, hourly] = normalizeBreezy(co("breezy", "acme"), [
      {
        id: "a",
        name: "Controller",
        url: "https://acme.breezy.hr/p/a",
        salary: "$120,000 - $150,000",
        location: { name: "Denver, CO" },
      },
      {
        id: "b",
        name: "Clerk",
        url: "https://acme.breezy.hr/p/b",
        salary: "$24 – $26 / hour",
        location: { is_remote: true },
      },
    ]);
    expect(annual?.salary).toEqual({ min: 120_000, max: 150_000, currency: "USD" });
    expect(hourly?.salary).toBeNull();
    expect(hourly?.remote).toBe(true);
  });

  it("reads Rippling and Gem postings", () => {
    const [r] = normalizeRippling(co("rippling", "acme"), [
      {
        uuid: "u1",
        name: "Payroll Specialist",
        url: "https://ats.rippling.com/acme/jobs/u1",
        workLocation: { label: "Remote (US)" },
      },
    ]);
    expect(r).toMatchObject({ id: "rippling:acme:u1", remote: true });
    const [g] = normalizeGem(co("gem", "acme"), [
      {
        id: "9",
        title: "Treasury Analyst",
        absolute_url: "https://jobs.gem.com/acme/9",
        content_plain: "Requires 3+ years of treasury experience. $90,000 - $110,000.",
        location: { name: "Austin, TX" },
      },
    ]);
    expect(g).toMatchObject({ minYears: 3, salary: { min: 90_000, max: 110_000, currency: "USD" } });
  });
});

describe("job site normalizers", () => {
  it("credits Himalayas and keeps its annual salary", () => {
    const [job] = normalizeHimalayas([
      {
        guid: "https://himalayas.app/companies/x/jobs/fa",
        title: "Financial Analyst",
        companyName: "X Corp",
        locationRestrictions: ["United States"],
        pubDate: 1_790_000_000,
        minSalary: 80_000,
        maxSalary: 95_000,
        salaryPeriod: "annual",
        currency: "USD",
      },
    ]);
    expect(job).toMatchObject({
      via: "Himalayas",
      url: "https://himalayas.app/companies/x/jobs/fa",
      location: "Remote (United States)",
      remote: true,
      salary: { min: 80_000, max: 95_000, currency: "USD" },
    });
  });

  it("credits Jobicy and decodes its titles", () => {
    const [job] = normalizeJobicy([
      {
        id: 5,
        url: "https://jobicy.com/jobs/5",
        jobTitle: "Revenue Accountant &amp; Analyst",
        companyName: "Hims &#038; Hers",
        jobGeo: "USA",
      },
    ]);
    expect(job).toMatchObject({ via: "Jobicy", company: "Hims & Hers", title: "Revenue Accountant & Analyst" });
  });
});

describe("dedupeJobs", () => {
  const job = (overrides: Partial<Job>): Job => ({
    id: "x",
    company: "Acme",
    title: "Accountant",
    location: "",
    remote: false,
    url: "",
    postedAt: null,
    salary: null,
    minYears: null,
    ...overrides,
  });

  it("drops repeated IDs and job-site copies of an employer's own posting", () => {
    const jobs = [
      job({ id: "greenhouse:acme:1" }),
      job({ id: "greenhouse:acme:1" }),
      job({ id: "himalayas:1", company: "ACME", via: "Himalayas" }),
      job({ id: "himalayas:2", company: "Other Co", via: "Himalayas" }),
    ];
    expect(dedupeJobs(jobs).map((j) => j.id)).toEqual(["greenhouse:acme:1", "himalayas:2"]);
  });
});

describe("searchCompanyJobs", () => {
  const pnc = co("workday", "pnc/wd5/External");
  // Answers Workday searches: one posting per title, or a server error for "Broken".
  const fakeWorkday = vi.fn(async (_url: string, init?: RequestInit) => {
    const { searchText } = JSON.parse(String(init?.body)) as { searchText: string };
    if (searchText === "Broken") return new Response("", { status: 500 });
    return Response.json({ total: 1, jobPostings: [{ title: searchText, externalPath: `/job/${searchText}` }] });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("keeps the titles that worked when another fails", async () => {
    vi.stubGlobal("fetch", fakeWorkday);
    const { jobs, complete } = await searchCompanyJobs(pnc, ["Accountant", "Broken", "Auditor"], 10_000);
    expect(jobs.map((j) => j.title).sort()).toEqual(["Accountant", "Auditor"]);
    expect(complete).toBe(false);
  });

  it("is complete when every title worked", async () => {
    vi.stubGlobal("fetch", fakeWorkday);
    expect((await searchCompanyJobs(pnc, ["Accountant"], 10_000)).complete).toBe(true);
  });

  it("fails only when nothing worked", async () => {
    vi.stubGlobal("fetch", fakeWorkday);
    await expect(searchCompanyJobs(pnc, ["Broken"], 10_000)).rejects.toThrow("workday returned 500");
  });
});
