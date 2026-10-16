import { describe, expect, it } from "vitest";
import { compareKeywords, findKeywords, isSoftSkill, topSkills, trackedSkill } from "./keywords.ts";
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

  it("only counts keywords from the job's field and its neighbors", () => {
    const job =
      "Solutions Engineer: run pre-sales demos with Kubernetes. We offer compensation, benefits, wellbeing stipends and fraud training.";
    const { missing } = compareKeywords("", job, "Solutions Engineer");
    expect(missing).toEqual(expect.arrayContaining(["pre-sales", "kubernetes"]));
    for (const noise of ["compensation", "benefits", "wellbeing", "fraud"]) expect(missing).not.toContain(noise);
  });

  it("uses every keyword when the title isn't in the taxonomy", () => {
    expect(compareKeywords("", "Fraud investigations", "Chief Vibes Officer").missing).toContain("fraud");
  });

  it("leaves soft skills out", () => {
    expect(compareKeywords("Python", "Python and strong communication skills")).toEqual({
      matched: ["python"],
      missing: [],
    });
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
- Python, SQL, Tableau, Excel, Docker
- Leadership: led cross-functional collaboration; strong problem-solving and leadership`;

  it("ranks the resume's skills by how often they're mentioned", () => {
    const { hard } = topSkills(resume);
    expect(hard.slice(0, 2)).toEqual(["python", "sql"]);
    expect(hard).toContain("tableau");
    expect(hard.length).toBeLessThanOrEqual(7);
  });

  it("sorts soft skills apart from hard ones", () => {
    const { hard, soft } = topSkills(resume);
    expect(soft[0]).toBe("leadership");
    expect(soft).toEqual(expect.arrayContaining(["collaboration", "problem solving", "cross-functional"]));
    expect(hard).not.toContain("leadership");
    expect(soft).not.toContain("python");
    expect(isSoftSkill("Problem-Solving")).toBe(true);
    expect(isSoftSkill("python")).toBe(false);
  });

  it("caps each list", () => {
    const { hard, soft } = topSkills(resume, 3);
    expect(hard).toHaveLength(3);
    expect(soft).toHaveLength(3);
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

describe("typed skills", () => {
  it("maps a typed skill to the keyword it names, or null", () => {
    expect(trackedSkill("Tableau")).toBe("tableau");
    expect(trackedSkill("NodeJS")).toBe(trackedSkill("node.js"));
    expect(trackedSkill("underwater basket weaving")).toBeNull();
    // A longer phrase that merely contains a keyword isn't that keyword.
    expect(trackedSkill("python scripting")).toBeNull();
  });

  it("matches skills we don't track against job titles only", () => {
    const jobs = [
      {
        id: "a",
        company: "Acme",
        title: "Salesforce Admin",
        location: "",
        remote: false,
        url: "",
        postedAt: null,
        salary: null,
        minYears: null,
        matchedTitle: "",
        skills: [],
      },
      {
        id: "b",
        company: "Acme",
        title: "Analyst",
        location: "",
        remote: false,
        url: "",
        postedAt: null,
        salary: null,
        minYears: null,
        matchedTitle: "",
        skills: [],
      },
    ] satisfies MatchedJob[];
    expect(filterBySkills(jobs, ["Salesforce Admin"]).map((j) => j.id)).toEqual(["a"]);
  });
});
