import { describe, expect, it } from "vitest";
import { compareKeywords } from "./keywords.ts";

describe("compareKeywords", () => {
  it("splits the posting's keywords into ones the resume has and ones it lacks", () => {
    const resume = "Ran wellness workshops and health fairs; recruited volunteers; tracked grants.";
    const job =
      "Health Educator: plan health fairs, teach nutrition and physical activity, use motivational interviewing, recruit volunteers.";
    const { matched, missing } = compareKeywords(resume, job);
    expect(matched).toEqual(expect.arrayContaining(["health fairs", "volunteers"]));
    expect(missing).toEqual(expect.arrayContaining(["nutrition", "physical activity", "motivational interviewing"]));
    expect(matched).not.toContain("nutrition");
  });

  it("returns nothing when the posting has no known keywords", () => {
    expect(compareKeywords("anything", "Join our friendly team!")).toEqual({ matched: [], missing: [] });
  });
});

describe("spelling variants", () => {
  it("counts them as one keyword, matched by any spelling", () => {
    expect(compareKeywords("Ten years in the non-profit sector", "Nonprofit experience required")).toEqual({
      matched: ["nonprofit"],
      missing: [],
    });
  });
});
