import { describe, expect, it } from "vitest";
import { locationMatches } from "./locations.ts";
import { type Filters, filterJobs, tokenize } from "./match.ts";
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
