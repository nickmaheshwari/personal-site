import { describe, expect, it } from "vitest";
import type { Job } from "../shared/types.ts";
import { trackerToCsv, withStatus } from "./tracker.ts";

const job: Job = {
  id: "lever:sierraclub:1",
  company: "Sierra Club",
  title: "Outreach Coordinator",
  location: "Oakland, CA",
  remote: false,
  url: "https://jobs.lever.co/sierraclub/1",
  postedAt: null,
  salary: null,
  minYears: null,
};

describe("withStatus", () => {
  it("records the applied date the first time a job moves past Saved, and keeps it", () => {
    const saved = withStatus({}, job, "saved", new Date("2026-10-01T12:00:00Z"));
    expect(saved[job.id]?.appliedAt).toBeNull();
    const applied = withStatus(saved, job, "applied", new Date("2026-10-03T12:00:00Z"));
    expect(applied[job.id]?.appliedAt).toBe("2026-10-03T12:00:00.000Z");
    const interviewing = withStatus(applied, job, "interviewing", new Date("2026-10-10T12:00:00Z"));
    expect(interviewing[job.id]).toMatchObject({ status: "interviewing", appliedAt: "2026-10-03T12:00:00.000Z" });
  });

  it("removes a job when the status is cleared", () => {
    expect(withStatus(withStatus({}, job, "saved"), job, null)).toEqual({});
  });
});

describe("trackerToCsv", () => {
  it("quotes cells with commas, quotes and newlines", () => {
    const tracker = withStatus({}, job, "applied", new Date("2026-10-03T12:00:00Z"));
    const entry = tracker[job.id];
    if (entry) entry.notes = 'Spoke to "Dana", follow up\nnext week';
    expect(trackerToCsv(tracker).split("\r\n")).toEqual([
      "Company,Title,Location,Status,Applied,Last updated,Notes,URL",
      'Sierra Club,Outreach Coordinator,"Oakland, CA",Applied,2026-10-03,2026-10-03,"Spoke to ""Dana"", follow up\nnext week",https://jobs.lever.co/sierraclub/1',
    ]);
  });
});
