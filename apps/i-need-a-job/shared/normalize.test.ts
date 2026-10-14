import { describe, expect, it } from "vitest";
import type { Company } from "./companies.ts";
import { extractMinYears, extractSalary, htmlToText, normalizeAshby, normalizeGreenhouse } from "./normalize.ts";

const acme: Company = { name: "Acme", source: "greenhouse", slug: "acme" };

describe("extractSalary", () => {
  it("parses common range formats", () => {
    expect(extractSalary("Pay: $150,000 - $200,000 per year")).toEqual({ min: 150_000, max: 200_000, currency: "USD" });
    expect(extractSalary("$185K–$240K + equity")).toEqual({ min: 185_000, max: 240_000, currency: "USD" });
    expect(extractSalary("$120,000 USD to $160,000 USD")).toEqual({ min: 120_000, max: 160_000, currency: "USD" });
  });

  it("ignores hourly rates and text without a range", () => {
    expect(extractSalary("$45 - $60 per hour")).toBeNull();
    expect(extractSalary("Competitive salary")).toBeNull();
  });
});

describe("extractMinYears", () => {
  it("returns the smallest stated requirement", () => {
    expect(
      extractMinYears("5+ years of professional software engineering experience. 3 years of experience with Go."),
    ).toBe(3);
    expect(extractMinYears("3-5 years experience")).toBe(3);
    expect(extractMinYears("Founded 10 years ago")).toBeNull();
  });
});

describe("normalizers", () => {
  it("decodes Greenhouse's escaped HTML before extracting", () => {
    expect(htmlToText("&lt;p&gt;Hello &amp;amp; welcome&lt;/p&gt;")).toBe("Hello & welcome");
    expect(extractSalary(htmlToText("Pay Range $102,000 &amp;mdash; $120,000 USD"))).toEqual({
      min: 102_000,
      max: 120_000,
      currency: "USD",
    });
    const [job] = normalizeGreenhouse(acme, {
      jobs: [
        {
          id: 1,
          title: " Backend Engineer ",
          absolute_url: "https://boards.greenhouse.io/acme/jobs/1",
          location: { name: "Remote - US" },
          content: "&lt;p&gt;4+ years of backend experience. $140,000 - $180,000&lt;/p&gt;",
        },
      ],
    });
    expect(job).toMatchObject({
      title: "Backend Engineer",
      remote: true,
      minYears: 4,
      salary: { min: 140_000, max: 180_000, currency: "USD" },
    });
  });

  it("treats Ashby hybrid roles as not remote", () => {
    const [job] = normalizeAshby(
      { ...acme, source: "ashby" },
      {
        jobs: [
          { id: "a", title: "SRE", jobUrl: "https://x", location: "NYC", isRemote: true, workplaceType: "Hybrid" },
        ],
      },
    );
    expect(job?.remote).toBe(false);
  });
});
