import { describe, expect, it } from "vitest";
import { estimateYearsOfExperience, suggestTitles } from "./resume.ts";

const SWE_RESUME = `
Jane Doe
San Diego, CA

Experience
Senior Software Engineer, Acme Corp            Jan 2021 – Present
- Built Go and TypeScript microservices on AWS with Kubernetes and Terraform
- Owned CI/CD pipelines in GitHub Actions; on-call for production incidents
Software Engineer, Initech                     06/2018 - 12/2020
- React frontend, Node.js REST APIs, PostgreSQL, Redis, Docker

Education
B.S. Computer Science, State University        2014 - 2018

Skills
Python, Java, TypeScript, React, Docker, Kubernetes, AWS, SQL
`;

describe("suggestTitles", () => {
  const titles = suggestTitles(SWE_RESUME);
  const fit = (title: string) => titles.find((t) => t.title === title)?.fit;

  it("marks titles the resume mentions as close", () => {
    expect(fit("Software Engineer")).toBe("close");
  });

  it("suggests the rest of the strongest families as related", () => {
    expect(fit("Software Architect")).toBe("related");
    expect(fit("Backend Engineer")).toBe("related");
    expect(fit("DevOps Engineer")).toBe("related");
  });

  it("offers neighboring families as stretch", () => {
    expect(titles.some((t) => t.fit === "stretch")).toBe(true);
    expect(fit("Engineering Manager")).toBe("stretch");
  });

  it("does not suggest unrelated families", () => {
    expect(fit("Account Executive")).toBeUndefined();
    expect(fit("Accountant")).toBeUndefined();
  });

  it("matches short acronyms case-sensitively", () => {
    expect(suggestTitles("Meeting at 5 pm").some((t) => t.title === "Product Manager")).toBe(false);
    expect(suggestTitles("SRE at Google").find((t) => t.title === "Site Reliability Engineer")?.fit).toBe("close");
  });

  it("returns nothing for text with no signal", () => {
    expect(suggestTitles("Lorem ipsum dolor sit amet")).toEqual([]);
  });
});

describe("estimateYearsOfExperience", () => {
  const now = new Date(2026, 9, 1); // Oct 2026

  it("sums work ranges and ignores education", () => {
    // Jun 2018 → Oct 2026 contiguous ≈ 8.3 years; the 2014-2018 degree is skipped.
    expect(estimateYearsOfExperience(SWE_RESUME, now)).toBe(8);
  });

  it("counts overlapping jobs once", () => {
    const text = "Experience\nJob A Jan 2020 - Dec 2022\nJob B (part-time) Jun 2021 - Jun 2022";
    expect(estimateYearsOfExperience(text, now)).toBe(3);
  });

  it("returns null when there are no ranges", () => {
    expect(estimateYearsOfExperience("Experience\nSoftware Engineer at Acme", now)).toBeNull();
  });
});
