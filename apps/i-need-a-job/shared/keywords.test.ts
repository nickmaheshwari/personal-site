import { describe, expect, it } from "vitest";
import { compareKeywords, findKeywords, topSkills } from "./keywords.ts";
import { filterBySkills, type MatchedJob } from "./match.ts";

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

describe("findKeywords", () => {
  it("finds whole-word skills, including run-together spellings", () => {
    const found = findKeywords("Built services in Python and Kafka; staffed the HelpDesk. Javascripty is not a word.");
    expect(found).toEqual(expect.arrayContaining(["python", "kafka", "help desk"]));
    expect(found).not.toContain("javascript");
  });
});

describe("topSkills", () => {
  const resume = `
Data Analyst
- Wrote SQL and Python to automate reports; Python notebooks for forecasting
- Built Tableau dashboards from SQL queries
- Python, SQL, Tableau, Excel, Docker`;

  it("ranks the resume's skills by how often they're mentioned", () => {
    const skills = topSkills(resume);
    expect(skills.slice(0, 2)).toEqual(["python", "sql"]);
    expect(skills).toContain("tableau");
    expect(skills.length).toBeLessThanOrEqual(7);
  });

  it("caps the list", () => {
    expect(topSkills(resume, 3)).toHaveLength(3);
  });
});

describe("filterBySkills", () => {
  const job = (id: string, title: string, skills?: string[]): MatchedJob => ({
    id,
    company: "Acme",
    title,
    location: "",
    remote: false,
    url: "",
    postedAt: null,
    salary: null,
    minYears: null,
    matchedTitle: title,
    ...(skills ? { skills } : {}),
  });
  const jobs = [job("described", "Data Analyst", ["python", "tableau"]), job("title-only", "SQL Developer")];
  const ids = (skills: string[]) => filterBySkills(jobs, skills).map((j) => j.id);

  it("keeps jobs that mention every selected skill, in the description or title", () => {
    expect(ids([])).toEqual(["described", "title-only"]);
    expect(ids(["python"])).toEqual(["described"]);
    expect(ids(["sql"])).toEqual(["title-only"]);
    expect(ids(["python", "sql"])).toEqual([]);
  });
});
