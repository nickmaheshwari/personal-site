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

describe("suggestTitles outside tech", () => {
  const fits = (text: string) => Object.fromEntries(suggestTitles(text).map((t) => [t.title, t.fit]));

  it("recognizes a nurse", () => {
    const f = fits(`Experience
Registered Nurse, Mercy Hospital, Jan 2019 - Present
Provided bedside patient care for 6 patients per shift; medication administration, vital signs, charting in Epic.
BLS and ACLS certified. Triage in a busy emergency department.`);
    expect(f["Registered Nurse"]).toBe("close");
    expect(f["Care Coordinator"]).toBe("related");
    expect(f["Software Engineer"]).toBeUndefined();
  });

  it("recognizes a line cook moving toward management", () => {
    const f = fits(`Work Experience
Line Cook, Blue Plate Bistro 2020 - Present
Prepped and cooked for a 120-seat restaurant; kept the kitchen ServSafe compliant; trained new hires.
Barista, Corner Coffee 2018 - 2020: point of sale, guest service`);
    expect(f.Chef).toBe("close");
    expect(f.Server).toBe("close");
    expect(f["Restaurant Manager"]).toBe("related");
  });

  it("recognizes a journalist", () => {
    const f = fits(`Experience
Staff Writer, The Daily Herald (2017 - 2024)
Reported and wrote 300+ stories in AP style; pitched headlines; worked with editors in a fast-paced newsroom.`);
    expect(f.Reporter).toBe("close");
    expect(f.Editor).toBe("related");
  });
});
