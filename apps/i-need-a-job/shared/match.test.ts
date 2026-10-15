import { describe, expect, it } from "vitest";
import { locationMatches } from "./locations.ts";
import { type Filters, filterJobs, filterJobsWithStats, type MatchedJob, searchJobs, tokenize } from "./match.ts";
import type { Job } from "./types.ts";

const job = (overrides: Partial<Job>): Job => ({
  id: "x",
  company: "Acme",
  title: "Software Engineer",
  location: "San Francisco, CA",
  remote: false,
  url: "https://example.com",
  postedAt: null,
  salary: null,
  minYears: null,
  ...overrides,
});

const filters = (overrides: Partial<Filters>): Filters => ({
  titles: ["Software Engineer"],
  industries: [],
  broadTitleMatch: false,
  remoteOnly: false,
  location: "",
  yearsOfExperience: null,
  minSalary: null,
  includeUnlistedSalary: true,
  ...overrides,
});

describe("tokenize", () => {
  it("drops seniority and expands abbreviations", () => {
    expect(tokenize("Sr. SRE II")).toEqual(["site", "reliability", "engineer"]);
    expect(tokenize("Staff Software Engineer, Backend")).toEqual(["software", "engineer", "backend"]);
    expect(tokenize("Full Stack Engineer")).toEqual(tokenize("Senior / Staff Fullstack Engineer"));
    expect(tokenize("Front-End Developer")).toEqual(["frontend", "developer"]);
    expect(tokenize("Development Associate")).toEqual(["development", "associate"]);
    expect(tokenize("Senior Technical Lead")).toEqual(["technical", "lead"]);
  });
});

describe("filterJobs", () => {
  it("matches titles regardless of seniority and extra words", () => {
    const jobs = [
      job({ id: "1", title: "Senior Software Engineer, Payments" }),
      job({ id: "2", title: "Software Engineer II" }),
      job({ id: "3", title: "Product Designer" }),
    ];
    expect(filterJobs(jobs, filters({})).map((j) => j.id)).toEqual(["1", "2"]);
  });

  it("records which selected title matched", () => {
    const [m] = filterJobs(
      [job({ title: "DevOps Engineer" })],
      filters({ titles: ["Software Engineer", "DevOps Engineer"] }),
    );
    expect(m?.matchedTitle).toBe("DevOps Engineer");
  });

  it("applies remote, location, experience and salary filters", () => {
    const jobs = [
      job({ id: "remote", remote: true, location: "Remote - US" }),
      job({ id: "nyc", location: "New York, NY", minYears: 8 }),
      job({ id: "paid", salary: { min: 150_000, max: 200_000, currency: "USD" } }),
      job({ id: "underpaid", salary: { min: 90_000, max: 120_000, currency: "USD" } }),
    ];
    expect(filterJobs(jobs, filters({ remoteOnly: true })).map((j) => j.id)).toEqual(["remote"]);
    expect(filterJobs(jobs, filters({ location: "New York City" })).map((j) => j.id)).toEqual(["nyc"]);
    expect(filterJobs(jobs, filters({ yearsOfExperience: 5 })).map((j) => j.id)).not.toContain("nyc");
    expect(filterJobs(jobs, filters({ minSalary: 140_000 })).map((j) => j.id)).toEqual(["remote", "nyc", "paid"]);
    expect(filterJobs(jobs, filters({ minSalary: 140_000, includeUnlistedSalary: false })).map((j) => j.id)).toEqual([
      "paid",
    ]);
  });
});

describe("locationMatches", () => {
  it("matches aliases as whole words", () => {
    expect(locationMatches("San Francisco Bay Area", "Palo Alto, CA")).toBe(true);
    expect(locationMatches("United States (anywhere)", "Austin, TX")).toBe(true);
    expect(locationMatches("United States (anywhere)", "Toronto, Canada")).toBe(false);
    expect(locationMatches("London", "New London, CT")).toBe(true); // known limitation of alias matching
  });
});

describe("industry filter", () => {
  it("keeps only companies in the selected industries", () => {
    const jobs = [job({ id: "nyt", company: "The New York Times" }), job({ id: "stripe", company: "Stripe" })];
    expect(filterJobs(jobs, filters({ industries: ["Media & Entertainment"] })).map((j) => j.id)).toEqual(["nyt"]);
    expect(filterJobs(jobs, filters({ industries: [] })).map((j) => j.id)).toEqual(["nyt", "stripe"]);
  });
});

describe("broad title matching", () => {
  const jobs = [
    job({ id: "a", title: "Wellness Program Coordinator" }),
    job({ id: "b", title: "Health Coordinator" }),
    job({ id: "c", title: "Program Coordinator" }),
  ];
  const titles = ["Health and Wellness Coordinator"];

  it("is strict by default", () => {
    expect(filterJobs(jobs, filters({ titles })).map((j) => j.id)).toEqual([]);
  });

  it("matches the role word plus half the other words when enabled", () => {
    expect(filterJobs(jobs, filters({ titles, broadTitleMatch: true })).map((j) => j.id)).toEqual(["a", "b"]);
  });
});

describe("filterJobsWithStats", () => {
  it("counts title matches and what each filter removed", () => {
    const jobs = [
      job({ id: "1", location: "Austin, TX" }),
      job({ id: "2", location: "Austin, TX", remote: true }),
      job({ id: "3", title: "Chef" }),
    ];
    const { matches, stats } = filterJobsWithStats(jobs, filters({ remoteOnly: true, location: "Seattle" }));
    expect(matches).toEqual([]);
    expect(stats).toEqual({
      titleMatches: 2,
      removed: { industry: 0, remote: 1, location: 1, experience: 0, salary: 0 },
    });
  });

  it("uses a posting's own industry for employers outside the company list", () => {
    const federal = job({ id: "f", company: "Department of Veterans Affairs", industry: "Nonprofit & Government" });
    expect(filterJobs([federal], filters({ industries: ["Nonprofit & Government"] }))).toHaveLength(1);
  });
});

describe("trailing seniority words", () => {
  it("treats them as the role, not as noise", () => {
    const jobs = [
      job({ id: "dev", title: "Development Associate" }),
      job({ id: "sdr", title: "Sales Development Representative" }),
      job({ id: "infra", title: "Software Engineer, Development Infrastructure" }),
    ];
    expect(filterJobs(jobs, filters({ titles: ["Development Associate"] })).map((j) => j.id)).toEqual(["dev"]);
  });
});

describe("broad matching ignores generic words", () => {
  it("doesn't match long titles on words like 'public' and 'program' alone", () => {
    const jobs = [
      job({ id: "tpm", title: "Technical Program Manager, Public Sector" }),
      job({ id: "ohp", title: "Global Occupational Health Program Manager" }),
    ];
    const titles = ["Public Health Program Manager"];
    expect(filterJobs(jobs, filters({ titles, broadTitleMatch: true })).map((j) => j.id)).toEqual(["ohp"]);
  });
});

describe("searchJobs", () => {
  const matched = (overrides: Partial<MatchedJob>): MatchedJob => ({
    ...job({}),
    matchedTitle: "Software Engineer",
    ...overrides,
  });
  const jobs = [
    matched({ id: "stripe", company: "Stripe", title: "Backend Engineer", location: "Seattle, WA" }),
    matched({ id: "bombas", company: "Bombas", title: "Data Analyst", location: "New York, NY" }),
    matched({ id: "nestle", company: "Nestlé Purina", title: "Software Engineer II", location: "Remote" }),
  ];
  const ids = (query: string) => searchJobs(jobs, query).map((j) => j.id);

  it("keeps everything for an empty or blank query", () => {
    expect(ids("")).toEqual(["stripe", "bombas", "nestle"]);
    expect(ids("   ")).toEqual(["stripe", "bombas", "nestle"]);
  });

  it("matches employer, title and location, ignoring case", () => {
    expect(ids("STRIPE")).toEqual(["stripe"]);
    expect(ids("analyst")).toEqual(["bombas"]);
    expect(ids("seattle")).toEqual(["stripe"]);
  });

  it("matches partial words and ignores accents", () => {
    expect(ids("strip")).toEqual(["stripe"]);
    expect(ids("nestle")).toEqual(["nestle"]);
  });

  it("requires every word, across fields and in any order", () => {
    expect(ids("engineer seattle")).toEqual(["stripe"]);
    expect(ids("seattle analyst")).toEqual([]);
  });

  it("matches the employer's industry", () => {
    expect(ids("retail")).toEqual(["bombas"]);
  });
});
